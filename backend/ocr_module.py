from PIL import Image


def extract_ocr_text(image_path: str) -> str:
    try:
        import pytesseract

        with Image.open(image_path) as image:
            return pytesseract.image_to_string(image).strip()
    except Exception:
        return ""
