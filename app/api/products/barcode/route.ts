import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { fetchLeclercNutritionByBarcode, fetchLeclerc24NutritionByBarcode } from '@/lib/leclerc'
import { isNutritionIncomplete, mergeNutritionPreferExisting, NutritionLike } from '@/lib/nutrition'

// This endpoint requires Node.js runtime (not Edge) for external HTTP requests to Leclerc
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

interface OpenFoodFactsProduct {
  product: {
    product_name?: string
    product_name_pl?: string
    brands?: string
    nutriments?: {
      'energy-kcal_100g'?: number
      salt_100g?: number
      proteins_100g?: number
      fat_100g?: number
      'saturated-fat_100g'?: number
      carbohydrates_100g?: number
      sugars_100g?: number
      calcium_100g?: number
      iron_100g?: number
      'vitamin-c_100g'?: number
    }
    allergens_tags?: string[]
  }
  status: number
}

// Mapowanie alergenów z Open Food Facts do naszych ID (A:1 - A:14)
const ALLERGEN_MAP: { [key: string]: number } = {
  'en:gluten': 1,           // GLUTEN
  'en:crustaceans': 2,      // SKORUPIAKI
  'en:eggs': 3,             // JAJA
  'en:fish': 4,             // RYBY
  'en:peanuts': 5,          // ORZESZKI ZIEMNE
  'en:soybeans': 6,         // SOJA
  'en:milk': 7,             // MLEKO
  'en:nuts': 8,             // ORZECHY
  'en:celery': 9,           // SELER
  'en:mustard': 10,         // GORCZYCA
  'en:sesame-seeds': 11,    // SEZAM
  'en:sulphur-dioxide-and-sulphites': 12, // DWUTLENEK SIARKI
  'en:lupin': 13,           // ŁUBIN
  'en:molluscs': 14,        // MIĘCZAKI
}

function mapAllergens(allergenTags?: string[]): number[] {
  if (!allergenTags) return []
  
  const allergenIds: number[] = []
  
  for (const tag of allergenTags) {
    const allergenId = ALLERGEN_MAP[tag]
    if (allergenId && !allergenIds.includes(allergenId)) {
      allergenIds.push(allergenId)
    }
  }
  
  return allergenIds.sort((a, b) => a - b)
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    let barcode = searchParams.get('code')

    if (!barcode) {
      return NextResponse.json(
        { error: 'Brak kodu kreskowego' },
        { status: 400 }
      )
    }

    // Wyczyść kod kreskowy (usuń spacje, konwertuj pusty string na null)
    barcode = barcode.trim()
    if (barcode === '') {
      return NextResponse.json(
        { error: 'Kod kreskowy nie może być pusty' },
        { status: 400 }
      )
    }

    console.log('Wyszukiwanie produktu o kodzie:', barcode)

    // NAJPIERW sprawdź czy produkt z tym kodem już istnieje w bazie
    // Używamy tego samego zapytania co w POST /api/products dla spójności
    const existingProducts = await prisma.$queryRaw<Array<{
      id: string
      name: string
      unit: string
      currentStock: number
      packageWeight: number | null
      barcode: string | null
    }>>`
      SELECT id, name, unit, "currentStock", "packageWeight", barcode 
      FROM "products" 
      WHERE barcode = ${barcode}
      LIMIT 1
    `

    console.log('Wynik wyszukiwania w bazie:', existingProducts)

    if (existingProducts && existingProducts.length > 0) {
      const existingProduct = existingProducts[0]
      console.log('Znaleziono produkt w bazie:', existingProduct)
      return NextResponse.json(
        { 
          error: 'Produkt z tym kodem kreskowym już istnieje w bazie',
          existingProduct: {
            id: existingProduct.id,
            name: existingProduct.name,
            unit: existingProduct.unit,
            currentStock: existingProduct.currentStock,
            packageWeight: existingProduct.packageWeight,
            barcode: existingProduct.barcode
          }
        },
        { status: 409 }
      )
    }

    console.log('Produkt nie znaleziony w bazie lokalnej, szukam w Open Food Facts...')

    // Jeśli nie ma w bazie, wywołaj API Open Food Facts
    const response = await fetch(
      `https://world.openfoodfacts.org/api/v0/product/${barcode}.json`,
      {
        headers: {
          'User-Agent': 'Kartoteka Magazynowa - Internal Use',
        },
      }
    )

    if (!response.ok) {
      throw new Error('Błąd połączenia z Open Food Facts')
    }

    const data: OpenFoodFactsProduct = await response.json()

    // Initialize product data - will be populated from OFF and/or Leclerc
    let productData: {
      name: string
      barcode: string
      manufacturer: string
      calories: number | null
      salt: number | null
      protein: number | null
      fat: number | null
      saturatedFat: number | null
      carbohydrates: number | null
      sugars: number | null
      calcium: number | null
      iron: number | null
      vitaminC: number | null
      allergens: number[]
      source: 'off' | 'leclerc' | 'off+leclerc' | 'none'
      leclercUrl?: string
    }

    let offDataFound = false
    let leclercDataFound = false

    if (data.status === 0 || !data.product) {
      console.log('Produkt nie znaleziony w Open Food Facts, próbuję Leclerc...')
      
      // Initialize with empty data
      productData = {
        name: '',
        barcode: barcode,
        manufacturer: '',
        calories: null,
        salt: null,
        protein: null,
        fat: null,
        saturatedFat: null,
        carbohydrates: null,
        sugars: null,
        calcium: null,
        iron: null,
        vitaminC: null,
        allergens: [],
        source: 'none',
      }
    } else {
      offDataFound = true
      const product = data.product

      // Zmapuj dane z Open Food Facts do naszego formatu
      productData = {
        name: product.product_name_pl || product.product_name || '',
        barcode: barcode,
        manufacturer: product.brands || '',
        calories: product.nutriments?.['energy-kcal_100g'] || null,
        salt: product.nutriments?.salt_100g || null,
        protein: product.nutriments?.proteins_100g || null,
        fat: product.nutriments?.fat_100g || null,
        saturatedFat: product.nutriments?.['saturated-fat_100g'] || null,
        carbohydrates: product.nutriments?.carbohydrates_100g || null,
        sugars: product.nutriments?.sugars_100g || null,
        calcium: product.nutriments?.calcium_100g 
          ? product.nutriments.calcium_100g * 1000 // Konwersja z g na mg
          : null,
        iron: product.nutriments?.iron_100g 
          ? product.nutriments.iron_100g * 1000 // Konwersja z g na mg
          : null,
        vitaminC: product.nutriments?.['vitamin-c_100g'] 
          ? product.nutriments['vitamin-c_100g'] * 1000 // Konwersja z g na mg
          : null,
        allergens: mapAllergens(product.allergens_tags),
        source: 'off',
      }

      console.log('Znaleziono produkt w Open Food Facts:', productData.name)
    }

    // Check if nutrition is incomplete and try Leclerc sources as fallback
    let nutritionData: NutritionLike = {
      calories: productData.calories,
      protein: productData.protein,
      fat: productData.fat,
      carbohydrates: productData.carbohydrates,
      saturatedFat: productData.saturatedFat,
      sugars: productData.sugars,
      salt: productData.salt,
      calcium: productData.calcium,
      iron: productData.iron,
      vitaminC: productData.vitaminC,
    }
    
    let leclerc24DataFound = false
    const sourcesList: string[] = offDataFound ? ['OpenFoodFacts'] : []

    // ==========================================================================
    // FALLBACK 1: Leclerc.com.pl
    // ==========================================================================
    if (isNutritionIncomplete(nutritionData) || !offDataFound) {
      console.log('Dane odżywcze niekompletne lub brak danych z OFF, próbuję Leclerc.com.pl...')
      
      try {
        const leclercResult = await fetchLeclercNutritionByBarcode(barcode)
        
        if (leclercResult) {
          leclercDataFound = true
          sourcesList.push('Leclerc.com.pl')
          console.log('Znaleziono dane w Leclerc.com.pl:', leclercResult.url)
          
          // Merge Leclerc data into product data (only fill missing fields)
          const mergedNutrition = mergeNutritionPreferExisting(nutritionData, leclercResult.data)
          
          // Update product data with merged nutrition
          productData.calories = mergedNutrition.calories ?? productData.calories
          productData.protein = mergedNutrition.protein ?? productData.protein
          productData.fat = mergedNutrition.fat ?? productData.fat
          productData.saturatedFat = mergedNutrition.saturatedFat ?? productData.saturatedFat
          productData.carbohydrates = mergedNutrition.carbohydrates ?? productData.carbohydrates
          productData.sugars = mergedNutrition.sugars ?? productData.sugars
          productData.salt = mergedNutrition.salt ?? productData.salt
          productData.calcium = mergedNutrition.calcium ?? productData.calcium
          productData.iron = mergedNutrition.iron ?? productData.iron
          productData.vitaminC = mergedNutrition.vitaminC ?? productData.vitaminC
          productData.leclercUrl = leclercResult.url
          
          // Update nutritionData for next check
          nutritionData = {
            calories: productData.calories,
            protein: productData.protein,
            fat: productData.fat,
            carbohydrates: productData.carbohydrates,
            saturatedFat: productData.saturatedFat,
            sugars: productData.sugars,
            salt: productData.salt,
            calcium: productData.calcium,
            iron: productData.iron,
            vitaminC: productData.vitaminC,
          }
        }
      } catch (leclercError) {
        console.error('Błąd podczas pobierania danych z Leclerc.com.pl:', leclercError)
      }
    }

    // ==========================================================================
    // FALLBACK 2: Leclerc24.net.pl (if still incomplete)
    // ==========================================================================
    if (isNutritionIncomplete(nutritionData) || (!offDataFound && !leclercDataFound)) {
      console.log('Dane nadal niekompletne, próbuję Leclerc24.net.pl...')
      
      try {
        const leclerc24Result = await fetchLeclerc24NutritionByBarcode(barcode)
        
        if (leclerc24Result) {
          leclerc24DataFound = true
          sourcesList.push('Leclerc24.net.pl')
          console.log('Znaleziono dane w Leclerc24.net.pl:', leclerc24Result.url)
          
          // Merge Leclerc24 data into product data (only fill missing fields)
          const mergedNutrition = mergeNutritionPreferExisting(nutritionData, leclerc24Result.data)
          
          // Update product data with merged nutrition
          productData.calories = mergedNutrition.calories ?? productData.calories
          productData.protein = mergedNutrition.protein ?? productData.protein
          productData.fat = mergedNutrition.fat ?? productData.fat
          productData.saturatedFat = mergedNutrition.saturatedFat ?? productData.saturatedFat
          productData.carbohydrates = mergedNutrition.carbohydrates ?? productData.carbohydrates
          productData.sugars = mergedNutrition.sugars ?? productData.sugars
          productData.salt = mergedNutrition.salt ?? productData.salt
          productData.calcium = mergedNutrition.calcium ?? productData.calcium
          productData.iron = mergedNutrition.iron ?? productData.iron
          productData.vitaminC = mergedNutrition.vitaminC ?? productData.vitaminC
          
          // Store Leclerc24 URL if no Leclerc URL already set
          if (!productData.leclercUrl) {
            productData.leclercUrl = leclerc24Result.url
          }
        }
      } catch (leclerc24Error) {
        console.error('Błąd podczas pobierania danych z Leclerc24.net.pl:', leclerc24Error)
      }
    }

    // Update source indicator based on which sources contributed
    if (sourcesList.length > 0) {
      if (sourcesList.length === 1 && sourcesList[0] === 'OpenFoodFacts') {
        productData.source = 'off'
      } else if (sourcesList.includes('OpenFoodFacts')) {
        productData.source = 'off+leclerc'  // Combined with OFF
      } else {
        productData.source = 'leclerc'  // Only Leclerc sources
      }
    }

    // If we still have no data at all, return 404
    if (!offDataFound && !leclercDataFound && !leclerc24DataFound) {
      return NextResponse.json(
        { error: 'Produkt nie został znaleziony w bazie Open Food Facts ani Leclerc' },
        { status: 404 }
      )
    }

    console.log('Zwracam produkt:', { ...productData, source: productData.source })

    return NextResponse.json(productData, { status: 200 })
    
  } catch (error) {
    console.error('Error fetching barcode data:', error)
    return NextResponse.json(
      { error: 'Błąd podczas wyszukiwania produktu' },
      { status: 500 }
    )
  }
}
