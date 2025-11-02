
import { NextRequest, NextResponse } from 'next/server'

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
    const barcode = searchParams.get('code')

    if (!barcode) {
      return NextResponse.json(
        { error: 'Brak kodu kreskowego' },
        { status: 400 }
      )
    }

    console.log('Wyszukiwanie produktu:', barcode)

    // Wywołaj API Open Food Facts
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

    if (data.status === 0 || !data.product) {
      return NextResponse.json(
        { error: 'Produkt nie został znaleziony w bazie Open Food Facts' },
        { status: 404 }
      )
    }

    const product = data.product

    // Zmapuj dane z Open Food Facts do naszego formatu
    const productData = {
      name: product.product_name_pl || product.product_name || '',
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
    }

    console.log('Znaleziono produkt:', productData)

    return NextResponse.json(productData, { status: 200 })
    
  } catch (error) {
    console.error('Error fetching barcode data:', error)
    return NextResponse.json(
      { error: 'Błąd podczas wyszukiwania produktu' },
      { status: 500 }
    )
  }
}
