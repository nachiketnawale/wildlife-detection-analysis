
from pathlib import Path
from collections import Counter
import yaml

ROOT = Path("dataset_v2")
config = yaml.safe_load((ROOT / "data.yaml").read_text(encoding="utf-8"))
names = config["names"]

total_images = 0
total_labels = 0
empty_labels = 0
missing_labels = []
invalid_lines = []
class_counts = Counter()

for split in ["train", "val", "test"]:
    image_dir = ROOT / "images" / split
    label_dir = ROOT / "labels" / split

    images = [
        p for p in image_dir.iterdir()
        if p.suffix.lower() in {".jpg", ".jpeg", ".png", ".webp"}
    ]

    total_images += len(images)
    print(f"\n{split}: {len(images)} images")

    for image in images:
        label = label_dir / f"{image.stem}.txt"

        if not label.exists():
            missing_labels.append(str(label))
            continue

        lines = label.read_text(encoding="utf-8").splitlines()

        if not lines:
            empty_labels += 1
            continue

        for line in lines:
            parts = line.split()

            try:
                if len(parts) != 5:
                    raise ValueError("Expected 5 values")

                cls = int(parts[0])
                x, y, w, h = map(float, parts[1:])

                if cls not in [int(k) for k in names.keys()]:
                    raise ValueError("Unknown class ID")

                if not (
                    0 <= x <= 1 and 0 <= y <= 1
                    and 0 < w <= 1 and 0 < h <= 1
                ):
                    raise ValueError("Invalid normalized box")

                class_counts[cls] += 1
                total_labels += 1

            except (ValueError, TypeError) as e:
                invalid_lines.append((str(label), line, str(e)))

print("\n========== VALIDATION SUMMARY ==========")
print("Total images:", total_images)
print("Valid bounding boxes:", total_labels)
print("Images with empty labels:", empty_labels)
print("Missing label files:", len(missing_labels))
print("Invalid label lines:", len(invalid_lines))

print("\nBounding boxes per class:")
for key, name in names.items():
    print(f"{key}: {name} -> {class_counts[int(key)]}")

if missing_labels:
    print("\nFirst missing label examples:")
    print(*missing_labels[:10], sep="\n")

if invalid_lines:
    print("\nFirst invalid label examples:")
    print(*invalid_lines[:10], sep="\n")
