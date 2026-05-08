import pandas as pd
import numpy as np
import joblib
import json
import os
import urllib.request

# URLs for a public version of the Disease Symptom Prediction dataset
TRAINING_URL = "https://raw.githubusercontent.com/itachi9604/healthcare-chatbot/master/Data/Training.csv"

def download_data():
    print("Downloading dataset...")
    if not os.path.exists("data"):
        os.makedirs("data")
    
    train_path = os.path.join("data", "symptom_training.csv")
    
    if not os.path.exists(train_path):
        urllib.request.urlretrieve(TRAINING_URL, train_path)
    
    return train_path

def train_model():
    print("Loading data...")
    train_path = download_data()
    df = pd.read_csv(train_path)
    
    # Clean up the dataset
    df = df.dropna(axis=1, how='all') # Drop empty columns
    
    # The last column is 'prognosis' (the disease)
    X = df.drop('prognosis', axis=1)
    y = df['prognosis']
    
    symptoms = list(X.columns)
    diseases = list(y.unique())
    
    print(f"Training model on {len(symptoms)} symptoms and {len(diseases)} diseases...")
    
    from sklearn.ensemble import RandomForestClassifier
    from sklearn.model_selection import train_test_split
    from sklearn.metrics import accuracy_score
    
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
    
    model = RandomForestClassifier(n_estimators=100, random_state=42)
    model.fit(X_train, y_train)
    
    preds = model.predict(X_test)
    acc = accuracy_score(y_test, preds)
    print(f"Model Validation Accuracy: {acc * 100:.2f}%")
    
    # Save the model
    os.makedirs("models", exist_ok=True)
    joblib.dump(model, "models/symptom_disease_model.pkl")
    
    metadata = {
        "symptoms": symptoms,
        "diseases": diseases,
        "accuracy": acc
    }
    
    with open("models/symptom_disease_metadata.json", "w") as f:
        json.dump(metadata, f, indent=4)
        
    print("Model and metadata saved successfully in backend/models/")

if __name__ == "__main__":
    train_model()
