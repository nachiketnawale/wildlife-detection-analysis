
import json
import random
import time
from pathlib import Path
from collections import Counter, defaultdict
from concurrent.futures import ThreadPoolExecutor, as_completed

import requests
import yaml

# --------------------------------------------------
# SETTINGS
# --------------------------------------------------
ROOT = Path(__file__).resolve().parent
JSON_PATH = ROOT / "wcs_cleaned_temp.json"
if not JSON_PATH.exists():
    JSON_PATH = ROOT / "wcs_20220205_bboxes_with_classes.json"

OUT = ROOT / "dataset_v2"
TARGET_IMAGES = 5000
SEED = 42
WORKERS = 12

IMAGE_BASE = (
    "https://storage.googleapis.com/"
    "public-datasets-lila/wcs-unzipped/"
)

EXISTING_CLASSES = [
    "tayassu pecari",
    "equus quagga",
    "loxodonta africana",
    "leopardus pardalis",
    "panthera onca",
]

# Never overwrite an existing V2 dataset.
if OUT.exists():
    raise SystemExit(
        f"{OUT} already exists. Rename it or choose a new output folder "
        "before running this script. Nothing was deleted."
    )

if not JSON_PATH.exists():
    raise FileNotFoundError(
        "WCS JSON not found. Check the JSON filename in the project folder."
    )

print("Reading:", JSON_PATH)
print("This may take a little time for the large JSON file.")

with open(JSON_PATH, "r", encoding="utf-8") as f:
    data = json.load(f)

images = {im["id"]: im for im in data["images"]}
categories = {
    cat["id"]: cat["name"].strip().lower()
    for cat in data["categories"]
}

# Count annotated boxes by category.
box_counts = Counter()
image_anns = defaultdict(list)

for ann in data["annotations"]:
    if ann.get("iscrowd", 0):
        continue
    cat_name = categories.get(ann["category_id"], "")
    if cat_name and cat_name != "empty":
        box_counts[cat_name] += 1
        image_anns[ann["image_id"]].append(ann)

available = set(categories.values())
missing = [name for name in EXISTING_CLASSES if name not in available]
if missing:
    raise SystemExit(f"Existing classes missing from JSON: {missing}")

# Keep the existing five, then add the five most frequent other species.
extras = [
    name for name, _ in box_counts.most_common()
    if name not in EXISTING_CLASSES and name != "empty"
][:5]

CLASS_NAMES = EXISTING_CLASSES + extras
CLASS_ID = {name: i for i, name in enumerate(CLASS_NAMES)}
SELECTED = set(CLASS_NAMES)

print("\nSelected classes:")
for i, name in enumerate(CLASS_NAMES):
    print(f"  {i}: {name} ({box_counts[name]} annotated boxes)")

# Only use images whose available non-empty annotations are all among
# the selected ten classes. This avoids deliberately dropping boxes
# for other annotated animal species.
class_candidates = defaultdict(list)

for image_id, anns in image_anns.items():
    names_in_image = {
        categories.get(a["category_id"], "")
        for a in anns
    }
    names_in_image.discard("empty")

    if not names_in_image or not names_in_image.issubset(SELECTED):
        continue

    for name in names_in_image:
        class_candidates[name].append(image_id)

rng = random.Random(SEED)
for name in CLASS_NAMES:
    rng.shuffle(class_candidates[name])

# Round-robin class queues help avoid collecting only the largest class.
queues = {name: list(class_candidates[name]) for name in CLASS_NAMES}
positions = {name: 0 for name in CLASS_NAMES}
chosen = []
seen = set()

while len(chosen) < TARGET_IMAGES:
    added_this_round = False

    for name in CLASS_NAMES:
        q = queues[name]
        while positions[name] < len(q):
            image_id = q[positions[name]]
            positions[name] += 1
            if image_id not in seen:
                seen.add(image_id)
                chosen.append(image_id)
                added_this_round = True
                break

        if len(chosen) >= TARGET_IMAGES:
            break

    if not added_this_round:
        break

print(f"\nEligible unique image candidates: {len(chosen)}")
if len(chosen) < TARGET_IMAGES:
    print(
        "WARNING: Fewer than 5000 eligible candidates were found. "
        "The script will download what is available."
    )

# Make a separate V2 directory; the existing dataset is untouched.
for split in ["train", "val", "test"]:
    (OUT / "images" / split).mkdir(parents=True, exist_ok=True)
    (OUT / "labels" / split).mkdir(parents=True, exist_ok=True)

# Download candidates in parallel. Keep only successful image downloads.
def download_one(image_id):
    im = images[image_id]
    file_name = im.get("file_name", "").lstrip("/")
    if not file_name:
        return image_id, None

    url = IMAGE_BASE + file_name
    try:
        response = requests.get(url, timeout=30)
        response.raise_for_status()
        if not response.content:
            return image_id, None
        return image_id, response.content
    except requests.RequestException:
        return image_id, None

successful = {}
failed = 0

print("\nDownloading images. This can take a while...")

with ThreadPoolExecutor(max_workers=WORKERS) as pool:
    futures = [pool.submit(download_one, iid) for iid in chosen]

    for future in as_completed(futures):
        image_id, content = future.result()

        if content is None:
            failed += 1
            continue

        successful[image_id] = content

        if len(successful) % 100 == 0:
            print(f"Downloaded successfully: {len(successful)}")

print(f"\nSuccessful downloads: {len(successful)}")
print(f"Failed/unavailable downloads: {failed}")

# Shuffle and split successful images 70/15/15.
successful_ids = list(successful.keys())
rng.shuffle(successful_ids)

n = len(successful_ids)
n_train = int(n * 0.70)
n_val = int(n * 0.15)

split_ids = {
    "train": successful_ids[:n_train],
    "val": successful_ids[n_train:n_train + n_val],
    "test": successful_ids[n_train + n_val:],
}

# Save each image and convert COCO boxes to YOLO normalized coordinates.
written_boxes = Counter()
written_images = Counter()

for split, ids in split_ids.items():
    for image_id in ids:
        im = images[image_id]
        image_name = f"wcs_{image_id}.jpg"
        image_path = OUT / "images" / split / image_name
        label_path = OUT / "labels" / split / f"wcs_{image_id}.txt"

        image_path.write_bytes(successful[image_id])

        width = im.get("width")
        height = im.get("height")
        if not width or not height:
            image_path.unlink(missing_ok=True)
            continue

        lines = []
        for ann in image_anns.get(image_id, []):
            cat_name = categories.get(ann["category_id"], "")
            if cat_name not in CLASS_ID:
                continue

            bbox = ann.get("bbox")
            if not bbox or len(bbox) != 4:
                continue

            x, y, w, h = bbox
            if w <= 0 or h <= 0:
                continue

            xc = (x + w / 2) / width
            yc = (y + h / 2) / height
            wn = w / width
            hn = h / height

            # Ignore malformed boxes outside image boundaries.
            if not (0 <= xc <= 1 and 0 <= yc <= 1
                    and 0 < wn <= 1 and 0 < hn <= 1):
                continue

            class_id = CLASS_ID[cat_name]
            lines.append(
                f"{class_id} {xc:.6f} {yc:.6f} {wn:.6f} {hn:.6f}"
            )
            written_boxes[cat_name] += 1

        if not lines:
            image_path.unlink(missing_ok=True)
            continue

        label_path.write_text("\n".join(lines) + "\n", encoding="utf-8")
        written_images[split] += 1

# Write YAML using the actual absolute path.
yaml_data = {
    "path": str(OUT.resolve()).replace("\\", "/"),
    "train": "images/train",
    "val": "images/val",
    "test": "images/test",
    "names": {i: name for i, name in enumerate(CLASS_NAMES)},
}

with open(OUT / "data.yaml", "w", encoding="utf-8") as f:
    yaml.safe_dump(yaml_data, f, sort_keys=False, allow_unicode=True)

print("\n========== DATASET V2 SUMMARY ==========")
print("Dataset folder:", OUT)
print("Images by split:", dict(written_images))
print("Total usable images:", sum(written_images.values()))
print("Bounding boxes per class:")
for name in CLASS_NAMES:
    print(f"  {name}: {written_boxes[name]} boxes")

print("\nCreated:", OUT / "data.yaml")
print("Dataset V2 preparation finished.")
