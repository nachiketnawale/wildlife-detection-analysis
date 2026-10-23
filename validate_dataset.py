
from pathlib import Path
from collections import defaultdict
import yaml

# -----------------------------------------
# 1. Configuration
# -----------------------------------------
ROOT = Path(__file__).resolve().parent
DATASET = ROOT / "dataset"
DATA_YAML = DATASET / "data.yaml"

SPLITS = ["train", "val", "test"]

EXPECTED_CLASSES = [
    "tayassu pecari",
    "equus quagga",
    "loxodonta africana",
    "leopardus pardalis",
    "panthera onca",
]

IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".bmp"}


def load_class_names():
    """Load class names from data.yaml when available."""
    if DATA_YAML.exists():
        with open(DATA_YAML, "r", encoding="utf-8") as file:
            config = yaml.safe_load(file) or {}

        names = config.get("names", EXPECTED_CLASSES)

        if isinstance(names, dict):
            names = [
                names[k] for k in sorted(names, key=lambda x: int(x))
            ]

        return names

    print("WARNING: data.yaml not found; using expected class names.")
    return EXPECTED_CLASSES


# -----------------------------------------
# 2. Validate one YOLO label file
# -----------------------------------------
def validate_label_file(label_path, num_classes):
    errors = []
    valid_boxes = 0
    class_counts = defaultdict(int)

    try:
        with open(label_path, "r", encoding="utf-8") as file:
            lines = file.readlines()
    except OSError as exc:
        return [f"Cannot read label file: {exc}"], 0, class_counts

    for line_number, line in enumerate(lines, start=1):
        line = line.strip()

        # Empty lines do not represent annotations.
        if not line:
            continue

        parts = line.split()

        if len(parts) != 5:
            errors.append(
                f"Line {line_number}: expected 5 values, "
                f"found {len(parts)}."
            )
            continue

        try:
            class_value = float(parts[0])
            x_center, y_center, width, height = map(
                float, parts[1:]
            )
        except ValueError:
            errors.append(
                f"Line {line_number}: contains a non-numeric value."
            )
            continue

        values = [class_value, x_center, y_center, width, height]

        if not all(map(lambda value: __import__("math").isfinite(value),
                       values)):
            errors.append(
                f"Line {line_number}: contains NaN or infinity."
            )
            continue

        if not class_value.is_integer():
            errors.append(
                f"Line {line_number}: class ID must be an integer."
            )
            continue

        class_id = int(class_value)

        if not 0 <= class_id < num_classes:
            errors.append(
                f"Line {line_number}: class ID {class_id} is outside "
                f"the valid range 0-{num_classes - 1}."
            )
            continue

        if not all(0 <= value <= 1 for value in
                   [x_center, y_center, width, height]):
            errors.append(
                f"Line {line_number}: coordinates must be "
                "normalized between 0 and 1."
            )
            continue

        if width <= 0 or height <= 0:
            errors.append(
                f"Line {line_number}: width and height must be positive."
            )
            continue

        # Ensure the bounding box stays inside the image.
        if (x_center - width / 2 < -1e-6 or
                x_center + width / 2 > 1 + 1e-6 or
                y_center - height / 2 < -1e-6 or
                y_center + height / 2 > 1 + 1e-6):
            errors.append(
                f"Line {line_number}: bounding box extends "
                "outside the image."
            )
            continue

        valid_boxes += 1
        class_counts[class_id] += 1

    return errors, valid_boxes, class_counts


# -----------------------------------------
# 3. Validate the complete dataset
# -----------------------------------------
def main():
    print("=" * 65)
    print("WILDLIFE DATASET VALIDATION")
    print("=" * 65)
    print(f"Dataset path: {DATASET}")

    if not DATASET.exists():
        print("ERROR: dataset folder does not exist.")
        return

    try:
        class_names = load_class_names()
    except Exception as exc:
        print(f"ERROR: could not read data.yaml: {exc}")
        return

    num_classes = len(class_names)

    print(f"Number of classes: {num_classes}")
    print("\nClasses:")
    for class_id, name in enumerate(class_names):
        print(f"  {class_id}: {name}")

    total_images = 0
    total_boxes = 0
    total_errors = 0
    total_missing_labels = 0
    total_empty_labels = 0

    overall_class_boxes = defaultdict(int)
    overall_class_images = defaultdict(set)

    for split in SPLITS:
        print(f"\n{'-' * 65}")
        print(f"Checking {split.upper()} split")
        print("-" * 65)

        image_dir = DATASET / "images" / split
        label_dir = DATASET / "labels" / split

        if not image_dir.exists():
            print(f"ERROR: image directory not found: {image_dir}")
            total_errors += 1
            continue

        if not label_dir.exists():
            print(f"ERROR: label directory not found: {label_dir}")
            total_errors += 1
            continue

        images = sorted(
            p for p in image_dir.iterdir()
            if p.is_file() and p.suffix.lower() in IMAGE_EXTENSIONS
        )

        split_boxes = 0
        split_errors = 0
        split_missing = 0
        split_empty = 0
        split_class_boxes = defaultdict(int)
        split_class_images = defaultdict(set)

        image_stems = {image.stem for image in images}

        # Check each image and its corresponding label.
        for image_path in images:
            label_path = label_dir / f"{image_path.stem}.txt"

            if not label_path.exists():
                print(f"MISSING LABEL: {image_path.name}")
                split_missing += 1
                split_errors += 1
                continue

            try:
                if label_path.stat().st_size == 0:
                    split_empty += 1
                    continue
            except OSError:
                print(f"ERROR: cannot access {label_path}")
                split_errors += 1
                continue

            errors, boxes, class_counts = validate_label_file(
                label_path, num_classes
            )

            if boxes == 0 and not errors:
                split_empty += 1

            split_boxes += boxes

            for class_id, count in class_counts.items():
                split_class_boxes[class_id] += count
                split_class_images[class_id].add(image_path.name)

            if errors:
                split_errors += len(errors)
                print(f"\nINVALID LABEL: {label_path.name}")
                for error in errors:
                    print(f"  - {error}")

        # Check for label files with no matching image.
        for label_path in sorted(label_dir.glob("*.txt")):
            if label_path.stem not in image_stems:
                print(f"ORPHAN LABEL: {label_path.name}")
                split_errors += 1

        print(f"\nImages: {len(images)}")
        print(f"Valid bounding boxes: {split_boxes}")
        print(f"Empty label files: {split_empty}")
        print(f"Missing labels: {split_missing}")
        print(f"Problems found: {split_errors}")

        total_images += len(images)
        total_boxes += split_boxes
        total_errors += split_errors
        total_missing_labels += split_missing
        total_empty_labels += split_empty

        for class_id, count in split_class_boxes.items():
            overall_class_boxes[class_id] += count
            overall_class_images[class_id].update(
                split_class_images[class_id]
            )

    # -----------------------------------------
    # 4. Final report
    # -----------------------------------------
    print(f"\n{'=' * 65}")
    print("FINAL DATASET REPORT")
    print("=" * 65)

    print(f"Total images: {total_images}")
    print(f"Total valid bounding boxes: {total_boxes}")
    print(f"Total empty label files: {total_empty_labels}")
    print(f"Total missing labels: {total_missing_labels}")
    print(f"Total problems: {total_errors}")

    print("\nClass-wise annotation statistics:")
    print(f"{'Class ID':<10} {'Species':<25} {'Boxes':>8} {'Images':>8}")
    print("-" * 55)

    for class_id, name in enumerate(class_names):
        print(
            f"{class_id:<10} "
            f"{name:<25} "
            f"{overall_class_boxes[class_id]:>8} "
            f"{len(overall_class_images[class_id]):>8}"
        )

    if total_errors == 0:
        print("\nRESULT: No validation problems found.")
    else:
        print("\nRESULT: Validation problems were found. Review the messages above.")

    print("=" * 65)


if __name__ == "__main__":
    main()
