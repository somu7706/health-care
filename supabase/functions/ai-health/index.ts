import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { action, data } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const aiCall = async (systemPrompt: string, userPrompt: string | object[]) => {
      const userContent = typeof userPrompt === "string" ? userPrompt : userPrompt;
      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userContent },
          ],
        }),
      });

      if (!response.ok) {
        if (response.status === 429) throw new Error("Rate limited. Please try again later.");
        if (response.status === 402) throw new Error("AI usage limit reached. Please add credits.");
        throw new Error(`AI gateway error: ${response.status}`);
      }

      const result = await response.json();
      return result.choices?.[0]?.message?.content || "";
    };

    let result;

    switch (action) {
      case "analyze-report": {
        const lang = data.language || "English";
        const systemPrompt = `You are a highly accurate medical document analyzer specializing in prescription analysis.

CRITICAL RULES:
1. Extract EVERY medicine mentioned in the prescription with exact spelling.
2. Use standard medical/pharmaceutical names (e.g., "Amoxicillin" not "Amoxilin", "Metformin" not "Metforman").
3. Apply fuzzy matching internally: if OCR text has a misspelling, correct it to the nearest valid medicine name.
4. For each medicine, provide a confidence score (0-100) based on how clearly it was identified.
5. If confidence < 90%, set "needs_review": true for that medicine and provide "original_text" showing what OCR detected.
6. Extract dosage, frequency, and duration precisely. If not specified, mark as "Not specified".
7. Identify the disease/condition being treated based on the medicines prescribed.
8. Determine if this is a prescription, lab report, X-ray, or other document type.

IMPORTANT: Respond in ${lang} language for summary and disease fields. Keep medicine names in English (international standard names).

Return ONLY valid JSON:
{
  "disease": "identified condition or null",
  "medicines": [
    {
      "name": "corrected standard medicine name",
      "original_text": "what OCR detected (only if different from name)",
      "generic_name": "generic/salt name",
      "dosage": "e.g., 500mg",
      "frequency": "e.g., twice daily",
      "duration": "e.g., 7 days",
      "drug_class": "e.g., Antibiotic, Analgesic",
      "confidence": 95,
      "needs_review": false
    }
  ],
  "summary": "brief clinical summary",
  "report_type": "prescription | lab_report | xray | other",
  "warnings": ["any drug interaction warnings"],
  "diet_recommendations": ["disease-specific diet suggestions based on medicines"],
  "contraindications": ["things to avoid based on prescribed medicines"]
}`;
        // Build user message - support both text and image input
        let userMessage: string | object[];
        if (data.imageBase64) {
          // Vision-based analysis: send image directly to Gemini
          userMessage = [
            {
              type: "text",
              text: data.reportText
                ? `Here is the OCR-extracted text for reference (may contain errors):\n${data.reportText}\n\nPlease analyze the prescription IMAGE directly for accurate medicine extraction. Cross-reference with the OCR text but trust the image more.`
                : "Please analyze this prescription image and extract all medicines accurately.",
            },
            {
              type: "image_url",
              image_url: { url: `data:${data.imageMimeType || "image/jpeg"};base64,${data.imageBase64}` },
            },
          ];
        } else {
          userMessage = data.reportText;
        }

        const text = await aiCall(systemPrompt, userMessage);
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        result = jsonMatch ? JSON.parse(jsonMatch[0]) : { error: "Could not parse AI response" };
        break;
      }

      case "predict-disease-stage": {
        const lang = data.language || "English";
        const systemPrompt = `You are a medical AI system specializing in disease staging.

Analyze the following data to predict disease stage:
- Disease name
- Prescribed medicines and their dosages
- Patient symptoms
- Patient age and medical history

STAGING CRITERIA:
- Early Stage: Mild symptoms, basic medication, high recovery potential
- Moderate Stage: Multiple symptoms, combination therapy, moderate disease progression
- Advanced Stage: Severe symptoms, aggressive treatment, significant organ involvement
- Recovery Stage: Improving markers, reduced medication, positive trajectory

Base your confidence on the quality and completeness of available data.

IMPORTANT: Respond in ${lang} language.

Return ONLY valid JSON:
{
  "disease": "string",
  "stage": "Early Stage | Moderate Stage | Advanced Stage | Recovery Stage",
  "confidence": number (0-100),
  "explanation": "detailed reasoning for this staging",
  "key_indicators": ["indicator1", "indicator2"],
  "recommended_actions": ["action1", "action2"]
}`;
        const text = await aiCall(systemPrompt, JSON.stringify(data));
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        result = jsonMatch ? JSON.parse(jsonMatch[0]) : { error: "Could not parse" };
        break;
      }

      case "generate-care-plan": {
        const lang = data.language || "English";
        const systemPrompt = `You are an AI healthcare planner creating evidence-based personalized care plans.

Generate a comprehensive care plan considering:
- The specific disease and its stage
- Prescribed medicines and their interactions
- Patient age and profile
- Drug-specific dietary restrictions (e.g., no grapefruit with statins, low sugar for diabetes meds)
- Exercise limitations based on condition

DIET RULES:
- If diabetes medicines (Metformin, Glipizide, etc.): Low glycemic index diet, limit refined carbs
- If hypertension medicines (Amlodipine, Losartan, etc.): Low sodium diet (<2300mg/day), DASH diet
- If cholesterol medicines (Atorvastatin, etc.): Low saturated fat, avoid grapefruit
- If kidney medicines: Limit potassium, phosphorus
- If liver medicines: Avoid alcohol completely
- If antibiotics: Include probiotics, avoid dairy near dose times
- If blood thinners (Warfarin): Consistent vitamin K intake

IMPORTANT: Respond in ${lang} language.

Return ONLY valid JSON:
{
  "diet": ["specific dietary suggestion with reasoning"],
  "foods_to_avoid": ["food1 - reason", "food2 - reason"],
  "foods_to_include": ["food1 - benefit", "food2 - benefit"],
  "exercise": ["exercise suggestion with duration and frequency"],
  "sleep": ["sleep hygiene recommendation"],
  "medication_schedule": ["specific time-based schedule"],
  "followups": ["followup recommendation with timeline"],
  "lifestyle_changes": ["specific lifestyle modification"],
  "warning_signs": ["symptoms to watch for that need immediate attention"]
}`;
        const text = await aiCall(systemPrompt, JSON.stringify(data));
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        result = jsonMatch ? JSON.parse(jsonMatch[0]) : { error: "Could not parse" };
        break;
      }

      case "generate-precautions": {
        const lang = data.language || "English";
        const systemPrompt = `You are a medical safety advisor generating critical precautions.

Based on the patient's diseases and medicines, generate specific, actionable precautions.

Categories to cover:
1. Drug interaction warnings
2. Food-drug interactions  
3. Activity restrictions
4. Side effect monitoring
5. Emergency warning signs
6. Lifestyle precautions

IMPORTANT: Respond in ${lang} language.

Return ONLY a JSON array of objects:
[
  {"category": "Drug Interaction", "precaution": "specific precaution text", "severity": "high|medium|low"},
  ...
]`;
        const text = await aiCall(systemPrompt, JSON.stringify(data));
        // Try array first, then object
        const arrayMatch = text.match(/\[[\s\S]*\]/);
        if (arrayMatch) {
          result = JSON.parse(arrayMatch[0]);
        } else {
          result = [];
        }
        break;
      }

      case "generate-reminders": {
        const systemPrompt = `You are a medication scheduling assistant. Based on the medicine frequency, generate specific reminder times.

Rules:
- "once daily" or "OD": 8:00 AM
- "twice daily" or "BD": 8:00 AM, 8:00 PM  
- "thrice daily" or "TDS" or "TID": 8:00 AM, 2:00 PM, 8:00 PM
- "four times daily" or "QID": 8:00 AM, 12:00 PM, 4:00 PM, 8:00 PM
- "before meals": 30 minutes before typical meal times
- "after meals": 30 minutes after typical meal times
- "at bedtime" or "HS": 10:00 PM
- "every X hours": space evenly starting from 8:00 AM
- "SOS" or "as needed": no fixed schedule, mark as "as_needed"

Return ONLY valid JSON:
{
  "reminders": [
    {
      "medicine_name": "string",
      "dosage": "string",
      "times": ["HH:MM"],
      "instruction": "before meals / after meals / with food / empty stomach",
      "type": "scheduled | as_needed"
    }
  ]
}`;
        const text = await aiCall(systemPrompt, JSON.stringify(data));
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        result = jsonMatch ? JSON.parse(jsonMatch[0]) : { reminders: [] };
        break;
      }

      case "analyze-symptoms": {
        const lang = data.language || "English";
        const systemPrompt = `You are a diagnostic AI. Given the symptoms, return possible conditions with clinical reasoning.

IMPORTANT: Respond in ${lang} language.

Return ONLY valid JSON:
{
  "possible_conditions": [
    { 
      "name": "condition name", 
      "probability": "high | medium | low", 
      "description": "brief clinical description",
      "recommended_tests": ["test1", "test2"],
      "urgency": "immediate | soon | routine"
    }
  ]
}`;
        const text = await aiCall(systemPrompt, JSON.stringify(data));
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        result = jsonMatch ? JSON.parse(jsonMatch[0]) : { possible_conditions: [] };
        break;
      }

      case "medicine-safety": {
        const lang = data.language || "English";
        const systemPrompt = `You are a pharmaceutical AI assistant. Analyze medicine safety comprehensively.

Check for:
1. Known side effects (common and rare)
2. Drug-drug interactions with commonly prescribed medicines
3. Food-drug interactions
4. Contraindications (pregnancy, liver disease, kidney disease, etc.)
5. Overdose risk and symptoms
6. Age-specific warnings

IMPORTANT: Respond in ${lang} language.

Return ONLY valid JSON:
{
  "safety_score": number (0-100),
  "warnings": ["critical warning"],
  "interactions": ["drug interaction detail"],
  "side_effects": ["common side effect"],
  "rare_side_effects": ["rare but serious side effect"],
  "food_interactions": ["food to avoid"],
  "contraindications": ["condition where this drug should not be used"],
  "overdose_symptoms": ["symptom of overdose"]
}`;
        const text = await aiCall(systemPrompt, JSON.stringify(data));
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        result = jsonMatch ? JSON.parse(jsonMatch[0]) : { safety_score: 0 };
        break;
      }

      case "health-risk-score": {
        const lang = data.language || "English";
        const systemPrompt = `You are a health risk assessment AI. Analyze patient data to calculate a health risk score.

Consider: age, current medicines, reported symptoms, lifestyle factors.

IMPORTANT: Respond in ${lang} language (except JSON keys).

Return ONLY valid JSON:
{
  "overall_score": number (0-100, higher = healthier),
  "risk_level": "Low Risk | Moderate Risk | High Risk",
  "factors": [
    { "name": "factor name", "score": number (0-100), "status": "good | moderate | poor", "detail": "explanation" }
  ],
  "recommendations": ["actionable recommendation"],
  "future_risks": [
    { "condition": "disease name", "probability": "low | moderate | high", "timeframe": "time estimate" }
  ]
}`;
        const text = await aiCall(systemPrompt, JSON.stringify(data));
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        result = jsonMatch ? JSON.parse(jsonMatch[0]) : { overall_score: 50, risk_level: "Moderate Risk", factors: [], recommendations: [] };
        break;
      }

      case "check-interactions": {
        const lang = data.language || "English";
        const systemPrompt = `You are a pharmacology AI specializing in drug interactions. Check ALL pairwise interactions between the given medicines.

IMPORTANT: Respond in ${lang} language (except JSON keys).

Return ONLY valid JSON:
{
  "interactions": [
    {
      "medicine_a": "name",
      "medicine_b": "name",
      "severity": "safe | moderate | dangerous",
      "description": "interaction detail",
      "recommendation": "what to do"
    }
  ]
}`;
        const text = await aiCall(systemPrompt, JSON.stringify(data));
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        result = jsonMatch ? JSON.parse(jsonMatch[0]) : { interactions: [] };
        break;
      }

      case "full-prescription-analysis": {
        const lang = data.language || "English";
        // Step 1: Predict disease stage
        const stagePrompt = `You are a medical AI. Analyze the disease "${data.disease}" with medicines: ${JSON.stringify(data.medicines)}. Patient age: ${data.age || "unknown"}.

IMPORTANT: Respond in ${lang} language (except JSON keys).

Return ONLY valid JSON:
{
  "stage": "Early Stage | Moderate Stage | Advanced Stage | Recovery Stage",
  "confidence": number (0-100),
  "explanation": "reasoning"
}`;
        const stageText = await aiCall(stagePrompt, JSON.stringify(data));
        const stageMatch = stageText.match(/\{[\s\S]*\}/);
        const stageResult = stageMatch ? JSON.parse(stageMatch[0]) : { stage: "Unknown", confidence: 50 };

        // Step 2: Generate care plan + diet
        const carePlanPrompt = `You are an AI healthcare planner. Generate a care plan for "${data.disease}" (${stageResult.stage}) with medicines: ${JSON.stringify(data.medicines)}.

Include diet plan, exercise, sleep, medication schedule, followups, foods to avoid, foods to include.

IMPORTANT: Respond in ${lang} language (except JSON keys).

Return ONLY valid JSON:
{
  "diet": ["suggestion"],
  "foods_to_avoid": ["food - reason"],
  "foods_to_include": ["food - benefit"],
  "exercise": ["exercise"],
  "sleep": ["sleep tip"],
  "medication_schedule": ["schedule"],
  "followups": ["followup"],
  "lifestyle_changes": ["change"],
  "warning_signs": ["sign"]
}`;
        const careText = await aiCall(carePlanPrompt, JSON.stringify(data));
        const careMatch = careText.match(/\{[\s\S]*\}/);
        const careResult = careMatch ? JSON.parse(careMatch[0]) : {};

        // Step 3: Generate precautions
        const precautionsPrompt = `You are a medical safety advisor. Generate precautions for disease "${data.disease}" with medicines: ${JSON.stringify(data.medicines)}.

IMPORTANT: Respond in ${lang} language (except JSON keys).

Return ONLY a JSON array:
[{"category": "string", "precaution": "string", "severity": "high|medium|low"}]`;
        const precText = await aiCall(precautionsPrompt, JSON.stringify(data));
        const precMatch = precText.match(/\[[\s\S]*\]/);
        const precResult = precMatch ? JSON.parse(precMatch[0]) : [];

        result = {
          stage: stageResult,
          care_plan: careResult,
          precautions: precResult,
        };
        break;
      }

      case "verify-medicine-authenticity": {
        const lang = data.language || "English";
        const systemPrompt = `You are a pharmaceutical authenticity verification AI. Analyze medicine details to predict whether the medicine is genuine or potentially fake/counterfeit.

Verification checks:
1. Medicine Name: Validate against known pharmaceutical database. Check if name, strength, dosage form are standard.
2. Manufacturer: Compare against known pharmaceutical companies globally.
3. Batch Number: Check format validity (most use alphanumeric 6-12 chars). Flag suspicious patterns.
4. Expiry Date: Flag if expired or suspiciously far in future (>5 years).
5. Packaging Text: Detect spelling errors, grammar issues, or suspicious text that indicate counterfeit.
6. Purchase Source: Higher risk for street vendors or unknown sources.

IMPORTANT: Respond in ${lang} language (except JSON keys).

Return ONLY valid JSON:
{
  "authenticity": "Likely Genuine | Suspicious | High Risk - Possible Fake",
  "risk_level": "Low | Medium | High",
  "confidence": number (0-100),
  "warnings": ["specific warning"],
  "details": {
    "name_check": { "status": "pass|warning|fail", "detail": "explanation" },
    "manufacturer_check": { "status": "pass|warning|fail", "detail": "explanation" },
    "batch_check": { "status": "pass|warning|fail", "detail": "explanation" },
    "expiry_check": { "status": "pass|warning|fail", "detail": "explanation" },
    "packaging_check": { "status": "pass|warning|fail", "detail": "explanation" },
    "source_check": { "status": "pass|warning|fail", "detail": "explanation" }
  },
  "recommendations": ["actionable recommendation"]
}`;
        const text = await aiCall(systemPrompt, JSON.stringify(data));
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        result = jsonMatch ? JSON.parse(jsonMatch[0]) : { error: "Could not parse" };
        break;
      }

      case "health-coach": {
        const lang = data.language || "English";
        const systemPrompt = `You are an AI health coach. Generate 6-8 personalized daily health tips based on the patient's medicines and conditions.

Categories: hydration, sleep, activity, nutrition, medication, heart
Priority: high, medium, low

IMPORTANT: Respond in ${lang} language (except JSON keys and icon values).

Return ONLY valid JSON:
{
  "tips": [
    { "category": "category label", "tip": "personalized health tip", "icon": "hydration|sleep|activity|nutrition|medication|heart", "priority": "high|medium|low" }
  ]
}`;
        const text = await aiCall(systemPrompt, JSON.stringify(data));
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        result = jsonMatch ? JSON.parse(jsonMatch[0]) : { tips: [] };
        break;
      }

      case "chat": {
        const lang = data.language || "English";
        const systemPrompt = `You are a helpful AI health assistant called VitalWave AI. You can only help with medical and health-related questions. If asked about non-health topics, politely redirect. Keep answers clear, concise, and always include a disclaimer to consult a doctor. Format responses in markdown. IMPORTANT: Respond in ${lang} language.`;
        const text = await aiCall(systemPrompt, data.message);
        result = { response: text };
        break;
      }

      default:
        result = { error: "Unknown action" };
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("AI function error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
