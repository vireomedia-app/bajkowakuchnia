/**
 * API endpoint to fill missing nutrition data for a product from external sources.
 * 
 * POST /api/products/[id]/fill-missing-from-leclerc
 * Body: { force?: boolean }
 * 
 * Uses a multi-source fallback chain:
 * 0. Open Food Facts API
 * 1. Leclerc.com.pl
 * 2. Leclerc24.net.pl
 * 
 * - Requires the product to have a barcode.
 * - By default, only fills null/undefined nutrition fields.
 * - If force=true, overwrites all nutrition fields.
 * 
 * Returns: { product: Product, filledFields: string[], sourceUrls: string[], sourceInfo: string[] }
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { 
  resolveNutritionWithFallbacks, 
  getMissingNutritionFields, 
  NutritionLike,
  formatSourceInfoMessage 
} from '@/lib/nutrition'
import { z } from 'zod'

// This endpoint requires Node.js runtime (not Edge) for external HTTP requests
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const requestSchema = z.object({
  force: z.boolean().optional().default(false),
})

interface RouteContext {
  params: Promise<{
    id: string
  }>
}

export async function POST(request: NextRequest, context: RouteContext) {
  const routeStart = Date.now()
  
  try {
    const resolvedParams = await context.params
    const productId = resolvedParams.id
    
    // Parse and validate request body
    let body = {}
    try {
      body = await request.json()
    } catch {
      // Empty body is OK, defaults will be used
    }
    
    const parseResult = requestSchema.safeParse(body)
    if (!parseResult.success) {
      return NextResponse.json(
        { error: parseResult.error.errors[0].message },
        { status: 400 }
      )
    }
    
    const { force } = parseResult.data
    
    console.log(`\n[Fill-Nutrition] ############################################`)
    console.log(`[Fill-Nutrition] Product ID: ${productId}`)
    console.log(`[Fill-Nutrition] Force overwrite: ${force}`)
    console.log(`[Fill-Nutrition] ############################################`)
    
    // Fetch the product
    const product = await prisma.product.findUnique({
      where: { id: productId },
    })
    
    if (!product) {
      console.log(`[Fill-Nutrition] ERROR: Product not found (ID: ${productId})`)
      return NextResponse.json(
        { error: 'Produkt nie został znaleziony' },
        { status: 404 }
      )
    }
    
    console.log(`[Fill-Nutrition] Product: "${product.name}"`)
    console.log(`[Fill-Nutrition] Barcode: ${product.barcode || 'NONE'}`)
    
    // Check if product has a barcode
    if (!product.barcode) {
      console.log(`[Fill-Nutrition] ERROR: Product has no barcode`)
      return NextResponse.json(
        { error: 'Produkt nie ma kodu kreskowego - nie można pobrać danych z Leclerc' },
        { status: 400 }
      )
    }
    
    // Get missing fields before fetching
    const existingNutrition: NutritionLike = {
      calories: product.calories,
      protein: product.protein,
      fat: product.fat,
      saturatedFat: product.saturatedFat,
      carbohydrates: product.carbohydrates,
      sugars: product.sugars,
      salt: product.salt,
      calcium: product.calcium,
      iron: product.iron,
      vitaminC: product.vitaminC,
    }
    
    const missingBefore = getMissingNutritionFields(existingNutrition)
    console.log(`[Fill-Nutrition] Existing nutrition:`, JSON.stringify(existingNutrition))
    console.log(`[Fill-Nutrition] Missing fields (${missingBefore.length}): ${missingBefore.join(', ') || 'none'}`)
    
    // If not forcing and no fields are missing, skip the fetch
    if (!force && missingBefore.length === 0) {
      console.log(`[Fill-Nutrition] All fields already filled - skipping fetch`)
      return NextResponse.json(
        { 
          message: 'Wszystkie pola wartości odżywczych są już uzupełnione',
          product,
          filledFields: [],
          sourceUrls: [],
          sourceInfo: [],
        },
        { status: 200 }
      )
    }
    
    console.log(`[Fill-Nutrition] Calling resolveNutritionWithFallbacks("${product.barcode}")...`)
    
    // Resolve nutrition from multiple sources (OFF → Leclerc.com.pl → Leclerc24.net.pl)
    const resolveResult = await resolveNutritionWithFallbacks(
      product.barcode,
      force ? null : existingNutrition  // If forcing, don't pass existing data
    )
    
    console.log(`[Fill-Nutrition] resolveNutritionWithFallbacks returned:`)
    console.log(`[Fill-Nutrition]   hasData: ${resolveResult.hasData}`)
    console.log(`[Fill-Nutrition]   sources: ${resolveResult.sourceInfo.join(', ') || 'NONE'}`)
    console.log(`[Fill-Nutrition]   merged:`, JSON.stringify(resolveResult.merged))
    
    if (!resolveResult.hasData) {
      console.log(`[Fill-Nutrition] FAILED: No nutrition data found from any source`)
      console.log(`[Fill-Nutrition] Total time: ${Date.now() - routeStart}ms`)
      return NextResponse.json(
        { 
          error: 'Nie znaleziono danych o wartościach odżywczych w żadnym ze źródeł (Open Food Facts, Leclerc.com.pl, Leclerc24.net.pl)',
          sourceInfo: [],
        },
        { status: 404 }
      )
    }
    
    // Use merged data from resolver
    const mergedNutrition = resolveResult.merged
    
    // Determine which fields were actually filled/changed
    const filledFields: string[] = []
    const updateData: Record<string, number | null> = {}
    
    const nutritionFields = [
      'calories', 'protein', 'fat', 'saturatedFat', 'carbohydrates',
      'sugars', 'salt', 'calcium', 'iron', 'vitaminC'
    ] as const
    
    for (const field of nutritionFields) {
      const oldValue = (existingNutrition as any)[field]
      const newValue = (mergedNutrition as any)[field]
      
      // Check if value changed
      if (force) {
        // In force mode, update if new value is different
        if (newValue !== undefined && newValue !== oldValue) {
          updateData[field] = newValue ?? null
          filledFields.push(field)
          console.log(`[Fill-Nutrition]   ${field}: ${oldValue} -> ${newValue ?? null} (force)`)
        }
      } else {
        // In normal mode, only fill if old value was null/undefined
        if ((oldValue === null || oldValue === undefined) && newValue !== undefined && newValue !== null) {
          updateData[field] = newValue
          filledFields.push(field)
          console.log(`[Fill-Nutrition]   ${field}: null -> ${newValue} (fill)`)
        }
      }
    }
    
    if (Object.keys(updateData).length === 0) {
      console.log(`[Fill-Nutrition] No new data to update (all incoming values already exist or are null)`)
      console.log(`[Fill-Nutrition] Total time: ${Date.now() - routeStart}ms`)
      return NextResponse.json(
        { 
          message: 'Brak nowych danych do uzupełnienia',
          product,
          filledFields: [],
          sourceUrls: resolveResult.sourceUrls,
          sourceInfo: resolveResult.sourceInfo,
        },
        { status: 200 }
      )
    }
    
    console.log(`[Fill-Nutrition] Updating ${filledFields.length} fields in database:`, JSON.stringify(updateData))
    
    // Update the product
    const updatedProduct = await prisma.product.update({
      where: { id: productId },
      data: updateData,
    })
    
    const sourceMessage = formatSourceInfoMessage(resolveResult.sourceInfo)
    console.log(`[Fill-Nutrition] SUCCESS: Updated ${filledFields.length} fields: ${filledFields.join(', ')}`)
    console.log(`[Fill-Nutrition] Sources: ${resolveResult.sourceInfo.join(', ')}`)
    console.log(`[Fill-Nutrition] Total time: ${Date.now() - routeStart}ms`)
    console.log(`[Fill-Nutrition] ############################################\n`)
    
    return NextResponse.json(
      {
        message: `${sourceMessage}. Uzupełniono ${filledFields.length} pól.`,
        product: updatedProduct,
        filledFields,
        sourceUrls: resolveResult.sourceUrls,
        sourceInfo: resolveResult.sourceInfo,
      },
      { status: 200 }
    )
    
  } catch (error) {
    console.error(`[Fill-Nutrition] EXCEPTION after ${Date.now() - routeStart}ms:`, error)
    
    return NextResponse.json(
      { error: 'Błąd podczas pobierania danych z Leclerc' },
      { status: 500 }
    )
  }
}
