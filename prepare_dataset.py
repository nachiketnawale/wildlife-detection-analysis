
import json
import random
import shutil
from collections import defaultdict
from pathlib import Path
from urllib.parse import quote

import requests
from PIL import Image, UnidentifiedImageError

# -------------------------------
# 1. Settings
# -------------------------------
JSON_FILE = Path("wcs_cleaned_temp.json")
OUTPUT_DIR = Path("dataset")
MAX_IMAGES_PER_CLASS = 100
RANDOM_SEED = 42

BASE_URL = (
    "https://storage.googleapis.com/"
    "public-datasets-lila/wcs-unzipped/"
)

# The class order here becomes the YOLO class IDs.
SELECTED_SPECIES = [
    "tayassu pecari",
    "equus quagga",
    "loxodonta africana",
    "leopardus pardalis",
    "panthera onca",
]

random.seed(RANDOM_SEED)

if not JSON_FILE.exists():
    raise FileNotFoundError(
        f"Cannot find {JSON_FILE}. Run this script "
        "from the wildlife-project folder."
    )

# -------------------------------
# 2. Read annotation JSON
# -------------------------------
print("Loading annotation JSON. This may take a while...")

with JSON_FILE.open("r", encoding="utf-8") as f:
    data = json.load(f)

categories = {
    category["id"]: category["name"].lower()
    for category in data["categories"]
}

category_ids = {
    name: category_id
    for category_id, name in categories.items()
    if name in SELECTED_SPECIES
}

missing = set(SELECTED_SPECIES) - set(category_ids)

if missing:
    raise ValueError(f"Categories not found: {missing}")

class_id_by_category = {
    category_ids[name]: class_id
    for class_id, name in enumerate(SELECTED_SPECIES)
}

images_by_id = {
    image["id"]: image
    for image in data["images"]
}

# -------------------------------
# 3. Find candidate images
# -------------------------------
candidates = defaultdict(set)

for ann in data["annotations"]:
    category_id = ann["category_id"]

    if category_id not in class_id_by_category:
        continue

    image_id = ann["image_id"]
    image_info = images_by_id.get(image_id)

    if not image_info or not image_info.get("file_name"):
        continue

    # Ignore invalid bounding boxes.
    bbox = ann.get("bbox")
    if not bbox or len(bbox) != 4:
        continue

    x, y, w, h = bbox
    if w <= 0 or h <= 0:
        continue

    candidates[category_id].add(image_id)

chosen_ids = set()

for category_id, image_ids in candidates.items():
    image_ids = sorted(image_ids)
    random.shuffle(image_ids)
    chosen_ids.update(image_ids[:MAX_IMAGES_PER_CLASS])

print("\nCandidate images selected:")
for name in SELECTED_SPECIES:
    cid = category_ids[name]
    print(f"{name}: {min(len(candidates[cid]), MAX_IMAGES_PER_CLASS)}")

print("Unique images to download:", len(chosen_ids))

# -------------------------------
# 4. Prepare clean output folders
# -------------------------------
if OUTPUT_DIR.exists():
    shutil.rmtree(OUTPUT_DIR)

for split in ("train", "val", "test"):
    (OUTPUT_DIR / "images" / split).mkdir(parents=True)
    (OUTPUT_DIR / "labels" / split).mkdir(parents=True)

# Keep selected annotations by image.
annotations_by_image = defaultdict(list)

for ann in data["annotations"]:
    if ann["category_id"] not in class_id_by_category:
        continue

    if ann["image_id"] not in chosen_ids:
        continue

    annotations_by_image[ann["image_id"]].append(ann)

# -------------------------------
# 5. Download images and convert boxes
# -------------------------------
session = requests.Session()
successful = []
failed = []

for index, image_id in enumerate(sorted(chosen_ids), start=1):
    info = images_by_id[image_id]
    relative_path = info["file_name"].lstrip("/")

    # Quote URL path safely while preserving folder separators.
    url = BASE_URL + quote(relative_path, safe="/")

    response = None

    try:
        response = session.get(url, timeout=30)
        response.raise_for_status()

        filename = f"{image_id}.jpg"

        # Validate the downloaded image before saving.
        from io import BytesIO
        with Image.open(BytesIO(response.content)) as im:
            im.verify()

        temp_path = OUTPUT_DIR / f"{filename}.download"
        temp_path.write_bytes(response.content)

        with Image.open(temp_path) as im:
            width, height = im.size

        temp_path.replace(OUTPUT_DIR / filename)
        successful.append((image_id, filename, width, height))

    except (
        requests.RequestException,
        UnidentifiedImageError,
        OSError,
        ValueError,
    ) as exc:
        failed.append((image_id, str(exc)))
        print(f"Skipped image {image_id}: {exc}")
        continue

    if index % 25 == 0:
        print(f"Processed {index}/{len(chosen_ids)} candidates...")

print(f"\nDownloaded successfully: {len(successful)}")
print(f"Failed or unavailable: {len(failed)}")

# -------------------------------
# 6. Split images into train/val/test
# -------------------------------
random.shuffle(successful)

total = len(successful)
train_end = int(total * 0.70)
val_end = int(total * 0.85)

splits = {
    "train": successful[:train_end],
    "val": successful[train_end:val_end],
    "test": successful[val_end:],
}

for split, records in splits.items():
    for image_id, filename, width, height in records:
        source = OUTPUT_DIR / filename
        image_dest = OUTPUT_DIR / "images" / split / filename
        label_dest = OUTPUT_DIR / "labels" / split / (
            Path(filename).stem + ".txt"
        )

        shutil.move(str(source), str(image_dest))

        lines = []

        for ann in annotations_by_image[image_id]:
            class_id = class_id_by_category[ann["category_id"]]
            x, y, w, h = ann["bbox"]

            # Clip boxes to image boundaries.
            x1 = max(0.0, min(float(width), float(x)))
            y1 = max(0.0, min(float(height), float(y)))
            x2 = max(0.0, min(float(width), float(x + w)))
            y2 = max(0.0, min(float(height), float(y + h)))

            box_w = x2 - x1
            box_h = y2 - y1

            if box_w <= 0 or box_h <= 0:
                continue

            center_x = (x1 + x2) / 2 / width
            center_y = (y1 + y2) / 2 / height
            norm_w = box_w / width
            norm_h = box_h / height

            lines.append(
                f"{class_id} {center_x:.6f} {center_y:.6f} "
                f"{norm_w:.6f} {norm_h:.6f}"
            )

        label_dest.write_text(
            "\n".join(lines),
            encoding="utf-8"
        )

# -------------------------------
# 7. Create YOLO dataset config
# -------------------------------
yaml_lines = [
    "path: dataset",
    "train: images/train",
    "val: images/val",
    "test: images/test",
    "",
    "names:",
]

for class_id, name in enumerate(SELECTED_SPECIES):
    yaml_lines.append(f"  {class_id}: '{name}'")

(OUTPUT_DIR / "data.yaml").write_text(
    "\n".join(yaml_lines) + "\n",
    encoding="utf-8"
)

print("\nDataset preparation complete!")
for split, records in splits.items():
    print(f"{split}: {len(records)} images")

print("YOLO config:", OUTPUT_DIR / "data.yaml")
print("Review failed downloads and class counts before training.")