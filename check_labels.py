
from pathlib import Path
from collections import Counter

ROOT = Path("dataset")
SPLITS = ["train", "val", "test"]

class_names = {
    0: "tayassu pecari",
    1: "equus quagga",
    2: "loxodonta africana",
    3: "leopardus pardalis",
    4: "panthera onca",
}

for split in SPLITS:
    image_dir = ROOT / "images" / split
    label_dir = ROOT / "labels" / split

    images = list(image_dir.glob("*"))
    label_files = list(label_dir.glob("*.txt"))

    counts = Counter()
    empty_labels = 0
    missing_labels = []
    bad_lines = []

    for image in images:
        label = label_dir / f"{image.stem}.txt"

        if not label.exists():
            missing_labels.append(image.name)
            continue

        text = label.read_text(encoding="utf-8").strip()

        if not text:
            empty_labels += 1
            continue

        for line_no, line in enumerate(text.splitlines(), start=1):
            parts = line.split()

            try:
                if len(parts) != 5:
                    raise ValueError("Expected 5 values")

                cls = int(parts[0])
                x, y, w, h = map(float, parts[1:])

                if cls not in class_names:
                    raise ValueError(f"Invalid class ID: {cls}")

                if not all(0 <= v <= 1 for v in (x, y, w, h)):
                    raise ValueError("Coordinates outside 0–1")

                if w <= 0 or h <= 0:
                    raise ValueError("Non-positive box size")

                counts[cls] += 1

            except ValueError as exc:
                bad_lines.append(
                    f"{label}, line {line_no}: {exc} | {line}"
                )

    print(f"\n===== {split.upper()} =====")
    print("Images:", len(images))
    print("Label files:", len(label_files))
    print("Images with empty labels:", empty_labels)
    print("Images missing labels:", len(missing_labels))
    print("Invalid label lines:", len(bad_lines))

    print("Bounding boxes per class:")
    for cls, name in class_names.items():
        print(f"  {cls}: {name}: {counts[cls]}")

    if missing_labels[:5]:
        print("First missing labels:", missing_labels[:5])

    if bad_lines[:10]:
        print("First invalid lines:")
        for item in bad_lines[:10]:
            print(" ", item)