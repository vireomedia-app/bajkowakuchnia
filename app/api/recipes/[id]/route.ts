
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

// GET - Pobierz szczegóły receptury
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const recipe = await prisma.recipe.findUnique({
      where: { id: params.id },
      include: {
        ingredients: {
          include: {
            product: true
          }
        }
      }
    })

    if (!recipe) {
      return NextResponse.json(
        { error: 'Recipe not found' },
        { status: 404 }
      )
    }

    // Oblicz wartości odżywcze
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
        const multiplier = ingredient.quantity / 100
        
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

    return NextResponse.json({
      ...recipe,
      nutrition
    })
  } catch (error) {
    console.error('Error fetching recipe:', error)
    return NextResponse.json(
      { error: 'Failed to fetch recipe' },
      { status: 500 }
    )
  }
}

// PATCH - Zaktualizuj recepturę
export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const data = await request.json()
    const { name, description, servings, categories, ingredients } = data

    // Usuń stare składniki i dodaj nowe
    await prisma.recipeIngredient.deleteMany({
      where: { recipeId: params.id }
    })

    const recipe = await prisma.recipe.update({
      where: { id: params.id },
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
    console.error('Error updating recipe:', error)
    return NextResponse.json(
      { error: 'Failed to update recipe' },
      { status: 500 }
    )
  }
}

// DELETE - Usuń recepturę
export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    await prisma.recipe.delete({
      where: { id: params.id }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting recipe:', error)
    return NextResponse.json(
      { error: 'Failed to delete recipe' },
      { status: 500 }
    )
  }
}
