
from ultralytics import YOLO
from pathlib import Path

model_path = Path(
    "runs/detect/runs/wildlife/"
    "yolo11n_scratch-2/weights/best.pt"
)

test_images = Path("dataset/images/test")

if not model_path.exists():
    raise FileNotFoundError(f"Model not found: {model_path}")

model = YOLO(str(model_path))

model.predict(
    source=str(test_images),
    imgsz=640,
    conf=0.15,
    save=True,
    project="runs/wildlife",
    name="test_predictions",
    exist_ok=True
)

print("Predictions saved to runs/wildlife/test_predictions")