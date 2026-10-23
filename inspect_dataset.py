
import json
import re
from collections import Counter
from pathlib import Path

JSON_FILE = Path("wcs_20220205_bboxes_with_classes.json")

if not JSON_FILE.exists():
    raise FileNotFoundError(f"JSON file not found: {JSON_FILE}")

print("Reading annotation file...")

# Replace non-standard NaN values with JSON null.
# This creates a temporary cleaned file rather than changing the original.
TEMP_FILE = Path("wcs_cleaned_temp.json")

with JSON_FILE.open("r", encoding="utf-8") as source:
    with TEMP_FILE.open("w", encoding="utf-8") as target:
        for line in source:
            line = re.sub(r'\bNaN\b', 'null', line)
            target.write(line)

print("Temporary JSON created. Loading categories and annotations...")

with TEMP_FILE.open("r", encoding="utf-8") as f:
    data = json.load(f)

categories = {
    category["id"]: category["name"]
    for category in data["categories"]
}

counts = Counter()
annotated_images = set()

for annotation in data["annotations"]:
    category_id = annotation["category_id"]
    counts[category_id] += 1
    annotated_images.add(annotation["image_id"])

print("\nTotal categories:", len(categories))
print("Total bounding-box annotations:", len(data["annotations"]))
print("Images with annotations:", len(annotated_images))

print("\nTop 30 categories by annotation count:")
for category_id, count in counts.most_common(30):
    print(f"{categories.get(category_id, 'Unknown')}: {count} boxes")