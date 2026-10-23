
from ultralytics import YOLO
import torch

print("PyTorch version:", torch.__version__)
print("CUDA GPU available:", torch.cuda.is_available())

# Build YOLO11 nano from its model configuration.
# This does NOT load pretrained weights.
model = YOLO("yolo11n.yaml")

# Train from random initialization.
results = model.train(
    data="dataset/data.yaml",
    epochs=50,
    imgsz=640,
    batch=4,
    patience=10,
    workers=2,
    project="runs/wildlife",
    name="yolo11n_scratch",
    seed=42,
    pretrained=False,
    plots=True
)

print("Training finished.")
print("Best model should be saved under:")
print("runs/wildlife/yolo11n_scratch/weights/best.pt")