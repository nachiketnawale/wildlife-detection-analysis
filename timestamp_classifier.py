"""
timestamp_classifier.py
-----------------------
Extracts timestamps from camera-trap images using EXIF metadata and local OCR fallback,
and classifies each image into one of three time buckets:
  - Morning: 06:00 to 11:59
  - Evening: 12:00 to 17:59
  - Night:   18:00 to 05:59

Preserves all existing code files in the project and processes images entirely locally
with zero tokens consumed.
"""

import os
import sys
import re
import argparse
import json
import zipfile
from pathlib import Path
from datetime import datetime, time
from typing import Optional, Tuple, Dict, Any, List

from PIL import Image, ExifTags, ImageOps
import numpy as np

# Try importing local OCR engines in order of priority
_OCR_ENGINE = None
try:
    from rapidocr_onnxruntime import RapidOCR
    _rapid_ocr = RapidOCR()
    _OCR_ENGINE = "rapidocr"
except ImportError:
    try:
        import pytesseract
        _OCR_ENGINE = "pytesseract"
    except ImportError:
        try:
            import easyocr
            _easy_ocr_reader = easyocr.Reader(['en'], gpu=False)
            _OCR_ENGINE = "easyocr"
        except ImportError:
            _OCR_ENGINE = None


def get_time_bucket(dt_or_time: Any) -> str:
    """
    Categorize a time or datetime into one of three buckets:
      - Morning: 06:00 to 11:59
      - Evening: 12:00 to 17:59
      - Night:   18:00 to 05:59
    """
    if isinstance(dt_or_time, datetime):
        t = dt_or_time.time()
    elif isinstance(dt_or_time, time):
        t = dt_or_time
    else:
        raise ValueError("Expected datetime or time object.")

    # Time boundaries
    morning_start = time(6, 0, 0)
    evening_start = time(12, 0, 0)
    night_start   = time(18, 0, 0)

    if morning_start <= t < evening_start:
        return "Morning"
    elif evening_start <= t < night_start:
        return "Evening"
    else:
        return "Night"


def extract_from_exif(image: Image.Image) -> Optional[datetime]:
    """Attempt to extract timestamp from EXIF metadata tags."""
    try:
        exif_data = image._getexif()
        if not exif_data:
            return None

        # Look for standard datetime tags in EXIF
        target_tags = ["DateTimeOriginal", "DateTime", "DateTimeDigitized"]
        tag_values = {}
        for tag_id, val in exif_data.items():
            tag_name = ExifTags.TAGS.get(tag_id)
            if tag_name in target_tags and isinstance(val, str) and val.strip():
                tag_values[tag_name] = val.strip()

        # Check in priority order
        for tag_name in target_tags:
            val = tag_values.get(tag_name)
            if not val:
                continue

            # Standard EXIF format: 'YYYY:MM:DD HH:MM:SS' or 'YYYY.MM.DD HH.MM.SS' or 'YYYY-MM-DD HH:MM:SS'
            cleaned = val.replace(".", ":").replace("-", ":")
            match = re.search(r"(\d{4}):(\d{1,2}):(\d{1,2})[T\s]+(\d{1,2})[:.](\d{2})(?:[:.](\d{2}))?", cleaned)
            if match:
                y, m, d, hh, mm = map(int, match.groups()[:5])
                ss = int(match.group(6)) if match.group(6) else 0
                if 1 <= m <= 12 and 1 <= d <= 31 and 0 <= hh <= 23 and 0 <= mm <= 59 and 0 <= ss <= 59:
                    return datetime(y, m, d, hh, mm, ss)
    except Exception:
        pass

    return None


def parse_timestamp_from_text(raw_text: str) -> Optional[datetime]:
    """Parse date and time from raw OCR text with robust OCR typo corrections."""
    if not raw_text:
        return None

    text = raw_text.strip()

    # Clean doubled OCR letters e.g. AMM -> AM, PMM -> PM
    cleaned = re.sub(r"\b(AM|PM)[A-Z]*\b", lambda m: m.group(1).upper(), text, flags=re.IGNORECASE)

    # Check for presence of AM/PM marker anywhere in the text
    ampm_match = re.search(r"\b(AM|PM)\b", cleaned, re.IGNORECASE)
    ampm = ampm_match.group(1).upper() if ampm_match else None

    # Check for date YYYY-MM-DD
    date_match = re.search(r"(20\d{2})\s*[-/.]\s*(\d{1,2})\s*[-/.]\s*(\d{1,2})", cleaned)

    # Pattern 1: HH [:;i.] MM [:;i.] SS
    m = re.search(r"(?<!\d)(\d{1,2})\s*[:;i.]\s*(\d{2}|oo)\s*[:;i.]\s*(\d{2}|\w{2})?", cleaned, re.IGNORECASE)
    if not m:
        # Pattern 2: digit + '1' + 2digits + ':' + 2digits e.g. 5139:55 PM -> 5 : 39 : 55
        m = re.search(r"(?<!\d)(\d{1,2})1(\d{2})\s*[:;i.]\s*(\d{2})", cleaned)
    if not m:
        # Pattern 3: just HH:MM
        m = re.search(r"(?<!\d)(\d{1,2})\s*[:;i.]\s*(\d{2}|oo)", cleaned, re.IGNORECASE)

    if not m:
        return None

    try:
        hh = int(m.group(1))
        mm_str = m.group(2).lower().replace("o", "0")
        mm = int(mm_str)
        ss = 0
        if m.lastindex >= 3 and m.group(3):
            g3 = m.group(3).lower().replace("o", "0")
            if g3.isdigit():
                ss = int(g3)

        if ampm:
            if not (1 <= hh <= 12):
                return None
            if ampm == "AM" and hh == 12:
                hh = 0
            elif ampm == "PM" and hh != 12:
                hh += 12

        if not (0 <= hh <= 23 and 0 <= mm <= 59 and 0 <= ss <= 59):
            return None

        if date_match:
            y, mo, d = map(int, date_match.groups())
            return datetime(y, mo, d, hh, mm, ss)
        else:
            return datetime(2000, 1, 1, hh, mm, ss)
    except Exception:
        return None


def run_local_ocr_on_crop(crop_img: Image.Image) -> Optional[datetime]:
    """Run local OCR on an image crop, testing regular and inverted orientations."""
    if _OCR_ENGINE is None:
        return None

    # Variations to handle camera trap OSD strip orientations (standard, rot180, flip vertical)
    variants = [
        crop_img,
        crop_img.rotate(180),
        crop_img.transpose(Image.FLIP_TOP_BOTTOM),
    ]

    for variant in variants:
        # Enlarge for OCR clarity
        enlarged = variant.resize((variant.width * 2, variant.height * 2), Image.Resampling.LANCZOS)

        extracted_text = ""
        if _OCR_ENGINE == "rapidocr":
            res, _ = _rapid_ocr(np.array(enlarged))
            if res:
                extracted_text = " ".join([item[1] for item in res])
        elif _OCR_ENGINE == "pytesseract":
            import pytesseract
            extracted_text = pytesseract.image_to_string(enlarged, config="--psm 6")
        elif _OCR_ENGINE == "easyocr":
            res = _easy_ocr_reader.readtext(np.array(enlarged))
            if res:
                extracted_text = " ".join([item[1] for item in res])

        dt = parse_timestamp_from_text(extracted_text)
        if dt:
            return dt

    return None


def extract_from_crops(image: Image.Image) -> Tuple[Optional[datetime], Optional[str]]:
    """Crop top 10% and bottom 10% to perform local OCR on printed timestamps."""
    w, h = image.size
    
    # Camera trap timestamp bars are typically between 32 and 60px high, within the top/bottom 10%
    crop_heights = [min(60, max(32, int(h * 0.10))), max(36, int(h * 0.10))]

    for ch in crop_heights:
        # Top strip
        top_strip = image.crop((0, 0, w, ch))
        dt_top = run_local_ocr_on_crop(top_strip)
        if dt_top:
            return dt_top, "OCR (Top Strip)"

    for ch in crop_heights:
        # Bottom strip
        bottom_strip = image.crop((0, h - ch, w, h))
        dt_bottom = run_local_ocr_on_crop(bottom_strip)
        if dt_bottom:
            return dt_bottom, "OCR (Bottom Strip)"

    return None, None


def classify_image(image_path: str) -> Dict[str, Any]:
    """
    Classify a single image:
      1. Attempt EXIF metadata extraction
      2. If missing, attempt OCR on top 10% and bottom 10%
      3. Classify into Morning (06:00-11:59), Evening (12:00-17:59), or Night (18:00-05:59)
    """
    result = {
        "file": str(Path(image_path).name),
        "path": str(image_path),
        "timestamp": None,
        "method": None,
        "bucket": "Unknown",
        "success": False
    }

    try:
        with Image.open(image_path) as img:
            rgb_img = img.convert("RGB")

            # 1. Try EXIF
            dt = extract_from_exif(img)
            method = "EXIF Metadata"

            # 2. Try OCR if EXIF missing
            if not dt:
                dt, method = extract_from_crops(rgb_img)

            if dt:
                result["timestamp"] = dt.strftime("%Y-%m-%d %H:%M:%S")
                result["method"] = method
                result["bucket"] = get_time_bucket(dt)
                result["success"] = True
    except Exception as e:
        result["error"] = str(e)

    return result


def process_images(image_paths: List[str], output_json: Optional[str] = None) -> Dict[str, Any]:
    """Process a list of images and aggregate results."""
    results = []
    bucket_counts = {"Morning": 0, "Evening": 0, "Night": 0, "Unknown": 0}

    print("=" * 80)
    print(f"{'Image File':<38} | {'Timestamp':<19} | {'Source':<16} | {'Bucket':<8}")
    print("-" * 80)

    for path in image_paths:
        res = classify_image(path)
        results.append(res)
        bucket = res["bucket"]
        bucket_counts[bucket] += 1

        ts_display = res["timestamp"] or "Not Detected"
        method_display = res["method"] or "N/A"
        print(f"{res['file']:<38} | {ts_display:<19} | {method_display:<16} | {bucket:<8}")

    print("=" * 80)
    print("\n[SUMMARY] Automated Frequency of Animal Sightings by Time of Day:")
    print("-" * 50)
    print(f"  Morning (06:00 - 11:59) : {bucket_counts['Morning']}")
    print(f"  Evening (12:00 - 17:59) : {bucket_counts['Evening']}")
    print(f"  Night   (18:00 - 05:59) : {bucket_counts['Night']}")
    if bucket_counts["Unknown"] > 0:
        print(f"  Unknown / Unresolved    : {bucket_counts['Unknown']}")
    print("-" * 50)
    print(f"  Total Processed         : {len(image_paths)}\n")

    summary_data = {
        "frequency_by_time_of_day": bucket_counts,
        "total_images": len(image_paths),
        "results": results
    }

    if output_json:
        with open(output_json, "w", encoding="utf-8") as f:
            json.dump(summary_data, f, indent=2)
        print(f"Results saved to: {output_json}")

    return summary_data


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Extract timestamps and classify camera trap images into Morning, Evening, Night.")
    parser.add_argument("--images", nargs="+", help="One or more image paths, or a directory containing images.")
    parser.add_argument("--zip", type=str, help="Path to a zip file containing camera trap images.")
    parser.add_argument("--max-images", type=int, default=None, help="Maximum number of images to process.")
    parser.add_argument("--output", type=str, default="timestamp_classification_results.json", help="Path to save output JSON.")
    args = parser.parse_args()

    target_files = []

    if args.images:
        for item in args.images:
            p = Path(item)
            if p.is_dir():
                target_files.extend([str(f) for f in p.rglob("*") if f.suffix.lower() in (".jpg", ".jpeg", ".png", ".webp")])
            elif p.is_file():
                target_files.append(str(p))

    elif args.zip:
        zip_path = Path(args.zip)
        if not zip_path.is_file():
            print(f"Zip file not found: {zip_path}")
            sys.exit(1)
        extract_dir = Path("extracted_temp_images")
        extract_dir.mkdir(exist_ok=True)
        with zipfile.ZipFile(zip_path, "r") as z:
            imgs = [n for n in z.namelist() if n.lower().endswith((".jpg", ".jpeg", ".png", ".webp"))]
            if args.max_images:
                imgs = imgs[:args.max_images]
            print(f"Extracting {len(imgs)} images from {zip_path}...")
            for img_name in imgs:
                z.extract(img_name, extract_dir)
                target_files.append(str(extract_dir / img_name))
    else:
        # Default behavior: test sample images if present, otherwise prompt help
        default_dir = Path("test_sample_images")
        if default_dir.exists():
            target_files = [str(f) for f in default_dir.rglob("*") if f.suffix.lower() in (".jpg", ".jpeg", ".png", ".webp")]
        else:
            print("Please specify --images <path_or_dir> or --zip <path_to_zip>")
            sys.exit(0)

    if args.max_images:
        target_files = target_files[:args.max_images]

    summary = process_images(target_files, output_json=args.output)

    try:
        from merge_stats import merge_yolo_and_timestamps
        zip_arg = args.zip if args.zip else ("dataset.zip" if Path("dataset.zip").exists() else None)
        merge_yolo_and_timestamps(
            timestamp_results_file=args.output,
            output_frequency_file="animal_frequency_data.json",
            zip_path=str(zip_arg) if zip_arg else None
        )
        print("Animal frequency data merged successfully -> animal_frequency_data.json")
    except Exception as exc:
        print(f"Frequency merge note: {exc}")
