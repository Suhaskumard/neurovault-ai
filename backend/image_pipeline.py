from functools import lru_cache

from PIL import Image

from ocr_module import extract_ocr_text


@lru_cache(maxsize=1)
def _captioner():
    from transformers import BlipForConditionalGeneration, BlipProcessor

    model_name = "Salesforce/blip-image-captioning-base"
    processor = BlipProcessor.from_pretrained(model_name)
    model = BlipForConditionalGeneration.from_pretrained(model_name)
    return processor, model


def caption_image(image_path: str) -> str:
    try:
        processor, model = _captioner()
        with Image.open(image_path).convert("RGB") as image:
            inputs = processor(image, return_tensors="pt")
            output = model.generate(**inputs, max_new_tokens=50)
            return processor.decode(output[0], skip_special_tokens=True).strip()
    except Exception:
        return "Image uploaded, but OCR and captioning were unavailable."


def process_image(image_path: str) -> str:
    ocr_text = extract_ocr_text(image_path)
    if ocr_text:
        return f"OCR text extracted from image: {ocr_text}"
    return f"Image caption: {caption_image(image_path)}"
