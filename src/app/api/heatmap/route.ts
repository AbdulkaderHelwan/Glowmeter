import { NextRequest, NextResponse } from 'next/server';

export interface HeatmapResult {
  zones: {
    id: string;
    label: string;
    x: number;
    y: number;
    width: number;
    height: number;
    intensity: number;
    color: string;
    description: string;
  }[];
  overallHealthMap: string;
}

const HEATMAP_PROMPT = `You are a facial analysis AI specializing in skin health and aging visualization. Analyze this face selfie and generate a heatmap-style zone assessment.

For each facial zone, provide a concern intensity from 0 to 1 where:
- 0.0-0.3 = Healthy/Excellent (green zone)
- 0.3-0.5 = Minor concerns (yellow zone)
- 0.5-0.7 = Moderate concerns (orange zone)
- 0.7-1.0 = Significant concerns (red zone)

CRITICAL: Look at the actual position of the face in the image. Provide coordinates that match where each zone ACTUALLY IS in the image. Do NOT assume the face is centered. Look carefully at the image and estimate accurate x, y positions as percentages of the overall image dimensions.

Analyze these specific facial zones:
1. Forehead (center top of face)
2. Left Temple
3. Right Temple
4. Glabella (between eyebrows)
5. Left Under-Eye
6. Right Under-Eye
7. Nose Bridge
8. Nose Tip / Pores
9. Left Cheek
10. Right Cheek
11. Nasolabial Left
12. Nasolabial Right
13. Upper Lip
14. Lower Lip / Chin
15. Jawline Left
16. Jawline Right

You MUST respond with ONLY valid JSON in this exact format:
{
  "zones": [
    { "id": "forehead", "label": "Forehead", "x": 35, "y": 12, "width": 30, "height": 15, "intensity": 0.3, "color": "rgba(234,179,8,0.35)", "description": "Minor fine lines visible" }
  ],
  "overallHealthMap": "<good|moderate|concern>"
}

Provide ALL 16 zones. Use these color patterns:
- Intensity 0-0.3: "rgba(34,197,94,0.25)" (green)
- Intensity 0.3-0.5: "rgba(234,179,8,0.35)" (yellow)
- Intensity 0.5-0.7: "rgba(249,115,22,0.4)" (orange)
- Intensity 0.7-1.0: "rgba(239,68,68,0.45)" (red)

IMPORTANT: x and y coordinates MUST be percentages of the FULL IMAGE dimensions, not relative to the face. Look at the image and estimate where each zone actually appears in the overall picture frame.`;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { image, faceBoundingBox } = body as { image: string; faceBoundingBox?: { x: number; y: number; width: number; height: number } };

    if (!image) {
      return NextResponse.json({ error: 'No image provided' }, { status: 400 });
    }

    // If we have a face bounding box from detection, include it in the prompt for more accurate zones
    let prompt = HEATMAP_PROMPT;
    if (faceBoundingBox) {
      prompt += `\n\nI have detected the face bounding box in this image. The face is located at: x=${faceBoundingBox.x}%, y=${faceBoundingBox.y}%, width=${faceBoundingBox.width}%, height=${faceBoundingBox.height}% of the image. Use this information to position your heatmap zones accurately within the detected face area.`;
    }

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

    let heatmapResult: HeatmapResult;
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('No JSON found in response');
      heatmapResult = JSON.parse(jsonMatch[0]);
    } catch (parseError) {
      console.error('Failed to parse VLM heatmap response:', content);
      return NextResponse.json({ error: 'Failed to parse heatmap results' }, { status: 500 });
    }

    if (!heatmapResult.zones || heatmapResult.zones.length === 0) {
      return NextResponse.json({ error: 'Incomplete heatmap results' }, { status: 500 });
    }

    for (const zone of heatmapResult.zones) {
      zone.intensity = Math.max(0, Math.min(1, zone.intensity));
    }

    return NextResponse.json(heatmapResult);
  } catch (error) {
    console.error('Heatmap analysis error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: `Heatmap analysis failed: ${message}` }, { status: 500 });
  }
}
