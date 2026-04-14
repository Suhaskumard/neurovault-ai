from dataclasses import dataclass


@dataclass
class TextChunk:
    text: str
    file_name: str


def split_text(text: str, file_name: str, chunk_size: int = 400, overlap: int = 50) -> list[TextChunk]:
    clean_text = " ".join(text.split())
    if not clean_text:
        return []

    chunks: list[TextChunk] = []
    start = 0
    while start < len(clean_text):
        end = min(start + chunk_size, len(clean_text))
        chunk = clean_text[start:end].strip()
        if chunk:
            chunks.append(TextChunk(text=chunk, file_name=file_name))
        if end == len(clean_text):
            break
        start = max(0, end - overlap)
    return chunks
