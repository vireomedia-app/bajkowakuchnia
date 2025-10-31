
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

// POST dodanie receptury do posiłku
export async function POST(
  request: Request,
  { params }: { params: { id: string; mealId: string } }
) {
  try {
    const data = await request.json();

    const mealPlanRecipe = await prisma.mealPlanRecipe.create({
      data: {
        mealPlanMealId: params.mealId,
        recipeId: data.recipeId,
        servings: data.servings || 1,
        order: data.order || 0,
      },
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
    });

    // Oblicz wartości odżywcze dla receptury
    const nutrition = {
      calories: 0,
      protein: 0,
      fat: 0,
      saturatedFat: 0,
      carbohydrates: 0,
      sugars: 0,
      salt: 0,
      calcium: 0,
      iron: 0,
      vitaminC: 0
    };

    if (mealPlanRecipe.recipe) {
      mealPlanRecipe.recipe.ingredients.forEach(ingredient => {
        if (ingredient.product) {
          const multiplier = ingredient.quantity / 100;
          
          nutrition.calories += (ingredient.product.calories || 0) * multiplier;
          nutrition.protein += (ingredient.product.protein || 0) * multiplier;
          nutrition.fat += (ingredient.product.fat || 0) * multiplier;
          nutrition.saturatedFat += (ingredient.product.saturatedFat || 0) * multiplier;
          nutrition.carbohydrates += (ingredient.product.carbohydrates || 0) * multiplier;
          nutrition.sugars += (ingredient.product.sugars || 0) * multiplier;
          nutrition.salt += (ingredient.product.salt || 0) * multiplier;
          nutrition.calcium += (ingredient.product.calcium || 0) * multiplier;
          nutrition.iron += (ingredient.product.iron || 0) * multiplier;
          nutrition.vitaminC += (ingredient.product.vitaminC || 0) * multiplier;
        }
      });
    }

    return NextResponse.json({
      ...mealPlanRecipe,
      recipe: {
        ...mealPlanRecipe.recipe,
        nutrition
      }
    });
  } catch (error) {
    console.error('Error adding recipe to meal:', error);
    return NextResponse.json(
      { error: 'Błąd podczas dodawania receptury do posiłku' },
      { status: 500 }
    );
  }
}
