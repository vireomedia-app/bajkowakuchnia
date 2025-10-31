
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

// GET - Pobierz wszystkie receptury
export async function GET() {
  try {
    const recipes = await prisma.recipe.findMany({
      include: {
        ingredients: {
          include: {
            product: true
          }
        }
      },
      orderBy: {
        name: 'asc'
      }
    })

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
      }

      recipe.ingredients.forEach(ingredient => {
        if (ingredient.product) {
          // Przelicz wartości odżywcze na ilość składnika w recepturze
          const multiplier = ingredient.quantity / 100 // wartości są na 100g
          
          nutrition.calories += (ingredient.product.calories || 0) * multiplier
          nutrition.protein += (ingredient.product.protein || 0) * multiplier
          nutrition.fat += (ingredient.product.fat || 0) * multiplier
          nutrition.saturatedFat += (ingredient.product.saturatedFat || 0) * multiplier
          nutrition.carbohydrates += (ingredient.product.carbohydrates || 0) * multiplier
          nutrition.sugars += (ingredient.product.sugars || 0) * multiplier
          nutrition.salt += (ingredient.product.salt || 0) * multiplier
          nutrition.calcium += (ingredient.product.calcium || 0) * multiplier
          nutrition.iron += (ingredient.product.iron || 0) * multiplier
          nutrition.vitaminC += (ingredient.product.vitaminC || 0) * multiplier
        }
      })

      return {
        ...recipe,
        nutrition
      }
    })

    return NextResponse.json(recipesWithNutrition)
  } catch (error) {
    console.error('Error fetching recipes:', error)
    return NextResponse.json(
      { error: 'Failed to fetch recipes' },
      { status: 500 }
    )
  }
}

// POST - Stwórz nową recepturę
export async function POST(request: Request) {
  try {
    const data = await request.json()
    const { name, description, servings, categories, ingredients } = data

    const recipe = await prisma.recipe.create({
      data: {
        name,
        description,
        servings,
        categories: categories || [],
        ingredients: {
          create: ingredients.map((ing: any) => ({
            productId: ing.productId || null,
            productName: ing.productName,
            quantity: ing.quantity,
            unit: ing.unit
          }))
        }
      },
      include: {
        ingredients: {
          include: {
            product: true
          }
        }
      }
    })

    return NextResponse.json(recipe)
  } catch (error) {
    console.error('Error creating recipe:', error)
    return NextResponse.json(
      { error: 'Failed to create recipe' },
      { status: 500 }
    )
  }
}
