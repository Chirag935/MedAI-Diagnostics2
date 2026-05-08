"""
Download pre-trained model files from external storage at build/deploy time.
Set MODEL_URL_SKIN and (optionally) MODEL_URL_SKIN_META as environment variables.
"""
import os
import sys
import urllib.request
from pathlib import Path

MODELS_DIR = Path(__file__).parent / "models"
MODELS_DIR.mkdir(parents=True, exist_ok=True)

DOWNLOADS = {
    "skin_disease_model.h5": os.getenv("MODEL_URL_SKIN"),
    "skin_disease_metadata.json": os.getenv("MODEL_URL_SKIN_META"),
}


def download(name: str, url: str) -> None:
    if not url:
        print(f"[skip] No URL set for {name}")
        return
    dest = MODELS_DIR / name
    if dest.exists() and dest.stat().st_size > 0:
        print(f"[skip] {name} already exists ({dest.stat().st_size} bytes)")
        return
    print(f"[download] {name} <- {url}")
    try:
        urllib.request.urlretrieve(url, dest)
        print(f"[ok] saved {name} ({dest.stat().st_size} bytes)")
    except Exception as e:
        print(f"[error] failed to download {name}: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    for name, url in DOWNLOADS.items():
        download(name, url)
    print("[done] model downloads complete")
