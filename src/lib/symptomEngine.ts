import model from "../data/trained_model.json";

export interface Condition {
    name: string;
    probability: "high" | "medium" | "low";
    description: string;
    score: number;
}

// Map common conversational terms to our technical symptom keys
const symptomAliases: Record<string, string[]> = {
    "fever": ["fever", "fiever", "high temperature", "hot", "feverish", "100", "101", "102", "103", "104"],
    "cough": ["cough", "coughing", "dry cough", "wet cough"],
    "cold": ["cold", "sneezing", "runny nose", "blocked nose", "chill"],
    "headache": ["headache", "head pain", "migraine", "pounding head"],
    "fatigue": ["fatigue", "tired", "weakness", "exhausted", "low energy"],
    "soreThroat": ["sore throat", "throat pain", "pain swallowing"],
    "bodyAche": ["body ache", "body pain", "muscle pain", "pains", "aching"],
    "breathShort": ["shortness of breath", "breathless", "difficulty breathing", "suffocation"],
    "tasteLoss": ["loss of taste", "loss of smell", "cannot taste", "no smell"],
    "nausea": ["nausea", "feeling sick", "queasy"],
    "vomiting": ["vomiting", "throw up", "puke"],
    "diarrhea": ["diarrhea", "loose motion", "stomach upset"],
    "abdominalPain": ["abdominal pain", "stomach pain", "tummy ache", "belly pain"],
    "chestPain": ["chest pain", "heart pain", "chest tightness"],
    "dizziness": ["dizziness", "giddy", "spinning", "faint"],
    "skinRash": ["rash", "itching", "skin spots", "redness"],
    "jointPain": ["joint pain", "knee pain", "back pain", "aching joints"],
    "muscleWeakness": ["muscle weakness", "weak muscles", "limb weakness"],
    "blurredVision": ["blurred vision", "cannot see", "vision problem", "vission"],
    "insomnia": ["insomnia", "cannot sleep", "no sleep", "sleepless"]
};

/**
 * ML Inference Engine (V3 - Enhanced for Text Parsing)
 */
export function analyzeSymptomsLocally(selectedSymptoms: string[], otherSymptomsText: string = ""): Condition[] {
    const extractedFromText: string[] = [];
    const lowerText = otherSymptomsText.toLowerCase();

    // 1. Extract potential symptoms from the description text
    Object.keys(symptomAliases).forEach(key => {
        const aliases = symptomAliases[key];
        if (aliases.some(alias => lowerText.includes(alias))) {
            if (!selectedSymptoms.includes(key)) {
                extractedFromText.push(key);
            }
        }
    });

    const combinedSymptoms = Array.from(new Set([...selectedSymptoms, ...extractedFromText]));

    if (combinedSymptoms.length === 0) return [];

    // 2. Calculate Posterior Log-Probabilities
    const results: Condition[] = model.modelData.map((disease: any) => {
        let logPosterior = disease.logPrior;
        let matchCount = 0;

        combinedSymptoms.forEach(s => {
            if (disease.logLikelihoods[s]) {
                // Boost the log likelihood for matching symptoms
                logPosterior += (disease.logLikelihoods[s] * 1.5);

                // Threshold check
                if (disease.logLikelihoods[s] > -3.5) {
                    matchCount++;
                }
            }
        });

        // Simple normalization for UI scoring
        // With more matches, the score should climb rapidly
        const matchRatio = matchCount / combinedSymptoms.length;
        let score = (matchRatio * 60) + (matchCount * 10);
        score = Math.min(100, score);

        let probability: "high" | "medium" | "low" = "low";
        if (matchCount >= 3 || (matchCount >= 2 && score > 70)) {
            probability = "high";
        } else if (matchCount >= 2 || (matchCount >= 1 && score > 40)) {
            probability = "medium";
        }

        return {
            name: disease.name,
            probability,
            description: disease.description,
            score: matchCount > 0 ? score : 0
        };
    });

    // 3. Filter and Rank Results
    return results
        .filter(r => r.score > 15) // Hide low-confidence noise
        .sort((a, b) => b.score - a.score)
        .slice(0, 3);
}
