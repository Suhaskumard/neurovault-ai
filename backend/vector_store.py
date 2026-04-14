import json
import re
import shutil
from dataclasses import asdict, dataclass
from pathlib import Path
from threading import Lock

import faiss
import numpy as np
from rank_bm25 import BM25Okapi

from embeddings import embed_query, embed_texts


TOKEN_PATTERN = re.compile(r"\w+")


@dataclass
class StoredChunk:
    text: str
    file_name: str


class HybridVectorStore:
    def __init__(self, db_dir: str = "../vector_db", dimension: int = 384):
        self.db_dir = Path(db_dir).resolve()
        self.index_path = self.db_dir / "index.faiss"
        self.meta_path = self.db_dir / "metadata.json"
        self.dimension = dimension
        self._lock = Lock()
        self.index = faiss.IndexFlatIP(dimension)
        self.chunks: list[StoredChunk] = []
        self.bm25: BM25Okapi | None = None
        self.db_dir.mkdir(parents=True, exist_ok=True)
        self.load()

    @staticmethod
    def _tokenize(text: str) -> list[str]:
        return TOKEN_PATTERN.findall(text.lower())

    def _rebuild_bm25(self) -> None:
        tokenized = [self._tokenize(chunk.text) for chunk in self.chunks]
        self.bm25 = BM25Okapi(tokenized) if tokenized else None

    def load(self) -> None:
        with self._lock:
            if self.index_path.exists() and self.meta_path.exists():
                self.index = faiss.read_index(str(self.index_path))
                metadata = json.loads(self.meta_path.read_text(encoding="utf-8"))
                self.chunks = [StoredChunk(**item) for item in metadata]
                self._rebuild_bm25()

    def persist(self) -> None:
        self.db_dir.mkdir(parents=True, exist_ok=True)
        faiss.write_index(self.index, str(self.index_path))
        self.meta_path.write_text(
            json.dumps([asdict(chunk) for chunk in self.chunks], ensure_ascii=False, indent=2),
            encoding="utf-8",
        )

    def add_chunks(self, chunks: list[StoredChunk]) -> int:
        if not chunks:
            return 0

        vectors = embed_texts([chunk.text for chunk in chunks])
        with self._lock:
            self.index.add(vectors)
            self.chunks.extend(chunks)
            self._rebuild_bm25()
            self.persist()
        return len(chunks)

    def search(self, query: str, top_k: int = 3) -> list[dict]:
        top_k = max(3, min(5, top_k))
        with self._lock:
            if not self.chunks or self.index.ntotal == 0:
                return []
            chunks_snapshot = list(self.chunks)
            index = self.index
            bm25 = self.bm25

        query_vector = embed_query(query).reshape(1, -1)
        vector_scores, vector_indices = index.search(query_vector, min(top_k * 3, len(chunks_snapshot)))

        combined: dict[int, float] = {}
        for rank, idx in enumerate(vector_indices[0]):
            if idx < 0:
                continue
            score = float(vector_scores[0][rank])
            combined[int(idx)] = combined.get(int(idx), 0.0) + 0.65 * score

        if bm25 is not None:
            bm25_scores = np.asarray(bm25.get_scores(self._tokenize(query)), dtype="float32")
            max_score = float(bm25_scores.max()) if bm25_scores.size else 0.0
            if max_score > 0:
                for idx in np.argsort(bm25_scores)[-top_k * 3:]:
                    combined[int(idx)] = combined.get(int(idx), 0.0) + 0.35 * float(bm25_scores[idx] / max_score)

        ranked = sorted(combined.items(), key=lambda item: item[1], reverse=True)[:top_k]
        return [
            {
                "file": chunks_snapshot[idx].file_name,
                "snippet": chunks_snapshot[idx].text[:500],
                "score": score,
            }
            for idx, score in ranked
        ]

    def clear(self) -> None:
        with self._lock:
            self.index = faiss.IndexFlatIP(self.dimension)
            self.chunks = []
            self.bm25 = None
            if self.db_dir.exists():
                shutil.rmtree(self.db_dir)
            self.db_dir.mkdir(parents=True, exist_ok=True)

    def count(self) -> int:
        with self._lock:
            return len(self.chunks)
