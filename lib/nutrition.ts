/**
 * Nutrition helper utilities.
 * 
 * This module provides functions for:
 * - Checking if product nutrition data is incomplete
 * - Merging nutrition data from multiple sources
 * - Unified fallback resolver for nutrition from multiple sources
 * 
 * Fallback order: Open Food Facts → Leclerc.com.pl → Leclerc24.net.pl
 */

import { fetchLeclercNutritionByBarcode, fetchLeclerc24NutritionByBarcode } from './leclerc'

/**
 * Type representing an object with nutrition fields.
 * This is intentionally loose to accept various product-like objects.
 */
export interface NutritionLike {
  calories?: number | null
  protein?: number | null
  fat?: number | null
  saturatedFat?: number | null
  carbohydrates?: number | null
  sugars?: number | null
  salt?: number | null
  fiber?: number | null
  calcium?: number | null
  iron?: number | null
  vitaminC?: number | null
}

/**
 * Core nutrition fields that are considered essential.
 * A product is considered "incomplete" if any of these are missing.
 */
const CORE_NUTRITION_FIELDS: (keyof NutritionLike)[] = [
  'calories',
  'protein',
  'fat',
  'carbohydrates',
]

/**
 * All nutrition fields that can be merged.
 */
const ALL_NUTRITION_FIELDS: (keyof NutritionLike)[] = [
  'calories',
  'protein',
  'fat',
  'saturatedFat',
  'carbohydrates',
  'sugars',
  'salt',
  'fiber',
  'calcium',
  'iron',
  'vitaminC',
]

/**
 * Check if a value is considered "missing" (null, undefined, or not a valid number).
 */
function isMissing(value: number | null | undefined): boolean {
  return value === null || value === undefined
}

/**
 * Check if a product's nutrition data is incomplete.
 * Returns true if ANY of the core fields (calories, protein, fat, carbohydrates) are missing/null.
 * 
 * @param productLike - An object containing nutrition fields
 * @returns true if nutrition data is incomplete, false if all core fields are present
 * 
 * @example
 * isNutritionIncomplete({ calories: 100, protein: 5, fat: 2, carbohydrates: 15 }) // false
 * isNutritionIncomplete({ calories: 100, protein: null, fat: 2, carbohydrates: 15 }) // true
 * isNutritionIncomplete({ calories: 100 }) // true (missing protein, fat, carbohydrates)
 */
export function isNutritionIncomplete(productLike: NutritionLike | null | undefined): boolean {
  if (!productLike) return true
  
  for (const field of CORE_NUTRITION_FIELDS) {
    if (isMissing(productLike[field])) {
      return true
    }
  }
  
  return false
}

/**
 * Count how many nutrition fields are missing.
 * Useful for determining how much data needs to be filled.
 * 
 * @param productLike - An object containing nutrition fields
 * @param coreOnly - If true, only count core fields; otherwise count all fields
 * @returns Number of missing fields
 */
export function countMissingNutritionFields(
  productLike: NutritionLike | null | undefined,
  coreOnly: boolean = false
): number {
  if (!productLike) {
    return coreOnly ? CORE_NUTRITION_FIELDS.length : ALL_NUTRITION_FIELDS.length
  }
  
  const fieldsToCheck = coreOnly ? CORE_NUTRITION_FIELDS : ALL_NUTRITION_FIELDS
  let count = 0
  
  for (const field of fieldsToCheck) {
    if (isMissing(productLike[field])) {
      count++
    }
  }
  
  return count
}

/**
 * Get a list of missing nutrition field names.
 * Useful for displaying which fields need to be filled.
 * 
 * @param productLike - An object containing nutrition fields
 * @param coreOnly - If true, only check core fields
 * @returns Array of missing field names
 */
export function getMissingNutritionFields(
  productLike: NutritionLike | null | undefined,
  coreOnly: boolean = false
): (keyof NutritionLike)[] {
  if (!productLike) {
    return coreOnly ? [...CORE_NUTRITION_FIELDS] : [...ALL_NUTRITION_FIELDS]
  }
  
  const fieldsToCheck = coreOnly ? CORE_NUTRITION_FIELDS : ALL_NUTRITION_FIELDS
  const missing: (keyof NutritionLike)[] = []
  
  for (const field of fieldsToCheck) {
    if (isMissing(productLike[field])) {
      missing.push(field)
    }
  }
  
  return missing
}

/**
 * Merge nutrition data from an incoming source into existing data.
 * 
 * By default, this function only fills null/undefined fields from the incoming data,
 * preserving any existing non-null values. Set `force` to true to overwrite all fields.
 * 
 * @param existing - The existing nutrition data (will not be modified)
 * @param incoming - The incoming nutrition data to merge
 * @param options - Merge options
 * @param options.force - If true, overwrite all fields; if false (default), only fill missing
 * @returns A new object with merged nutrition data
 * 
 * @example
 * // Only fills missing fields
 * mergeNutritionPreferExisting(
 *   { calories: 100, protein: null, fat: 5, carbohydrates: null },
 *   { calories: 200, protein: 10, fat: 8, carbohydrates: 20 }
 * )
 * // Result: { calories: 100, protein: 10, fat: 5, carbohydrates: 20 }
 * 
 * @example
 * // Force overwrites all fields
 * mergeNutritionPreferExisting(
 *   { calories: 100, protein: null },
 *   { calories: 200, protein: 10 },
 *   { force: true }
 * )
 * // Result: { calories: 200, protein: 10 }
 */
export function mergeNutritionPreferExisting<T extends NutritionLike>(
  existing: T | null | undefined,
  incoming: NutritionLike | null | undefined,
  options: { force?: boolean } = {}
): Partial<NutritionLike> {
  const { force = false } = options
  
  // Start with existing data (or empty object)
  const result: Partial<NutritionLike> = {}
  
  // Copy existing values
  if (existing) {
    for (const field of ALL_NUTRITION_FIELDS) {
      if (!isMissing(existing[field])) {
        result[field] = existing[field]
      }
    }
  }
  
  // Merge incoming values
  if (incoming) {
    for (const field of ALL_NUTRITION_FIELDS) {
      const incomingValue = incoming[field]
      
      // Skip if incoming is null/undefined
      if (isMissing(incomingValue)) continue
      
      // In force mode, always overwrite
      if (force) {
        result[field] = incomingValue
        continue
      }
      
      // In normal mode, only fill if existing is missing
      if (isMissing(result[field])) {
        result[field] = incomingValue
      }
    }
  }
  
  return result
}

/**
 * Extract only the nutrition fields from a larger object.
 * Useful for creating a clean nutrition-only subset.
 * 
 * @param source - The source object containing nutrition fields
 * @returns An object with only nutrition fields
 */
export function extractNutritionFields<T extends NutritionLike>(
  source: T | null | undefined
): Partial<NutritionLike> {
  if (!source) return {}
  
  const result: Partial<NutritionLike> = {}
  
  for (const field of ALL_NUTRITION_FIELDS) {
    if (!isMissing(source[field])) {
      result[field] = source[field]
    }
  }
  
  return result
}

/**
 * Human-readable names for nutrition fields in Polish.
 */
export const NUTRITION_FIELD_NAMES_PL: Record<keyof NutritionLike, string> = {
  calories: 'Kalorie',
  protein: 'Białko',
  fat: 'Tłuszcz',
  saturatedFat: 'Kwasy nasycone',
  carbohydrates: 'Węglowodany',
  sugars: 'Cukry',
  salt: 'Sól',
  fiber: 'Błonnik',
  calcium: 'Wapń',
  iron: 'Żelazo',
  vitaminC: 'Witamina C',
}

/**
 * Units for nutrition fields.
 */
export const NUTRITION_FIELD_UNITS: Record<keyof NutritionLike, string> = {
  calories: 'kcal',
  protein: 'g',
  fat: 'g',
  saturatedFat: 'g',
  carbohydrates: 'g',
  sugars: 'g',
  salt: 'g',
  fiber: 'g',
  calcium: 'mg',
  iron: 'mg',
  vitaminC: 'mg',
}

// =============================================================================
// UNIFIED NUTRITION RESOLVER WITH FALLBACKS
// =============================================================================

/**
 * Result from the unified nutrition resolver.
 */
export interface NutritionResolveResult {
  /** Data from Open Food Facts (if found) */
  fromOpenFoodFacts?: Partial<NutritionLike> | null
  /** Data from Leclerc.com.pl (if found) */
  fromLeclerc?: Partial<NutritionLike> | null
  /** Data from Leclerc24.net.pl (if found) */
  fromLeclerc24?: Partial<NutritionLike> | null
  /** Merged result from all sources */
  merged: Partial<NutritionLike>
  /** Human-readable description of which sources were used */
  sourceInfo: string[]
  /** URLs of the sources used */
  sourceUrls: string[]
  /** Whether any data was found */
  hasData: boolean
}

// Allergen mapping from Open Food Facts tags to our IDs
const OFF_ALLERGEN_MAP: { [key: string]: number } = {
  'en:gluten': 1,
  'en:crustaceans': 2,
  'en:eggs': 3,
  'en:fish': 4,
  'en:peanuts': 5,
  'en:soybeans': 6,
  'en:milk': 7,
  'en:nuts': 8,
  'en:celery': 9,
  'en:mustard': 10,
  'en:sesame-seeds': 11,
  'en:sulphur-dioxide-and-sulphites': 12,
  'en:lupin': 13,
  'en:molluscs': 14,
}

/**
 * Fetch nutrition data from Open Food Facts API.
 * 
 * @param barcode - Product barcode
 * @returns Nutrition data or null if not found
 */
async function fetchOpenFoodFactsNutrition(barcode: string): Promise<{
  data: Partial<NutritionLike>
  name?: string
  manufacturer?: string
  allergens?: number[]
} | null> {
  console.log(`[OFF] Fetching nutrition for barcode: ${barcode}`)
  
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 10000)
  
  try {
    const response = await fetch(
      `https://world.openfoodfacts.org/api/v0/product/${barcode}.json`,
      {
        headers: { 'User-Agent': 'Kartoteka Magazynowa - Internal Use' },
        signal: controller.signal,
      }
    )
    
    if (!response.ok) {
      console.log(`[OFF] HTTP ${response.status}`)
      return null
    }
    
    const json = await response.json()
    
    if (json.status === 0 || !json.product) {
      console.log('[OFF] Product not found')
      return null
    }
    
    const product = json.product
    const n = product.nutriments || {}
    
    const data: Partial<NutritionLike> = {
      calories: n['energy-kcal_100g'] ?? null,
      protein: n.proteins_100g ?? null,
      fat: n.fat_100g ?? null,
      saturatedFat: n['saturated-fat_100g'] ?? null,
      carbohydrates: n.carbohydrates_100g ?? null,
      sugars: n.sugars_100g ?? null,
      salt: n.salt_100g ?? null,
      fiber: n.fiber_100g ?? null,
      calcium: n.calcium_100g ? n.calcium_100g * 1000 : null,
      iron: n.iron_100g ? n.iron_100g * 1000 : null,
      vitaminC: n['vitamin-c_100g'] ? n['vitamin-c_100g'] * 1000 : null,
    }
    
    // Map allergens
    const allergens: number[] = []
    if (product.allergens_tags) {
      for (const tag of product.allergens_tags) {
        const id = OFF_ALLERGEN_MAP[tag]
        if (id && !allergens.includes(id)) allergens.push(id)
      }
    }
    
    // Check if we got any meaningful nutrition data
    const hasNutrition = data.calories != null || data.protein != null || 
                         data.fat != null || data.carbohydrates != null
    
    if (!hasNutrition) {
      console.log('[OFF] Product found but no nutrition data')
      return null
    }
    
    console.log(`[OFF] Found nutrition data for: ${product.product_name_pl || product.product_name || barcode}`)
    
    return {
      data,
      name: product.product_name_pl || product.product_name,
      manufacturer: product.brands,
      allergens: allergens.sort((a, b) => a - b),
    }
  } catch (error: any) {
    if (error?.name === 'AbortError') {
      console.error('[OFF] Request timed out')
    } else {
      console.error('[OFF] Error:', error)
    }
    return null
  } finally {
    clearTimeout(timeoutId)
  }
}

/**
 * Resolve nutrition data from ALL external sources.
 * 
 * ALWAYS queries every source (no skip logic):
 * 1. Open Food Facts API (fastest, most reliable)
 * 2. Leclerc.com.pl scraper
 * 3. Leclerc24.net.pl scraper
 * 
 * OFF initializes the merged result. Leclerc sources only fill null fields
 * (they do not override existing non-null values from OFF).
 * 
 * @param barcode - The product barcode
 * @returns Resolved nutrition data with source information
 */
export async function resolveNutritionWithFallbacks(
  barcode: string,
): Promise<NutritionResolveResult> {
  console.log(`\n[NutritionResolver] ====================================================`)
  console.log(`[NutritionResolver] Starting resolution for barcode: ${barcode}`)
  console.log(`[NutritionResolver] Mode: OFF initializes, Leclerc fills nulls`)
  console.log(`[NutritionResolver] ====================================================`)
  
  const totalStart = Date.now()
  
  const result: NutritionResolveResult = {
    merged: {},
    sourceInfo: [],
    sourceUrls: [],
    hasData: false,
  }
  
  // ==========================================================================
  // SOURCE 0: Open Food Facts (fastest, most reliable)
  // ==========================================================================
  console.log('[NutritionResolver] --- SOURCE 0: Open Food Facts ---')
  const offStart = Date.now()
  try {
    const offResult = await fetchOpenFoodFactsNutrition(barcode)
    console.log(`[NutritionResolver] OFF completed in ${Date.now() - offStart}ms`)
    
    if (offResult && offResult.data) {
      console.log(`[NutritionResolver] OFF returned data:`, JSON.stringify(offResult.data))
      result.fromOpenFoodFacts = offResult.data
      result.sourceUrls.push(`https://world.openfoodfacts.org/product/${barcode}`)
      
      // Overwrite merged with OFF data
      result.merged = mergeNutritionPreferExisting(result.merged, offResult.data, { force: true })
      result.sourceInfo.push('Open Food Facts')
      result.hasData = true
      
      console.log('[NutritionResolver] Merged after OFF:', JSON.stringify(result.merged))
    } else {
      console.log('[NutritionResolver] OFF returned null/no data')
    }
  } catch (error) {
    console.error(`[NutritionResolver] OFF ERROR after ${Date.now() - offStart}ms:`, error instanceof Error ? error.message : error)
  }
  
  // ==========================================================================
  // SOURCE 1: Leclerc.com.pl (ALWAYS tried)
  // ==========================================================================
  console.log('[NutritionResolver] --- SOURCE 1: Leclerc.com.pl ---')
  const leclercStart = Date.now()
  try {
    const leclercResult = await fetchLeclercNutritionByBarcode(barcode)
    console.log(`[NutritionResolver] Leclerc.com.pl completed in ${Date.now() - leclercStart}ms`)
    
    if (leclercResult && leclercResult.data) {
      console.log(`[NutritionResolver] Leclerc.com.pl returned data from: ${leclercResult.url}`)
      result.fromLeclerc = leclercResult.data
      result.sourceUrls.push(leclercResult.url)
      
      // Fill null fields from Leclerc (preserve existing OFF values)
      result.merged = mergeNutritionPreferExisting(result.merged, leclercResult.data)
      result.sourceInfo.push('Leclerc.com.pl')
      result.hasData = true
      
      console.log('[NutritionResolver] Merged after Leclerc:', JSON.stringify(result.merged))
    } else {
      console.log('[NutritionResolver] Leclerc.com.pl returned null/no data')
    }
  } catch (error) {
    console.error(`[NutritionResolver] Leclerc.com.pl ERROR after ${Date.now() - leclercStart}ms:`, error instanceof Error ? error.message : error)
  }
  
  // ==========================================================================
  // SOURCE 2: Leclerc24.net.pl (ALWAYS tried)
  // ==========================================================================
  console.log('[NutritionResolver] --- SOURCE 2: Leclerc24.net.pl ---')
  const leclerc24Start = Date.now()
  try {
    const leclerc24Result = await fetchLeclerc24NutritionByBarcode(barcode)
    console.log(`[NutritionResolver] Leclerc24.net.pl completed in ${Date.now() - leclerc24Start}ms`)
    
    if (leclerc24Result && leclerc24Result.data) {
      console.log(`[NutritionResolver] Leclerc24.net.pl returned data from: ${leclerc24Result.url}`)
      console.log(`[NutritionResolver] Leclerc24 data:`, JSON.stringify(leclerc24Result.data))
      result.fromLeclerc24 = leclerc24Result.data
      result.sourceUrls.push(leclerc24Result.url)
      
      // Fill remaining null fields from Leclerc24 (preserve existing values)
      result.merged = mergeNutritionPreferExisting(result.merged, leclerc24Result.data)
      result.sourceInfo.push('Leclerc24.net.pl')
      result.hasData = true
      
      console.log('[NutritionResolver] Merged after Leclerc24:', JSON.stringify(result.merged))
    } else {
      console.log('[NutritionResolver] Leclerc24.net.pl returned null/no data')
    }
  } catch (error) {
    console.error(`[NutritionResolver] Leclerc24.net.pl ERROR after ${Date.now() - leclerc24Start}ms:`, error instanceof Error ? error.message : error)
  }
  
  // Final status
  const totalElapsed = Date.now() - totalStart
  console.log(`[NutritionResolver] ====================================================`)
  console.log(`[NutritionResolver] FINAL RESULT:`)
  console.log(`[NutritionResolver]   hasData: ${result.hasData}`)
  console.log(`[NutritionResolver]   sources: ${result.sourceInfo.length > 0 ? result.sourceInfo.join(', ') : 'NONE'}`)
  console.log(`[NutritionResolver]   sourceUrls: ${result.sourceUrls.join(', ') || 'NONE'}`)
  console.log(`[NutritionResolver]   merged:`, JSON.stringify(result.merged))
  console.log(`[NutritionResolver]   totalTime: ${totalElapsed}ms`)
  console.log(`[NutritionResolver] ====================================================\n`)
  
  return result
}

/**
 * Format source info for display to user.
 * 
 * @param sourceInfo - Array of source names
 * @returns Human-readable string in Polish
 */
export function formatSourceInfoMessage(sourceInfo: string[]): string {
  if (sourceInfo.length === 0) {
    return 'Nie znaleziono danych o wartościach odżywczych'
  }
  
  if (sourceInfo.length === 1) {
    return `Dane uzupełnione z ${sourceInfo[0]}`
  }
  
  return `Dane uzupełnione z ${sourceInfo.join(' i ')}`
}
