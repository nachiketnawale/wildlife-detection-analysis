
from pathlib import Path
from itertools import combinations

LABEL_DIR = Path("dataset/labels/train")
IMAGE_DIR = Path("dataset/images/train")
IOU_THRESHOLD = 0.5

def iou(box_a, box_b):
    ax1, ay1, ax2, ay2 = box_a
    bx1, by1, bx2, by2 = box_b

    ix1 = max(ax1, bx1)
    iy1 = max(ay1, by1)
    ix2 = min(ax2, bx2)
    iy2 = min(ay2, by2)

    intersection = max(0, ix2 - ix1) * max(0, iy2 - iy1)
    area_a = (ax2 - ax1) * (ay2 - ay1)
    area_b = (bx2 - bx1) * (by2 - by1)
    union = area_a + area_b - intersection

    return intersection / union if union else 0

found = 0

for label_file in LABEL_DIR.glob("*.txt"):
    boxes = []

    for line in label_file.read_text().splitlines():
        values = line.split()
        if len(values) != 5:
            continue

        cls, cx, cy, w, h = values
        cx, cy, w, h = map(float, (cx, cy, w, h))

        box = (
            cx - w / 2,
            cy - h / 2,
            cx + w / 2,
            cy + h / 2,
        )
        boxes.append((int(cls), box))

    overlaps = []

    for (class_a, box_a), (class_b, box_b) in combinations(boxes, 2):
        score = iou(box_a, box_b)

        if score >= IOU_THRESHOLD:
            overlaps.append((class_a, class_b, score))

    if overlaps:
        print(f"\n{label_file.name}:")
        for class_a, class_b, score in overlaps:
            print(
                f"  classes {class_a}/{class_b}, "
                f"IoU={score:.2f}"
            )
        found += 1

        if found >= 20:
            break

print(f"\nImages with high-overlap box pairs: {found}")
