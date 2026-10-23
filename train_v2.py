
from ultralytics import YOLO
import torch

print("PyTorch version:", torch.__version__)
print("CUDA GPU available:", torch.cuda.is_available())
print("Starting wildlife model training from scratch...")

# Build a new YOLO11 Nano model from its architecture.
# Do not load pretrained weights.
model = YOLO("yolo11n.yaml")

results = model.train(
    data="dataset_v2/data.yaml",
    epochs=100,
    imgsz=640,
    batch=4,
    patience=15,
    workers=2,
    project="runs/wildlife_v2",
    name="yolo11n_scratch_10classes",
    seed=42,
    pretrained=False,
    plots=True
)

print("Training finished.")
print("Check the training output for the best.pt checkpoint path.")
