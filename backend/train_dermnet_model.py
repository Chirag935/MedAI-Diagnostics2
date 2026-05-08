"""
DermNet Eczema/Acne Classifier Trainer
======================================

Trains a small MobileNetV2 transfer-learning classifier on DermNet to
distinguish:
    - eczema  (DermNet "Eczema Photos" + similar)
    - acne    (DermNet "Acne and Rosacea Photos" + similar)
    - other   (sampled from all other DermNet classes — negative class)

This is the COMPLEMENT to the HAM10000 model:
    - HAM10000 model -> melanoma & dermatoscopic lesions
    - This model     -> eczema & acne (inflammatory conditions)

USAGE
-----
    cd backend
    python train_dermnet_model.py

~15-25 min on CPU. Produces:
    backend/models/dermnet_model.h5            (~14 MB)
    backend/models/dermnet_metadata.json
"""
from __future__ import annotations
import json
import os
import random
import shutil
from pathlib import Path

DATA_DIR = Path("data/dermnet/train")
MODELS_DIR = Path("models")
WORKING_DIR = Path("data/dermnet_3class")  # restructured for tf.keras flow_from_directory

IMG_SIZE = 224
BATCH_SIZE = 32
EPOCHS_HEAD = 8
EPOCHS_FINE = 10
SEED = 42
FINE_TUNE_LAYERS = 40

# DermNet folder name keywords that map to our 3 target classes.
# Folder names include phrases like "Eczema Photos", "Acne and Rosacea Photos", etc.
ECZEMA_KEYWORDS = ["eczema", "atopic", "dermatitis"]
ACNE_KEYWORDS = ["acne", "rosacea"]
# "other" = everything else, downsampled

CLASSES = ["eczema", "acne", "other"]
LABELS = {
    "eczema": "Eczema / Atopic Dermatitis",
    "acne":   "Acne / Rosacea",
    "other":  "Other Skin Condition",
}


def classify_folder(name: str) -> str:
    n = name.lower()
    if any(k in n for k in ECZEMA_KEYWORDS):
        return "eczema"
    if any(k in n for k in ACNE_KEYWORDS):
        return "acne"
    return "other"


def build_3class_dataset():
    """Restructure DermNet into 3 folders: eczema/, acne/, other/."""
    if not DATA_DIR.exists():
        raise FileNotFoundError(
            f"DermNet data not found at {DATA_DIR}. "
            "Run: python download_dermnet.py first."
        )

    if WORKING_DIR.exists():
        print(f"[INFO] Removing old working dir {WORKING_DIR}")
        shutil.rmtree(WORKING_DIR)

    for cls in CLASSES:
        (WORKING_DIR / cls).mkdir(parents=True, exist_ok=True)

    print("[1/4] Categorizing DermNet folders into 3 classes...")
    folders_by_class = {"eczema": [], "acne": [], "other": []}
    for sub in DATA_DIR.iterdir():
        if sub.is_dir():
            cls = classify_folder(sub.name)
            folders_by_class[cls].append(sub)

    for cls, folders in folders_by_class.items():
        print(f"      {cls}: {len(folders)} source folders")
        for f in folders:
            print(f"         - {f.name}")

    if not folders_by_class["eczema"] or not folders_by_class["acne"]:
        raise RuntimeError(
            "Could not find eczema or acne folders in DermNet. "
            "Verify the dataset extraction is correct."
        )

    print("\n[2/4] Copying images to 3-class structure...")
    counts = {}
    rng = random.Random(SEED)

    # First, count eczema + acne images (these are our minority classes — keep all)
    for cls in ("eczema", "acne"):
        n = 0
        for src_folder in folders_by_class[cls]:
            for img in src_folder.glob("*"):
                if img.suffix.lower() in (".jpg", ".jpeg", ".png"):
                    target = WORKING_DIR / cls / f"{src_folder.name}_{img.name}"
                    shutil.copy2(img, target)
                    n += 1
        counts[cls] = n
        print(f"      {cls}: {n} images")

    # Cap "other" to roughly the size of the larger of eczema/acne to keep balanced.
    cap = max(counts["eczema"], counts["acne"])
    other_imgs = []
    for src_folder in folders_by_class["other"]:
        for img in src_folder.glob("*"):
            if img.suffix.lower() in (".jpg", ".jpeg", ".png"):
                other_imgs.append((src_folder.name, img))
    rng.shuffle(other_imgs)
    other_imgs = other_imgs[:cap]
    for src_name, img in other_imgs:
        target = WORKING_DIR / "other" / f"{src_name}_{img.name}"
        shutil.copy2(img, target)
    counts["other"] = len(other_imgs)
    print(f"      other: {counts['other']} images (capped at {cap})")

    print(f"\n[INFO] Final dataset size: {sum(counts.values())} images")
    return counts


def train():
    try:
        import tensorflow as tf
        from tensorflow.keras import layers, models, optimizers, callbacks
        from tensorflow.keras.applications import MobileNetV2
        from tensorflow.keras.applications.mobilenet_v2 import preprocess_input
        import numpy as np
    except ImportError as e:
        print(f"[ERROR] Missing dependency: {e}")
        print('       pip install "tensorflow-cpu>=2.15.0,<2.17.0"')
        return

    counts = build_3class_dataset()

    print("\n[3/4] Building tf.data pipelines...")
    raw_ds = tf.keras.utils.image_dataset_from_directory(
        WORKING_DIR,
        labels="inferred",
        label_mode="int",
        class_names=CLASSES,
        image_size=(IMG_SIZE, IMG_SIZE),
        batch_size=None,  # we'll batch after split
        shuffle=True,
        seed=SEED,
    )

    # Manual 80/20 split
    total = sum(counts.values())
    val_size = int(total * 0.2)
    val_ds = raw_ds.take(val_size)
    train_ds = raw_ds.skip(val_size)

    augment = tf.keras.Sequential([
        layers.RandomFlip("horizontal_and_vertical"),
        layers.RandomRotation(0.15),
        layers.RandomZoom(0.1),
        layers.RandomBrightness(0.15),
        layers.RandomContrast(0.1),
    ])

    def prep(img, label, training=False):
        img = tf.cast(img, tf.float32)
        if training:
            img = augment(img)
        img = preprocess_input(img)
        return img, label

    train_ds = (
        train_ds
        .map(lambda x, y: prep(x, y, training=True), num_parallel_calls=tf.data.AUTOTUNE)
        .batch(BATCH_SIZE)
        .prefetch(tf.data.AUTOTUNE)
    )
    val_ds = (
        val_ds
        .map(lambda x, y: prep(x, y, training=False), num_parallel_calls=tf.data.AUTOTUNE)
        .batch(BATCH_SIZE)
        .prefetch(tf.data.AUTOTUNE)
    )

    # Class weights (in case 'other' was capped lower than minorities)
    weights = {}
    n_total = sum(counts.values())
    for i, cls in enumerate(CLASSES):
        weights[i] = n_total / (len(CLASSES) * counts[cls])
    print(f"      Class weights: {weights}")

    print("\n[4/4] Building MobileNetV2 transfer-learning model...")
    base = MobileNetV2(input_shape=(IMG_SIZE, IMG_SIZE, 3), include_top=False, weights="imagenet")
    base.trainable = False

    model = models.Sequential([
        base,
        layers.GlobalAveragePooling2D(),
        layers.Dropout(0.3),
        layers.Dense(128, activation="relu"),
        layers.Dropout(0.2),
        layers.Dense(len(CLASSES), activation="softmax"),
    ])
    model.compile(
        optimizer=optimizers.Adam(1e-3),
        loss="sparse_categorical_crossentropy",
        metrics=["accuracy"],
    )

    print(f"\n[Stage 1] Training head ({EPOCHS_HEAD} epochs)...")
    head_cbs = [
        callbacks.EarlyStopping(monitor="val_accuracy", patience=3,
                                restore_best_weights=True, mode="max"),
        callbacks.ReduceLROnPlateau(monitor="val_loss", factor=0.5,
                                    patience=2, min_lr=1e-6, verbose=1),
    ]
    model.fit(
        train_ds, validation_data=val_ds, epochs=EPOCHS_HEAD,
        class_weight=weights, callbacks=head_cbs, verbose=1,
    )

    print(f"\n[Stage 2] Fine-tuning top {FINE_TUNE_LAYERS} layers ({EPOCHS_FINE} epochs)...")
    base.trainable = True
    for layer in base.layers[:-FINE_TUNE_LAYERS]:
        layer.trainable = False
    for layer in base.layers:
        if isinstance(layer, tf.keras.layers.BatchNormalization):
            layer.trainable = False

    model.compile(
        optimizer=optimizers.Adam(1e-5),
        loss="sparse_categorical_crossentropy",
        metrics=["accuracy"],
    )
    fine_cbs = [
        callbacks.EarlyStopping(monitor="val_accuracy", patience=4,
                                restore_best_weights=True, mode="max"),
        callbacks.ReduceLROnPlateau(monitor="val_loss", factor=0.3,
                                    patience=2, min_lr=1e-7, verbose=1),
    ]
    history = model.fit(
        train_ds, validation_data=val_ds, epochs=EPOCHS_FINE,
        class_weight=weights, callbacks=fine_cbs, verbose=1,
    )

    val_acc = float(max(history.history.get("val_accuracy", [0.0])))
    print(f"\n[DONE] Best validation accuracy: {val_acc:.4f}")

    MODELS_DIR.mkdir(parents=True, exist_ok=True)
    model_path = MODELS_DIR / "dermnet_model.h5"
    model.save(model_path)

    metadata = {
        "classes": CLASSES,
        "class_labels": LABELS,
        "input_shape": [IMG_SIZE, IMG_SIZE, 3],
        "accuracy": round(val_acc, 4),
        "engine": "mobilenetv2_dermnet",
        "backbone": "MobileNetV2",
        "dataset": "DermNet (3-class: eczema/acne/other)",
        "preprocessing": "mobilenet_v2.preprocess_input",
        "class_counts": counts,
    }
    with open(MODELS_DIR / "dermnet_metadata.json", "w") as f:
        json.dump(metadata, f, indent=4)

    print(f"[SAVED] Model: {model_path}  ({model_path.stat().st_size / 1e6:.1f} MB)")
    print(f"[SAVED] Metadata: {MODELS_DIR / 'dermnet_metadata.json'}")


if __name__ == "__main__":
    train()
