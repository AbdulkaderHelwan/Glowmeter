import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// POST /api/reminders — Create a reminder
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, email, scanId, monthsAhead = 3 } = body;

    if (!userId || !email) {
      return NextResponse.json({ error: 'userId and email are required' }, { status: 400 });
    }

    // Validate email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json({ error: 'Invalid email address' }, { status: 400 });
    }

    // Ensure user exists
    let user = await db.user.findUnique({ where: { id: userId } });
    if (!user) {
      user = await db.user.create({ data: { id: userId } });
    }

    // Update user email
    await db.user.update({
      where: { id: userId },
      data: { email },
    });

    // Calculate reminder date
    const remindAt = new Date();
    remindAt.setMonth(remindAt.getMonth() + monthsAhead);

    const reminder = await db.reminder.create({
      data: {
        userId,
        email,
        scanId: scanId || '',
        remindAt,
      },
    });

    return NextResponse.json({
      reminder,
      message: `Reminder set! We'll email you in ${monthsAhead} months to re-check your bio age.`,
    });
  } catch (error) {
    console.error('Create reminder error:', error);
    return NextResponse.json({ error: 'Failed to create reminder' }, { status: 500 });
  }
}
