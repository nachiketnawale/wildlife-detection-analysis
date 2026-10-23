from flask import request, redirect, url_for
from werkzeug.utils import secure_filename
from ultralytics import YOLO
from PIL import Image, ImageDraw
from pathlib import Path
import re
import yaml
import json
import uuid
from flask import abort
from flask import Flask, render_template, jsonify


app = Flask(__name__)

ROOT = Path(__file__).resolve().parent

MODEL_PATH = ROOT / "models" / "wildlife_yolo_pretrained_best.pt"

UPLOAD_DIR = ROOT / "uploads"
UPLOAD_DIR.mkdir(exist_ok=True)

ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}

model = None
model_error = None

try:
    if MODEL_PATH.exists():
        model = YOLO(str(MODEL_PATH))
    else:
        model_error = f"Model checkpoint not found: {MODEL_PATH}"
except Exception as exc:
    model_error = str(exc)

DATASET = ROOT / "dataset"
DATA_YAML = DATASET / "data.yaml"

SPECIES_NAMES = [
    "tayassu pecari",
    "equus quagga",
    "loxodonta africana",
    "leopardus pardalis",
    "panthera onca",
]
LEARNING_DIR = ROOT / "learning_data"
INBOX_DIR = LEARNING_DIR / "inbox"
VERIFIED_DIR = LEARNING_DIR / "verified"
VERIFIED_IMAGES = VERIFIED_DIR / "images"
VERIFIED_LABELS = VERIFIED_DIR / "labels"
CLASSES_FILE = LEARNING_DIR / "classes.json"

for folder in [
    INBOX_DIR,
    VERIFIED_IMAGES,
    VERIFIED_LABELS,
]:
    folder.mkdir(parents=True, exist_ok=True)


def load_learning_classes():
    """Load class IDs while preserving existing model class order."""
    if CLASSES_FILE.exists():
        with open(CLASSES_FILE, "r", encoding="utf-8") as f:
            classes = json.load(f)
        return classes

    classes = {
        str(i): name for i, name in enumerate(SPECIES_NAMES)
    }
    with open(CLASSES_FILE, "w", encoding="utf-8") as f:
        json.dump(classes, f, indent=2)

    return classes

def load_dataset_info():
    """Read dataset configuration and count images and labels."""
    info = {
        "species": SPECIES_NAMES,
        "splits": {},
        "total_images": 0,
        "total_boxes": 0,
        "dataset_ready": False,
        "error": None,
    }

    if not DATA_YAML.exists():
        info["error"] = "dataset/data.yaml was not found."
        return info

    try:
        with open(DATA_YAML, "r", encoding="utf-8") as file:
            config = yaml.safe_load(file) or {}

        names = config.get("names", SPECIES_NAMES)
        if isinstance(names, dict):
            names = [names[k] for k in sorted(names, key=lambda x: int(x))]
        info["species"] = names

        for split in ["train", "val", "test"]:
            image_dir = DATASET / "images" / split
            label_dir = DATASET / "labels" / split

            images = (
                len([
                    p for p in image_dir.iterdir()
                    if p.is_file() and p.suffix.lower() in
                    {".jpg", ".jpeg", ".png", ".webp"}
                ])
                if image_dir.exists() else 0
            )

            boxes = 0
            if label_dir.exists():
                for label_file in label_dir.glob("*.txt"):
                    try:
                        with open(label_file, "r", encoding="utf-8") as f:
                            for line in f:
                                if line.strip():
                                    boxes += 1
                    except OSError:
                        pass

            info["splits"][split] = {
                "images": images,
                "boxes": boxes,
            }
            info["total_images"] += images
            info["total_boxes"] += boxes

        info["dataset_ready"] = info["total_images"] > 0
        return info

    except Exception as exc:
        info["error"] = str(exc)
        return info


@app.route("/")
def dashboard():
    info = load_dataset_info()
    return render_template("index.html", info=info)


@app.route("/api/dataset")
def dataset_api():
    return jsonify(load_dataset_info())


@app.route("/health")
def health():
    return jsonify({"status": "running"})


@app.route("/animal_frequency_data.json")
def animal_frequency_api():
    from flask import send_from_directory
    frequency_file = ROOT / "animal_frequency_data.json"
    if not frequency_file.exists():
        return jsonify({"error": "animal_frequency_data.json is still generating"}), 404
    return send_from_directory(ROOT, "animal_frequency_data.json")


@app.route("/detect", methods=["GET", "POST"])
def detect():
    result_data = None
    error = model_error

    if request.method == "POST":
        uploaded = request.files.get("image")

        if not uploaded or not uploaded.filename:
            error = "Please select an image."
        elif Path(uploaded.filename).suffix.lower() not in ALLOWED_EXTENSIONS:
            error = "Upload a JPG, JPEG, PNG, or WEBP image."
        elif model is None:
            error = "The YOLO model could not be loaded: " + str(model_error)
        else:
            try:
                image = Image.open(uploaded.stream).convert("RGB")
                prediction = model.predict(
                    source=image,
                    imgsz=640,
                    conf=0.05,
                    verbose=False
                )[0]

                output_image = prediction.plot()
                from PIL import Image as PILImage
                rendered = PILImage.fromarray(output_image[:, :, ::-1])

                import uuid
                output_name = f"{uuid.uuid4().hex}.jpg"
                output_path = UPLOAD_DIR / output_name
                rendered.save(output_path, format="JPEG")

                detections = []
                names = prediction.names

                if prediction.boxes is not None:
                    for box in prediction.boxes:
                        class_id = int(box.cls.item())
                        confidence = float(box.conf.item())
                        detections.append({
                            "species": names.get(class_id, str(class_id)),
                            "confidence": round(confidence * 100, 2),
                        })

                result_data = {
                    "image": f"/uploads/{output_name}",
                    "count": len(detections),
                    "detections": detections,
                }
                error = None

            except Exception as exc:
                error = f"Detection failed: {exc}"

    return render_template(
        "detect.html",
        result=result_data,
        error=error,
        model_ready=model is not None,
    )


@app.route("/uploads/<filename>")
def uploaded_image(filename):
    from flask import send_from_directory
    return send_from_directory(UPLOAD_DIR, filename)

@app.route("/teach")
def teach():
    classes = load_learning_classes()
    return render_template(
        "teach.html",
        classes=classes,
        model_ready=model is not None,
    )


@app.route("/teach/upload", methods=["POST"])
def teach_upload():
    if model is None:
        return jsonify({"error": "YOLO model is unavailable."}), 503

    uploaded = request.files.get("image")

    if not uploaded or not uploaded.filename:
        return jsonify({"error": "Please select an image."}), 400

    if Path(uploaded.filename).suffix.lower() not in ALLOWED_EXTENSIONS:
        return jsonify({"error": "Unsupported image format."}), 400

    try:
        image = Image.open(uploaded.stream).convert("RGB")
        image_id = uuid.uuid4().hex
        filename = f"{image_id}.jpg"
        image_path = INBOX_DIR / filename
        image.save(image_path, "JPEG", quality=95)

        prediction = model.predict(
            source=image,
            imgsz=640,
            conf=0.05,
            verbose=False,
        )[0]

        boxes = []
        if prediction.boxes is not None:
            width, height = image.size

            for box in prediction.boxes:
                x1, y1, x2, y2 = [
                    float(v) for v in box.xyxy[0].tolist()
                ]
                class_id = int(box.cls.item())
                confidence = float(box.conf.item())

                boxes.append({
                    "x1": max(0, min(1, x1 / width)),
                    "y1": max(0, min(1, y1 / height)),
                    "x2": max(0, min(1, x2 / width)),
                    "y2": max(0, min(1, y2 / height)),
                    "class_id": class_id,
                    "confidence": round(confidence * 100, 2),
                })

        return jsonify({
            "image_id": image_id,
            "image_url": url_for("teach_image", filename=filename),
            "width": image.width,
            "height": image.height,
            "boxes": boxes,
            "classes": load_learning_classes(),
        })

    except Exception as exc:
        return jsonify({"error": f"Could not process image: {exc}"}), 500


@app.route("/learning-images/<filename>")
def teach_image(filename):
    # Only serve files from the controlled inbox directory.
    if Path(filename).name != filename or not filename.endswith(".jpg"):
        abort(404)

    from flask import send_from_directory
    return send_from_directory(INBOX_DIR, filename)


@app.route("/teach/save", methods=["POST"])
def teach_save():
    """Save human-reviewed boxes as YOLO-format labels."""
    data = request.get_json(silent=True) or {}
    image_id = data.get("image_id", "")

    # Prevent path traversal and only accept IDs generated by this app.
    if not re.fullmatch(r"[0-9a-f]{32}", image_id):
        return jsonify({"error": "Invalid image ID."}), 400

    source_image = INBOX_DIR / f"{image_id}.jpg"
    if not source_image.exists():
        return jsonify({"error": "Uploaded image not found. Upload it again."}), 404

    boxes = data.get("boxes")
    if not isinstance(boxes, list) or not boxes:
        return jsonify({
            "error": "Add at least one verified bounding box."
        }), 400

    classes = load_learning_classes()
    allowed_ids = {int(k) for k in classes.keys()}

    # Validate and register any user-added species names.
    for box in boxes:
        name = str(box.get("species", "")).strip().lower()
        if not name:
            return jsonify({"error": "Every box needs a species name."}), 400

        if len(name) > 80:
            return jsonify({"error": "Species name is too long."}), 400

        if name not in [v.lower() for v in classes.values()]:
            next_id = max((int(k) for k in classes), default=-1) + 1
            classes[str(next_id)] = name.title()

    # Save class list without changing existing IDs.
    with open(CLASSES_FILE, "w", encoding="utf-8") as f:
        json.dump(classes, f, indent=2)

    name_to_id = {
        value.lower(): int(key) for key, value in classes.items()
    }

    label_lines = []
    for box in boxes:
        try:
            x1 = float(box["x1"])
            y1 = float(box["y1"])
            x2 = float(box["x2"])
            y2 = float(box["y2"])
            species = str(box["species"]).strip().lower()
        except (KeyError, TypeError, ValueError):
            return jsonify({"error": "Invalid bounding box data."}), 400

        if not (
            0 <= x1 < x2 <= 1 and
            0 <= y1 < y2 <= 1
        ):
            return jsonify({
                "error": "A bounding box has invalid coordinates."
            }), 400

        class_id = name_to_id[species]
        cx = (x1 + x2) / 2
        cy = (y1 + y2) / 2
        width = x2 - x1
        height = y2 - y1

        label_lines.append(
            f"{class_id} {cx:.6f} {cy:.6f} {width:.6f} {height:.6f}"
        )

    image_destination = VERIFIED_IMAGES / f"{image_id}.jpg"
    label_destination = VERIFIED_LABELS / f"{image_id}.txt"

    # Do not overwrite previously saved annotations.
    if image_destination.exists() or label_destination.exists():
        return jsonify({
            "error": "This image has already been saved. Upload it again to make a new annotation."
        }), 409

    import shutil
    shutil.copy2(source_image, image_destination)

    with open(label_destination, "w", encoding="utf-8") as f:
        f.write("\n".join(label_lines) + "\n")

    return jsonify({
        "message": "Verified annotations saved successfully.",
        "boxes_saved": len(label_lines),
        "classes": classes,
        "note": "The model has not been retrained yet.",
    })

if __name__ == "__main__":
    print("Wildlife Dashboard")
    print(f"Project folder: {ROOT}")
    print(f"Dataset folder: {DATASET}")
    print(f"Model loaded: {model is not None}")

    app.run(
        debug=True,
        use_reloader=False
    )