from functools import lru_cache
from threading import Lock

import numpy as np


_model_lock = Lock()


@lru_cache(maxsize=1)
def get_embedding_model():
    from sentence_transformers import SentenceTransformer

    return SentenceTransformer("all-MiniLM-L6-v2")


def embed_texts(texts: list[str]) -> np.ndarray:
    if not texts:
        return np.empty((0, 384), dtype="float32")

    with _model_lock:
        model = get_embedding_model()
        embeddings = model.encode(
            texts,
            batch_size=32,
            normalize_embeddings=True,
            show_progress_bar=False,
        )
    return np.asarray(embeddings, dtype="float32")


def embed_query(query: str) -> np.ndarray:
    return embed_texts([query])[0]
