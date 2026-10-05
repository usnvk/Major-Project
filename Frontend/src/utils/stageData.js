export const STAGE_CARE_DATA = {
  1: {
    stage: 1,
    title: "Stage 1 – Early / Mild Condition",
    description: "Incipient pulmonary lesion visible. High responsiveness to standard first-line regimen.",
    medication: [
      "Initiate standard Intensive Phase anti-TB therapy (Rifampicin, Isoniazid, Pyrazinamide, Ethambutol).",
      "Strict compliance with daily medication schedule under DOTS supervision.",
      "Monitor baseline liver enzyme and kidney function parameters."
    ],
    precautions: [
      "Maintain adequate room ventilation and natural sunlight exposure.",
      "Cover mouth and nose during coughing or sneezing.",
      "Schedule follow-up sputum smear microscopy after 4 weeks of treatment."
    ],
    diet: [
      "High-protein intake (eggs, lean poultry, legumes, dairy) to rebuild tissue.",
      "Incorporate antioxidant-rich fruits (berries, citrus) and dark leafy vegetables.",
      "Maintain daily fluid intake of 2.5–3.0 liters of water."
    ]
  },
  2: {
    stage: 2,
    title: "Stage 2 – Moderate Condition",
    description: "Moderate localized lung involvement with consolidated regions. Medical attention and prescribed treatment should be strictly followed.",
    medication: [
      "Follow prescribed anti-TB treatment regimen without skipping doses.",
      "Complete the full 6-month intensive and continuation course.",
      "Take Pyridoxine (Vitamin B6) supplement to mitigate Isoniazid-induced neuropathy."
    ],
    precautions: [
      "Wear N95/FFP2 protective mask in enclosed public spaces or during clinical visits.",
      "Maintain proper cross-ventilation in living quarters.",
      "Avoid close contact with immunocompromised individuals and infants."
    ],
    diet: [
      "High-protein, energy-dense foods to prevent disease-related weight loss.",
      "Balanced nutritious meals rich in Zinc, Iron, and Vitamin A.",
      "Stay well-hydrated and avoid alcohol or liver-stressing substances."
    ]
  },
  3: {
    stage: 3,
    title: "Stage 3 – Advanced / Extensive Condition",
    description: "Extensive cavitary pulmonary lesions detected. Immediate specialist care and close monitoring required.",
    medication: [
      "Full first-line/second-line anti-TB therapeutic regimen under pulmonologist oversight.",
      "Daily observed treatment (DOTS) with monthly therapeutic efficacy evaluation.",
      "Adjuvant nutritional and pulmonary support therapy as prescribed."
    ],
    precautions: [
      "Strict respiratory isolation during the initial infectious phase (first 2-3 weeks).",
      "Use HEPA filtration or high-flow ventilation in recovery quarters.",
      "Urgent clinical referral if hemoptysis (coughing blood) or severe dyspnea occurs."
    ],
    diet: [
      "Calorie-dense, high-protein supplements alongside structured meal plans.",
      "Micronutrient supplementation including Vitamin D, Vitamin C, Zinc, and B-complex.",
      "Frequent small nutritious meals to support metabolic recovery."
    ]
  }
};

export const getStageInformation = (stageNum) => {
  if (!stageNum || stageNum < 1 || stageNum > 3) {
    return null;
  }
  return STAGE_CARE_DATA[stageNum] || STAGE_CARE_DATA[2];
};
