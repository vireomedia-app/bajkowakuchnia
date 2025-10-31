

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { Prisma } from '@prisma/client'

export const dynamic = "force-dynamic"

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File
  
    if (!file) {
      return NextResponse.json(
        { error: 'Nie przesłano pliku' },
        { status: 400 }
      )
    }

    // Odczytaj zawartość pliku
    const fileText = await file.text()
    let importData: any
  
    try {
      importData = JSON.parse(fileText)
    } catch (error) {
      return NextResponse.json(
        { error: 'Nieprawidłowy format pliku JSON' },
        { status: 400 }
      )
    }

    // Sprawdź czy plik ma właściwą strukturę
    if (!importData.data || !importData.version) {
      return NextResponse.json(
        { error: 'Nieprawidłowa struktura pliku eksportu' },
        { status: 400 }
      )
    }

    const {
      products = [],
      transactions = [],
      recipes = [],
      recipeIngredients = [],
      nutritionalStandards = [],
      mealPlans = [],
      mealPlanDays = [],
      mealPlanMeals = [],
      mealPlanRecipes = []
    } = importData.data

    // UWAGA: To usunie WSZYSTKIE obecne dane!
    // Usuwamy w odpowiedniej kolejności ze względu na foreign keys
    await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      // Usuń dane w odpowiedniej kolejności (najpierw zależne)
      await tx.mealPlanRecipe.deleteMany()
      await tx.mealPlanMeal.deleteMany()
      await tx.mealPlanDay.deleteMany()
      await tx.mealPlan.deleteMany()
      await tx.nutritionalStandards.deleteMany()
      await tx.recipeIngredient.deleteMany()
      await tx.recipe.deleteMany()
      await tx.transaction.deleteMany()
      await tx.product.deleteMany()

      // Importuj produkty
      for (const product of products) {
        await tx.product.create({
          data: {
            id: product.id,
            name: product.name,
            unit: product.unit,
            currentStock: product.currentStock || 0,
            manufacturer: product.manufacturer,
            calories: product.calories,
            salt: product.salt,
            protein: product.protein,
            fat: product.fat,
            saturatedFat: product.saturatedFat,
            carbohydrates: product.carbohydrates,
            sugars: product.sugars,
            calcium: product.calcium,
            iron: product.iron,
            vitaminC: product.vitaminC,
            allergens: product.allergens || [],
            createdAt: product.createdAt ? new Date(product.createdAt) : undefined,
            updatedAt: product.updatedAt ? new Date(product.updatedAt) : undefined
          }
        })
      }

      // Importuj transakcje
      for (const transaction of transactions) {
        await tx.transaction.create({
          data: {
            id: transaction.id,
            productId: transaction.productId,
            date: new Date(transaction.date),
            document: transaction.document,
            type: transaction.type,
            quantity: transaction.quantity,
            balance: transaction.balance,
            createdAt: transaction.createdAt ? new Date(transaction.createdAt) : undefined
          }
        })
      }

      // Importuj receptury
      for (const recipe of recipes) {
        await tx.recipe.create({
          data: {
            id: recipe.id,
            name: recipe.name,
            description: recipe.description,
            servings: recipe.servings || 1,
            mealType: recipe.mealType,
            categories: recipe.categories || [],
            createdAt: recipe.createdAt ? new Date(recipe.createdAt) : undefined,
            updatedAt: recipe.updatedAt ? new Date(recipe.updatedAt) : undefined
          }
        })
      }

      // Importuj składniki receptur
      for (const ingredient of recipeIngredients) {
        await tx.recipeIngredient.create({
          data: {
            id: ingredient.id,
            recipeId: ingredient.recipeId,
            productId: ingredient.productId,
            productName: ingredient.productName,
            quantity: ingredient.quantity,
            unit: ingredient.unit
          }
        })
      }

      // Importuj normy żywieniowe
      for (const standard of nutritionalStandards) {
        await tx.nutritionalStandards.create({
          data: {
            id: standard.id,
            name: standard.name,
            energyMin: standard.energyMin,
            energyMax: standard.energyMax,
            proteinPercentMin: standard.proteinPercentMin,
            proteinPercentMax: standard.proteinPercentMax,
            fatPercentMin: standard.fatPercentMin,
            fatPercentMax: standard.fatPercentMax,
            carbohydratesPercentMin: standard.carbohydratesPercentMin,
            carbohydratesPercentMax: standard.carbohydratesPercentMax,
            calcium: standard.calcium,
            iron: standard.iron,
            vitaminC: standard.vitaminC,
            createdAt: standard.createdAt ? new Date(standard.createdAt) : undefined,
            updatedAt: standard.updatedAt ? new Date(standard.updatedAt) : undefined
          }
        })
      }

      // Importuj jadłospisy
      for (const mealPlan of mealPlans) {
        await tx.mealPlan.create({
          data: {
            id: mealPlan.id,
            name: mealPlan.name,
            weekNumber: mealPlan.weekNumber,
            season: mealPlan.season,
            description: mealPlan.description,
            standardsId: mealPlan.standardsId,
            createdAt: mealPlan.createdAt ? new Date(mealPlan.createdAt) : undefined,
            updatedAt: mealPlan.updatedAt ? new Date(mealPlan.updatedAt) : undefined
          }
        })
      }

      // Importuj dni jadłospisów
      for (const day of mealPlanDays) {
        await tx.mealPlanDay.create({
          data: {
            id: day.id,
            mealPlanId: day.mealPlanId,
            dayOfWeek: day.dayOfWeek,
            date: day.date ? new Date(day.date) : null,
            createdAt: day.createdAt ? new Date(day.createdAt) : undefined,
            updatedAt: day.updatedAt ? new Date(day.updatedAt) : undefined
          }
        })
      }

      // Importuj posiłki w dniach
      for (const meal of mealPlanMeals) {
        await tx.mealPlanMeal.create({
          data: {
            id: meal.id,
            mealPlanDayId: meal.mealPlanDayId,
            mealType: meal.mealType,
            order: meal.order || 0,
            createdAt: meal.createdAt ? new Date(meal.createdAt) : undefined,
            updatedAt: meal.updatedAt ? new Date(meal.updatedAt) : undefined
          }
        })
      }

      // Importuj receptury w posiłkach
      for (const mealRecipe of mealPlanRecipes) {
        await tx.mealPlanRecipe.create({
          data: {
            id: mealRecipe.id,
            mealPlanMealId: mealRecipe.mealPlanMealId,
            recipeId: mealRecipe.recipeId,
            servings: mealRecipe.servings || 1,
            order: mealRecipe.order || 0,
            createdAt: mealRecipe.createdAt ? new Date(mealRecipe.createdAt) : undefined
          }
        })
      }
    })

    return NextResponse.json({
      success: true,
      message: 'Dane zostały pomyślnie zaimportowane',
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
    })
  
  } catch (error) {
    console.error('Error importing data:', error)
    return NextResponse.json(
      { 
        error: 'Błąd podczas importowania danych',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
