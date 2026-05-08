"""
DermNet Dataset Downloader
==========================

Downloads the DermNet skin-disease image dataset for training the
eczema/acne classifier that complements the HAM10000 model.

Dataset: shubhamg2208/dermnet (Kaggle)
  - 23 skin disease classes, ~19,500 images, ~1.5 GB
  - Organized as folders per class under train/ and test/

USAGE
-----
    cd backend
    python download_dermnet.py

Auth options (in priority order):
  1. kagglehub (recommended) - reads ~/.kaggle/kaggle.json automatically
  2. Manual download - if both fail, prints instructions

After successful download, files end up at:
    backend/data/dermnet/train/<class>/*.jpg
    backend/data/dermnet/test/<class>/*.jpg
"""
from __future__ import annotations
import os
import shutil
import sys
from pathlib import Path

DATA_DIR = Path("data/dermnet")
DATASET_SLUG = "shubhamgoel27/dermnet"


def already_downloaded() -> bool:
    train = DATA_DIR / "train"
    return train.exists() and any(train.iterdir())


def try_kagglehub() -> bool:
    try:
        import kagglehub
    except ImportError:
        print("[INFO] kagglehub not installed. Installing...")
        os.system(f'"{sys.executable}" -m pip install kagglehub --quiet')
        try:
            import kagglehub
        except ImportError:
            print("[ERROR] Could not install kagglehub.")
            return False

    print(f"[INFO] Downloading {DATASET_SLUG} via kagglehub...")
    print("[INFO] This is ~1.5 GB and may take 5-15 minutes.")
    try:
        path = kagglehub.dataset_download(DATASET_SLUG)
        print(f"[OK] Dataset downloaded to: {path}")
    except Exception as e:
        print(f"[ERROR] kagglehub download failed: {e}")
        return False

    # kagglehub puts files in a cache dir. Copy/symlink to our data dir.
    src = Path(path)
    DATA_DIR.mkdir(parents=True, exist_ok=True)

    # Find the train/ and test/ subdirs anywhere inside the downloaded folder
    train_src = None
    test_src = None
    for sub in src.rglob("*"):
        if sub.is_dir() and sub.name.lower() == "train" and train_src is None:
            train_src = sub
        elif sub.is_dir() and sub.name.lower() == "test" and test_src is None:
            test_src = sub

    if not train_src:
        print(f"[ERROR] Couldn't find train/ folder inside {src}")
        return False

    print(f"[INFO] Linking train/ from {train_src}")
    target_train = DATA_DIR / "train"
    if target_train.exists():
        if target_train.is_symlink():
            target_train.unlink()
        else:
            shutil.rmtree(target_train)
    try:
        # Symlink first (fast, no disk duplication)
        os.symlink(train_src, target_train, target_is_directory=True)
    except (OSError, NotImplementedError):
        print("[INFO] Symlink failed (Windows perms?). Copying instead...")
        shutil.copytree(train_src, target_train)

    if test_src:
        print(f"[INFO] Linking test/ from {test_src}")
        target_test = DATA_DIR / "test"
        if target_test.exists():
            if target_test.is_symlink():
                target_test.unlink()
            else:
                shutil.rmtree(target_test)
        try:
            os.symlink(test_src, target_test, target_is_directory=True)
        except (OSError, NotImplementedError):
            shutil.copytree(test_src, target_test)

    return True


def manual_instructions():
    print("\n" + "=" * 60)
    print("MANUAL DOWNLOAD REQUIRED")
    print("=" * 60)
    print("kagglehub auto-download failed. To download manually:")
    print()
    print("1. Sign in at https://www.kaggle.com")
    print("2. Visit: https://www.kaggle.com/datasets/shubhamg2208/dermnet")
    print("3. Click 'Download' (top right) - downloads dermnet.zip (~1.5 GB)")
    print("4. Extract the zip into:")
    print(f"     {DATA_DIR.resolve()}")
    print("   You should end up with:")
    print(f"     {DATA_DIR}/train/<class folders>/")
    print(f"     {DATA_DIR}/test/<class folders>/")
    print()
    print("5. Re-run: python download_dermnet.py  (will detect existing data)")
    print("=" * 60)


def list_classes():
    train = DATA_DIR / "train"
    if not train.exists():
        return
    classes = sorted([p.name for p in train.iterdir() if p.is_dir()])
    print(f"\n[OK] Found {len(classes)} disease classes:")
    for c in classes:
        n = len(list((train / c).glob("*")))
        marker = "  <-- TARGET" if any(k in c.lower() for k in ["eczema", "acne", "rosacea"]) else ""
        print(f"    {c:50s}  ({n} images){marker}")


def main():
    if already_downloaded():
        print(f"[OK] Dataset already present at {DATA_DIR}")
        list_classes()
        return

    print(f"[INFO] Target directory: {DATA_DIR.resolve()}")
    DATA_DIR.mkdir(parents=True, exist_ok=True)

    if try_kagglehub():
        print("\n[SUCCESS] DermNet dataset ready.")
        list_classes()
        print("\n[NEXT] Run: python train_dermnet_model.py")
    else:
        manual_instructions()


if __name__ == "__main__":
    main()
