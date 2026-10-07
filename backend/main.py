import os
import uuid
import json
import threading
import time
import queue
from pathlib import Path
from typing import Optional
from datetime import timedelta

# import whisper

from faster_whisper import WhisperModel
from fastapi import FastAPI, UploadFile, File, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, PlainTextResponse
import aiofiles

# ─── App & Config ────────────────────────────────────────────────────────────
app = FastAPI(title="Offline Video Transcriptor API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

UPLOAD_DIR = Path("uploads")
UPLOAD_DIR.mkdir(exist_ok=True)

# ─── In-memory job store ──────────────────────────────────────────────────────
# job = {
#   "id": str,
#   "filename": str,
#   "file_path": str,
#   "status": "queued" | "processing" | "done" | "error",
#   "progress": 0-100,
#   "model": str,
#   "transcript": None | {"text": str, "segments": list},
#   "error": None | str,
#   "created_at": float,
# }
JOBS_FILE = Path("jobs.json")
jobs: dict[str, dict] = {}
job_queue: queue.Queue = queue.Queue()

def save_jobs():
    """Save all jobs to a JSON file."""
    try:
        # Don't save large transcripts in the main index if they are already done, 
        # but for this simple app we'll just save everything.
        with open(JOBS_FILE, "w", encoding="utf-8") as f:
            json.dump(jobs, f, indent=2)
    except:
        pass

def load_jobs():
    """Load jobs from JSON file."""
    global jobs
    if JOBS_FILE.exists():
        try:
            with open(JOBS_FILE, "r", encoding="utf-8") as f:
                jobs = json.load(f)
            # Re-enqueue any jobs that were queued or processing when shut down
            for jid, job in jobs.items():
                if job["status"] in ("queued", "processing"):
                    job["status"] = "uploaded" # reset to uploaded so they can be re-started
        except:
            jobs = {}

load_jobs()

# ─── Whisper model cache ──────────────────────────────────────────────────────
loaded_models: dict[str, WhisperModel] = {}
model_lock = threading.Lock()

def get_model(model_name: str) -> WhisperModel:
    with model_lock:
        if model_name not in loaded_models:
            print(f"[Whisper] Loading model: {model_name} (faster-whisper)...")
            # compute_type="int8" is the fastest for CPU and very accurate.
            # compute_type="float16" is fastest for GPU.
            try:
                # auto-detect GPU
                import torch
                device = "cuda" if torch.cuda.is_available() else "cpu"
                compute_type = "float16" if device == "cuda" else "int8"
                
                loaded_models[model_name] = WhisperModel(
                    model_name, 
                    device=device, 
                    compute_type=compute_type,
                    download_root="models"
                )
            except Exception as e:
                print(f"[Whisper] Opt init failed, falling back: {e}")
                loaded_models[model_name] = WhisperModel(model_name, device="cpu", compute_type="int8")
            print(f"[Whisper] Model '{model_name}' loaded on {loaded_models[model_name].model.device}.")
        return loaded_models[model_name]


# ─── Helpers ──────────────────────────────────────────────────────────────────
def format_timestamp(seconds: float) -> str:
    """Convert seconds to SRT timestamp HH:MM:SS,mmm"""
    td = timedelta(seconds=seconds)
    total_seconds = int(td.total_seconds())
    millis = int((td.total_seconds() - total_seconds) * 1000)
    hours = total_seconds // 3600
    minutes = (total_seconds % 3600) // 60
    secs = total_seconds % 60
    return f"{hours:02d}:{minutes:02d}:{secs:02d},{millis:03d}"


def format_vtt_timestamp(seconds: float) -> str:
    """Convert seconds to VTT timestamp HH:MM:SS.mmm"""
    td = timedelta(seconds=seconds)
    total_seconds = int(td.total_seconds())
    millis = int((td.total_seconds() - total_seconds) * 1000)
    hours = total_seconds // 3600
    minutes = (total_seconds % 3600) // 60
    secs = total_seconds % 60
    return f"{hours:02d}:{minutes:02d}:{secs:02d}.{millis:03d}"


def segments_to_srt(segments: list) -> str:
    lines = []
    for i, seg in enumerate(segments, 1):
        start = format_timestamp(seg["start"])
        end = format_timestamp(seg["end"])
        text = seg["text"].strip()
        lines.append(f"{i}\n{start} --> {end}\n{text}\n")
    return "\n".join(lines)


def segments_to_vtt(segments: list) -> str:
    lines = ["WEBVTT\n"]
    for i, seg in enumerate(segments, 1):
        start = format_vtt_timestamp(seg["start"])
        end = format_vtt_timestamp(seg["end"])
        text = seg["text"].strip()
        lines.append(f"{i}\n{start} --> {end}\n{text}\n")
    return "\n".join(lines)


# ─── Background worker ───────────────────────────────────────────────────────
def worker():
    """Single background thread that processes jobs one by one."""
    while True:
        job_id = job_queue.get()
        if job_id is None:
            break

        job = jobs.get(job_id)
        if not job:
            job_queue.task_done()
            continue

        try:
            job["status"] = "processing"
            job["progress"] = 0

            model_name = job.get("model", "base")
            model = get_model(model_name)

            file_path = job["file_path"]
            if not os.path.exists(file_path):
                raise FileNotFoundError(f"File not found: {file_path}")

            job["progress"] = 5  # processing audio
            
            # OPTIMIZATION: Extract audio to 16kHz mono WAV using ffmpeg first. 
            # This is faster than letting Whisper handle various video containers directly.
            audio_path = f"{file_path}.wav"
            import subprocess
            try:
                # -y overwrite, -i input, -ar 16000 frequency, -ac 1 mono
                subprocess.run([
                    "ffmpeg", "-y", "-i", file_path, 
                    "-ar", "16000", "-ac", "1", "-vn", audio_path
                ], check=True, capture_output=True)
                process_path = audio_path
            except:
                process_path = file_path # fallback

            job["progress"] = 10

            # Transcribe with VAD filter (Voice Activity Detection) 
            # skips silence and background noise — MASSIVE speedup for many videos.
            segments, info = model.transcribe(
                process_path, 
                beam_size=5,
                vad_filter=True,
                vad_parameters=dict(min_silence_duration_ms=500)
            )
            
            total_duration = info.duration
            transcribed_segments = []
            transcribed_text = []

            for segment in segments:
                # Calculate progress based on end-time of segment
                if total_duration > 0:
                    pct = min(int((segment.end / total_duration) * 85) + 10, 95)
                    job["progress"] = pct
                
                seg_dict = {
                    "start": segment.start,
                    "end": segment.end,
                    "text": segment.text
                }
                transcribed_segments.append(seg_dict)
                transcribed_text.append(segment.text)

            job["progress"] = 95
            full_text = "".join(transcribed_text).strip()

            job["transcript"] = {
                "text": full_text,
                "segments": transcribed_segments,
                "language": info.language,
                "srt": segments_to_srt(transcribed_segments),
                "vtt": segments_to_vtt(transcribed_segments),
            }

            job["progress"] = 100
            job["status"] = "done"
            save_jobs() # Persistence
            print(f"[Worker] Job {job_id} done.")

        except Exception as e:
            job["status"] = "error"
            job["error"] = str(e)
            job["progress"] = 0
            save_jobs() # Persistence
            print(f"[Worker] Job {job_id} ERROR: {e}")

        finally:
            # Cleanup temporary audio file
            if 'audio_path' in locals() and os.path.exists(audio_path):
                try: os.remove(audio_path)
                except: pass
            job_queue.task_done()




# Start the single background worker thread
worker_thread = threading.Thread(target=worker, daemon=True)
worker_thread.start()


# ─── API Routes ───────────────────────────────────────────────────────────────

@app.get("/")
def root():
    return {"message": "Offline Video Transcriptor API is running."}


@app.post("/upload")
async def upload_file(file: UploadFile = File(...)):
    """Upload a video/audio file. Returns a job_id."""
    job_id = str(uuid.uuid4())
    ext = Path(file.filename).suffix or ".mp4"
    safe_name = f"{job_id}{ext}"
    file_path = str(UPLOAD_DIR / safe_name)

    async with aiofiles.open(file_path, "wb") as f:
        content = await file.read()
        await f.write(content)

    jobs[job_id] = {
        "id": job_id,
        "filename": file.filename,
        "file_path": file_path,
        "status": "uploaded",
        "progress": 0,
        "model": "base",
        "transcript": None,
        "error": None,
        "created_at": time.time(),
    }

    return {"job_id": job_id, "filename": file.filename, "status": "uploaded"}


@app.post("/transcribe/{job_id}")
def start_transcription(job_id: str, model: str = "base"):
    """Enqueue a job for transcription."""
    job = jobs.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    if job["status"] in ("queued", "processing"):
        return {"message": "Already queued or processing", "job_id": job_id}

    job["status"] = "queued"
    job["progress"] = 0
    job["model"] = model
    job["error"] = None
    job["transcript"] = None
    job_queue.put(job_id)
    save_jobs() # Persistence

    return {"job_id": job_id, "status": "queued", "model": model}


@app.get("/status/{job_id}")
def get_status(job_id: str):
    """Get status + progress of a job."""
    job = jobs.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return {
        "job_id": job_id,
        "filename": job["filename"],
        "status": job["status"],
        "progress": job["progress"],
        "model": job["model"],
        "language": job["transcript"]["language"] if job["transcript"] else None,
        "error": job["error"],
    }


@app.get("/status")
def get_all_statuses():
    """Get status of all jobs."""
    return [
        {
            "job_id": j["id"],
            "filename": j["filename"],
            "status": j["status"],
            "progress": j["progress"],
            "model": j["model"],
            "language": j["transcript"]["language"] if j["transcript"] else None,
            "error": j["error"],
        }
        for j in sorted(jobs.values(), key=lambda x: x["created_at"])
    ]


@app.get("/transcript/{job_id}")
def get_transcript(job_id: str, fmt: str = "text"):
    """Get transcript for a job. fmt = text | srt | vtt"""
    job = jobs.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    if job["status"] != "done":
        raise HTTPException(status_code=400, detail=f"Job not done yet (status: {job['status']})")

    t = job["transcript"]
    if fmt == "srt":
        return PlainTextResponse(content=t["srt"], media_type="text/plain")
    elif fmt == "vtt":
        return PlainTextResponse(content=t["vtt"], media_type="text/plain")
    else:
        return {
            "job_id": job_id,
            "filename": job["filename"],
            "language": t["language"],
            "text": t["text"],
            "segments": t["segments"],
        }


@app.get("/transcripts/all")
def get_all_transcripts():
    """
    Merge all completed transcripts into one text file.
    Returns plain text with separators between videos.
    """
    done_jobs = [j for j in sorted(jobs.values(), key=lambda x: x["created_at"]) if j["status"] == "done"]
    if not done_jobs:
        raise HTTPException(status_code=404, detail="No completed transcriptions found")

    parts = []
    for j in done_jobs:
        t = j["transcript"]
        separator = "=" * 60
        parts.append(
            f"{separator}\n"
            f"VIDEO: {j['filename']}\n"
            f"LANGUAGE: {t['language']}\n"
            f"{separator}\n\n"
            f"{t['text']}\n"
        )

    merged = "\n\n".join(parts)
    return PlainTextResponse(content=merged, media_type="text/plain")


@app.delete("/job/{job_id}")
def delete_job(job_id: str):
    """Delete a job and its uploaded file."""
    job = jobs.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    if job["status"] == "processing":
        raise HTTPException(status_code=400, detail="Cannot delete a job that is currently processing")

    # Remove file
    try:
        if os.path.exists(job["file_path"]):
            os.remove(job["file_path"])
    except Exception:
        pass

    del jobs[job_id]
    save_jobs() # Persistence
    return {"message": "Job deleted", "job_id": job_id}


@app.delete("/jobs/all")
def clear_all_jobs():
    """Clear all jobs that are not currently processing."""
    removed = []
    for job_id in list(jobs.keys()):
        job = jobs[job_id]
        if job["status"] != "processing":
            try:
                if os.path.exists(job["file_path"]):
                    os.remove(job["file_path"])
            except Exception:
                pass
            del jobs[job_id]
            removed.append(job_id)
    save_jobs() # Persistence
    return {"removed": removed}
