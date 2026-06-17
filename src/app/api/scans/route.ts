import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET /api/scans?userId=xxx&type=longevity
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const type = searchParams.get('type');

    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 });
    }

    const where: Record<string, unknown> = { userId };
    if (type) where.analysisType = type;

    const scans = await db.scan.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    // Parse resultData JSON for each scan
    const parsed = scans.map((scan) => ({
      ...scan,
      resultData: JSON.parse(scan.resultData),
    }));

    return NextResponse.json({ scans: parsed });
  } catch (error) {
    console.error('Get scans error:', error);
    return NextResponse.json({ error: 'Failed to fetch scans' }, { status: 500 });
  }
}

// POST /api/scans — Save a scan result
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, analysisType, overallScore, biologicalAge, chronologicalAge, ageGap, longevityScore, longevityCategory, skinType, makeupStyle, resultData, imageData } = body;

    if (!userId || !analysisType || !resultData) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Ensure user exists
    let user = await db.user.findUnique({ where: { id: userId } });
    if (!user) {
      user = await db.user.create({ data: { id: userId } });
    }

    const scan = await db.scan.create({
      data: {
        userId,
        analysisType,
        overallScore: overallScore || 0,
        biologicalAge: biologicalAge || null,
        chronologicalAge: chronologicalAge || null,
        ageGap: ageGap || null,
        longevityScore: longevityScore || null,
        longevityCategory: longevityCategory || null,
        skinType: skinType || null,
        makeupStyle: makeupStyle || null,
        resultData: typeof resultData === 'string' ? resultData : JSON.stringify(resultData),
        imageData: imageData || null,
      },
    });

    return NextResponse.json({ scan });
  } catch (error) {
    console.error('Save scan error:', error);
    return NextResponse.json({ error: 'Failed to save scan' }, { status: 500 });
  }
}
