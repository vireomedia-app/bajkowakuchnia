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
    
    console.log(`[Fill From Leclerc] Product ID: ${productId}, Force: ${force}`)
    
    // Fetch the product
    const product = await prisma.product.findUnique({
      where: { id: productId },
    })
    
    if (!product) {
      return NextResponse.json(
        { error: 'Produkt nie został znaleziony' },
        { status: 404 }
      )
    }
    
    // Check if product has a barcode
    if (!product.barcode) {
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
    
    // If not forcing and no fields are missing, skip the fetch
    if (!force && missingBefore.length === 0) {
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
    
    console.log(`[Fill From Leclerc] Fetching nutrition for barcode: ${product.barcode}`)
    
    // Resolve nutrition from multiple sources (OFF → Leclerc.com.pl → Leclerc24.net.pl)
    const resolveResult = await resolveNutritionWithFallbacks(
      product.barcode,
      force ? null : existingNutrition  // If forcing, don't pass existing data
    )
    
    if (!resolveResult.hasData) {
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
        }
      } else {
        // In normal mode, only fill if old value was null/undefined
        if ((oldValue === null || oldValue === undefined) && newValue !== undefined && newValue !== null) {
          updateData[field] = newValue
          filledFields.push(field)
        }
      }
    }
    
    if (Object.keys(updateData).length === 0) {
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
    
    // Update the product
    const updatedProduct = await prisma.product.update({
      where: { id: productId },
      data: updateData,
    })
    
    const sourceMessage = formatSourceInfoMessage(resolveResult.sourceInfo)
    console.log(`[Fill From Leclerc] Updated ${filledFields.length} fields: ${filledFields.join(', ')}. Sources: ${resolveResult.sourceInfo.join(', ')}`)
    
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
    console.error('[Fill From Leclerc] Error:', error)
    
    return NextResponse.json(
      { error: 'Błąd podczas pobierania danych z Leclerc' },
      { status: 500 }
    )
  }
}
