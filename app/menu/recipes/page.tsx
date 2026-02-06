
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { ArrowLeft, PlusCircle } from 'lucide-react'
import { RecipesList } from '@/components/recipes-list'
import { RecipeWithNutrition } from '@/lib/types'
import { prisma } from '@/lib/db'

export const dynamic = "force-dynamic";

async function getRecipes(): Promise<RecipeWithNutrition[]> {
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

      return {
        ...recipe,
        nutrition
      };
    });

    return recipesWithNutrition;
  } catch (error) {
    console.error('Error fetching recipes:', error)
    return []
  }
}

export default async function RecipesPage() {
  const recipes = await getRecipes()

  return (
    <div className="space-y-8">
      {/* Navigation */}
      <div className="flex items-center justify-between">
        <Link href="/menu">
          <Button variant="ghost" className="gap-2">
            <ArrowLeft className="w-4 h-4" />
            Powrót do jadłospisu
          </Button>
        </Link>
        <Link href="/menu/recipes/new">
          <Button className="gap-2 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800">
            <PlusCircle className="w-4 h-4" />
            Stwórz recepturę
          </Button>
        </Link>
      </div>

      {/* Header */}
      <div className="text-center space-y-4">
        <h1 className="text-4xl md:text-5xl font-bold text-gray-900">Receptury posiłków</h1>
        <p className="text-lg text-gray-600 max-w-2xl mx-auto">
          Przeglądaj wszystkie dostępne receptury wraz z wartościami odżywczymi
        </p>
      </div>

      {/* Recipes List */}
      <RecipesList recipes={recipes} />
    </div>
  )
}
