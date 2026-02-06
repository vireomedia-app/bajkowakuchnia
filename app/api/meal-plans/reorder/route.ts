
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const { orderedIds } = await request.json();

    if (!Array.isArray(orderedIds)) {
      return NextResponse.json(
        { error: 'Invalid data format' },
        { status: 400 }
      );
    }

    // Update display order for each meal plan
    const updatePromises = orderedIds.map((id, index) =>
      prisma.mealPlan.update({
        where: { id },
        data: { displayOrder: index },
      })
    );

    await Promise.all(updatePromises);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error reordering meal plans:', error);
    return NextResponse.json(
      { error: 'Failed to reorder meal plans' },
      { status: 500 }
    );
  }
}
