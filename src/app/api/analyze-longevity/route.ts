import { NextRequest, NextResponse } from 'next/server';

export interface LongevityAnalysisResult {
  biologicalAge: number;
  chronologicalAge: number;
  ageGap: number;
  ageGapCategory: string;
  faceAgeConfidence: number;
  biomarkers: {
    collagenIntegrity: { score: number; label: string; description: string; biologicalInsight: string };
    cellularTurnover: { score: number; label: string; description: string; biologicalInsight: string };
    oxidativeStress: { score: number; label: string; description: string; biologicalInsight: string };
    glycationSigns: { score: number; label: string; description: string; biologicalInsight: string };
    inflammationMarkers: { score: number; label: string; description: string; biologicalInsight: string };
    hormonalBalance: { score: number; label: string; description: string; biologicalInsight: string };
    telomereProxy: { score: number; label: string; description: string; biologicalInsight: string };
    mitochondrialFunction: { score: number; label: string; description: string; biologicalInsight: string };
  };
  epigeneticClock: {
    estimatedBiologicalAge: number;
    clockIndicators: {
      name: string;
      observed: string;
      typicalAgeRange: string;
    }[];
    clockConfidence: string;
  };
  facialAgeSigns: {
    area: string;
    observedSign: string;
    estimatedAgeImpact: number;
    reversibility: string;
  }[];
  longevityScore: number;
  longevityCategory: string;
  recommendations: {
    category: string;
    interventions: string[];
    impactLevel: string;
    timeToEffect: string;
  }[];
  summary: string;
}

const LONGEVITY_PROMPT = `You are an expert in facial biomarker analysis, epigenetic aging clocks, and longevity science. Analyze this face selfie image to estimate biological age and assess longevity biomarkers visible through facial characteristics.

IMPORTANT DISCLAIMERS:
- This is a COSMETIC facial appearance assessment using visible proxy indicators, NOT a medical diagnosis or clinical epigenetic test.
- Real epigenetic clocks require DNA methylation blood testing (Horvath clock, GrimAge, etc.). This analysis uses VISIBLE FACIAL PROXIES only.
- Results are estimations for educational and cosmetic purposes only.

The user's actual chronological age is: {CHRONOLOGICAL_AGE} years old.

Based on their chronological age and visible facial characteristics, estimate their biological age. The biological age should be derived from:
- Visible skin aging vs expected aging for their chronological age
- Facial fat distribution and volume loss patterns
- Collagen and elasticity indicators
- Wrinkle depth, pattern, and distribution
- Pigmentation changes that correlate with cellular aging
- Under-eye area characteristics (hollowing, darkness, thinning)
- Jawline definition and jowling
- Nasolabial fold depth
- Forehead line patterns
- Lip volume and vermillion border definition
- Ear lobe creasing (Frank's sign proxy)

For each of the 8 biomarkers below, provide a score from 0-100 where:
- 0-30 = Significant aging acceleration visible (biomarker suggests age > chronological + 10)
- 31-50 = Moderate aging acceleration (biomarker suggests age > chronological + 5)
- 51-70 = Normal aging trajectory (biomarker aligns with chronological age)
- 71-85 = Slower aging trajectory (biomarker suggests age < chronological - 3)
- 86-100 = Exceptional longevity indicators (biomarker suggests age < chronological - 7)

BIOMARKERS TO ASSESS:
1. Collagen Integrity — Skin firmness, bounce-back, wrinkle depth, elasticity indicators. Biological insight: collagen production declines ~1% annually after 25; visible sagging and creping indicate accelerated loss.
2. Cellular Turnover — Skin radiance, texture uniformity, dullness, rough patches. Biological insight: cell turnover slows from ~28 days at age 20 to ~45+ days at 60; dull/rough skin indicates slower turnover.
3. Oxidative Stress — Uneven pigmentation, sun damage signs, age spots, dullness. Biological insight: free radical damage accumulates in skin; visible hyperpigmentation and sun damage correlate with systemic oxidative stress.
4. Glycation Signs — Skin yellowing, stiffness, loss of suppleness, crosshatch wrinkling. Biological insight: advanced glycation end-products (AGEs) make skin stiff and yellowed; associated with metabolic health.
5. Inflammation Markers — Redness, sensitivity, rosacea signs, puffiness. Biological insight: chronic low-grade inflammation (inflammaging) accelerates biological aging; visible skin inflammation may reflect systemic inflammation.
6. Hormonal Balance — Skin thickness, oil distribution, facial hair patterns, adult acne. Biological insight: declining hormones affect skin thickness, moisture, and texture; patterns can indicate hormonal aging trajectory.
7. Telomere Proxy — Overall skin vitality, healing capacity, scar appearance, resilience. Biological insight: shorter telomeres correlate with visible skin aging; poor healing and fragility are proxies.
8. Mitochondrial Function — Skin energy, radiance, fatigue signs under eyes, overall vitality. Biological insight: mitochondrial dysfunction shows as skin dullness, dark circles, and lack of cellular energy.

Also provide:
- Epigenetic clock estimation with observed indicators mapped to age ranges
- Facial age signs breakdown by area (forehead, eyes, cheeks, nasolabial, jawline, lips, neck)
- A longevity score (0-100) combining all biomarkers
- Longevity category (Accelerated Aging, Normal Trajectory, Slow Aging, Longevity Advantage)
- Intervention recommendations grouped by category with impact level and time to see effect
- A 2-3 sentence summary

You MUST respond with ONLY valid JSON in this exact format:
{
  "biologicalAge": <number, estimated biological age>,
  "chronologicalAge": <number, user's actual age>,
  "ageGap": <number, biological minus chronological (negative = look younger)>,
  "ageGapCategory": "<string: 'Significantly Younger' | 'Younger' | 'Age-Appropriate' | 'Older' | 'Significantly Older'>",
  "faceAgeConfidence": <number 0-100, confidence in the age estimation>,
  "biomarkers": {
    "collagenIntegrity": { "score": <number>, "label": "Collagen Integrity", "description": "<1 sentence visual finding>", "biologicalInsight": "<1 sentence science explanation>" },
    "cellularTurnover": { "score": <number>, "label": "Cellular Turnover Rate", "description": "<1 sentence visual finding>", "biologicalInsight": "<1 sentence science explanation>" },
    "oxidativeStress": { "score": <number>, "label": "Oxidative Stress Signs", "description": "<1 sentence visual finding>", "biologicalInsight": "<1 sentence science explanation>" },
    "glycationSigns": { "score": <number>, "label": "Glycation Markers", "description": "<1 sentence visual finding>", "biologicalInsight": "<1 sentence science explanation>" },
    "inflammationMarkers": { "score": <number>, "label": "Inflammation Markers", "description": "<1 sentence visual finding>", "biologicalInsight": "<1 sentence science explanation>" },
    "hormonalBalance": { "score": <number>, "label": "Hormonal Balance", "description": "<1 sentence visual finding>", "biologicalInsight": "<1 sentence science explanation>" },
    "telomereProxy": { "score": <number>, "label": "Telomere Length Proxy", "description": "<1 sentence visual finding>", "biologicalInsight": "<1 sentence science explanation>" },
    "mitochondrialFunction": { "score": <number>, "label": "Mitochondrial Function", "description": "<1 sentence visual finding>", "biologicalInsight": "<1 sentence science explanation>" }
  },
  "epigeneticClock": {
    "estimatedBiologicalAge": <number>,
    "clockIndicators": [
      { "name": "<indicator name>", "observed": "<what was observed>", "typicalAgeRange": "<e.g. '40-50 years'>" }
    ],
    "clockConfidence": "<Low | Moderate | High>"
  },
  "facialAgeSigns": [
    { "area": "<area name>", "observedSign": "<what was observed>", "estimatedAgeImpact": <number of years added/subtracted>, "reversibility": "<High | Moderate | Low>" }
  ],
  "longevityScore": <number 0-100>,
  "longevityCategory": "<string>",
  "recommendations": [
    { "category": "<string>", "interventions": ["<specific intervention>", "<specific intervention>"], "impactLevel": "<High | Moderate | Low>", "timeToEffect": "<e.g. '3-6 months'>" }
  ],
  "summary": "<2-3 sentence summary>"
}`;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { image, chronologicalAge } = body as { image: string; chronologicalAge: number };

    if (!image) {
      return NextResponse.json({ error: 'No image provided' }, { status: 400 });
    }

    if (!chronologicalAge || chronologicalAge < 10 || chronologicalAge > 120) {
      return NextResponse.json({ error: 'Please provide a valid age (10-120)' }, { status: 400 });
    }

    const prompt = LONGEVITY_PROMPT.replace('{CHRONOLOGICAL_AGE}', String(chronologicalAge));

    const ZAI = (await import('z-ai-web-dev-sdk')).default;
    const zai = await ZAI.create();

    const response = await zai.chat.completions.createVision({
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            { type: 'image_url', image_url: { url: image } }
          ]
        }
      ],
      thinking: { type: 'disabled' }
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      return NextResponse.json({ error: 'No analysis result returned from AI' }, { status: 500 });
    }

    let analysisResult: LongevityAnalysisResult;
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('No JSON found in response');
      analysisResult = JSON.parse(jsonMatch[0]);
    } catch (parseError) {
      console.error('Failed to parse VLM longevity response:', content);
      return NextResponse.json({ error: 'Failed to parse AI analysis results. Please try again.' }, { status: 500 });
    }

    // Validate
    if (!analysisResult.biomarkers || !analysisResult.biologicalAge) {
      return NextResponse.json({ error: 'Incomplete analysis results. Please try again.' }, { status: 500 });
    }

    // Clamp and enforce consistency
    const clamp = (n: number, min = 0, max = 100) => Math.max(min, Math.min(max, Math.round(n)));

    analysisResult.biologicalAge = clamp(analysisResult.biologicalAge, 10, 120);
    analysisResult.chronologicalAge = chronologicalAge;
    analysisResult.ageGap = analysisResult.biologicalAge - chronologicalAge;
    analysisResult.longevityScore = clamp(analysisResult.longevityScore);
    analysisResult.faceAgeConfidence = clamp(analysisResult.faceAgeConfidence);

    // Classify age gap
    if (analysisResult.ageGap <= -8) analysisResult.ageGapCategory = 'Significantly Younger';
    else if (analysisResult.ageGap <= -3) analysisResult.ageGapCategory = 'Younger';
    else if (analysisResult.ageGap <= 3) analysisResult.ageGapCategory = 'Age-Appropriate';
    else if (analysisResult.ageGap <= 8) analysisResult.ageGapCategory = 'Older';
    else analysisResult.ageGapCategory = 'Significantly Older';

    // Clamp biomarker scores
    for (const key of Object.keys(analysisResult.biomarkers) as Array<keyof typeof analysisResult.biomarkers>) {
      analysisResult.biomarkers[key].score = clamp(analysisResult.biomarkers[key].score);
    }

    return NextResponse.json(analysisResult);
  } catch (error) {
    console.error('Longevity analysis error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: `Analysis failed: ${message}` }, { status: 500 });
  }
}
