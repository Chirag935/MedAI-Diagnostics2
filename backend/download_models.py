"""
Download pre-trained model files from external storage at build/deploy time.

Set the following environment variables on your hosting service (Render):
  MODEL_URL_SKIN       -> direct URL to skin_disease_model.h5
  MODEL_URL_DERMNET    -> direct URL to dermnet_model.h5
  MODEL_URL_SYMPTOM_V1 -> direct URL to symptom_disease_model.pkl
  MODEL_URL_SYMPTOM_V2 -> direct URL to symptom_disease_model_v2.pkl

If a URL is unset, that model is skipped (the corresponding feature will
fall back gracefully or be unavailable). Recommended host: Hugging Face Hub.
"""
import os
import sys
import urllib.request
from pathlib import Path

MODELS_DIR = Path(__file__).parent / "models"
MODELS_DIR.mkdir(parents=True, exist_ok=True)

DOWNLOADS = {
    "skin_disease_model.h5":       os.getenv("MODEL_URL_SKIN"),
    "dermnet_model.h5":            os.getenv("MODEL_URL_DERMNET"),
    "symptom_disease_model.pkl":   os.getenv("MODEL_URL_SYMPTOM_V1"),
    "symptom_disease_model_v2.pkl": os.getenv("MODEL_URL_SYMPTOM_V2"),
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
        # Use a UA header — Hugging Face and some CDNs reject default urllib UA
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=180) as r, open(dest, "wb") as f:
            while True:
                chunk = r.read(1024 * 1024)
                if not chunk:
                    break
                f.write(chunk)
        print(f"[ok] saved {name} ({dest.stat().st_size} bytes)")
    except Exception as e:
        print(f"[error] failed to download {name}: {e}", file=sys.stderr)
        # Don't exit — let the server start with whatever models are available
        # so non-broken features still work.


if __name__ == "__main__":
    for name, url in DOWNLOADS.items():
        download(name, url)
    print("[done] model downloads complete")
