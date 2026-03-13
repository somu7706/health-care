import medicines from "../data/medicine_data.json";

export interface AuthenticityResult {
    authenticity: string;
    risk_level: string;
    confidence: number;
    warnings: string[];
    details: {
        name_check: { status: string; detail: string };
        manufacturer_check: { status: string; detail: string };
        batch_check: { status: string; detail: string };
        expiry_check: { status: string; detail: string };
        packaging_check: { status: string; detail: string };
        source_check: { status: string; detail: string };
    };
    recommendations: string[];
}

export function verifyMedicineLocally(input: {
    medicineName: string;
    manufacturer: string;
    batchNumber: string;
    expiryDate: string;
    purchaseSource: string;
    packagingText?: string;
}): AuthenticityResult {
    const name = input.medicineName.toLowerCase();
    const mfr = input.manufacturer.toLowerCase();
    const batch = input.batchNumber.toUpperCase();
    const today = new Date();
    const expiry = new Date(input.expiryDate);

    // 1. Find matching medicine in dataset
    const match = medicines.find(m =>
        name.includes(m.name.toLowerCase()) ||
        m.name.toLowerCase().includes(name)
    );

    const mfrMatch = match && (
        mfr.includes(match.manufacturer.toLowerCase()) ||
        match.manufacturer.toLowerCase().includes(mfr)
    );

    let confidence = 0;
    let risk_level = "High";
    const warnings: string[] = [];
    const recommendations: string[] = ["Consult a professional if unsure.", "Always buy from licensed pharmacies."];

    // Logic checks
    const name_status = match ? "pass" : "warning";
    const mfr_status = mfrMatch ? "pass" : (match ? "fail" : "warning");

    // Batch check: Simple prefix check + length
    const isBatchFormatValid = match && batch.startsWith(match.prefix) && batch.length >= 4;
    const batch_status = isBatchFormatValid ? "pass" : (match ? "fail" : "warning");

    // Expiry check
    const isExpired = expiry < today;
    const expiry_status = isExpired ? "fail" : "pass";

    // Source check
    const isSourceSafe = input.purchaseSource.includes("Licensed Pharmacy");
    const source_status = isSourceSafe ? "pass" : "warning";

    // Packaging check (simple spelling/suspicious word check)
    const suspiciousWords = ["temp", "offer", "discount", "free", "magic", "cure all"];
    const hasSuspiciousText = input.packagingText && suspiciousWords.some(w => input.packagingText?.toLowerCase().includes(w));
    const packaging_status = hasSuspiciousText ? "fail" : "pass";

    // Calculate overall confidence and risk
    if (name_status === "pass") confidence += 20;
    if (mfr_status === "pass") confidence += 20;
    if (batch_status === "pass") confidence += 20;
    if (expiry_status === "pass") confidence += 20;
    if (source_status === "pass") confidence += 20;

    if (confidence >= 80) {
        risk_level = "Low";
    } else if (confidence >= 50) {
        risk_level = "Medium";
    } else {
        risk_level = "High";
    }

    if (isExpired) {
        warnings.push("This medicine is expired.");
        recommendations.push("Do not consume expired medication.");
        risk_level = "High";
        confidence = Math.min(confidence, 30);
    }

    if (mfr_status === "fail") {
        warnings.push("Manufacturer does not match the known producer of this medicine.");
    }

    if (batch_status === "fail") {
        warnings.push("Batch number format doesn't match standard records for this manufacturer.");
    }

    if (!isSourceSafe) {
        warnings.push("Purchased from a non-recommended source.");
    }

    return {
        authenticity: confidence >= 80 ? "Likely Genuine" : (confidence >= 50 ? "Suspicious" : "Potentially Counterfeit"),
        risk_level: risk_level,
        confidence: confidence,
        warnings: warnings.length > 0 ? warnings : ["No major issues detected based on provided data."],
        details: {
            name_check: { status: name_status, detail: match ? `Matches records for ${match.name}` : "Medicine not found in local safety database." },
            manufacturer_check: { status: mfr_status, detail: mfrMatch ? "Correct manufacturer for this brand." : "Manufacturer verification inconclusive." },
            batch_check: { status: batch_status, detail: isBatchFormatValid ? "Valid batch format." : "Batch number format is unusual." },
            expiry_check: { status: expiry_status, detail: isExpired ? "Product is past its expiry date." : "Expiry date is valid." },
            packaging_check: { status: packaging_status, detail: hasSuspiciousText ? "Suspicious markings detected on packaging." : "No obvious packaging defects noted." },
            source_check: { status: source_status, detail: isSourceSafe ? "Trusted purchase source." : "Source provides higher risk of counterfeit." }
        },
        recommendations: recommendations
    };
}
