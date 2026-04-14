# NeuroVault AI

NeuroVault AI is a full-stack multimodal RAG app with a ChatGPT-like interface, document/image ingestion, hybrid retrieval, Ollama-backed answers, and source attribution.

## Stack

- Frontend: React, Vite, Tailwind CSS, Axios
- Backend: FastAPI, Uvicorn
- RAG: SentenceTransformers `all-MiniLM-L6-v2`, FAISS, BM25
- LLM: Ollama with `llama3` by default
- Images: pytesseract OCR with BLIP caption fallback

## Backend Setup

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

Install and run Ollama separately:

```bash
ollama pull llama3
ollama serve
```

Optional environment variables:

```bash
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=llama3
FRONTEND_ORIGIN=http://localhost:5173
```

For OCR, install the Tesseract binary and ensure it is on `PATH`. If unavailable, image ingestion falls back to BLIP captioning.

## Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

Optional `.env`:

```bash
VITE_API_BASE_URL=http://localhost:8000
```

## Run Commands

Backend:

```bash
cd backend
uvicorn main:app --reload --port 8000
```

Frontend:

```bash
cd frontend
npm run dev
```

Open `http://localhost:5173`.

## API

- `GET /health` returns service status and index count.
- `POST /upload` accepts one or more files under `files`.
- `POST /chat` accepts `{ "query": "...", "top_k": 3 }` and returns an answer plus sources.
- `POST /chat/stream` streams answer tokens and ends with source metadata.
- `POST /clear` resets uploads, vector index, BM25 corpus, and chat memory.

## Deployment

### Backend on Render or Railway

1. Create a Python service from this repository.
2. Set the root directory to `backend`.
3. Build command: `pip install -r requirements.txt`
4. Start command: `uvicorn main:app --host 0.0.0.0 --port $PORT`
5. Configure `OLLAMA_BASE_URL`, `OLLAMA_MODEL`, and `FRONTEND_ORIGIN`.

Use a hosted Ollama-compatible runtime or a Railway/VM service that can run Ollama.

### Frontend on Vercel

1. Set the root directory to `frontend`.
2. Build command: `npm run build`
3. Output directory: `dist`
4. Add `VITE_API_BASE_URL` pointing to the deployed backend.

## Notes

- Uploaded content is stored locally in `uploads/`.
- FAISS data and metadata persist in `vector_db/`.
- Top-k is clamped to `3-5` to keep context focused and latency reasonable.
- Image failures are converted into safe fallback text instead of request crashes.
