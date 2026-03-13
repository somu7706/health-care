import json
import os
import math
from collections import defaultdict

# PYTHON TRAINING SCRIPT: Naive Bayes Model Generator
# This script replaces the Node.js version to keep all training in Python.

def train_symptoms_python():
    print("--- PYTHON SYMPTOM ANALYZER TRAINING ---")
    
    # 1. Setup paths
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    data_path = os.path.join(base_dir, 'src', 'data', 'symptom_data.json')
    output_path = os.path.join(base_dir, 'src', 'data', 'trained_model.json')

    if not os.path.exists(data_path):
        print(f"Error: Dataset not found at {data_path}")
        return

    # 2. Load Training Data
    print("Phase 1: Loading Training Data...")
    with open(data_path, 'r') as f:
        training_data = json.load(f)

    # 3. Feature Engineering & Probability Calculation
    # We implement Naive Bayes with Laplace Smoothing (Alpha = 1)
    print("Phase 2: Feature Engineering & Probabilistic Modeling...")
    
    # Count occurrences
    symptom_counts = defaultdict(int)
    all_symptoms = set()
    for item in training_data:
        for s in item['symptoms']:
            symptom_counts[s] += 1
            all_symptoms.add(s)

    vocab = sorted(list(all_symptoms))
    print(f"Detected {len(vocab)} unique symptoms (Vocabulary Size).")

    # Calculate Priors and Likelihoods
    model_data = []
    num_docs = len(training_data)
    alpha = 1.0 # Laplace Smoothing

    for item in training_data:
        # P(Disease) - Simplistic prior
        log_prior = math.log(1 / num_docs)
        
        # P(Symptom | Disease)
        log_likelihoods = {}
        # We assume binary presence/absence model
        # Smooth the probability for all symptoms in vocab
        for s in vocab:
            if s in item['symptoms']:
                # Probability of symptom being present in this disease
                # (1 + alpha) / (1 + 2 * alpha)
                prob = (1.0 + alpha) / (1.0 + (2.0 * alpha))
            else:
                # Probability of symptom being absent
                prob = alpha / (1.0 + (2.0 * alpha))
            
            log_likelihoods[s] = math.log(prob)

        model_data.append({
            "name": item['disease'],
            "description": item['description'],
            "logPrior": log_prior,
            "logLikelihoods": log_likelihoods
        })

    # 4. Save the trained model
    final_output = {
        "modelType": "NaiveBayes-Binary-Python",
        "trainedAt": "2026-03-10",
        "vocab": vocab,
        "modelData": model_data
    }

    with open(output_path, 'w') as f:
        json.dump(final_output, f, indent=2)

    print(f"--- TRAINING COMPLETE ---")
    print(f"Successfully generated Python-trained ML Model with {len(model_data)} branches.")
    print(f"Model saved to: {output_path}")

if __name__ == "__main__":
    train_symptoms_python()
