

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { Prisma } from '@prisma/client'

export const dynamic = "force-dynamic"
export const maxDuration = 300 // 5 minut timeout

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

    // UWAGA: To usunie WSZYSTKIE obecne dane (poza użytkownikami)!
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

      // Mapy do konwersji starych ID na nowe
      const productIdMap = new Map<string, string>()
      const recipeIdMap = new Map<string, string>()
      const standardsIdMap = new Map<string, string>()
      const mealPlanIdMap = new Map<string, string>()
      const mealPlanDayIdMap = new Map<string, string>()
      const mealPlanMealIdMap = new Map<string, string>()

      // Importuj produkty (bez wymuszania ID)
      for (const product of products) {
        const newProduct = await tx.product.create({
          data: {
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
        productIdMap.set(product.id, newProduct.id)
      }

      // Importuj transakcje z nowymi ID produktów
      for (const transaction of transactions) {
        const newProductId = productIdMap.get(transaction.productId)
        if (!newProductId) {
          console.warn(`Product ID ${transaction.productId} not found for transaction ${transaction.id}`)
          continue
        }

        await tx.transaction.create({
          data: {
            productId: newProductId,
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
        const newRecipe = await tx.recipe.create({
          data: {
            name: recipe.name,
            description: recipe.description,
            servings: recipe.servings || 1,
            mealType: recipe.mealType,
            categories: recipe.categories || [],
            createdAt: recipe.createdAt ? new Date(recipe.createdAt) : undefined,
            updatedAt: recipe.updatedAt ? new Date(recipe.updatedAt) : undefined
          }
        })
        recipeIdMap.set(recipe.id, newRecipe.id)
      }

      // Importuj składniki receptur z nowymi ID
      for (const ingredient of recipeIngredients) {
        const newRecipeId = recipeIdMap.get(ingredient.recipeId)
        if (!newRecipeId) {
          console.warn(`Recipe ID ${ingredient.recipeId} not found for ingredient ${ingredient.id}`)
          continue
        }

        // productId może być null dla produktów niestandardowych
        const newProductId = ingredient.productId ? productIdMap.get(ingredient.productId) : null

        await tx.recipeIngredient.create({
          data: {
            recipeId: newRecipeId,
            productId: newProductId,
            productName: ingredient.productName,
            quantity: ingredient.quantity,
            unit: ingredient.unit
          }
        })
      }

      // Importuj normy żywieniowe
      for (const standard of nutritionalStandards) {
        const newStandard = await tx.nutritionalStandards.create({
          data: {
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
        standardsIdMap.set(standard.id, newStandard.id)
      }

      // Importuj jadłospisy
      for (const mealPlan of mealPlans) {
        // standardsId może być null
        const newStandardsId = mealPlan.standardsId ? standardsIdMap.get(mealPlan.standardsId) : null

        const newMealPlan = await tx.mealPlan.create({
          data: {
            name: mealPlan.name,
            weekNumber: mealPlan.weekNumber,
            season: mealPlan.season,
            description: mealPlan.description,
            standardsId: newStandardsId,
            createdAt: mealPlan.createdAt ? new Date(mealPlan.createdAt) : undefined,
            updatedAt: mealPlan.updatedAt ? new Date(mealPlan.updatedAt) : undefined
          }
        })
        mealPlanIdMap.set(mealPlan.id, newMealPlan.id)
      }

      // Importuj dni jadłospisów
      for (const day of mealPlanDays) {
        const newMealPlanId = mealPlanIdMap.get(day.mealPlanId)
        if (!newMealPlanId) {
          console.warn(`Meal plan ID ${day.mealPlanId} not found for day ${day.id}`)
          continue
        }

        const newDay = await tx.mealPlanDay.create({
          data: {
            mealPlanId: newMealPlanId,
            dayOfWeek: day.dayOfWeek,
            date: day.date ? new Date(day.date) : null,
            createdAt: day.createdAt ? new Date(day.createdAt) : undefined,
            updatedAt: day.updatedAt ? new Date(day.updatedAt) : undefined
          }
        })
        mealPlanDayIdMap.set(day.id, newDay.id)
      }

      // Importuj posiłki w dniach
      for (const meal of mealPlanMeals) {
        const newMealPlanDayId = mealPlanDayIdMap.get(meal.mealPlanDayId)
        if (!newMealPlanDayId) {
          console.warn(`Meal plan day ID ${meal.mealPlanDayId} not found for meal ${meal.id}`)
          continue
        }

        const newMeal = await tx.mealPlanMeal.create({
          data: {
            mealPlanDayId: newMealPlanDayId,
            mealType: meal.mealType,
            order: meal.order || 0,
            createdAt: meal.createdAt ? new Date(meal.createdAt) : undefined,
            updatedAt: meal.updatedAt ? new Date(meal.updatedAt) : undefined
          }
        })
        mealPlanMealIdMap.set(meal.id, newMeal.id)
      }

      // Importuj receptury w posiłkach
      for (const mealRecipe of mealPlanRecipes) {
        const newMealPlanMealId = mealPlanMealIdMap.get(mealRecipe.mealPlanMealId)
        const newRecipeId = recipeIdMap.get(mealRecipe.recipeId)
        
        if (!newMealPlanMealId || !newRecipeId) {
          console.warn(`Missing mapping for meal recipe ${mealRecipe.id}`)
          continue
        }

        await tx.mealPlanRecipe.create({
          data: {
            mealPlanMealId: newMealPlanMealId,
            recipeId: newRecipeId,
            servings: mealRecipe.servings || 1,
            order: mealRecipe.order || 0,
            createdAt: mealRecipe.createdAt ? new Date(mealRecipe.createdAt) : undefined
          }
        })
      }
    }, {
      timeout: 300000, // 5 minut
      maxWait: 300000
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
