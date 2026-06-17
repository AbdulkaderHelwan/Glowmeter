import { NextRequest, NextResponse } from 'next/server';

export interface CosmeticsAnalysisResult {
  overallScore: number;
  detectedProducts: {
    name: string;
    category: string;
    detected: boolean;
    score: number;
    colorDescription: string;
    notes: string;
  }[];
  applicationQuality: {
    blending: { score: number; label: string; description: string };
    colorMatch: { score: number; label: string; description: string };
    symmetry: { score: number; label: string; description: string };
    longevity: { score: number; label: string; description: string };
    overallFinish: { score: number; label: string; description: string };
  };
  colorProfile: {
    undertone: string;
    foundationMatch: string;
    lipColor: string;
    eyeMakeupColors: string[];
    blushColor: string;
    overallColorHarmony: string;
  };
  suggestions: {
    category: string;
    tips: string[];
    productTypes: string[];
  }[];
  makeupStyle: string;
  summary: string;
}

const COSMETICS_PROMPT = `You are a professional makeup artist and cosmetics analyst AI. Analyze this face selfie image and provide a detailed cosmetics and makeup assessment.

IMPORTANT: This is a COSMETIC analysis only, NOT a medical diagnosis. Evaluate only visible cosmetic products.

For each score, use 0-100 where:
- 0-30 = Poor (poorly applied / not detected / significant issues)
- 31-50 = Fair (basic application visible, needs improvement)
- 51-70 = Good (decent application with minor issues)
- 71-85 = Very Good (well-applied with minimal issues)
- 86-100 = Excellent (flawless or near-flawless application)

STEP 1 — Detect which of these makeup products are visible on the face:
- Foundation / BB Cream / Tinted Moisturizer
- Concealer
- Setting Powder
- Bronzer / Contour
- Blush
- Highlighter
- Eyebrow Pencil / Gel / Pomade
- Eyeshadow
- Eyeliner
- Mascara
- Lipstick / Lip Gloss / Lip Liner
- Lip Balm (tinted)

For each product: note if detected, score the quality of application (0-100), describe the color/shade visible, and add a brief note about the application.

STEP 2 — Evaluate the overall quality of makeup application across 5 dimensions:
1. Blending — How well products are blended, no harsh lines, seamless transitions
2. Color Match — How well foundation/concealer matches the natural skin tone
3. Symmetry — How even and balanced the makeup looks on both sides of the face
4. Longevity — Signs of wear, fading, creasing, smudging (if visible)
5. Overall Finish — Overall polish, cohesion, and professional quality

STEP 3 — Describe the color profile:
- Skin undertone (Warm, Cool, Neutral, Olive)
- How well foundation matches the skin tone
- Lip color description
- Eye makeup colors detected
- Blush color description
- Overall color harmony assessment

STEP 4 — Determine the makeup style (e.g., Natural/No-Makeup, Everyday, Glam, Editorial, Smokey, Dewy, Matte, etc.)

STEP 5 — Provide personalized suggestions grouped by category with specific product type recommendations.

STEP 6 — Write a 2-3 sentence summary.

You MUST respond with ONLY valid JSON in this exact format, no other text:
{
  "overallScore": <number 0-100>,
  "detectedProducts": [
    { "name": "<product name>", "category": "<Face|Eyes|Lips|Brows>", "detected": <boolean>, "score": <number 0-100>, "colorDescription": "<color/shade description>", "notes": "<brief note about application quality>" }
  ],
  "applicationQuality": {
    "blending": { "score": <number>, "label": "Blending & Transitions", "description": "<1 sentence>" },
    "colorMatch": { "score": <number>, "label": "Color Matching", "description": "<1 sentence>" },
    "symmetry": { "score": <number>, "label": "Symmetry & Balance", "description": "<1 sentence>" },
    "longevity": { "score": <number>, "label": "Longevity & Wear", "description": "<1 sentence>" },
    "overallFinish": { "score": <number>, "label": "Overall Finish", "description": "<1 sentence>" }
  },
  "colorProfile": {
    "undertone": "<string>",
    "foundationMatch": "<string describing match quality>",
    "lipColor": "<string>",
    "eyeMakeupColors": ["<color1>", "<color2>"],
    "blushColor": "<string>",
    "overallColorHarmony": "<string>"
  },
  "suggestions": [
    { "category": "Foundation & Base", "tips": ["<tip>", "<tip>"], "productTypes": ["<product type to try>", "<product type to try>"] },
    { "category": "Eye Makeup", "tips": ["<tip>", "<tip>"], "productTypes": ["<product type to try>", "<product type to try>"] },
    { "category": "Lip Color", "tips": ["<tip>", "<tip>"], "productTypes": ["<product type to try>", "<product type to try>"] },
    { "category": "Finishing & Setting", "tips": ["<tip>", "<tip>"], "productTypes": ["<product type to try>", "<product type to try>"] }
  ],
  "makeupStyle": "<string>",
  "summary": "<2-3 sentence summary>"
}`;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { image } = body as { image: string };

    if (!image) {
      return NextResponse.json({ error: 'No image provided' }, { status: 400 });
    }

    const ZAI = (await import('z-ai-web-dev-sdk')).default;
    const zai = await ZAI.create();

    const response = await zai.chat.completions.createVision({
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: COSMETICS_PROMPT },
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

    let analysisResult: CosmeticsAnalysisResult;
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('No JSON found in response');
      analysisResult = JSON.parse(jsonMatch[0]);
    } catch (parseError) {
      console.error('Failed to parse VLM cosmetics response:', content);
      return NextResponse.json({ error: 'Failed to parse AI analysis results. Please try again.' }, { status: 500 });
    }

    if (!analysisResult.detectedProducts || !analysisResult.applicationQuality) {
      return NextResponse.json({ error: 'Incomplete analysis results. Please try again.' }, { status: 500 });
    }

    const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));
    analysisResult.overallScore = clamp(analysisResult.overallScore);
    for (const product of analysisResult.detectedProducts) product.score = clamp(product.score);
    for (const key of Object.keys(analysisResult.applicationQuality) as Array<keyof typeof analysisResult.applicationQuality>) {
      analysisResult.applicationQuality[key].score = clamp(analysisResult.applicationQuality[key].score);
    }

    return NextResponse.json(analysisResult);
  } catch (error) {
    console.error('Cosmetics analysis error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: `Analysis failed: ${message}` }, { status: 500 });
  }
}
