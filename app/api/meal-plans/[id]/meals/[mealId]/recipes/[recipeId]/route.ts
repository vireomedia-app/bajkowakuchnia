
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

// PUT aktualizacja receptury w posiłku (np. liczba porcji)
export async function PUT(
  request: Request,
  { params }: { params: { id: string; mealId: string; recipeId: string } }
) {
  try {
    const data = await request.json();

    const mealPlanRecipe = await prisma.mealPlanRecipe.update({
      where: { id: params.recipeId },
      data: {
        servings: data.servings,
        order: data.order,
      },
      include: {
        recipe: true,
      },
    });

    return NextResponse.json(mealPlanRecipe);
  } catch (error) {
    console.error('Error updating meal plan recipe:', error);
    return NextResponse.json(
      { error: 'Błąd podczas aktualizacji receptury w posiłku' },
      { status: 500 }
    );
  }
}

// DELETE usunięcie receptury z posiłku
export async function DELETE(
  request: Request,
  { params }: { params: { id: string; mealId: string; recipeId: string } }
) {
  try {
    await prisma.mealPlanRecipe.delete({
      where: { id: params.recipeId },
    });

    return NextResponse.json({ message: 'Receptura została usunięta z posiłku' });
  } catch (error) {
    console.error('Error deleting meal plan recipe:', error);
    return NextResponse.json(
      { error: 'Błąd podczas usuwania receptury z posiłku' },
      { status: 500 }
    );
  }
}
