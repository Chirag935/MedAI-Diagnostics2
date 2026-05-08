"""
Symptom-Disease Model V2 — Fine-Tuned with Patient Profile Features
====================================================================

Augments the original Disease Symptom Prediction dataset with synthetic
age_group and duration features based on each disease's epidemiological
profile. The retrained model can then use those features as direct inputs,
not just as post-hoc priors.

Augmentation strategy:
  - For each original row (disease D), sample 3 versions with
    age/duration drawn from D's empirical distribution.
  - Result: ~3x rows, each with 132 symptoms + 8 one-hot patient-profile
    features = 140 features.

Fine-tune outcome:
  - models/symptom_disease_model_v2.pkl
  - models/symptom_disease_metadata_v2.json

Inference (skin_analyzer / symptom_checker) will auto-detect v2 and use it.
"""
from __future__ import annotations
import os
import json
import random
from pathlib import Path

import numpy as np
import pandas as pd
import joblib

DATA_PATH = Path("data/symptom_training.csv")
MODELS_DIR = Path("models")
SEED = 42
AUGMENT_FACTOR = 3  # how many synthetic rows per original

AGE_GROUPS = ["child", "teen", "adult", "senior"]
DURATIONS = ["hours", "days", "weeks", "chronic"]

# ---------------------------------------------------------------------------
# Per-disease epidemiological profile.
# Each profile gives rough P(age_group) and P(duration) when a patient
# presents with that disease. These are the same priors used in the rule layer
# but here they're baked into the training data so the model learns to use them.
# ---------------------------------------------------------------------------
def _ages(c=0.0, t=0.0, a=1.0, s=0.0):
    total = c + t + a + s or 1.0
    return {"child": c / total, "teen": t / total, "adult": a / total, "senior": s / total}

def _durs(h=0.0, d=1.0, w=0.0, ch=0.0):
    total = h + d + w + ch or 1.0
    return {"hours": h / total, "days": d / total, "weeks": w / total, "chronic": ch / total}


DISEASE_PROFILE = {
    # Acute mild — broad ages, short duration
    "Common Cold":          {"ages": _ages(3, 2, 4, 2), "durs": _durs(1, 6, 2, 0)},
    "Allergy":              {"ages": _ages(2, 2, 4, 2), "durs": _durs(2, 4, 2, 1)},
    "Migraine":             {"ages": _ages(0.5, 2, 6, 1.5), "durs": _durs(4, 3, 1, 1)},
    "GERD":                 {"ages": _ages(0.5, 1, 6, 3), "durs": _durs(1, 3, 3, 4)},
    "Gastroenteritis":      {"ages": _ages(3, 2, 4, 1), "durs": _durs(2, 6, 1, 0)},
    "Hypoglycemia":         {"ages": _ages(1, 1, 5, 3), "durs": _durs(5, 3, 1, 0)},
    "Drug Reaction":        {"ages": _ages(1, 1, 5, 3), "durs": _durs(3, 5, 1, 0)},
    "Peptic ulcer disease": {"ages": _ages(0, 1, 6, 3), "durs": _durs(0, 2, 4, 4)},
    "Urinary tract infection": {"ages": _ages(0.5, 1, 6, 2.5), "durs": _durs(1, 6, 2, 0)},
    "Impetigo":             {"ages": _ages(6, 2, 1, 1), "durs": _durs(0, 4, 4, 1)},
    "Chicken pox":          {"ages": _ages(7, 2, 1, 0), "durs": _durs(0, 3, 6, 0)},

    # Common chronic — adults/seniors, longer duration
    "Acne":                 {"ages": _ages(0, 7, 3, 0), "durs": _durs(0, 1, 3, 5)},
    "Fungal infection":     {"ages": _ages(2, 2, 4, 2), "durs": _durs(0, 2, 4, 3)},
    "Psoriasis":            {"ages": _ages(0, 1, 5, 4), "durs": _durs(0, 0, 1, 8)},
    "Cervical spondylosis": {"ages": _ages(0, 0, 4, 6), "durs": _durs(0, 0, 1, 8)},
    "Osteoarthritis":       {"ages": _ages(0, 0, 3, 7), "durs": _durs(0, 0, 1, 8)},
    "Arthritis":            {"ages": _ages(0, 0, 4, 6), "durs": _durs(0, 0, 1, 8)},
    "Varicose veins":       {"ages": _ages(0, 0, 4, 6), "durs": _durs(0, 0, 1, 8)},
    "Bronchial Asthma":     {"ages": _ages(3, 2, 3, 2), "durs": _durs(1, 2, 2, 5)},
    "(vertigo) Paroxysmal Positional Vertigo": {"ages": _ages(0, 1, 4, 5), "durs": _durs(2, 4, 2, 1)},
    "Dimorphic hemorrhoids (piles)":           {"ages": _ages(0, 0, 5, 5), "durs": _durs(0, 1, 3, 5)},

    # Moderate
    "Diabetes":             {"ages": _ages(0, 1, 4, 5), "durs": _durs(0, 0, 1, 8)},
    "Hypertension":         {"ages": _ages(0, 0, 4, 6), "durs": _durs(0, 0, 1, 8)},
    "Hypothyroidism":       {"ages": _ages(0, 1, 5, 4), "durs": _durs(0, 0, 1, 8)},
    "Hyperthyroidism":      {"ages": _ages(0, 1, 6, 3), "durs": _durs(0, 1, 2, 6)},
    "Dengue":               {"ages": _ages(2, 2, 4, 2), "durs": _durs(1, 7, 1, 0)},
    "Typhoid":              {"ages": _ages(2, 3, 4, 1), "durs": _durs(0, 4, 5, 0)},
    "Malaria":              {"ages": _ages(2, 2, 4, 2), "durs": _durs(2, 6, 1, 0)},
    "Pneumonia":            {"ages": _ages(2, 1, 3, 4), "durs": _durs(1, 5, 3, 0)},
    "Hepatitis A":          {"ages": _ages(3, 2, 4, 1), "durs": _durs(0, 2, 5, 2)},
    "Hepatitis E":          {"ages": _ages(2, 2, 4, 2), "durs": _durs(0, 2, 5, 2)},
    "Jaundice":             {"ages": _ages(2, 1, 4, 3), "durs": _durs(0, 3, 5, 1)},
    "Chronic cholestasis":  {"ages": _ages(0, 1, 4, 5), "durs": _durs(0, 0, 1, 8)},

    # Severe
    "Heart attack":         {"ages": _ages(0, 0, 3, 7), "durs": _durs(7, 2, 0, 0)},
    "Paralysis (brain hemorrhage)": {"ages": _ages(0, 0, 3, 7), "durs": _durs(8, 1, 0, 0)},
    "Tuberculosis":         {"ages": _ages(1, 1, 4, 4), "durs": _durs(0, 0, 2, 7)},
    "AIDS":                 {"ages": _ages(0, 1, 7, 2), "durs": _durs(0, 0, 1, 8)},
    "Hepatitis B":          {"ages": _ages(0, 1, 6, 3), "durs": _durs(0, 0, 1, 8)},
    "Hepatitis C":          {"ages": _ages(0, 0, 5, 5), "durs": _durs(0, 0, 1, 8)},
    "Hepatitis D":          {"ages": _ages(0, 0, 5, 5), "durs": _durs(0, 0, 1, 8)},
    "Alcoholic hepatitis":  {"ages": _ages(0, 0, 6, 4), "durs": _durs(0, 0, 1, 8)},
}

DEFAULT_PROFILE = {"ages": _ages(1, 1, 1, 1), "durs": _durs(1, 1, 1, 1)}


def _sample_from(dist: dict, rng: random.Random) -> str:
    keys = list(dist.keys())
    weights = [dist[k] for k in keys]
    return rng.choices(keys, weights=weights, k=1)[0]


def augment(df: pd.DataFrame) -> pd.DataFrame:
    """Add age_group + duration features. Each row spawns AUGMENT_FACTOR variants."""
    rng = random.Random(SEED)
    rows = []
    for _, r in df.iterrows():
        disease = r["prognosis"]
        profile = DISEASE_PROFILE.get(disease, DEFAULT_PROFILE)
        for _ in range(AUGMENT_FACTOR):
            new = r.copy()
            ag = _sample_from(profile["ages"], rng)
            du = _sample_from(profile["durs"], rng)
            for g in AGE_GROUPS:
                new[f"age_{g}"] = 1 if ag == g else 0
            for d in DURATIONS:
                new[f"dur_{d}"] = 1 if du == d else 0
            rows.append(new)
    return pd.DataFrame(rows).reset_index(drop=True)


def main():
    print("[1/4] Loading existing dataset...")
    df = pd.read_csv(DATA_PATH)
    df = df.dropna(axis=1, how="all")
    print(f"      Loaded: {len(df)} rows, {len(df.columns)-1} symptoms, {df['prognosis'].nunique()} diseases")

    print(f"[2/4] Augmenting with synthetic age + duration features (×{AUGMENT_FACTOR})...")
    df_aug = augment(df)
    print(f"      Augmented size: {len(df_aug)} rows, {len(df_aug.columns)-1} features")

    X = df_aug.drop("prognosis", axis=1)
    y = df_aug["prognosis"]
    feature_cols = list(X.columns)
    diseases = sorted(y.unique().tolist())

    print("[3/4] Training RandomForest on augmented data...")
    from sklearn.ensemble import RandomForestClassifier
    from sklearn.model_selection import train_test_split
    from sklearn.metrics import accuracy_score

    X_tr, X_te, y_tr, y_te = train_test_split(X, y, test_size=0.2,
                                              stratify=y, random_state=SEED)
    model = RandomForestClassifier(
        n_estimators=200, max_depth=None,
        class_weight="balanced", random_state=SEED, n_jobs=-1,
    )
    model.fit(X_tr, y_tr)
    acc = accuracy_score(y_te, model.predict(X_te))
    print(f"      Validation accuracy: {acc*100:.2f}%")

    print("[4/4] Saving model + metadata...")
    MODELS_DIR.mkdir(exist_ok=True)
    joblib.dump(model, MODELS_DIR / "symptom_disease_model_v2.pkl")

    # Separate symptom feature columns from patient-profile columns
    symptom_cols = [c for c in feature_cols if not (c.startswith("age_") or c.startswith("dur_"))]
    profile_cols = [c for c in feature_cols if c.startswith("age_") or c.startswith("dur_")]

    metadata = {
        "version": 2,
        "symptoms": symptom_cols,
        "profile_features": profile_cols,
        "feature_order": feature_cols,
        "diseases": diseases,
        "accuracy": round(acc, 4),
        "augment_factor": AUGMENT_FACTOR,
        "training_rows": len(df_aug),
    }
    with open(MODELS_DIR / "symptom_disease_metadata_v2.json", "w") as f:
        json.dump(metadata, f, indent=4)

    print(f"\n[DONE] Saved:")
    print(f"   models/symptom_disease_model_v2.pkl")
    print(f"   models/symptom_disease_metadata_v2.json")
    print(f"   Accuracy: {acc*100:.2f}%  | Features: {len(feature_cols)}  | Diseases: {len(diseases)}")


if __name__ == "__main__":
    main()
