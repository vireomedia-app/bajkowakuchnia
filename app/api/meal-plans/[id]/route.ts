
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

// GET konkretnego jadłospisu
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const mealPlan = await prisma.mealPlan.findUnique({
      where: { id: params.id },
      include: {
        standards: true,
        days: {
          include: {
            meals: {
              include: {
                recipes: {
                  include: {
                    recipe: {
                      include: {
                        ingredients: {
                          include: {
                            product: true,
                          },
                        },
                      },
                    },
                  },
                  orderBy: { order: 'asc' },
                },
              },
              orderBy: { order: 'asc' },
            },
          },
          orderBy: { dayOfWeek: 'asc' },
        },
      },
    });

    if (!mealPlan) {
      return NextResponse.json(
        { error: 'Jadłospis nie został znaleziony' },
        { status: 404 }
      );
    }

    return NextResponse.json(mealPlan);
  } catch (error) {
    console.error('Error fetching meal plan:', error);
    return NextResponse.json(
      { error: 'Błąd podczas pobierania jadłospisu' },
      { status: 500 }
    );
  }
}

// PUT aktualizacja jadłospisu
export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const data = await request.json();

    const mealPlan = await prisma.mealPlan.update({
      where: { id: params.id },
      data: {
        name: data.name,
        weekNumber: data.weekNumber,
        season: data.season,
        description: data.description,
        standardsId: data.standardsId,
      },
      include: {
        standards: true,
        days: {
          include: {
            meals: {
              include: {
                recipes: {
                  include: {
                    recipe: true,
                  },
                  orderBy: { order: 'asc' },
                },
              },
              orderBy: { order: 'asc' },
            },
          },
          orderBy: { dayOfWeek: 'asc' },
        },
      },
    });

    return NextResponse.json(mealPlan);
  } catch (error) {
    console.error('Error updating meal plan:', error);
    return NextResponse.json(
      { error: 'Błąd podczas aktualizacji jadłospisu' },
      { status: 500 }
    );
  }
}

// DELETE jadłospisu
export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    await prisma.mealPlan.delete({
      where: { id: params.id },
    });

    return NextResponse.json({ message: 'Jadłospis został usunięty' });
  } catch (error) {
    console.error('Error deleting meal plan:', error);
    return NextResponse.json(
      { error: 'Błąd podczas usuwania jadłospisu' },
      { status: 500 }
    );
  }
}
