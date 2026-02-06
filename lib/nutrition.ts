/**
 * Nutrition helper utilities.
 * 
 * This module provides functions for:
 * - Checking if product nutrition data is incomplete
 * - Merging nutrition data from multiple sources
 * - Unified fallback resolver for nutrition from multiple sources
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

/**
 * Resolve nutrition data using multiple fallback sources.
 * 
 * Order of resolution:
 * 1. Leclerc.com.pl - Primary Leclerc scraper
 * 2. Leclerc24.net.pl - Secondary Leclerc-like scraper
 * 
 * The function uses the existing data and only fills missing fields.
 * Each subsequent source only fills fields that are still missing after the previous source.
 * 
 * @param barcode - The product barcode
 * @param existingNutrition - Optional existing nutrition data to preserve
 * @returns Resolved nutrition data with source information
 */
export async function resolveNutritionWithFallbacks(
  barcode: string,
  existingNutrition?: NutritionLike | null
): Promise<NutritionResolveResult> {
  console.log(`[NutritionResolver] Starting resolution for barcode: ${barcode}`)
  
  const result: NutritionResolveResult = {
    merged: existingNutrition ? extractNutritionFields(existingNutrition) : {},
    sourceInfo: [],
    sourceUrls: [],
    hasData: false,
  }
  
  // Helper to check if we still need more data
  const stillIncomplete = () => isNutritionIncomplete(result.merged)
  
  // ==========================================================================
  // SOURCE 1: Leclerc.com.pl
  // ==========================================================================
  if (stillIncomplete()) {
    console.log('[NutritionResolver] Trying Leclerc.com.pl...')
    try {
      const leclercResult = await fetchLeclercNutritionByBarcode(barcode)
      
      if (leclercResult && leclercResult.data) {
        result.fromLeclerc = leclercResult.data
        result.sourceUrls.push(leclercResult.url)
        
        // Merge with existing (only fill missing)
        result.merged = mergeNutritionPreferExisting(result.merged, leclercResult.data)
        result.sourceInfo.push('Leclerc.com.pl')
        result.hasData = true
        
        console.log('[NutritionResolver] Got data from Leclerc.com.pl')
      } else {
        console.log('[NutritionResolver] No data from Leclerc.com.pl')
      }
    } catch (error) {
      console.error('[NutritionResolver] Error from Leclerc.com.pl:', error)
    }
  }
  
  // ==========================================================================
  // SOURCE 2: Leclerc24.net.pl (if still incomplete)
  // ==========================================================================
  if (stillIncomplete()) {
    console.log('[NutritionResolver] Trying Leclerc24.net.pl...')
    try {
      const leclerc24Result = await fetchLeclerc24NutritionByBarcode(barcode)
      
      if (leclerc24Result && leclerc24Result.data) {
        result.fromLeclerc24 = leclerc24Result.data
        result.sourceUrls.push(leclerc24Result.url)
        
        // Merge with existing (only fill missing)
        result.merged = mergeNutritionPreferExisting(result.merged, leclerc24Result.data)
        result.sourceInfo.push('Leclerc24.net.pl')
        result.hasData = true
        
        console.log('[NutritionResolver] Got data from Leclerc24.net.pl')
      } else {
        console.log('[NutritionResolver] No data from Leclerc24.net.pl')
      }
    } catch (error) {
      console.error('[NutritionResolver] Error from Leclerc24.net.pl:', error)
    }
  }
  
  // Final status
  if (result.hasData) {
    console.log(`[NutritionResolver] Resolved with sources: ${result.sourceInfo.join(', ')}`)
  } else {
    console.log('[NutritionResolver] No data found from any source')
  }
  
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
