<div align="center">

# 🎬 WhisperFlow — Offline Video Transcriptor

<p align="center">
  <strong>All transcription happens **locally on your machine** — no data is sent to any cloud service.</strong>
</p>

<p align="center">
  <a href="#-overview">Overview</a> •
  <a href="#-key-features">Key Features</a> •
  <a href="#-tech-stack--architecture">Tech Stack</a> •
  <a href="#-project-structure">Project Structure</a> •
  <a href="#-getting-started">Getting Started</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Category-AI%20Audio%20%26%20Video%20Intelligence-7c3aed?style=for-the-badge" alt="Category: AI Audio & Video Intelligence" />
  <img src="https://img.shields.io/badge/Tech%20Stack-Next.js%20%7C%20Python%20%7C%20faster--whisper-10b981?style=for-the-badge" alt="Tech Stack: Next.js | Python | faster-whisper" />
  <img src="https://img.shields.io/badge/Status-Production%20Ready-8b5cf6?style=for-the-badge" alt="Status: Production Ready" />
  <img src="https://img.shields.io/badge/License-MIT-f59e0b?style=for-the-badge" alt="License: MIT" />
</p>

</div>

---

## ✨ Key Features

- 🎥 **Upload multiple videos** — supports MP4, MKV, MOV, AVI, and more
- ⚡ **Fast transcription** using `faster-whisper` with VAD (Voice Activity Detection)
- 🤖 **Auto GPU detection** — uses CUDA if available, falls back to CPU
- 📊 **Real-time progress tracking** per video
- 🌍 **Auto language detection**
- 📄 **Export transcripts** in plain text, `.srt`, or `.vtt` subtitle formats
- 📦 **Merge all transcripts** into a single file
- 🗑️ **Delete jobs** individually or all at once
- 💾 **Job persistence** — transcriptions are saved across restarts

---

## 🛠️ Tech Stack & Architecture

| Layer    | Technology                          |
|----------|-------------------------------------|
| Frontend | Next.js 14, React 18, TypeScript    |
| Backend  | Python, FastAPI, Uvicorn            |
| AI Model | faster-whisper (OpenAI Whisper)     |
| Audio    | FFmpeg (audio extraction)           |
| GPU      | PyTorch (CUDA auto-detected)        |

---

## 📁 Project Structure

```
videogen/
├── backend/
│   ├── main.py            # FastAPI app — all API routes & transcription logic
│   ├── requirements.txt   # Python dependencies
│   ├── models/            # Whisper model weights (auto-downloaded)
│   └── uploads/           # Uploaded video files (runtime)
├── frontend/
│   ├── app/               # Next.js App Router pages
│   ├── components/        # React components
│   ├── lib/               # Utilities / API client
│   └── package.json
├── start.bat              # One-click launcher (Windows)
└── README.md
```

---

## 🚀 Getting Started

### Prerequisites

- **Python 3.10+**
- **Node.js 18+**
- **FFmpeg** installed and available in your system PATH
  - Windows: [ffmpeg.org/download](https://ffmpeg.org/download.html) or via `winget install ffmpeg`
- *(Optional)* NVIDIA GPU with CUDA for faster transcription

---

### 1. Clone the repository

```bash
git clone https://github.com/nikhilcodeworks/videogen.git
cd videogen
```

---

### 2. Backend Setup

```bash
cd backend

# Create and activate a virtual environment
python -m venv venv
venv\Scripts\activate       # Windows
# source venv/bin/activate  # macOS/Linux

# Install dependencies
pip install -r requirements.txt

# Start the backend server
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

The API will be available at: **http://localhost:8000**

---

### 3. Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Start the development server
npm run dev
```

The app will be available at: **http://localhost:3000**

---

### ⚡ One-Click Launch (Windows)

Simply double-click **`start.bat`** in the root folder to launch both the backend and frontend simultaneously. The app will open in your browser automatically.

---

## 🎯 API Endpoints

| Method   | Endpoint               | Description                              |
|----------|------------------------|------------------------------------------|
| `POST`   | `/upload`              | Upload a video/audio file                |
| `POST`   | `/transcribe/{job_id}` | Start transcription (choose model)       |
| `GET`    | `/status/{job_id}`     | Get status & progress of a job           |
| `GET`    | `/status`              | Get status of all jobs                   |
| `GET`    | `/transcript/{job_id}` | Get transcript (`?fmt=text\|srt\|vtt`)  |
| `GET`    | `/transcripts/all`     | Merge & download all transcripts         |
| `DELETE` | `/job/{job_id}`        | Delete a specific job                    |
| `DELETE` | `/jobs/all`            | Clear all non-processing jobs            |

---

## 🤖 Whisper Model Sizes

You can choose the model when starting transcription. Larger models are more accurate but slower.

| Model    | Size   | Speed     | Accuracy  |
|----------|--------|-----------|-----------|
| `tiny`   | ~75MB  | Fastest   | Basic     |
| `base`   | ~145MB | Fast      | Good ✅    |
| `small`  | ~465MB | Moderate  | Better    |
| `medium` | ~1.5GB | Slow      | Great     |
| `large`  | ~2.9GB | Slowest   | Best      |

> Default model is `base`. Models are downloaded automatically on first use into the `backend/models/` folder.

---

## 📜 License

This project is open source and available under the [MIT License](LICENSE).

---

## 🙌 Acknowledgements

- [faster-whisper](https://github.com/SYSTRAN/faster-whisper) — CTranslate2-based Whisper implementation
- [OpenAI Whisper](https://github.com/openai/whisper) — Original speech recognition model
- [FastAPI](https://fastapi.tiangolo.com/) — Modern Python web framework
- [Next.js](https://nextjs.org/) — React framework for the frontend
