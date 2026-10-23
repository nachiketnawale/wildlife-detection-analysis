"""
merge_stats.py
--------------
Merges YOLO object detection / classification labels with image timestamp buckets
(Morning, Evening, Night) to generate animal_frequency_data.json.

Format of animal_frequency_data.json:
{
  "Animal Name": {
    "Morning": <count>,
    "Evening": <count>,
    "Night": <count>
  },
  ...
}
"""

import os
import sys
import json
import zipfile
from pathlib import Path
from typing import Dict, Any, Optional, List

# Species dictionary from dataset/data.yaml and project configuration
DEFAULT_SPECIES_MAP = {
    0: "Peccary",
    1: "Zebra",
    2: "Elephant",
    3: "Ocelot",
    4: "Jaguar",
}

SCIENTIFIC_SPECIES_MAP = {
    0: "Tayassu pecari",
    1: "Equus quagga",
    2: "Loxodonta africana",
    3: "Leopardus pardalis",
    4: "Panthera onca",
}


def find_yolo_labels_for_image(
    image_stem: str,
    search_dirs: Optional[List[Path]] = None,
    zip_path: Optional[Path] = None,
    species_map: Optional[Dict[int, str]] = None
) -> List[str]:
    """Find detected animal species for a given image stem from YOLO txt files or zip."""
    if species_map is None:
        species_map = DEFAULT_SPECIES_MAP

    detected_species = []

    # 1. Search local label directories if available
    default_dirs = [
        Path("test_sample_images"),
        Path("dataset/labels"),
        Path("dataset/labels/test"),
        Path("dataset/labels/train"),
        Path("dataset/labels/val"),
        Path("runs/wildlife/test_predictions/labels"),
        Path("labels"),
    ]
    if search_dirs:
        default_dirs = search_dirs + default_dirs

    for base_dir in default_dirs:
        if not base_dir.exists():
            continue
        # Check direct or recursive
        label_file = base_dir / f"{image_stem}.txt"
        if not label_file.exists():
            candidates = list(base_dir.rglob(f"{image_stem}.txt"))
            if candidates:
                label_file = candidates[0]

        if label_file.exists():
            try:
                with open(label_file, "r", encoding="utf-8") as f:
                    for line in f:
                        parts = line.strip().split()
                        if parts:
                            cls_id = int(float(parts[0]))
                            name = species_map.get(cls_id, f"Species_{cls_id}")
                            if name not in detected_species:
                                detected_species.append(name)
                if detected_species:
                    return detected_species
            except Exception:
                pass

    # 2. Check inside dataset.zip if not found in local folders
    if zip_path and zip_path.is_file():
        try:
            with zipfile.ZipFile(zip_path, "r") as z:
                for split in ("test", "train", "val"):
                    zip_entry = f"dataset/labels/{split}/{image_stem}.txt"
                    if zip_entry in z.namelist():
                        content = z.read(zip_entry).decode("utf-8").strip()
                        for line in content.splitlines():
                            parts = line.strip().split()
                            if parts:
                                cls_id = int(float(parts[0]))
                                name = species_map.get(cls_id, f"Species_{cls_id}")
                                if name not in detected_species:
                                    detected_species.append(name)
                        if detected_species:
                            return detected_species
        except Exception:
            pass

    return detected_species or ["Unknown"]


def merge_yolo_and_timestamps(
    timestamp_results_file: str = "timestamp_classification_results.json",
    output_frequency_file: str = "animal_frequency_data.json",
    zip_path: Optional[str] = "dataset.zip",
    use_simple_names: bool = False
) -> Dict[str, Dict[str, int]]:
    """Merge timestamp classification results with YOLO animal labels."""
    species_map = SIMPLE_SPECIES_MAP if use_simple_names else DEFAULT_SPECIES_MAP

    if not os.path.exists(timestamp_results_file):
        raise FileNotFoundError(f"Timestamp results file not found: {timestamp_results_file}")

    with open(timestamp_results_file, "r", encoding="utf-8") as f:
        data = json.load(f)

    image_results = data.get("results", [])

    # Initialize animal frequency dictionary with known classes
    animal_frequency: Dict[str, Dict[str, int]] = {
        name: {"Morning": 0, "Evening": 0, "Night": 0}
        for name in species_map.values()
    }

    zip_file_obj = Path(zip_path) if zip_path and os.path.exists(zip_path) else None

    for item in image_results:
        filename = item.get("file", "")
        bucket = item.get("bucket", "Unknown")
        stem = Path(filename).stem

        # Skip unknown time buckets
        if bucket not in ("Morning", "Evening", "Night"):
            continue

        animals = find_yolo_labels_for_image(stem, zip_path=zip_file_obj, species_map=species_map)

        for animal in animals:
            if animal not in animal_frequency:
                animal_frequency[animal] = {"Morning": 0, "Evening": 0, "Night": 0}
            animal_frequency[animal][bucket] += 1

    # Filter out empty classes or keep classes that have at least one sighting, or all registered species
    with open(output_frequency_file, "w", encoding="utf-8") as f:
        json.dump(animal_frequency, f, indent=2)

    return animal_frequency


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="Merge YOLO animal labels with timestamp buckets.")
    parser.add_argument("--timestamps", default="timestamp_classification_results.json", help="Input timestamp JSON file")
    parser.add_argument("--output", default="animal_frequency_data.json", help="Output frequency JSON file")
    parser.add_argument("--zip", default="dataset.zip", help="Path to dataset.zip")
    parser.add_argument("--simple-names", action="store_true", help="Use simplified animal names (e.g., Jaguar instead of Panthera onca)")
    args = parser.parse_args()

    try:
        freq = merge_yolo_and_timestamps(
            timestamp_results_file=args.timestamps,
            output_frequency_file=args.output,
            zip_path=args.zip,
            use_simple_names=args.simple_names
        )
        print("Successfully generated animal_frequency_data.json:\n")
        print(json.dumps(freq, indent=2))
    except Exception as e:
        print(f"Error during merge: {e}")
        sys.exit(1)
