
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export const dynamic = "force-dynamic"
export const maxDuration = 300 // 5 minut timeout

export async function GET() {
  try {
    // Pobierz wszystkie dane z bazy
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
      prisma.product.findMany(),
      prisma.transaction.findMany(),
      prisma.recipe.findMany(),
      prisma.recipeIngredient.findMany(),
      prisma.nutritionalStandards.findMany(),
      prisma.mealPlan.findMany(),
      prisma.mealPlanDay.findMany(),
      prisma.mealPlanMeal.findMany(),
      prisma.mealPlanRecipe.findMany()
    ])

    // Przygotuj dane do eksportu
    const exportData = {
      version: '2.0',
      exportDate: new Date().toISOString(),
      data: {
        products: products.map(p => ({
          id: p.id,
          name: p.name,
          unit: p.unit,
          currentStock: p.currentStock,
          barcode: p.barcode,
          manufacturer: p.manufacturer,
          calories: p.calories,
          salt: p.salt,
          protein: p.protein,
          fat: p.fat,
          saturatedFat: p.saturatedFat,
          carbohydrates: p.carbohydrates,
          sugars: p.sugars,
          calcium: p.calcium,
          iron: p.iron,
          vitaminC: p.vitaminC,
          allergens: p.allergens,
          createdAt: p.createdAt.toISOString(),
          updatedAt: p.updatedAt.toISOString()
        })),
        transactions: transactions.map(t => ({
          id: t.id,
          productId: t.productId,
          date: t.date.toISOString(),
          document: t.document,
          type: t.type,
          quantity: t.quantity,
          loss: t.loss,
          balance: t.balance,
          createdAt: t.createdAt.toISOString()
        })),
        recipes: recipes.map(r => ({
          id: r.id,
          name: r.name,
          description: r.description,
          servings: r.servings,
          mealType: r.mealType,
          categories: r.categories,
          createdAt: r.createdAt.toISOString(),
          updatedAt: r.updatedAt.toISOString()
        })),
        recipeIngredients: recipeIngredients.map(ri => ({
          id: ri.id,
          recipeId: ri.recipeId,
          productId: ri.productId,
          productName: ri.productName,
          quantity: ri.quantity,
          unit: ri.unit
        })),
        nutritionalStandards: nutritionalStandards.map(ns => ({
          id: ns.id,
          name: ns.name,
          energyMin: ns.energyMin,
          energyMax: ns.energyMax,
          proteinPercentMin: ns.proteinPercentMin,
          proteinPercentMax: ns.proteinPercentMax,
          fatPercentMin: ns.fatPercentMin,
          fatPercentMax: ns.fatPercentMax,
          carbohydratesPercentMin: ns.carbohydratesPercentMin,
          carbohydratesPercentMax: ns.carbohydratesPercentMax,
          calcium: ns.calcium,
          iron: ns.iron,
          vitaminC: ns.vitaminC,
          createdAt: ns.createdAt.toISOString(),
          updatedAt: ns.updatedAt.toISOString()
        })),
        mealPlans: mealPlans.map(mp => ({
          id: mp.id,
          name: mp.name,
          weekNumber: mp.weekNumber,
          startDate: mp.startDate?.toISOString(),
          endDate: mp.endDate?.toISOString(),
          season: mp.season,
          description: mp.description,
          standardsId: mp.standardsId,
          displayOrder: mp.displayOrder,
          createdAt: mp.createdAt.toISOString(),
          updatedAt: mp.updatedAt.toISOString()
        })),
        mealPlanDays: mealPlanDays.map(mpd => ({
          id: mpd.id,
          mealPlanId: mpd.mealPlanId,
          dayOfWeek: mpd.dayOfWeek,
          date: mpd.date?.toISOString(),
          createdAt: mpd.createdAt.toISOString(),
          updatedAt: mpd.updatedAt.toISOString()
        })),
        mealPlanMeals: mealPlanMeals.map(mpm => ({
          id: mpm.id,
          mealPlanDayId: mpm.mealPlanDayId,
          mealType: mpm.mealType,
          order: mpm.order,
          createdAt: mpm.createdAt.toISOString(),
          updatedAt: mpm.updatedAt.toISOString()
        })),
        mealPlanRecipes: mealPlanRecipes.map(mpr => ({
          id: mpr.id,
          mealPlanMealId: mpr.mealPlanMealId,
          recipeId: mpr.recipeId,
          servings: mpr.servings,
          order: mpr.order,
          createdAt: mpr.createdAt.toISOString()
        }))
      }
    }

    // Zwróć dane jako JSON
    return NextResponse.json(exportData, {
      status: 200,
      headers: {
        'Content-Disposition': `attachment; filename="kartoteka_full_export_${new Date().toISOString().split('T')[0]}.json"`
      }
    })

  } catch (error) {
    console.error('Export error:', error)
    return NextResponse.json(
      { 
        error: 'Błąd podczas eksportu danych',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
