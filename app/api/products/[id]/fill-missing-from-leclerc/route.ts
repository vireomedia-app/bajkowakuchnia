/**
 * API endpoint to fetch and overwrite nutrition data for a product from external sources.
 * 
 * POST /api/products/[id]/fill-missing-from-leclerc
 * 
 * ALWAYS performs the full scraping process from all sources:
 * 0. Open Food Facts API
 * 1. Leclerc.com.pl
 * 2. Leclerc24.net.pl
 * 
 * Always overwrites existing database values with newly fetched data.
 * Requires the product to have a barcode.
 * 
 * Returns: { product: Product, filledFields: string[], sourceUrls: string[], sourceInfo: string[] }
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { 
  resolveNutritionWithFallbacks, 
  formatSourceInfoMessage 
} from '@/lib/nutrition'

// This endpoint requires Node.js runtime (not Edge) for external HTTP requests
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

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
    
    console.log(`\n[Fill-Nutrition] ############################################`)
    console.log(`[Fill-Nutrition] Product ID: ${productId}`)
    console.log(`[Fill-Nutrition] Mode: ALWAYS fetch all sources, overwrite all fields`)
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
        { error: 'Produkt nie ma kodu kreskowego - nie można pobrać danych' },
        { status: 400 }
      )
    }
    
    console.log(`[Fill-Nutrition] Calling resolveNutritionWithFallbacks("${product.barcode}")...`)
    
    // Resolve nutrition from ALL sources (no skip logic)
    const resolveResult = await resolveNutritionWithFallbacks(product.barcode)
    
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
    
    // Build update data - always overwrite with whatever we fetched
    const mergedNutrition = resolveResult.merged
    const filledFields: string[] = []
    const updateData: Record<string, number | null> = {}
    
    // Note: 'fiber' is intentionally excluded - no DB column for it
    const nutritionFields = [
      'calories', 'protein', 'fat', 'saturatedFat', 'carbohydrates',
      'sugars', 'salt', 'calcium', 'iron', 'vitaminC'
    ] as const
    
    for (const field of nutritionFields) {
      const oldValue = (product as any)[field]
      const newValue = (mergedNutrition as any)[field]
      
      // Always overwrite if we have a new value (including 0)
      if (newValue !== undefined && newValue !== null) {
        updateData[field] = newValue
        if (newValue !== oldValue) {
          filledFields.push(field)
          console.log(`[Fill-Nutrition]   ${field}: ${oldValue} -> ${newValue}`)
        }
      }
    }
    
    if (Object.keys(updateData).length === 0) {
      console.log(`[Fill-Nutrition] No fields to update`)
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
    
    console.log(`[Fill-Nutrition] Updating ${Object.keys(updateData).length} fields in database:`, JSON.stringify(updateData))
    
    // Update the product
    const updatedProduct = await prisma.product.update({
      where: { id: productId },
      data: updateData,
    })
    
    const sourceMessage = formatSourceInfoMessage(resolveResult.sourceInfo)
    console.log(`[Fill-Nutrition] SUCCESS: Updated fields: ${filledFields.join(', ') || '(values unchanged)'}`)
    console.log(`[Fill-Nutrition] Sources: ${resolveResult.sourceInfo.join(', ')}`)
    console.log(`[Fill-Nutrition] Total time: ${Date.now() - routeStart}ms`)
    console.log(`[Fill-Nutrition] ############################################\n`)
    
    return NextResponse.json(
      {
        message: `${sourceMessage}. Zaktualizowano dane.`,
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
      { error: 'Błąd podczas pobierania danych' },
      { status: 500 }
    )
  }
}
