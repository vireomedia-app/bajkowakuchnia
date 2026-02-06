
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const originalPlan = await prisma.mealPlan.findUnique({
      where: { id: params.id },
      include: {
        days: {
          include: {
            meals: {
              include: {
                recipes: true,
              },
            },
          },
        },
      },
    });

    if (!originalPlan) {
      return NextResponse.json(
        { error: 'Meal plan not found' },
        { status: 404 }
      );
    }

    // Create a copy with "(kopia)" suffix
    const copiedPlan = await prisma.mealPlan.create({
      data: {
        name: `${originalPlan.name} (kopia)`,
        description: originalPlan.description,
        weekNumber: originalPlan.weekNumber,
        season: originalPlan.season,
        startDate: originalPlan.startDate,
        endDate: originalPlan.endDate,
        standardsId: originalPlan.standardsId,
        displayOrder: originalPlan.displayOrder,
        days: {
          create: originalPlan.days.map((day) => ({
            dayOfWeek: day.dayOfWeek,
            meals: {
              create: day.meals.map((meal) => ({
                mealType: meal.mealType,
                order: meal.order,
                recipes: {
                  create: meal.recipes.map((recipe) => ({
                    recipeId: recipe.recipeId,
                    servings: recipe.servings,
                    order: recipe.order,
                  })),
                },
              })),
            },
          })),
        },
      },
      include: {
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
            },
          },
        },
      },
    });

    return NextResponse.json(copiedPlan);
  } catch (error) {
    console.error('Error duplicating meal plan:', error);
    return NextResponse.json(
      { error: 'Failed to duplicate meal plan' },
      { status: 500 }
    );
  }
}
