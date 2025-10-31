

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    // Eksportuj wszystkie dane z bazy danych
    const [
      products,
      transactions,
      recipes,
      recipeIngredients,
      nutritionalStandards,
      mealPlans,
      mealPlanDays,
      mealPlanMeals,
      mealPlanRecipes
    ] = await Promise.all([
      prisma.product.findMany({
        orderBy: { createdAt: 'asc' }
      }),
      prisma.transaction.findMany({
        orderBy: { createdAt: 'asc' }
      }),
      prisma.recipe.findMany({
        orderBy: { createdAt: 'asc' }
      }),
      prisma.recipeIngredient.findMany(),
      prisma.nutritionalStandards.findMany({
        orderBy: { createdAt: 'asc' }
      }),
      prisma.mealPlan.findMany({
        orderBy: { createdAt: 'asc' }
      }),
      prisma.mealPlanDay.findMany({
        orderBy: { createdAt: 'asc' }
      }),
      prisma.mealPlanMeal.findMany({
        orderBy: { createdAt: 'asc' }
      }),
      prisma.mealPlanRecipe.findMany({
        orderBy: { createdAt: 'asc' }
      })
    ])

    // Przygotuj dane do eksportu
    const exportData = {
      version: '1.0',
      exportDate: new Date().toISOString(),
      data: {
        products,
        transactions,
        recipes,
        recipeIngredients,
        nutritionalStandards,
        mealPlans,
        mealPlanDays,
        mealPlanMeals,
        mealPlanRecipes
      },
      stats: {
        productsCount: products.length,
        transactionsCount: transactions.length,
        recipesCount: recipes.length,
        recipeIngredientsCount: recipeIngredients.length,
        nutritionalStandardsCount: nutritionalStandards.length,
        mealPlansCount: mealPlans.length,
        mealPlanDaysCount: mealPlanDays.length,
        mealPlanMealsCount: mealPlanMeals.length,
        mealPlanRecipesCount: mealPlanRecipes.length
      }
    }

    // Konwertuj do JSON
    const jsonData = JSON.stringify(exportData, null, 2)
    
    // Przygotuj nazwę pliku z datą
    const filename = `kartoteka_full_export_${new Date().toISOString().split('T')[0]}.json`

    // Zwróć plik JSON
    return new NextResponse(jsonData, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="${filename}"`
      }
    })
    
  } catch (error) {
    console.error('Error exporting data:', error)
    return NextResponse.json(
      { error: 'Błąd podczas eksportowania danych' },
      { status: 500 }
    )
  }
}
