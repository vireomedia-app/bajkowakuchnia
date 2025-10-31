
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { prisma } from '@/lib/db';
import { notFound } from 'next/navigation';
import { MealPlanEditor } from '@/components/meal-plan-editor';

export const dynamic = "force-dynamic";

async function getMealPlan(id: string) {
  try {
    const mealPlan = await prisma.mealPlan.findUnique({
      where: { id },
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
      return null;
    }

    // Oblicz wartości odżywcze dla każdej receptury w posiłkach
    const mealPlanWithNutrition = {
      ...mealPlan,
      days: mealPlan.days.map(day => ({
        ...day,
        meals: day.meals.map(meal => ({
          ...meal,
          recipes: meal.recipes.map(mealRecipe => {
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

            if (mealRecipe.recipe) {
              mealRecipe.recipe.ingredients.forEach(ingredient => {
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

            return {
              ...mealRecipe,
              recipe: {
                ...mealRecipe.recipe,
                nutrition
              }
            };
          })
        }))
      }))
    };

    return mealPlanWithNutrition;
  } catch (error) {
    console.error('Error fetching meal plan:', error);
    return null;
  }
}

async function getRecipes() {
  try {
    const recipes = await prisma.recipe.findMany({
      include: {
        ingredients: {
          include: {
            product: true,
          },
        },
      },
      orderBy: { name: 'asc' },
    });

    // Oblicz wartości odżywcze dla każdej receptury
    const recipesWithNutrition = recipes.map(recipe => {
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

      recipe.ingredients.forEach(ingredient => {
        if (ingredient.product) {
          // Przelicz wartości odżywcze na ilość składnika w recepturze
          const multiplier = ingredient.quantity / 100; // wartości są na 100g
          
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

      return {
        ...recipe,
        nutrition
      };
    });

    return recipesWithNutrition;
  } catch (error) {
    console.error('Error fetching recipes:', error);
    return [];
  }
}

export default async function MealPlanDetailPage({ params }: { params: { id: string } }) {
  const [mealPlan, recipes] = await Promise.all([
    getMealPlan(params.id),
    getRecipes(),
  ]);

  if (!mealPlan) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <Link href="/menu/meal-plans">
        <Button variant="ghost" className="gap-2">
          <ArrowLeft className="w-4 h-4" />
          Powrót do jadłospisów
        </Button>
      </Link>

      <MealPlanEditor mealPlan={mealPlan} availableRecipes={recipes} />
    </div>
  );
}
