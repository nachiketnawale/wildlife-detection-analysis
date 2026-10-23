
import re
from datetime import datetime
from pathlib import Path

import pytesseract
from PIL import Image, ImageOps, ImageEnhance, ImageFilter

pytesseract.pytesseract.tesseract_cmd = (
    r"C:\Program Files\Tesseract-OCR\tesseract.exe"
)


def prepare(crop):
    """Enlarge and improve contrast for OCR."""
    crop = ImageOps.grayscale(crop)
    crop = ImageEnhance.Contrast(crop).enhance(2.0)
    crop = crop.resize((crop.width * 3, crop.height * 3))
    return crop


def get_ocr_text(crop, psm=7):
    return pytesseract.image_to_string(
        prepare(crop),
        config=f"--oem 3 --psm {psm}"
    ).strip()


def parse_date(text):
    text = text.upper().replace("O", "0")
    text = text.replace("—", "-").replace("–", "-")

    match = re.search(
        r"(20\d{2})\s*[-/.]\s*(\d{1,2})\s*[-/.]\s*(\d{1,2})",
        text
    )

    if not match:
        return None

    try:
        year, month, day = map(int, match.groups())
        return datetime(year, month, day).date()
    except ValueError:
        return None


def parse_time(text):
    text = text.upper().replace(";", ":").replace(".", ":")

    # Standard time, e.g. 8:33:02 AM
    match = re.search(
        r"(?<!\d)(\d{1,2})\s*:\s*(\d{2})\s*:\s*(\d{2})"
        r"\s*(AM|PM)?",
        text
    )

    if not match:
        # Compact OCR fallback, e.g. 83302 AM
        match = re.search(
            r"(?<!\d)(\d)(\d{2})(\d{2})\s*(AM|PM)",
            text
        )

    if not match:
        return None

    hour, minute, second = map(int, match.groups()[:3])
    ampm = match.group(4)

    if ampm:
        if not 1 <= hour <= 12:
            return None
        if ampm == "AM" and hour == 12:
            hour = 0
        elif ampm == "PM" and hour != 12:
            hour += 12

    if not (0 <= hour <= 23 and
            0 <= minute <= 59 and
            0 <= second <= 59):
        return None

    return hour, minute, second


def read_camera_timestamp(image_path):
    image_path = Path(image_path)

    if not image_path.is_file():
        raise FileNotFoundError(f"Image not found: {image_path}")

    with Image.open(image_path) as source:
        image = source.convert("RGB")

    width, height = image.size

    # The tested WCS image has a thin timestamp bar at the top.
    strip = image.crop((0, 0, width, min(32, height)))

    # Save this image so you can inspect exactly what OCR sees.
    strip.save("timestamp_debug.png")

    # These coordinates are tuned to the sample image.
    date_crop = strip.crop((0, 0, min(360, width), strip.height))
    time_crop = strip.crop((
        min(360, width), 0, min(730, width), strip.height
    ))

    date_results = []
    time_results = []

    for psm in (7, 8, 13):
        result = get_ocr_text(date_crop, psm)
        date_results.append((result, parse_date(result)))

    for psm in (7, 8, 13):
        result = get_ocr_text(time_crop, psm)
        time_results.append((result, parse_time(result)))

    print("\nDate OCR attempts:")
    for text, parsed in date_results:
        print(f"  {text!r} -> {parsed}")

    print("\nTime OCR attempts:")
    for text, parsed in time_results:
        print(f"  {text!r} -> {parsed}")

    date_valid = next(
        ((text, value) for text, value in date_results if value),
        None
    )
    time_valid = next(
        ((text, value) for text, value in time_results if value),
        None
    )

    if date_valid and time_valid:
        date_value = date_valid[1]
        hour, minute, second = time_valid[1]

        timestamp = datetime(
            date_value.year, date_value.month, date_value.day,
            hour, minute, second
        )

        return {
            "timestamp": timestamp.isoformat(sep=" "),
            "source": "top_strip_ocr",
            "ocr_text": (
                f"date={date_valid[0]!r}; time={time_valid[0]!r}"
            ),
            "needs_review": True
        }

    return {
        "timestamp": None,
        "source": "not_detected",
        "ocr_text": (
            f"date={date_results}; time={time_results}"
        ),
        "needs_review": True
    }


if __name__ == "__main__":
    image_path = input(
        "Enter the full path of a camera-trap image: "
    ).strip().strip('"')

    try:
        result = read_camera_timestamp(image_path)

        print("\nTimestamp OCR result")
        print("--------------------")
        for key, value in result.items():
            print(f"{key}: {value}")

        print("\nDiagnostic crop saved as timestamp_debug.png")

    except Exception as error:
        print(f"Error: {error}")
