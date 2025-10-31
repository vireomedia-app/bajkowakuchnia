
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import * as XLSX from 'xlsx'

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    // Get all recipes with ingredients and calculated nutrition
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
    
    if (!recipes || recipes.length === 0) {
      return NextResponse.json(
        { error: 'Brak receptur do eksportu' },
        { status: 404 }
      )
    }
    
    // Create new workbook
    const workbook = XLSX.utils.book_new()
    
    // Create summary sheet with all recipes
    const summaryData = [
      ['Lp.', 'Nazwa receptury', 'Opis', 'Liczba porcji', 'Liczba składników', 'Kalorie (na 100g)', 'Białko (g)', 'Tłuszcz (g)', 'Węglowodany (g)'],
      ...recipes.map((recipe, index) => {
        // Calculate total nutrition values
        const nutrition = calculateRecipeNutrition(recipe)
        
        return [
          index + 1,
          recipe?.name || '',
          recipe?.description || '',
          recipe?.servings || 1,
          recipe?.ingredients?.length || 0,
          nutrition.calories.toFixed(1),
          nutrition.protein.toFixed(1),
          nutrition.fat.toFixed(1),
          nutrition.carbohydrates.toFixed(1)
        ]
      })
    ]
    
    const summarySheet = XLSX.utils.aoa_to_sheet(summaryData)
    
    // Set column widths for summary
    summarySheet['!cols'] = [
      { width: 5 },  // Lp.
      { width: 35 }, // Nazwa
      { width: 40 }, // Opis
      { width: 12 }, // Porcje
      { width: 15 }, // Składniki
      { width: 15 }, // Kalorie
      { width: 12 }, // Białko
      { width: 12 }, // Tłuszcz
      { width: 15 }  // Węglowodany
    ]
    
    XLSX.utils.book_append_sheet(workbook, summarySheet, 'Podsumowanie receptur')
    
    // Create individual sheets for each recipe
    for (const recipe of recipes) {
      if (!recipe?.id) continue
      
      try {
        const sheetData: any[] = []
        
        // Add recipe header
        sheetData.push(['RECEPTURA POSIŁKU'])
        sheetData.push(['Nazwa:', recipe?.name || ''])
        sheetData.push(['Opis:', recipe?.description || ''])
        sheetData.push(['Liczba porcji:', recipe?.servings || 1])
        sheetData.push([])
        
        // Add ingredients section
        sheetData.push(['SKŁADNIKI'])
        sheetData.push(['Lp.', 'Nazwa składnika', 'Ilość', 'Jednostka'])
        
        recipe.ingredients?.forEach((ingredient, index) => {
          sheetData.push([
            index + 1,
            ingredient?.productName || '',
            ingredient?.quantity || 0,
            ingredient?.unit || ''
          ])
        })
        
        sheetData.push([])
        sheetData.push([])
        
        // Calculate and add nutrition information
        const nutrition = calculateRecipeNutrition(recipe)
        
        sheetData.push(['WARTOŚCI ODŻYWCZE (na 100g produktu gotowego)'])
        sheetData.push(['Kalorie:', `${nutrition.calories.toFixed(1)} kcal`])
        sheetData.push(['Białko:', `${nutrition.protein.toFixed(1)} g`])
        sheetData.push(['Tłuszcz:', `${nutrition.fat.toFixed(1)} g`])
        sheetData.push(['  w tym kwasy tłuszczowe nasycone:', `${nutrition.saturatedFat.toFixed(1)} g`])
        sheetData.push(['Węglowodany:', `${nutrition.carbohydrates.toFixed(1)} g`])
        sheetData.push(['  w tym cukry:', `${nutrition.sugars.toFixed(1)} g`])
        sheetData.push(['Sól:', `${nutrition.salt.toFixed(2)} g`])
        sheetData.push(['Wapń:', `${nutrition.calcium.toFixed(1)} mg`])
        sheetData.push(['Żelazo:', `${nutrition.iron.toFixed(1)} mg`])
        sheetData.push(['Witamina C:', `${nutrition.vitaminC.toFixed(1)} mg`])
        
        sheetData.push([])
        sheetData.push([])
        
        // Add detailed nutritional breakdown by ingredient
        sheetData.push(['SZCZEGÓŁOWY ROZKŁAD WARTOŚCI ODŻYWCZYCH'])
        sheetData.push(['Składnik', 'Ilość (g/ml)', 'Kalorie', 'Białko (g)', 'Tłuszcz (g)', 'Węglowodany (g)'])
        
        recipe.ingredients?.forEach((ingredient) => {
          const product = ingredient.product
          const quantity = ingredient?.quantity || 0
          
          if (product) {
            // Convert quantity to grams/ml for calculation
            let quantityInGrams = quantity
            if (ingredient.unit === 'kg') {
              quantityInGrams = quantity * 1000
            } else if (ingredient.unit === 'l') {
              quantityInGrams = quantity * 1000
            }
            
            // Calculate nutrition for this ingredient
            const multiplier = quantityInGrams / 100
            
            sheetData.push([
              ingredient.productName || '',
              quantityInGrams.toFixed(1),
              ((product.calories || 0) * multiplier).toFixed(1),
              ((product.protein || 0) * multiplier).toFixed(1),
              ((product.fat || 0) * multiplier).toFixed(1),
              ((product.carbohydrates || 0) * multiplier).toFixed(1)
            ])
          } else {
            sheetData.push([
              ingredient.productName || '',
              quantity,
              'Brak danych',
              'Brak danych',
              'Brak danych',
              'Brak danych'
            ])
          }
        })
        
        const recipeSheet = XLSX.utils.aoa_to_sheet(sheetData)
        
        // Set column widths
        recipeSheet['!cols'] = [
          { width: 35 }, // First column
          { width: 25 }, // Second column
          { width: 15 }, // Third
          { width: 15 }, // Fourth
          { width: 15 }, // Fifth
          { width: 15 }  // Sixth
        ]
        
        // Clean recipe name for sheet name (Excel sheet names have limitations)
        const cleanRecipeName = (recipe?.name || 'Receptura')
          .replace(/[\/\\?*:[\]]/g, '')
          .substring(0, 31)
        
        XLSX.utils.book_append_sheet(workbook, recipeSheet, cleanRecipeName)
        
      } catch (error) {
        console.error(`Error processing recipe ${recipe.name}:`, error)
        continue
      }
    }
    
    // Generate buffer
    const buffer = XLSX.write(workbook, {
      type: 'buffer',
      bookType: 'xlsx'
    })
    
    // Return file as response
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="receptury_jadlospis_${new Date().toISOString().split('T')[0]}.xlsx"`
      }
    })
    
  } catch (error) {
    console.error('Export error:', error)
    return NextResponse.json(
      { error: 'Błąd podczas eksportu danych' },
      { status: 500 }
    )
  }
}

// Helper function to calculate nutrition for entire recipe
function calculateRecipeNutrition(recipe: any) {
  let totalWeight = 0
  let totalCalories = 0
  let totalProtein = 0
  let totalFat = 0
  let totalSaturatedFat = 0
  let totalCarbohydrates = 0
  let totalSugars = 0
  let totalSalt = 0
  let totalCalcium = 0
  let totalIron = 0
  let totalVitaminC = 0
  
  recipe.ingredients?.forEach((ingredient: any) => {
    const product = ingredient.product
    if (!product) return
    
    const quantity = ingredient?.quantity || 0
    
    // Convert quantity to grams/ml for calculation
    let quantityInGrams = quantity
    if (ingredient.unit === 'kg') {
      quantityInGrams = quantity * 1000
    } else if (ingredient.unit === 'l') {
      quantityInGrams = quantity * 1000
    }
    
    totalWeight += quantityInGrams
    
    // Calculate nutrition based on per 100g values
    const multiplier = quantityInGrams / 100
    
    totalCalories += (product.calories || 0) * multiplier
    totalProtein += (product.protein || 0) * multiplier
    totalFat += (product.fat || 0) * multiplier
    totalSaturatedFat += (product.saturatedFat || 0) * multiplier
    totalCarbohydrates += (product.carbohydrates || 0) * multiplier
    totalSugars += (product.sugars || 0) * multiplier
    totalSalt += (product.salt || 0) * multiplier
    totalCalcium += (product.calcium || 0) * multiplier
    totalIron += (product.iron || 0) * multiplier
    totalVitaminC += (product.vitaminC || 0) * multiplier
  })
  
  // Calculate per 100g of final product
  const per100g = totalWeight > 0 ? 100 / totalWeight : 0
  
  return {
    calories: totalCalories * per100g,
    protein: totalProtein * per100g,
    fat: totalFat * per100g,
    saturatedFat: totalSaturatedFat * per100g,
    carbohydrates: totalCarbohydrates * per100g,
    sugars: totalSugars * per100g,
    salt: totalSalt * per100g,
    calcium: totalCalcium * per100g,
    iron: totalIron * per100g,
    vitaminC: totalVitaminC * per100g
  }
}
