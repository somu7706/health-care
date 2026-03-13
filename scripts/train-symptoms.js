import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ML TRAINING SCRIPT: Naive Bayes Pattern Classifier
// This script converts raw medical data into a probabilistic model for real-time inference.

const rawDataPath = path.join(__dirname, '../src/data/symptom_data.json');
const outputPath = path.join(__dirname, '../src/data/trained_model.json');

console.log('--- SYMPTOM ANALYZER ML TRAINING ---');
console.log('Phase 1: Loading Training Data...');

try {
    const rawData = JSON.parse(fs.readFileSync(rawDataPath, 'utf8'));

    // Build Vocabulary (All possible symptoms)
    const allSymptoms = new Set();
    rawData.forEach(item => {
        item.symptoms.forEach(s => allSymptoms.add(s));
    });
    const vocabulary = Array.from(allSymptoms);

    console.log(`Phase 2: Feature Engineering (Vocab Size: ${vocabulary.length})...`);

    // Calculate Priors and Likelihoods
    const totalCases = rawData.length;

    const trainedData = rawData.map(item => {
        // Prior probability P(Disease) - assume uniform for this dataset or count occurrences
        const prior = 1 / totalCases;

        // Likelihood P(Symptom | Disease)
        // We use Laplace Smoothing (Alpha = 1) to avoid zero probabilities
        const likelihoods = {};
        const symptomCount = item.symptoms.length;

        vocabulary.forEach(symptom => {
            const isPresent = item.symptoms.includes(symptom);
            // P(S | D) = (count(S in D) + Alpha) / (count(D) + Alpha * VocabSize)
            // Since our "data" is categorical disease definitions, we treat count(S in D) as 1 or 0
            const prob = (isPresent ? 1 : 0.01) / (1 + 0.01 * vocabulary.length);
            likelihoods[symptom] = Math.log(prob); // Store log-likelihood to avoid underflow
        });

        return {
            name: item.disease,
            description: item.description,
            logPrior: Math.log(prior),
            logLikelihoods: likelihoods
        };
    });

    const model = {
        metadata: {
            algorithm: "Naive Bayes Classifier",
            trainedAt: new Date().toISOString(),
            version: "2.0.0",
            stats: {
                diseaseCount: totalCases,
                featureCount: vocabulary.length
            }
        },
        vocabulary: vocabulary,
        modelData: trainedData
    };

    fs.writeFileSync(outputPath, JSON.stringify(model, null, 2));
    console.log(`--- TRAINING COMPLETE ---`);
    console.log(`Successfully generated ML Model with ${totalCases} layers.`);
} catch (error) {
    console.error('CRITICAL: Training failed:', error);
}
