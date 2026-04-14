import os
import shutil
from pathlib import Path

import requests
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from chat_memory import ChatMemory
from document_loader import is_supported_file, load_file
from rag_pipeline import RAGPipeline
from text_splitter import split_text
from vector_store import HybridVectorStore, StoredChunk


BASE_DIR = Path(__file__).resolve().parent.parent
UPLOAD_DIR = BASE_DIR / "uploads"
VECTOR_DB_DIR = BASE_DIR / "vector_db"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
VECTOR_DB_DIR.mkdir(parents=True, exist_ok=True)

frontend_origin = os.getenv("FRONTEND_ORIGIN", "http://localhost:5173,http://127.0.0.1:5173")
allowed_origins = [origin.strip() for origin in frontend_origin.split(",") if origin.strip()]

app = FastAPI(title="NeuroVault AI", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

store = HybridVectorStore(db_dir=str(VECTOR_DB_DIR))
memory = ChatMemory()
rag = RAGPipeline(store=store, memory=memory)


class ChatRequest(BaseModel):
    query: str = Field(..., min_length=1)
    top_k: int = Field(3, ge=3, le=5)


@app.get("/health")
def health() -> dict:
    ollama_available = False
    try:
        response = requests.get(f"{rag.ollama_base_url}/api/tags", timeout=2)
        ollama_available = response.ok
    except Exception:
        ollama_available = False

    return {
        "status": "ok",
        "indexed_chunks": store.count(),
        "uploaded_files": len(list(UPLOAD_DIR.glob("*"))),
        "ollama_available": ollama_available,
    }


@app.post("/upload")
async def upload(files: list[UploadFile] = File(...)) -> dict:
    if not files:
        raise HTTPException(status_code=400, detail="No files uploaded.")

    uploaded = []
    total_chunks = 0

    for file in files:
        if not file.filename or not is_supported_file(file.filename):
            uploaded.append({"file": file.filename, "status": "skipped", "chunks": 0})
            continue

        safe_name = Path(file.filename).name
        target_path = UPLOAD_DIR / safe_name
        with target_path.open("wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        text = load_file(str(target_path))
        chunks = split_text(text, safe_name, chunk_size=400, overlap=50)
        stored_chunks = [StoredChunk(text=chunk.text, file_name=chunk.file_name) for chunk in chunks]
        added = store.add_chunks(stored_chunks)
        total_chunks += added
        uploaded.append({"file": safe_name, "status": "indexed" if added else "empty", "chunks": added})

    return {"uploaded": uploaded, "total_chunks": total_chunks, "indexed_chunks": store.count()}


@app.post("/chat")
def chat(request: ChatRequest) -> dict:
    return rag.answer(request.query, top_k=request.top_k)


@app.post("/chat/stream")
def chat_stream(request: ChatRequest) -> StreamingResponse:
    return StreamingResponse(
        rag.stream_answer(request.query, top_k=request.top_k),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@app.post("/clear")
def clear() -> dict:
    store.clear()
    memory.clear()
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    return {"status": "cleared", "uploaded_files_preserved": len(list(UPLOAD_DIR.glob("*")))}


@app.post("/reindex")
def reindex() -> dict:
    store.clear()
    memory.clear()

    uploaded = []
    total_chunks = 0

    for path in sorted(UPLOAD_DIR.glob("*")):
        if not path.is_file() or not is_supported_file(path.name):
            continue

        text = load_file(str(path))
        chunks = split_text(text, path.name, chunk_size=400, overlap=50)
        stored_chunks = [StoredChunk(text=chunk.text, file_name=chunk.file_name) for chunk in chunks]
        added = store.add_chunks(stored_chunks)
        total_chunks += added
        uploaded.append({"file": path.name, "status": "indexed" if added else "empty", "chunks": added})

    return {"uploaded": uploaded, "total_chunks": total_chunks, "indexed_chunks": store.count()}
