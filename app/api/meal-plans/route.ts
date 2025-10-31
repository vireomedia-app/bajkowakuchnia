
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

// GET wszystkich jadłospisów
export async function GET() {
  try {
    const mealPlans = await prisma.mealPlan.findMany({
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
                },
              },
              orderBy: { order: 'asc' },
            },
          },
          orderBy: { dayOfWeek: 'asc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(mealPlans);
  } catch (error) {
    console.error('Error fetching meal plans:', error);
    return NextResponse.json(
      { error: 'Błąd podczas pobierania jadłospisów' },
      { status: 500 }
    );
  }
}

// POST nowego jadłospisu
export async function POST(request: Request) {
  try {
    const data = await request.json();

    // Utwórz jadłospis z 5 dniami (poniedziałek-piątek)
    const mealPlan = await prisma.mealPlan.create({
      data: {
        name: data.name,
        weekNumber: data.weekNumber,
        season: data.season,
        description: data.description,
        standardsId: data.standardsId,
        days: {
          create: [1, 2, 3, 4, 5].map((dayOfWeek) => ({
            dayOfWeek,
            meals: {
              create: [
                { mealType: 'BREAKFAST', order: 1 },
                { mealType: 'SECOND_BREAKFAST', order: 2 },
                { mealType: 'LUNCH', order: 3 },
                { mealType: 'FIRST_SNACK', order: 4 },
                { mealType: 'SECOND_SNACK', order: 5 },
              ],
            },
          })),
        },
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
    console.error('Error creating meal plan:', error);
    return NextResponse.json(
      { error: 'Błąd podczas tworzenia jadłospisu' },
      { status: 500 }
    );
  }
}
