from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import pandas as pd
import joblib
import json
import os
import re
import traceback
import numpy as np
import httpx
from datetime import datetime

router = APIRouter()

# Simple disease descriptions for common people
DISEASE_INFO: dict[str, str] = {
    "Fungal infection": "A skin condition caused by fungi. Common symptoms include itching, rash, and skin peeling. Usually treatable with antifungal creams.",
    "Allergy": "Your body's immune system overreacts to something harmless like pollen, food, or dust. Causes sneezing, itching, or rashes.",
    "GERD": "Stomach acid flows back into your food pipe, causing heartburn and chest discomfort. Managed with diet changes and antacids.",
    "Chronic cholestasis": "A liver condition where bile flow is reduced. Causes itching and yellowing of skin. Needs medical evaluation.",
    "Drug Reaction": "An unwanted side effect from medication. Can cause rashes, fever, or nausea. Stop the medication and see a doctor.",
    "Peptic ulcer disease": "Open sores in the stomach lining causing burning stomach pain, especially when hungry. Treatable with medication.",
    "AIDS": "A serious immune system disease caused by HIV. Requires medical diagnosis with blood tests — symptom checkers alone cannot diagnose this. Many common symptoms overlap with less serious conditions.",
    "Diabetes": "Your body has trouble managing blood sugar levels. Causes frequent urination, thirst, and fatigue. Managed with diet, exercise, and medication.",
    "Gastroenteritis": "Stomach flu — an infection causing vomiting, diarrhea, and stomach cramps. Usually resolves in a few days with rest and fluids.",
    "Bronchial Asthma": "Airways in your lungs get narrow, making breathing difficult. Triggers include dust, cold air, and exercise. Managed with inhalers.",
    "Hypertension": "High blood pressure — often has no symptoms but increases risk of heart disease. Managed with lifestyle changes and medication.",
    "Migraine": "Severe throbbing headache, often on one side, with nausea and light sensitivity. Can last hours to days.",
    "Cervical spondylosis": "Wear and tear of neck bones and discs causing neck pain and stiffness. Common with aging.",
    "Paralysis (brain hemorrhage)": "Loss of movement in part of the body due to bleeding in the brain. This is a medical emergency — call 911 immediately.",
    "Jaundice": "Yellowing of skin and eyes due to excess bilirubin. Often signals a liver problem. Needs medical evaluation.",
    "Malaria": "A mosquito-borne infection causing high fever, chills, and sweating. Treatable with antimalarial drugs.",
    "Chicken pox": "A viral infection causing itchy, blister-like rash all over the body. Common in children. Usually mild and self-resolving.",
    "Dengue": "A mosquito-borne viral fever causing high fever, severe headache, and body pain. Needs medical monitoring.",
    "Typhoid": "A bacterial infection from contaminated food/water causing prolonged fever, weakness, and stomach pain. Treatable with antibiotics.",
    "Hepatitis A": "A liver infection from contaminated food/water. Causes fatigue, nausea, and jaundice. Usually resolves on its own.",
    "Hepatitis B": "A serious liver infection spread through blood/body fluids. Can become chronic. Vaccine available for prevention.",
    "Hepatitis C": "A liver infection spread through blood contact. Often has no early symptoms. Curable with modern medications.",
    "Hepatitis D": "A liver infection that only occurs with Hepatitis B. Makes liver disease more severe.",
    "Hepatitis E": "A liver infection from contaminated water. Similar to Hepatitis A. Usually self-resolving.",
    "Alcoholic hepatitis": "Liver inflammation from heavy alcohol use. Causes jaundice, fever, and abdominal pain. Requires stopping alcohol.",
    "Tuberculosis": "A bacterial lung infection causing persistent cough, weight loss, and night sweats. Treatable with a course of antibiotics.",
    "Common Cold": "A mild viral infection of the nose and throat. Causes runny nose, sneezing, and sore throat. Resolves in 7-10 days.",
    "Pneumonia": "A lung infection causing cough with phlegm, fever, and difficulty breathing. May need antibiotics.",
    "Dimorphic hemorrhoids (piles)": "Swollen blood vessels in the rectum causing pain and bleeding during bowel movements. Treatable with diet changes and medication.",
    "Heart attack": "Blood flow to the heart is blocked. Causes chest pain, shortness of breath. This is a medical emergency — call 911.",
    "Varicose veins": "Swollen, twisted veins visible under the skin, usually in legs. Caused by weakened valves. Manageable with compression stockings.",
    "Hypothyroidism": "Your thyroid gland doesn't produce enough hormones, causing fatigue, weight gain, and cold sensitivity. Managed with daily medication.",
    "Hyperthyroidism": "Your thyroid produces too much hormone, causing weight loss, rapid heartbeat, and anxiety. Treatable with medication.",
    "Hypoglycemia": "Blood sugar drops too low, causing shakiness, sweating, and confusion. Eat something sugary immediately.",
    "Osteoarthritis": "Joint cartilage wears down over time causing pain and stiffness, especially in knees and hips. Common with aging.",
    "Arthritis": "Inflammation of joints causing pain, swelling, and reduced movement. Multiple types exist. Managed with medication and exercise.",
    "(vertigo) Paroxysmal Positional Vertigo": "Brief episodes of dizziness triggered by head position changes. Not dangerous but uncomfortable. Treatable with head exercises.",
    "Acne": "Clogged skin pores causing pimples, blackheads, and bumps. Very common in teenagers. Treatable with skincare products.",
    "Urinary tract infection": "Bacterial infection in the urinary system causing burning urination and frequent urge to pee. Treatable with antibiotics.",
    "Psoriasis": "An immune condition causing thick, scaly patches on skin. Chronic but manageable with creams and medication.",
    "Impetigo": "A contagious skin infection causing red sores that rupture and form crusts. Common in children. Treatable with antibiotics.",
}

def get_disease_description(disease: str) -> str:
    return DISEASE_INFO.get(disease, f"{disease} — Please consult a healthcare professional for detailed information about this condition.")


# ---------------------------------------------------------------------------
# Severity tiers — used to apply a realistic prior on top of the model's
# raw probabilities. Without this, vague inputs ("headache", "fever") can
# trigger emergency-level predictions because rare/severe conditions in the
# training set share those generic symptoms.
# ---------------------------------------------------------------------------
SEVERITY_TIER = {
    # Common, everyday conditions — boosted when symptom count is low
    "Common Cold": "common",
    "Allergy": "common",
    "Migraine": "common",
    "GERD": "common",
    "Acne": "common",
    "Gastroenteritis": "common",
    "Fungal infection": "common",
    "Bronchial Asthma": "common",
    "(vertigo) Paroxysmal Positional Vertigo": "common",
    "Cervical spondylosis": "common",
    "Osteoarthritis": "common",
    "Arthritis": "common",
    "Varicose veins": "common",
    "Urinary tract infection": "common",
    "Psoriasis": "common",
    "Impetigo": "common",
    "Dimorphic hemorrhoids (piles)": "common",
    "Hypoglycemia": "common",
    "Drug Reaction": "common",
    "Peptic ulcer disease": "common",
    "Chicken pox": "common",

    # Moderate — possible but require multiple matching symptoms
    "Hypertension": "moderate",
    "Diabetes": "moderate",
    "Hypothyroidism": "moderate",
    "Hyperthyroidism": "moderate",
    "Jaundice": "moderate",
    "Dengue": "moderate",
    "Typhoid": "moderate",
    "Malaria": "moderate",
    "Hepatitis A": "moderate",
    "Hepatitis E": "moderate",
    "Pneumonia": "moderate",
    "Chronic cholestasis": "moderate",

    # Severe / rare — heavily penalized unless many symptoms match strongly
    "Heart attack": "severe",
    "Paralysis (brain hemorrhage)": "severe",
    "AIDS": "severe",
    "Tuberculosis": "severe",
    "Hepatitis B": "severe",
    "Hepatitis C": "severe",
    "Hepatitis D": "severe",
    "Alcoholic hepatitis": "severe",
}

# Multiplicative priors applied to raw probabilities. Tuned so that:
#   - With 1-2 symptoms, common conditions dominate
#   - With 4+ symptoms, the model can confidently report severe ones
TIER_PRIOR = {
    "common":   1.7,
    "moderate": 0.9,
    "severe":   0.30,
    "unknown":  0.7,
}

# Extra penalty on severe conditions when few SPECIFIC symptoms were matched
LOW_SYMPTOM_SEVERE_PENALTY = {
    1: 0.05,  # 1 specific symptom -> severe down to 5%
    2: 0.15,
    3: 0.45,
    4: 0.80,
}

# Symptoms that appear in MANY diseases. Alone, they're not enough evidence.
# Used to compute a "specificity-weighted" symptom count.
GENERIC_SYMPTOMS = {
    "fatigue", "headache", "high_fever", "mild_fever", "vomiting",
    "nausea", "loss_of_appetite", "weight_loss", "weight_gain",
    "lethargy", "malaise", "muscle_pain", "joint_pain", "chills",
    "sweating", "shivering", "anxiety", "depression", "irritability",
    "restlessness", "weakness_in_limbs", "muscle_weakness", "dizziness",
    "cough", "abdominal_pain", "back_pain", "neck_pain",
    "stomach_pain", "indigestion", "constipation", "diarrhoea",
}

# Chronic conditions — heavily penalized when symptom duration is short
# (hours/days). These take weeks-to-months to manifest.
CHRONIC_CONDITIONS = {
    "Diabetes", "Hypertension", "Hypothyroidism", "Hyperthyroidism",
    "Osteoarthritis", "Arthritis", "Cervical spondylosis",
    "Varicose veins", "Tuberculosis", "Hepatitis B", "Hepatitis C",
    "Hepatitis D", "AIDS", "Alcoholic hepatitis", "Chronic cholestasis",
    "Psoriasis",
}

# Acute conditions — boosted slightly when duration is short
ACUTE_CONDITIONS = {
    "Common Cold", "Gastroenteritis", "Migraine", "Hypoglycemia",
    "Drug Reaction", "Heart attack", "Malaria", "Dengue", "Typhoid",
    "Pneumonia", "Urinary tract infection", "Allergy",
}

# COMMON + ACUTE + MILD — the default safe fallback for vague short-duration
# complaints. Excludes chronic-but-common conditions like Cervical spondylosis,
# Osteoarthritis, Arthritis, Varicose veins, Psoriasis (which take time to develop).
ACUTE_COMMON = {
    "Common Cold", "Allergy", "Migraine", "GERD", "Gastroenteritis",
    "Hypoglycemia", "Drug Reaction", "Peptic ulcer disease",
    "Urinary tract infection", "Impetigo", "Chicken pox",
}

# For each generic symptom, the medically PLAUSIBLE diseases that can cause it.
# Used as a whitelist when the user inputs only sparse/generic symptoms — so we
# never suggest e.g. "Fungal infection" for a "headache" complaint.
GENERIC_SYMPTOM_PLAUSIBLE = {
    "headache": [
        "Migraine", "Common Cold", "Cervical spondylosis",
        "Hypertension", "Hypoglycemia", "Dengue", "Typhoid", "Malaria",
    ],
    "high_fever": [
        "Common Cold", "Malaria", "Dengue", "Typhoid", "Pneumonia",
        "Gastroenteritis", "Urinary tract infection", "Chicken pox",
        "Hepatitis A", "Hepatitis E",
    ],
    "mild_fever": [
        "Common Cold", "Allergy", "Gastroenteritis",
        "Urinary tract infection", "Drug Reaction",
    ],
    "fatigue": [
        "Common Cold", "Hypothyroidism", "Hypoglycemia",
        "Allergy", "GERD", "Diabetes", "Hepatitis A",
    ],
    "cough": [
        "Common Cold", "Bronchial Asthma", "Pneumonia",
        "GERD", "Tuberculosis",
    ],
    "vomiting": [
        "Gastroenteritis", "Migraine", "Drug Reaction",
        "GERD", "Peptic ulcer disease", "Typhoid",
    ],
    "nausea": [
        "Gastroenteritis", "Migraine", "GERD",
        "Drug Reaction", "Peptic ulcer disease",
    ],
    "abdominal_pain": [
        "Gastroenteritis", "Peptic ulcer disease", "GERD",
        "Urinary tract infection", "Typhoid",
    ],
    "stomach_pain": [
        "Gastroenteritis", "Peptic ulcer disease", "GERD",
    ],
    "back_pain": [
        "Cervical spondylosis", "Osteoarthritis", "Arthritis",
    ],
    "neck_pain": [
        "Cervical spondylosis", "Migraine",
    ],
    "joint_pain": [
        "Arthritis", "Osteoarthritis", "Dengue", "Common Cold",
    ],
    "muscle_pain": [
        "Common Cold", "Dengue", "Malaria",
    ],
    "dizziness": [
        "(vertigo) Paroxysmal Positional Vertigo", "Hypoglycemia",
        "Hypertension", "Migraine",
    ],
    "diarrhoea": [
        "Gastroenteritis", "Drug Reaction",
    ],
    "constipation": [
        "GERD", "Dimorphic hemorrhoids (piles)",
    ],
    "weight_loss": [
        "Hyperthyroidism", "Diabetes", "Tuberculosis",
    ],
    "weight_gain": [
        "Hypothyroidism", "Diabetes",
    ],
    "anxiety": [
        "Hyperthyroidism", "Hypoglycemia",
    ],
    "depression": [
        "Hypothyroidism",
    ],
    "chills": [
        "Common Cold", "Malaria", "Dengue", "Typhoid", "Pneumonia",
    ],
    "shivering": [
        "Common Cold", "Malaria", "Dengue", "Typhoid", "Pneumonia",
    ],
    "sweating": [
        "Hyperthyroidism", "Hypoglycemia", "Heart attack", "Malaria",
    ],
    "lethargy": [
        "Common Cold", "Hypothyroidism", "Hypoglycemia",
    ],
    "malaise": [
        "Common Cold", "Allergy", "Hepatitis A",
    ],
    "loss_of_appetite": [
        "Gastroenteritis", "Hepatitis A", "Typhoid", "Tuberculosis",
    ],
    "indigestion": [
        "GERD", "Peptic ulcer disease",
    ],
    "weakness_in_limbs": [
        "Hypoglycemia", "Cervical spondylosis", "Paralysis (brain hemorrhage)",
    ],
    "muscle_weakness": [
        "Hypothyroidism", "Hypoglycemia",
    ],
    "restlessness": [
        "Hyperthyroidism", "Hypoglycemia",
    ],
    "irritability": [
        "Hyperthyroidism", "Hypoglycemia",
    ],
    # ----- Specific symptoms (not "generic" but commonly entered alone) -----
    "chest_pain": ["GERD", "Bronchial Asthma", "Heart attack", "Pneumonia", "Peptic ulcer disease"],
    "breathlessness": ["Bronchial Asthma", "Pneumonia", "Heart attack", "Tuberculosis"],
    "palpitations": ["Hyperthyroidism", "Heart attack", "Hypoglycemia"],
    "fast_heart_rate": ["Hyperthyroidism", "Heart attack", "Hypoglycemia"],
    "itching": ["Allergy", "Fungal infection", "Drug Reaction", "Chicken pox", "Jaundice", "Hepatitis A", "Chronic cholestasis"],
    "skin_rash": ["Allergy", "Drug Reaction", "Chicken pox", "Fungal infection", "Psoriasis", "Impetigo"],
    "nodal_skin_eruptions": ["Fungal infection"],
    "continuous_sneezing": ["Common Cold", "Allergy"],
    "runny_nose": ["Common Cold", "Allergy"],
    "congestion": ["Common Cold", "Allergy"],
    "sinus_pressure": ["Common Cold", "Allergy"],
    "throat_irritation": ["Common Cold"],
    "redness_of_eyes": ["Allergy", "Common Cold"],
    "watering_from_eyes": ["Allergy"],
    "pain_behind_the_eyes": ["Migraine", "Dengue"],
    "visual_disturbances": ["Migraine"],
    "blurred_and_distorted_vision": ["Migraine", "Hypoglycemia", "Diabetes", "Hypertension"],
    "spinning_movements": ["(vertigo) Paroxysmal Positional Vertigo"],
    "loss_of_balance": ["(vertigo) Paroxysmal Positional Vertigo", "Paralysis (brain hemorrhage)"],
    "unsteadiness": ["(vertigo) Paroxysmal Positional Vertigo"],
    "stiff_neck": ["Cervical spondylosis", "Migraine"],
    "knee_pain": ["Osteoarthritis", "Arthritis"],
    "hip_joint_pain": ["Osteoarthritis", "Arthritis"],
    "swelling_joints": ["Arthritis", "Osteoarthritis"],
    "movement_stiffness": ["Osteoarthritis", "Arthritis", "Cervical spondylosis"],
    "painful_walking": ["Osteoarthritis", "Arthritis", "Varicose veins"],
    "muscle_wasting": ["Tuberculosis", "AIDS"],
    "yellowing_of_eyes": ["Jaundice", "Hepatitis A", "Hepatitis B", "Hepatitis C", "Hepatitis D", "Hepatitis E", "Alcoholic hepatitis"],
    "yellowish_skin": ["Jaundice", "Hepatitis A", "Hepatitis B", "Hepatitis C", "Hepatitis D", "Hepatitis E", "Alcoholic hepatitis"],
    "dark_urine": ["Jaundice", "Hepatitis A", "Hepatitis E"],
    "yellow_urine": ["Jaundice"],
    "bladder_discomfort": ["Urinary tract infection"],
    "foul_smell_of_urine": ["Urinary tract infection"],
    "continuous_feel_of_urine": ["Urinary tract infection"],
    "burning_micturition": ["Urinary tract infection"],
    "spotting_urination": ["Urinary tract infection"],
    "pain_during_bowel_movements": ["Dimorphic hemorrhoids (piles)"],
    "pain_in_anal_region": ["Dimorphic hemorrhoids (piles)"],
    "bloody_stool": ["Dimorphic hemorrhoids (piles)", "Peptic ulcer disease"],
    "irritation_in_anus": ["Dimorphic hemorrhoids (piles)"],
    "swollen_legs": ["Varicose veins"],
    "swollen_blood_vessels": ["Varicose veins"],
    "prominent_veins_on_calf": ["Varicose veins"],
    "swollen_extremeties": ["Hypothyroidism", "Varicose veins"],
    "puffy_face_and_eyes": ["Hypothyroidism"],
    "enlarged_thyroid": ["Hypothyroidism", "Hyperthyroidism"],
    "brittle_nails": ["Hypothyroidism"],
    "cold_hands_and_feets": ["Hypothyroidism"],
    "mood_swings": ["Hyperthyroidism", "Hypothyroidism"],
    "excessive_hunger": ["Diabetes", "Hyperthyroidism"],
    "increased_appetite": ["Diabetes"],
    "polyuria": ["Diabetes"],
    "irregular_sugar_level": ["Diabetes", "Hypoglycemia"],
    "slurred_speech": ["Paralysis (brain hemorrhage)"],
    "weakness_of_one_body_side": ["Paralysis (brain hemorrhage)"],
    "altered_sensorium": ["Paralysis (brain hemorrhage)"],
    "coma": ["Paralysis (brain hemorrhage)"],
    "pus_filled_pimples": ["Acne"],
    "blackheads": ["Acne"],
    "scurring": ["Acne"],
    "skin_peeling": ["Fungal infection", "Psoriasis"],
    "silver_like_dusting": ["Psoriasis"],
    "small_dents_in_nails": ["Psoriasis"],
    "inflammatory_nails": ["Psoriasis"],
    "blister": ["Chicken pox", "Impetigo"],
    "red_sore_around_nose": ["Impetigo"],
    "yellow_crust_ooze": ["Impetigo"],
    "dischromic_patches": ["Fungal infection"],
    "red_spots_over_body": ["Chicken pox", "Drug Reaction"],
    "internal_itching": ["Allergy", "Drug Reaction"],
    "mucoid_sputum": ["Common Cold", "Pneumonia", "Bronchial Asthma"],
    "rusty_sputum": ["Pneumonia"],
    "blood_in_sputum": ["Tuberculosis", "Pneumonia"],
    "phlegm": ["Common Cold", "Pneumonia", "Bronchial Asthma", "Tuberculosis"],
    "patches_in_throat": ["Common Cold", "AIDS"],
    "loss_of_smell": ["Common Cold"],
    "toxic_look_(typhos)": ["Typhoid"],
    "belly_pain": ["Gastroenteritis", "Peptic ulcer disease", "Typhoid"],
    "abnormal_menstruation": ["Hyperthyroidism", "Hypothyroidism"],
    "swelling_of_stomach": ["Alcoholic hepatitis", "Hepatitis B"],
    "distention_of_abdomen": ["Alcoholic hepatitis"],
    "history_of_alcohol_consumption": ["Alcoholic hepatitis"],
    "fluid_overload": ["Hepatitis B", "Alcoholic hepatitis"],
    "swelled_lymph_nodes": ["AIDS", "Tuberculosis"],
    "extra_marital_contacts": ["AIDS"],
    "receiving_blood_transfusion": ["AIDS", "Hepatitis B", "Hepatitis C"],
    "receiving_unsterile_injections": ["AIDS", "Hepatitis B", "Hepatitis C"],
    "stomach_bleeding": ["Peptic ulcer disease", "GERD"],
    "acute_liver_failure": ["Hepatitis B", "Alcoholic hepatitis"],
    "obesity": ["Diabetes", "Hypertension"],
    "lack_of_concentration": ["Hypothyroidism", "Hyperthyroidism", "Hypoglycemia", "Diabetes"],
    "drying_and_tingling_lips": ["Hypoglycemia"],
    "ulcers_on_tongue": ["Drug Reaction", "AIDS", "Peptic ulcer disease"],
    "acidity": ["GERD", "Peptic ulcer disease"],
    "stomach_pain": ["Gastroenteritis", "Peptic ulcer disease", "GERD"],
    "burning_micturation": ["Urinary tract infection"],
    "sunken_eyes": ["Gastroenteritis", "Dengue"],
    "dehydration": ["Gastroenteritis", "Dengue"],
    "blackish_skin": ["Fungal infection"],
    "muscle_pain_specific": [],  # placeholder, ignore
}


DURATION_MULTIPLIER = {
    # When symptoms are < few days old, chronic conditions are unlikely
    "hours":   {"chronic": 0.10, "acute": 1.4},
    "days":    {"chronic": 0.30, "acute": 1.2},
    "weeks":   {"chronic": 0.85, "acute": 1.0},
    "chronic": {"chronic": 1.5,  "acute": 0.7},
}


# ---------------------------------------------------------------------------
# Synonym map — colloquial / lay terms -> model's canonical symptom names.
# Applied BEFORE exact matching so users can type natural words.
# ---------------------------------------------------------------------------
SYMPTOM_SYNONYMS = {
    "stomachache": "abdominal_pain",
    "stomach ache": "abdominal_pain",
    "stomach pain": "abdominal_pain",
    "tummy ache": "abdominal_pain",
    "belly ache": "belly_pain",
    "throwing up": "vomiting",
    "puking": "vomiting",
    "feeling sick": "nausea",
    "queasy": "nausea",
    "throat pain": "throat_irritation",
    "sore throat": "throat_irritation",
    "runny nose": "runny_nose",
    "stuffy nose": "congestion",
    "blocked nose": "congestion",
    "loose motion": "diarrhoea",
    "loose motions": "diarrhoea",
    "diarrhea": "diarrhoea",
    "the runs": "diarrhoea",
    "tired": "fatigue",
    "exhausted": "fatigue",
    "low energy": "fatigue",
    "shortness of breath": "breathlessness",
    "trouble breathing": "breathlessness",
    "cant breathe": "breathlessness",
    "racing heart": "fast_heart_rate",
    "fast heartbeat": "fast_heart_rate",
    "heart pounding": "palpitations",
    "dizzy": "dizziness",
    "lightheaded": "dizziness",
    "spinning": "spinning_movements",
    "high temperature": "high_fever",
    "low fever": "mild_fever",
    "low grade fever": "mild_fever",
    "yellow eyes": "yellowing_of_eyes",
    "yellow skin": "yellowish_skin",
    "joint ache": "joint_pain",
    "muscle ache": "muscle_pain",
    "body ache": "muscle_pain",
    "body aches": "muscle_pain",
    "burning urine": "burning_micturition",
    "painful urination": "burning_micturition",
    "frequent urination": "polyuria",
    "skin itching": "itching",
    "rash": "skin_rash",
    "rashes": "skin_rash",
    "pimples": "pus_filled_pimples",
    "blackheads": "blackheads",
    "blurry vision": "blurred_and_distorted_vision",
    "blurred vision": "blurred_and_distorted_vision",
    "weight loss": "weight_loss",
    "losing weight": "weight_loss",
    "gaining weight": "weight_gain",
    "no appetite": "loss_of_appetite",
    "loss of appetite": "loss_of_appetite",
    "more hungry": "increased_appetite",
    "neck stiffness": "stiff_neck",
    "stiff neck": "stiff_neck",
    "constipated": "constipation",
    "back ache": "back_pain",
    "lower back pain": "back_pain",
    "chest tightness": "chest_pain",
    "chest discomfort": "chest_pain",
    "phlegm": "phlegm",
    "mucus": "mucoid_sputum",
    "blood in cough": "blood_in_sputum",
    "coughing blood": "blood_in_sputum",
    "lethargic": "lethargy",
    "weak": "muscle_weakness",
    "shaky": "shivering",
    "feverish chills": "chills",
    "feeling cold": "chills",
    "headaches": "headache",
    "head ache": "headache",
    "anxious": "anxiety",
    "depressed": "depression",
    "sad": "depression",
    "irritable": "irritability",
    "moody": "mood_swings",
    "cant focus": "lack_of_concentration",
    "trouble concentrating": "lack_of_concentration",
    "swollen feet": "swollen_extremeties",
    "swollen ankles": "swollen_extremeties",
    "swollen legs": "swollen_legs",
}


def _resolve_synonym(text: str) -> str:
    """Return the canonical model symptom for a colloquial phrase, or the
    original (lowercased, underscored) text if no synonym matches."""
    lower = text.lower().strip()
    if lower in SYMPTOM_SYNONYMS:
        return SYMPTOM_SYNONYMS[lower]
    # Try without underscore variants too
    no_underscore = lower.replace("_", " ")
    if no_underscore in SYMPTOM_SYNONYMS:
        return SYMPTOM_SYNONYMS[no_underscore]
    return lower.replace(" ", "_")


def _apply_severity_prior(diseases: list, probs: np.ndarray, matched_count: int,
                           age_group: str = "adult", duration: str = "days",
                           specific_count: int = None) -> np.ndarray:
    """Re-weight raw model probabilities using severity tiers, age, and duration.

    Returns a NEW probability array (renormalized). The original `probs`
    is never mutated.
    """
    adjusted = probs.copy().astype(float)
    # Use specific_count for severe penalty if provided — generic symptoms
    # don't count as evidence for serious diseases.
    effective_count = specific_count if specific_count is not None else matched_count
    severe_extra = LOW_SYMPTOM_SEVERE_PENALTY.get(effective_count, 1.0)
    duration_mult = DURATION_MULTIPLIER.get(duration, DURATION_MULTIPLIER["days"])

    # Age-based adjustments. These reflect rough epidemiological priors:
    # - Children rarely get cardiovascular events / chronic liver disease
    # - Seniors are more vulnerable to severe conditions
    AGE_DISEASE_MULTIPLIER = {
        "child": {  # under 12
            "Heart attack": 0.05,
            "Hypertension": 0.10,
            "Osteoarthritis": 0.10,
            "Cervical spondylosis": 0.10,
            "Alcoholic hepatitis": 0.02,
            "AIDS": 0.10,
            "Hepatitis B": 0.30,
            "Hepatitis C": 0.10,
            "Chicken pox": 1.5,    # more common in children
            "Common Cold": 1.3,
            "Impetigo": 1.5,
        },
        "teen": {  # 13-19
            "Heart attack": 0.15,
            "Hypertension": 0.30,
            "Acne": 1.6,
            "Osteoarthritis": 0.15,
        },
        "adult": {},  # 20-59 — neutral baseline
        "senior": {  # 60+
            "Heart attack": 1.4,
            "Hypertension": 1.3,
            "Osteoarthritis": 1.4,
            "Pneumonia": 1.3,
            "Acne": 0.10,
            "Chicken pox": 0.20,
        },
    }
    age_mult = AGE_DISEASE_MULTIPLIER.get(age_group, {})

    for i, disease in enumerate(diseases):
        tier = SEVERITY_TIER.get(disease, "unknown")
        adjusted[i] *= TIER_PRIOR.get(tier, 1.0)
        if tier == "severe":
            adjusted[i] *= severe_extra
        if disease in age_mult:
            adjusted[i] *= age_mult[disease]
        # Duration prior: chronic diseases need time to develop
        if disease in CHRONIC_CONDITIONS:
            adjusted[i] *= duration_mult["chronic"]
        elif disease in ACUTE_CONDITIONS:
            adjusted[i] *= duration_mult["acute"]
    total = adjusted.sum()
    if total > 0:
        adjusted = adjusted / total
    return adjusted

MODELS_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "models")
# Prefer fine-tuned V2 model (with patient-profile features). Fall back to V1.
MODEL_PATH_V2 = os.path.join(MODELS_DIR, "symptom_disease_model_v2.pkl")
META_PATH_V2 = os.path.join(MODELS_DIR, "symptom_disease_metadata_v2.json")
MODEL_PATH = os.path.join(MODELS_DIR, "symptom_disease_model.pkl")
META_PATH = os.path.join(MODELS_DIR, "symptom_disease_metadata.json")

# Supabase client for logging
SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_KEY = os.getenv("SUPABASE_KEY", "")
_sb_client = None

def _get_supabase():
    global _sb_client
    if _sb_client is None and SUPABASE_URL and SUPABASE_KEY:
        from supabase import create_client
        _sb_client = create_client(SUPABASE_URL, SUPABASE_KEY)
    return _sb_client

def _log_prediction(module: str, prediction: str, confidence: float, features: str = None):
    """Auto-log prediction to Supabase predictions table."""
    try:
        sb = _get_supabase()
        if sb:
            sb.table("predictions").insert({
                "module": module,
                "prediction": prediction,
                "confidence": confidence,
                "timestamp": datetime.now().isoformat(),
                "features": features
            }).execute()
    except Exception:
        pass  # Don't break predictions if logging fails

# Load model and metadata once at startup for faster predictions
_model = None
_metadata = None

def _get_model():
    global _model, _metadata
    if _model is None:
        # Prefer V2 (fine-tuned with patient profile features)
        if os.path.exists(MODEL_PATH_V2) and os.path.exists(META_PATH_V2):
            _model = joblib.load(MODEL_PATH_V2)
            with open(META_PATH_V2, "r") as f:
                _metadata = json.load(f)
            print(f"[Symptom Checker] V2 model loaded: {len(_metadata['symptoms'])} symptoms + "
                  f"{len(_metadata.get('profile_features', []))} profile features, "
                  f"{len(_metadata['diseases'])} diseases (acc={_metadata.get('accuracy')})")
        elif os.path.exists(MODEL_PATH) and os.path.exists(META_PATH):
            _model = joblib.load(MODEL_PATH)
            with open(META_PATH, "r") as f:
                _metadata = json.load(f)
            print(f"[Symptom Checker] V1 model loaded: {len(_metadata['symptoms'])} symptoms, "
                  f"{len(_metadata['diseases'])} diseases")
        else:
            raise HTTPException(
                status_code=503,
                detail="Symptom prediction model not trained yet. Run train_symptom_model_v2.py first."
            )
    return _model, _metadata

class SymptomRequest(BaseModel):
    symptoms: list[str]
    age_group: str | None = "adult"   # child | teen | adult | senior
    duration: str | None = "days"      # hours | days | weeks | chronic

@router.post("/predict")
async def predict_disease(request: SymptomRequest):
    try:
        model, metadata = _get_model()
        all_symptoms = metadata["symptoms"]
        all_diseases = metadata["diseases"]
        
        # Create input vector — exact matching against model's symptom list
        input_data = [0] * len(all_symptoms)
        matched_count = 0
        
        for user_symptom in request.symptoms:
            # Resolve colloquial synonyms first ("stomachache" -> "abdominal_pain"),
            # then normalize.
            normalized = _resolve_synonym(user_symptom)

            # Try exact match first
            for i, model_symptom in enumerate(all_symptoms):
                model_normalized = model_symptom.lower().strip()
                if normalized == model_normalized:
                    input_data[i] = 1
                    matched_count += 1
                    break
            else:
                # Try partial match as fallback (e.g., "fever" matches "high_fever")
                for i, model_symptom in enumerate(all_symptoms):
                    model_normalized = model_symptom.lower().strip()
                    if normalized in model_normalized or model_normalized in normalized:
                        input_data[i] = 1
                        matched_count += 1
                        break
        
        if matched_count == 0:
            return {
                "prediction": "Unable to match symptoms",
                "confidence": 0.0,
                "severity": "Unknown",
                "recommendation": "Please select symptoms from the provided list for accurate prediction.",
                "matched_symptoms": 0,
                "total_submitted": len(request.symptoms)
            }
        
        # If V2 model: append patient-profile one-hot features in the
        # exact order the model expects.
        if metadata.get("version") == 2:
            ag = (request.age_group or "adult").lower().strip()
            if ag not in ("child", "teen", "adult", "senior"):
                ag = "adult"
            du = (request.duration or "days").lower().strip()
            if du not in ("hours", "days", "weeks", "chronic"):
                du = "days"
            for feat in metadata.get("profile_features", []):
                if feat == f"age_{ag}" or feat == f"dur_{du}":
                    input_data.append(1)
                else:
                    input_data.append(0)

        # Real ML prediction
        raw_probabilities = model.predict_proba([input_data])[0]

        # Apply severity-aware re-ranking so that vague inputs ("headache",
        # "fever") don't trigger emergency-level predictions. With few
        # matched symptoms, common conditions are boosted and severe ones
        # are heavily penalized.
        age_group = (request.age_group or "adult").lower().strip()
        if age_group not in ("child", "teen", "adult", "senior"):
            age_group = "adult"
        duration = (request.duration or "days").lower().strip()
        if duration not in ("hours", "days", "weeks", "chronic"):
            duration = "days"

        # Count SPECIFIC (non-generic) matched symptoms. Generic symptoms
        # like "headache" or "fever" alone don't constitute evidence for a
        # specific diagnosis — many diseases share them.
        matched_canonical = []
        for j, val in enumerate(input_data):
            if val == 1 and j < len(all_symptoms):
                matched_canonical.append(all_symptoms[j].lower().strip())
        specific_count = sum(1 for s in matched_canonical if s not in GENERIC_SYMPTOMS)

        probabilities = _apply_severity_prior(
            all_diseases, raw_probabilities, matched_count,
            age_group=age_group, duration=duration, specific_count=specific_count,
        )

        # ----- Universal plausibility filter -----
        # For each disease, count how many of the user's entered symptoms are
        # documented plausible causes for it. Diseases with ZERO plausible
        # links to ANY of the entered symptoms are heavily penalized — this
        # eliminates results like "chest_pain -> Chicken pox" where the model
        # picks a disease that has no real medical relationship to the input.
        plausible_for_input: set[str] = set()
        for s in matched_canonical:
            for d in GENERIC_SYMPTOM_PLAUSIBLE.get(s, []):
                plausible_for_input.add(d)

        if plausible_for_input:
            penalized = probabilities.copy()
            for i, disease in enumerate(all_diseases):
                if disease in plausible_for_input:
                    # Boost diseases that are plausible for MULTIPLE entered symptoms
                    relevance = sum(
                        1 for s in matched_canonical
                        if disease in GENERIC_SYMPTOM_PLAUSIBLE.get(s, [])
                    )
                    penalized[i] *= (1.0 + 0.5 * relevance)  # 1.5x for 1, 2.0x for 2, etc.
                else:
                    penalized[i] *= 0.05  # Heavy penalty for medically-unrelated diseases
            total = penalized.sum()
            if total > 0:
                probabilities = penalized / total

        # Final prediction = arg-max of the ADJUSTED probabilities
        pred_idx = int(np.argmax(probabilities))
        prediction = all_diseases[pred_idx] if pred_idx < len(all_diseases) else "Unknown"
        confidence = float(probabilities[pred_idx])

        # Get top 3 predictions for transparency
        top_indices = np.argsort(probabilities)[::-1][:3]
        top_predictions = []
        for idx in top_indices:
            if probabilities[idx] > 0.01:
                disease_name = all_diseases[idx] if idx < len(all_diseases) else f"Class {idx}"
                top_predictions.append({
                    "disease": disease_name,
                    "probability": round(float(probabilities[idx]) * 100, 1),
                    "description": get_disease_description(disease_name)
                })
        
        # ----- Uncertainty handling -----
        # If too few SPECIFIC symptoms matched OR confidence is too low,
        # return a "differential diagnosis" rather than a confident answer.
        # Generic-only inputs (just "headache" or "fever + fatigue") are
        # NEVER enough to commit to a specific disease.
        is_uncertain = (matched_count < 3 or specific_count < 1
                        or confidence < 0.30)
        very_uncertain = (
            matched_count <= 1
            or specific_count == 0  # ALL inputs were generic
            or (matched_count < 3 and confidence < 0.25)
        )

        if very_uncertain:
            # With sparse/generic input, restrict candidates to diseases that
            # are MEDICALLY PLAUSIBLE causes of the matched symptoms (e.g. never
            # suggest "Fungal infection" for a "headache" complaint).
            plausible: set[str] = set()
            for s in matched_canonical:
                if s in GENERIC_SYMPTOM_PLAUSIBLE:
                    plausible.update(GENERIC_SYMPTOM_PLAUSIBLE[s])

            # Fallback: if no whitelist match (e.g. unknown generic symptom),
            # use all common-tier diseases.
            if not plausible:
                plausible = {
                    d for d in all_diseases
                    if SEVERITY_TIER.get(d, "unknown") == "common"
                }

            # Layered preference for picking the most realistic diagnosis:
            # 1. ACUTE_COMMON ∩ plausible (mild + short-duration) — best for
            #    short-duration vague complaints
            # 2. all common-tier plausible diseases — for chronic durations
            # 3. fall back to the full plausible set
            common_plausible = {
                d for d in plausible
                if SEVERITY_TIER.get(d, "unknown") == "common"
            }
            acute_common_plausible = {
                d for d in common_plausible if d in ACUTE_COMMON
            }
            if duration in ("hours", "days") and acute_common_plausible:
                effective_plausible = acute_common_plausible
            elif common_plausible:
                effective_plausible = common_plausible
            else:
                effective_plausible = plausible

            candidate_indices = [
                i for i, d in enumerate(all_diseases) if d in effective_plausible
            ]
            if candidate_indices:
                best_idx = max(candidate_indices, key=lambda i: probabilities[i])
                prediction = all_diseases[best_idx]
                cand_total = sum(probabilities[i] for i in candidate_indices)
                if cand_total > 0:
                    confidence = float(probabilities[best_idx] / cand_total)
                else:
                    confidence = 0.30

            # Rebuild top_predictions from the plausible set so the UI shows
            # only medically related alternatives, not random diseases.
            cand_sorted = sorted(candidate_indices, key=lambda i: -probabilities[i])[:3]
            top_predictions = []
            cand_total = sum(probabilities[i] for i in candidate_indices) or 1.0
            for idx in cand_sorted:
                disease_name = all_diseases[idx]
                rel_prob = float(probabilities[idx] / cand_total)
                top_predictions.append({
                    "disease": disease_name,
                    "probability": round(rel_prob * 100, 1),
                    "description": get_disease_description(disease_name),
                })

            # Build a friendly, duration-aware recommendation.
            duration_phrase = {
                "hours":   "since it just started, monitor closely",
                "days":    "since this has been a few days",
                "weeks":   "since this has lasted weeks",
                "chronic": "since this has been long-term",
            }.get(duration, "")

            severity = "Mild - likely a common condition"
            confidence_warning = (
                f"ℹ️ Based on limited symptoms ({matched_count} matched), the most likely common "
                "cause is shown below. Adding more symptoms (e.g., associated symptoms, "
                "severity, what makes it worse) will sharpen the prediction."
            )
            recommendation = (
                f"Most likely cause: {prediction}. {duration_phrase.capitalize() if duration_phrase else ''}. "
                f"Try home care first (rest, hydration, OTC remedies). "
                f"If symptoms worsen, persist beyond expected duration, or new symptoms appear, "
                f"consult a doctor."
            ).strip()

            # Auto-log
            _log_prediction("symptoms", prediction, confidence, json.dumps(request.symptoms))

            return {
                "prediction": prediction,
                "description": get_disease_description(prediction),
                "confidence": round(confidence, 3),
                "severity": severity,
                "confidence_warning": confidence_warning,
                "recommendation": recommendation,
                "disclaimer": "⚕️ This is a screening tool, not a medical diagnosis. With limited symptoms, this is a best-guess based on the most common cause. Always consult a healthcare professional for proper evaluation.",
                "matched_symptoms": matched_count,
                "specific_symptoms": specific_count,
                "total_submitted": len(request.symptoms),
                "top_predictions": top_predictions,
                "age_group": age_group,
                "duration": duration,
            }

        # Determine severity based on confidence
        if confidence >= 0.8:
            severity = "High - Strong prediction. Consult a physician."
        elif confidence >= 0.5:
            severity = "Moderate - Likely match. Medical consultation recommended."
        else:
            severity = "Low - Uncertain prediction. Consider adding more symptoms for better accuracy."

        # Confidence warning
        confidence_warning = ""
        if is_uncertain:
            confidence_warning = (
                "⚠️ Low confidence — these symptoms match multiple conditions. "
                "The result below is the most likely option, but please review the "
                "alternatives and consult a doctor for proper diagnosis."
            )
        elif confidence < 0.6:
            confidence_warning = "⚠️ Moderate confidence — please review alternatives and consult a doctor."

        # Auto-log to MLOps dashboard
        _log_prediction("symptoms", prediction, confidence, json.dumps(request.symptoms))

        return {
            "prediction": prediction,
            "description": get_disease_description(prediction),
            "confidence": round(confidence, 3),
            "severity": severity,
            "confidence_warning": confidence_warning,
            "recommendation": f"AI identified {matched_count} symptom(s). Top match: {prediction} ({round(confidence*100,1)}%). Please consult a healthcare professional for confirmation.",
            "disclaimer": "⚕️ This AI prediction is for informational purposes only. It is NOT a medical diagnosis. Many symptoms overlap between common and serious conditions. Always consult a qualified healthcare professional.",
            "matched_symptoms": matched_count,
            "specific_symptoms": specific_count,
            "total_submitted": len(request.symptoms),
            "top_predictions": top_predictions,
            "age_group": age_group,
            "duration": duration,
        }
    except HTTPException:
        raise
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Prediction error: {str(e)}")


# ============================================================================
# LLM-powered free-text symptom parser
# ============================================================================
GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions"
GROQ_MODEL = "llama-3.3-70b-versatile"


class ParseRequest(BaseModel):
    text: str


def _build_parse_prompt(canonical_symptoms: list[str]) -> str:
    """Build a strict prompt that constrains the LLM output to canonical symptoms."""
    symptom_list = ", ".join(canonical_symptoms)
    return f"""You are a medical intake parser. Extract structured information from a patient's free-text description.

You MUST respond with ONLY a single valid JSON object (no markdown, no commentary, no code fences) in EXACTLY this shape:
{{
  "symptoms": ["<canonical_symptom_1>", "<canonical_symptom_2>"],
  "age_group": "child" | "teen" | "adult" | "senior",
  "duration": "hours" | "days" | "weeks" | "chronic"
}}

RULES:
1. "symptoms" MUST contain ONLY values from this exact canonical list (use underscores, lowercase):
{symptom_list}

2. Map colloquial language to the closest canonical name:
   - "stomachache" -> "abdominal_pain"
   - "throwing up" -> "vomiting"
   - "tired" -> "fatigue"
   - "shortness of breath" -> "breathlessness"
   - "burning while peeing" -> "burning_micturition"
   - "stiff neck" -> "stiff_neck"
   - "racing heart" -> "fast_heart_rate"
   - "blurry vision" -> "blurred_and_distorted_vision"

3. Do NOT invent symptoms not present in the canonical list. If a described symptom has no match, omit it.

4. age_group: infer from any age mention. Default "adult" if unclear.
   - Under 12 -> "child"
   - 13-19 -> "teen"
   - 20-59 -> "adult"
   - 60+ -> "senior"

5. duration: infer from any time mention. Default "days" if unclear.
   - hours / "today" / "this morning" -> "hours"
   - days / "couple days" / "few days" -> "days"
   - 1+ weeks -> "weeks"
   - months/years/"chronic"/"always" -> "chronic"

6. If no symptoms can be extracted, return {{"symptoms": [], "age_group": "adult", "duration": "days"}}.

Respond with ONLY the JSON object, nothing else."""


def _fuzzy_match_to_canonical(symptom: str, canonical: list[str]) -> str | None:
    """Last-line defense: ensure LLM-returned symptom maps to a canonical one."""
    s = symptom.lower().strip().replace(" ", "_")
    if s in canonical:
        return s
    # Try synonym map
    syn = SYMPTOM_SYNONYMS.get(symptom.lower().strip()) or SYMPTOM_SYNONYMS.get(s.replace("_", " "))
    if syn and syn in canonical:
        return syn
    # Substring match (e.g., "fever" -> "high_fever")
    for c in canonical:
        if s == c or s in c or c in s:
            return c
    return None


def _offline_keyword_parse(text: str, canonical: list[str]) -> dict:
    """Fallback: simple keyword + synonym extraction when Groq is unavailable."""
    text_lower = text.lower()
    found: list[str] = []

    # Try synonyms first (longer phrases first to avoid partial matches)
    for phrase in sorted(SYMPTOM_SYNONYMS.keys(), key=len, reverse=True):
        if phrase in text_lower:
            target = SYMPTOM_SYNONYMS[phrase]
            if target in canonical and target not in found:
                found.append(target)

    # Then direct canonical matches
    for c in canonical:
        c_phrase = c.replace("_", " ")
        if c_phrase in text_lower and c not in found:
            found.append(c)

    # Age detection
    age_group = "adult"
    age_match = re.search(r"\b(\d{1,3})[\s-]*(?:y|yr|yrs|year|years|yo)\b", text_lower)
    if age_match:
        age = int(age_match.group(1))
        if age < 13: age_group = "child"
        elif age < 20: age_group = "teen"
        elif age >= 60: age_group = "senior"
    elif any(w in text_lower for w in ["child", "kid", "toddler", "baby", "infant"]):
        age_group = "child"
    elif any(w in text_lower for w in ["teenager", "teen"]):
        age_group = "teen"
    elif any(w in text_lower for w in ["senior", "elderly", "grandfather", "grandmother", "old man", "old woman"]):
        age_group = "senior"

    # Duration detection
    duration = "days"
    if any(w in text_lower for w in ["hour", "today", "this morning", "just now", "since morning"]):
        duration = "hours"
    elif any(w in text_lower for w in ["week", "weeks"]):
        duration = "weeks"
    elif any(w in text_lower for w in ["month", "months", "year", "years", "chronic", "always", "long time"]):
        duration = "chronic"

    return {"symptoms": found, "age_group": age_group, "duration": duration}


@router.post("/parse")
async def parse_symptoms(request: ParseRequest):
    """Convert free-text patient description into structured symptoms via LLM."""
    try:
        _, metadata = _get_model()
        canonical = [s.lower().strip() for s in metadata["symptoms"]]

        if not request.text or not request.text.strip():
            return {"symptoms": [], "age_group": "adult", "duration": "days", "mode": "empty"}

        # If no Groq key, use offline keyword extractor
        if not GROQ_API_KEY:
            result = _offline_keyword_parse(request.text, canonical)
            result["mode"] = "offline_keyword"
            return result

        prompt = _build_parse_prompt(canonical)

        try:
            async with httpx.AsyncClient(timeout=20.0) as client:
                response = await client.post(
                    GROQ_API_URL,
                    headers={
                        "Authorization": f"Bearer {GROQ_API_KEY}",
                        "Content-Type": "application/json",
                    },
                    json={
                        "model": GROQ_MODEL,
                        "messages": [
                            {"role": "system", "content": prompt},
                            {"role": "user", "content": request.text},
                        ],
                        "temperature": 0.1,
                        "max_tokens": 512,
                        "response_format": {"type": "json_object"},
                    },
                )
        except Exception as e:
            print(f"[parse_symptoms] Groq call failed, falling back: {e}")
            result = _offline_keyword_parse(request.text, canonical)
            result["mode"] = "offline_fallback"
            return result

        if response.status_code != 200:
            print(f"[parse_symptoms] Groq API error {response.status_code}: {response.text[:200]}")
            result = _offline_keyword_parse(request.text, canonical)
            result["mode"] = "offline_fallback"
            return result

        raw_content = response.json()["choices"][0]["message"]["content"].strip()

        # Strip any code fences just in case
        raw_content = re.sub(r"^```(?:json)?\s*|\s*```$", "", raw_content, flags=re.MULTILINE).strip()

        try:
            parsed = json.loads(raw_content)
        except json.JSONDecodeError:
            print(f"[parse_symptoms] Bad JSON from LLM: {raw_content[:300]}")
            result = _offline_keyword_parse(request.text, canonical)
            result["mode"] = "offline_fallback_json_error"
            return result

        # Sanitize: ensure symptoms are all from canonical list
        raw_symptoms = parsed.get("symptoms", []) or []
        cleaned: list[str] = []
        for s in raw_symptoms:
            if not isinstance(s, str):
                continue
            matched = _fuzzy_match_to_canonical(s, canonical)
            if matched and matched not in cleaned:
                cleaned.append(matched)

        age_group = parsed.get("age_group", "adult")
        if age_group not in ("child", "teen", "adult", "senior"):
            age_group = "adult"

        duration = parsed.get("duration", "days")
        if duration not in ("hours", "days", "weeks", "chronic"):
            duration = "days"

        return {
            "symptoms": cleaned,
            "age_group": age_group,
            "duration": duration,
            "mode": "llm",
            "raw_count": len(raw_symptoms),
            "matched_count": len(cleaned),
        }
    except HTTPException:
        raise
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Parse error: {str(e)}")
