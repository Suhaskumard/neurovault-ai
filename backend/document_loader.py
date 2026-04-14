import re
from pathlib import Path

from image_pipeline import process_image


DOCUMENT_EXTENSIONS = {".pdf", ".txt", ".docx"}
IMAGE_EXTENSIONS = {".png", ".jpg", ".jpeg", ".webp", ".bmp", ".tiff"}


def normalize_text(text: str) -> str:
    replacements = {
        "\uf0b7": " - ",
        "ï·": " - ",
        "•": " - ",
        "": " - ",
        "\u2013": "-",
        "\u2014": "-",
        "\u2019": "'",
        "\u201c": '"',
        "\u201d": '"',
        "\u00a0": " ",
    }

    cleaned = text.replace("\x00", "")
    for source, target in replacements.items():
        cleaned = cleaned.replace(source, target)

    cleaned = rejoin_spaced_letters(cleaned)
    return " ".join(cleaned.split())


def rejoin_spaced_letters(text: str) -> str:
    def _collapse(match) -> str:
        letters = re.findall(r"[A-Za-z]", match.group(0))
        return "".join(letters)

    return re.sub(r"(?:\b[A-Za-z]\b(?:\s+|$)){3,}", _collapse, text)


def load_pdf(path: Path) -> str:
    try:
        from PyPDF2 import PdfReader

        reader = PdfReader(str(path))
        return normalize_text("\n".join(page.extract_text() or "" for page in reader.pages))
    except Exception as exc:
        return f"Failed to extract PDF text: {exc}"


def load_docx(path: Path) -> str:
    try:
        from docx import Document

        document = Document(str(path))
        return normalize_text("\n".join(paragraph.text for paragraph in document.paragraphs))
    except Exception as exc:
        return f"Failed to extract DOCX text: {exc}"


def load_txt(path: Path) -> str:
    try:
        return normalize_text(path.read_text(encoding="utf-8", errors="ignore"))
    except Exception as exc:
        return f"Failed to read text file: {exc}"


def load_file(path: str) -> str:
    file_path = Path(path)
    extension = file_path.suffix.lower()

    if extension == ".pdf":
        return load_pdf(file_path)
    if extension == ".docx":
        return load_docx(file_path)
    if extension == ".txt":
        return load_txt(file_path)
    if extension in IMAGE_EXTENSIONS:
        return normalize_text(process_image(str(file_path)))
    return ""


def is_supported_file(filename: str) -> bool:
    return Path(filename).suffix.lower() in DOCUMENT_EXTENSIONS | IMAGE_EXTENSIONS
