
from pathlib import Path
from PIL import Image, ImageDraw
import random

random.seed(42)

image_dir = Path("dataset/images/train")
label_dir = Path("dataset/labels/train")
output_dir = Path("label_review")
output_dir.mkdir(exist_ok=True)

class_names = {
    0: "tayassu pecari",
    1: "equus quagga",
    2: "loxodonta africana",
    3: "leopardus pardalis",
    4: "panthera onca",
}

images = list(image_dir.glob("*"))
random.shuffle(images)

shown = 0

for image_path in images:
    label_path = label_dir / f"{image_path.stem}.txt"

    if not label_path.exists():
        continue

    with Image.open(image_path) as original:
        image = original.convert("RGB")
    draw = ImageDraw.Draw(image)
    width, height = image.size

    for line in label_path.read_text().splitlines():
        parts = line.split()
        if len(parts) != 5:
            continue

        cls = int(parts[0])
        cx, cy, bw, bh = map(float, parts[1:])

        x1 = (cx - bw / 2) * width
        y1 = (cy - bh / 2) * height
        x2 = (cx + bw / 2) * width
        y2 = (cy + bh / 2) * height

        draw.rectangle((x1, y1, x2, y2), outline="red", width=3)
        draw.text(
            (x1, max(0, y1 - 14)),
            class_names.get(cls, str(cls)),
            fill="yellow",
            stroke_width=1,
            stroke_fill="black",
        )

    output_path = output_dir / image_path.name
    image.save(output_path)
    shown += 1

    if shown >= 12:
        break

print(f"Created {shown} labelled images in: {output_dir}")
