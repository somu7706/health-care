import pandas as pd
import numpy as np
import json
import os
from sklearn.ensemble import RandomForestClassifier
from sklearn.preprocessing import MultiLabelBinarizer

# ML SCRIPT: Random Forest Disease Prediction Model
# Focus: This script trains a Random Forest model as an 'Expert System' logic benchmark.

def train_model():
    print("--- RANDOM FOREST TRAINING INITIATED ---")
    
    # 1. Load data
    data_path = os.path.join(os.path.dirname(__file__), '../src/data/symptom_data.json')
    if not os.path.exists(data_path):
        print(f"Error: Dataset not found at {data_path}")
        return

    with open(data_path, 'r') as f:
        raw_data = json.load(f)

    # 2. Prepare features (Symptom One-Hot Encoding)
    diseases = [item['disease'] for item in raw_data]
    symptoms_list = [item['symptoms'] for item in raw_data]

    mlb = MultiLabelBinarizer()
    X = mlb.fit_transform(symptoms_list)
    y = diseases
    symptom_names = mlb.classes_

    # 3. Train Random Forest (Ensemble of 100 Trees)
    # This model is great for explanation because it looks at feature importance
    rf = RandomForestClassifier(n_estimators=100, random_state=42)
    rf.fit(X, y)

    print(f"Model trained successfully on {len(diseases)} disease patterns.")
    print(f"Total features (Symptoms) identified: {len(symptom_names)}")

    # 4. Extract Feature Importance for UI Explanation
    importance = rf.feature_importances_
    indices = np.argsort(importance)[::-1]
    
    explanation_data = {
        "model_type": "Random Forest Classifier",
        "description": "An ensemble of 100 Decision Trees used to classify disease patterns based on symptom presence.",
        "top_features": [
            {"symptom": symptom_names[i], "weight": float(importance[i])} 
            for i in indices[:10]
        ],
        "training_metadata": {
            "samples": len(diseases),
            "features": len(symptom_names),
            "accuracy_on_train": float(rf.score(X, y))
        }
    }

    # 5. Export to research folder for explanation reference
    output_path = os.path.join(os.path.dirname(__file__), '../research/rf_explanation.json')
    with open(output_path, 'w') as f:
        json.dump(explanation_data, f, indent=2)
    
    print(f"Explanation metadata saved to: {output_path}")

if __name__ == "__main__":
    train_model()
