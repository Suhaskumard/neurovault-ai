# NeuroVault AI

NeuroVault AI is a local AI-powered document and image retrieval chat app.
It combines a FastAPI backend with a React + Vite frontend to upload files, index content with FAISS, and answer user questions from retrieved document context.

## Features

- Upload documents and images for indexing
- Supports PDF, TXT, DOCX, PNG, JPG, WEBP, BMP, and TIFF
- Local FAISS-based vector search for retrieval
- Chat interface with source-aware answers
- FastAPI backend with file upload, health, reindexing, and chat endpoints
- Frontend built with React, Vite, Tailwind CSS

## Repository Structure

- `backend/`
  - `main.py` — FastAPI app and endpoint definitions
  - `chat_memory.py` — chat session memory handling
  - `document_loader.py` — supported file loaders and parsing logic
  - `embeddings.py` — embedding utilities
  - `image_pipeline.py` — image preprocessing and OCR support
  - `ocr_module.py` — OCR logic for images
  - `rag_pipeline.py` — retrieval-augmented generation pipeline
  - `text_splitter.py` — text chunking utility
  - `vector_store.py` — FAISS vector store management
  - `requirements.txt` — Python dependencies
- `frontend/`
  - `src/` — React application source files
  - `index.html` — app entry HTML
  - `package.json` — frontend dependencies and scripts
  - `vite.config.js` — Vite configuration
- `uploads/` — uploaded files stored at runtime
- `vector_db/` — FAISS database files stored at runtime

## Setup

### Backend

1. Open a terminal and navigate to `backend/`
2. Create and activate a virtual environment:

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
```

3. Install dependencies:

```powershell
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
```

4. Start the backend server:

```powershell
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### Frontend

1. Open a second terminal and navigate to `frontend/`
2. Install npm dependencies:

```powershell
npm install
```

3. Start the frontend development server:

```powershell
npm run dev
```

4. Open the app in your browser at `http://localhost:5173`

## Usage

1. Upload supported documents or images from the web UI.
2. Wait for files to be indexed.
3. Enter a question in the chat interface.
4. The app will return answers with retrieved source information.

## Environment Notes

- The backend allows CORS from `http://localhost:5173` and `http://127.0.0.1:5173` by default.
- You can override allowed frontend origins using `FRONTEND_ORIGIN`.
- Uploaded files are stored in `uploads/` and vector data is stored in `vector_db/`.

## Troubleshooting

- If the frontend cannot reach the backend, verify `uvicorn` is running on port `8000`.
- If Ollama is not available, the app will still operate in fallback mode for retrieval.
- Make sure `torch` installs successfully for your platform. If needed, install a platform-specific CPU or GPU wheel from the official PyTorch site.

## License

This project does not include a license file by default. Add one if you want to share or publish the code.
