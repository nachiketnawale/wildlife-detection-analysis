
from pathlib import Path
from PIL import Image, ImageDraw
import math

ROOT = Path("dataset")
OUTPUT = Path("overlap_review.jpg")

files = [
    "1981eef8-92d5-11e9-8c96-000d3a74c7de",
    "dde32b6e-92d4-11e9-b895-000d3a74c7de",
    "df7b8faf-92d4-11e9-83f9-000d3a74c7de",
    "e9ff1040-92d4-11e9-9bd7-000d3a74c7de",
    "fec56596-92d4-11e9-b84f-000d3a74c7de",
]

names = {
    0: "tayassu pecari",
    1: "equus quagga",
    2: "loxodonta africana",
    3: "leopardus pardalis",
    4: "panthera onca",
}

tiles = []
tile_w, tile_h = 640, 440

for stem in files:
    image_path = next(
        (ROOT / "images").rglob(stem + ".jpg"),
        None
    )
    label_path = next(
        (ROOT / "labels").rglob(stem + ".txt"),
        None
    )

    if image_path is None or label_path is None:
        print("Missing image or label:", stem)
        continue

    with Image.open(image_path) as im:
        im = im.convert("RGB")
        im.thumbnail((tile_w, tile_h - 35))

    tile = Image.new("RGB", (tile_w, tile_h), "white")
    tile.paste(im, ((tile_w - im.width) // 2, 35))
    draw = ImageDraw.Draw(tile)
    draw.text((8, 8), stem, fill="black")

    scale_x = im.width
    scale_y = im.height
    offset_x = (tile_w - im.width) // 2
    offset_y = 35

    # Read original image size for normalized YOLO coordinates.
    with Image.open(image_path) as original:
        original_w, original_h = original.size

    for line in label_path.read_text().splitlines():
        parts = line.split()
        if len(parts) != 5:
            continue

        cls = int(parts[0])
        cx, cy, bw, bh = map(float, parts[1:])

        x1 = offset_x + (cx - bw / 2) * scale_x
        y1 = offset_y + (cy - bh / 2) * scale_y
        x2 = offset_x + (cx + bw / 2) * scale_x
        y2 = offset_y + (cy + bh / 2) * scale_y

        draw.rectangle((x1, y1, x2, y2), outline="red", width=3)
        draw.text(
            (x1, max(offset_y, y1 - 13)),
            names.get(cls, str(cls)),
            fill="yellow",
            stroke_width=1,
            stroke_fill="black",
        )

    tiles.append(tile)

columns = 2
rows = math.ceil(len(tiles) / columns)
sheet = Image.new("RGB", (columns * tile_w, rows * tile_h), "#cccccc")

for i, tile in enumerate(tiles):
    sheet.paste(tile, ((i % columns) * tile_w, (i // columns) * tile_h))

sheet.save(OUTPUT)
print("Saved review image:", OUTPUT.resolve())
