from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional
from datetime import datetime

class BasePredictionResponse(BaseModel):
    disease: str
    confidence: float = Field(..., ge=0, le=100, description="Confidence score (0-100%)")
    risk_level: str = Field(..., description="Risk level: LOW/MODERATE/HIGH/CRITICAL")
    prediction: str
    explanation: str
    timestamp: datetime = Field(default_factory=datetime.now)
    disclaimer: str = "This tool is for educational/research purposes only and does not constitute medical advice."

class ImagePredictionResponse(BasePredictionResponse):
    image_processed: bool
    heatmap_url: Optional[str] = None
    additional_metrics: Dict[str, Any] = {}

class TabularPredictionResponse(BasePredictionResponse):
    input_features: Dict[str, Any]
    feature_importance: Optional[Dict[str, float]] = None
    top_risk_factors: Optional[List[str]] = None

# Disease-specific schemas
class PneumoniaRequest(BaseModel):
    image: bytes

class PneumoniaResponse(ImagePredictionResponse):
    normal_probability: float
    pneumonia_probability: float
    grad_cam_available: bool
    model_accuracy: float = Field(0.0, description="Model accuracy on test set (0-1)")
    model_precision: float = Field(0.0, description="Model precision (0-1)")
    model_recall: float = Field(0.0, description="Model recall (0-1)")
    model_f1_score: float = Field(0.0, description="Model F1-score (0-1)")
    model_roc_auc: float = Field(0.0, description="Model ROC-AUC score (0-1)")

class MalariaRequest(BaseModel):
    image: bytes

class MalariaResponse(ImagePredictionResponse):
    normal_probability: float
    infected_probability: float
    parasite_density: Optional[float] = None
    model_accuracy: float = Field(0.0, description="Model accuracy on test set (0-1)")
    model_precision: float = Field(0.0, description="Model precision (0-1)")
    model_recall: float = Field(0.0, description="Model recall (0-1)")
    model_f1_score: float = Field(0.0, description="Model F1-score (0-1)")
    model_roc_auc: float = Field(0.0, description="Model ROC-AUC score (0-1)")

class BreastCancerRequest(BaseModel):
    radius_mean: float
    texture_mean: float
    perimeter_mean: float
    area_mean: float
    smoothness_mean: float
    compactness_mean: float
    concavity_mean: float
    concave_points_mean: float
    symmetry_mean: float
    fractal_dimension_mean: float
    radius_se: float
    texture_se: float
    perimeter_se: float
    area_se: float
    smoothness_se: float
    compactness_se: float
    concavity_se: float
    concave_points_se: float
    symmetry_se: float
    fractal_dimension_se: float
    radius_worst: float
    texture_worst: float
    perimeter_worst: float
    area_worst: float
    smoothness_worst: float
    compactness_worst: float
    concavity_worst: float
    concave_points_worst: float
    symmetry_worst: float
    fractal_dimension_worst: float

class BreastCancerResponse(TabularPredictionResponse):
    malignant_probability: float
    benign_probability: float
    model_accuracy: float = Field(0.0, description="Model accuracy on test set (0-1)")
    model_precision: float = Field(0.0, description="Model precision (0-1)")
    model_recall: float = Field(0.0, description="Model recall (0-1)")
    model_f1_score: float = Field(0.0, description="Model F1-score (0-1)")
    model_roc_auc: float = Field(0.0, description="Model ROC-AUC score (0-1)")

class DiabetesRequest(BaseModel):
    pregnancies: float
    glucose: float
    blood_pressure: float
    skin_thickness: float
    insulin: float
    bmi: float
    diabetes_pedigree: float
    age: float

class DiabetesResponse(TabularPredictionResponse):
    diabetic_probability: float
    non_diabetic_probability: float
    risk_tier: str
    model_accuracy: float = Field(..., description="Model accuracy on test set (0-1)")
    model_precision: float = Field(..., description="Model precision (0-1)")
    model_recall: float = Field(..., description="Model recall (0-1)")
    model_f1_score: float = Field(..., description="Model F1-score (0-1)")
    model_roc_auc: float = Field(..., description="Model ROC-AUC score (0-1)")

class AlzheimerRequest(BaseModel):
    age: float
    gender: float
    education_years: float
    mmse_score: float
    memory_complaints: float
    behavioral_problems: float
    adl_score: float
    functional_assessment: float
    brain_volume_ratio: float
    cortical_thickness: float
    csf_protein_level: float
    hippocampal_atrophy: float

class AlzheimerResponse(TabularPredictionResponse):
    non_demented_probability: float
    very_mild_probability: float
    mild_probability: float
    moderate_probability: float
    predicted_class: str
    model_accuracy: float = Field(0.0, description="Model accuracy on test set (0-1)")
    model_precision: float = Field(0.0, description="Model precision (0-1)")
    model_recall: float = Field(0.0, description="Model recall (0-1)")
    model_f1_score: float = Field(0.0, description="Model F1-score (0-1)")
    model_roc_auc: float = Field(0.0, description="Model ROC-AUC score (0-1)")

class LiverDiseaseRequest(BaseModel):
    age: float
    gender: float
    total_bilirubin: float
    direct_bilirubin: float
    alkaline_phosphatase: float
    alamine_aminotransferase: float
    aspartate_aminotransferase: float
    total_proteins: float
    albumin: float
    albumin_globulin_ratio: float

class LiverDiseaseResponse(TabularPredictionResponse):
    disease_probability: float
    healthy_probability: float
    model_accuracy: float = Field(0.0, description="Model accuracy on test set (0-1)")
    model_precision: float = Field(0.0, description="Model precision (0-1)")
    model_recall: float = Field(0.0, description="Model recall (0-1)")
    model_f1_score: float = Field(0.0, description="Model F1-score (0-1)")
    model_roc_auc: float = Field(0.0, description="Model ROC-AUC score (0-1)")

class KidneyDiseaseRequest(BaseModel):
    age: float
    blood_pressure: float
    specific_gravity: float
    albumin: float
    sugar: float
    red_blood_cells: float
    pus_cell: float
    pus_cell_clumps: float
    bacteria: float
    blood_glucose_random: float
    blood_urea: float
    serum_creatinine: float
    sodium: float
    potassium: float
    hemoglobin: float
    packed_cell_volume: float
    white_blood_cell_count: float
    red_blood_cell_count: float
    hypertension: float
    diabetes_mellitus: float
    coronary_artery_disease: float
    appetite: float
    pedema: float
    anemia: float

class KidneyDiseaseResponse(TabularPredictionResponse):
    ckd_probability: float
    no_ckd_probability: float
    ckd_stage: Optional[str] = None
    model_accuracy: float = Field(0.0, description="Model accuracy on test set (0-1)")
    model_precision: float = Field(0.0, description="Model precision (0-1)")
    model_recall: float = Field(0.0, description="Model recall (0-1)")
    model_f1_score: float = Field(0.0, description="Model F1-score (0-1)")
    model_roc_auc: float = Field(0.0, description="Model ROC-AUC score (0-1)")

class HeartDiseaseRequest(BaseModel):
    age: float
    sex: float
    cp: float
    trestbps: float
    chol: float
    fbs: float
    restecg: float
    thalach: float
    exang: float
    oldpeak: float
    slope: float
    ca: float
    thal: float

class HeartDiseaseResponse(TabularPredictionResponse):
    disease_probability: float
    healthy_probability: float
    model_accuracy: float = Field(0.0, description="Model accuracy on test set (0-1)")
    model_precision: float = Field(0.0, description="Model precision (0-1)")
    model_recall: float = Field(0.0, description="Model recall (0-1)")
    model_f1_score: float = Field(0.0, description="Model F1-score (0-1)")
    model_roc_auc: float = Field(0.0, description="Model ROC-AUC score (0-1)")

# Metrics schemas
class ModelMetrics(BaseModel):
    model_name: str
    accuracy: float
    precision: float
    recall: float
    f1_score: float
    specificity: float
    sensitivity: float
    auc_roc: float
    mcc: float
    confusion_matrix: List[List[int]]
    training_accuracy: float
    validation_accuracy: float
    test_accuracy: float
    dataset_info: Dict[str, Any]

class AllMetricsResponse(BaseModel):
    metrics: Dict[str, ModelMetrics]
    comparison_chart_data: Dict[str, Any]
    last_updated: datetime = Field(default_factory=datetime.now)
