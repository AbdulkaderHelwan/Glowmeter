import { NextRequest, NextResponse } from 'next/server';

export interface SkinAnalysisResult {
  overallScore: number;
  metrics: {
    pores: { score: number; label: string; description: string };
    texture: { score: number; label: string; description: string };
    redness: { score: number; label: string; description: string };
    hydration: { score: number; label: string; description: string };
    pigmentation: { score: number; label: string; description: string };
    radiance: { score: number; label: string; description: string };
    oiliness: { score: number; label: string; description: string };
    fineLines: { score: number; label: string; description: string };
    firmness: { score: number; label: string; description: string };
    ageing: { score: number; label: string; description: string };
  };
  skinType: string;
  concerns: string[];
  recommendations: {
    category: string;
    tips: string[];
  }[];
  summary: string;
}

const ANALYSIS_PROMPT = `You are a professional cosmetic skin analyst AI. Analyze this face selfie image and provide a detailed cosmetic skin assessment.

IMPORTANT: This is a COSMETIC analysis only, NOT a medical diagnosis. Evaluate only visible cosmetic skin characteristics.

For each metric, provide a score from 0-100 where:
- 0-30 = Poor (significant concerns visible)
- 31-50 = Fair (moderate concerns visible)  
- 51-70 = Good (minor concerns visible)
- 71-85 = Very Good (minimal concerns)
- 86-100 = Excellent (excellent skin condition)

Analyze these 10 metrics:
1. Pores - Size and visibility of pores across T-zone and cheeks
2. Texture - Surface smoothness, roughness, and uneven patches
3. Redness - Visible redness, irritation, or uneven tone from sensitivity
4. Hydration - Signs of moisture balance, dehydration, plumpness
5. Pigmentation - Uneven tone, dark spots, discoloration
6. Radiance - Brightness, dullness, overall luminosity
7. Oiliness - Shine levels, oil balance across face
8. Fine Lines - Early expression lines and shallow wrinkles
9. Firmness - Visible sagging, loss of tightness
10. Ageing - Overall cosmetic ageing signs (combined assessment)

Also determine:
- Skin type (Oily, Dry, Combination, Normal, Sensitive)
- Top 3 concerns (short phrases)
- Personalized skincare recommendations grouped by category
- A brief 2-3 sentence summary

You MUST respond with ONLY valid JSON in this exact format, no other text:
{
  "overallScore": <number 0-100>,
  "metrics": {
    "pores": { "score": <number>, "label": "Pore Size & Visibility", "description": "<1 sentence>" },
    "texture": { "score": <number>, "label": "Skin Texture", "description": "<1 sentence>" },
    "redness": { "score": <number>, "label": "Redness & Irritation", "description": "<1 sentence>" },
    "hydration": { "score": <number>, "label": "Hydration Level", "description": "<1 sentence>" },
    "pigmentation": { "score": <number>, "label": "Pigmentation & Dark Spots", "description": "<1 sentence>" },
    "radiance": { "score": <number>, "label": "Radiance & Glow", "description": "<1 sentence>" },
    "oiliness": { "score": <number>, "label": "Oiliness & Shine", "description": "<1 sentence>" },
    "fineLines": { "score": <number>, "label": "Fine Lines & Wrinkles", "description": "<1 sentence>" },
    "firmness": { "score": <number>, "label": "Firmness & Elasticity", "description": "<1 sentence>" },
    "ageing": { "score": <number>, "label": "Visible Skin Ageing", "description": "<1 sentence>" }
  },
  "skinType": "<string>",
  "concerns": ["<string>", "<string>", "<string>"],
  "recommendations": [
    { "category": "Cleansing", "tips": ["<tip>", "<tip>"] },
    { "category": "Moisturizing", "tips": ["<tip>", "<tip>"] },
    { "category": "Protection", "tips": ["<tip>", "<tip>"] },
    { "category": "Treatment", "tips": ["<tip>", "<tip>"] }
  ],
  "summary": "<2-3 sentence summary>"
}`;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { image } = body as { image: string };

    if (!image) {
      return NextResponse.json(
        { error: 'No image provided' },
        { status: 400 }
      );
    }

    // Use z-ai-web-dev-sdk VLM for skin analysis
    const ZAI = (await import('z-ai-web-dev-sdk')).default;
    const zai = await ZAI.create();

    const response = await zai.chat.completions.createVision({
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: ANALYSIS_PROMPT },
            { type: 'image_url', image_url: { url: image } }
          ]
        }
      ],
      thinking: { type: 'disabled' }
    });

    const content = response.choices[0]?.message?.content;

    if (!content) {
      return NextResponse.json(
        { error: 'No analysis result returned from AI' },
        { status: 500 }
      );
    }

    // Parse the JSON response from VLM
    let analysisResult: SkinAnalysisResult;
    try {
      // Try to extract JSON from the response (might have markdown wrapping)
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }
      analysisResult = JSON.parse(jsonMatch[0]);
    } catch (parseError) {
      console.error('Failed to parse VLM response:', content);
      console.error('Parse error:', parseError);
      return NextResponse.json(
        { error: 'Failed to parse AI analysis results. Please try again.' },
        { status: 500 }
      );
    }

    // Validate the result has required fields
    if (!analysisResult.metrics || !analysisResult.overallScore) {
      return NextResponse.json(
        { error: 'Incomplete analysis results. Please try again.' },
        { status: 500 }
      );
    }

    // Clamp all scores to 0-100
    const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));
    analysisResult.overallScore = clamp(analysisResult.overallScore);
    
    for (const key of Object.keys(analysisResult.metrics) as Array<keyof typeof analysisResult.metrics>) {
      analysisResult.metrics[key].score = clamp(analysisResult.metrics[key].score);
    }

    return NextResponse.json(analysisResult);
  } catch (error) {
    console.error('Skin analysis error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json(
      { error: `Analysis failed: ${message}` },
      { status: 500 }
    );
  }
}
