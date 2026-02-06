/**
 * API endpoint to resolve nutrition data from external sources.
 * Currently supports Leclerc.pl as a data source.
 * 
 * POST /api/nutrition/resolve
 * Body: { barcode: string, force?: boolean }
 * 
 * Returns: { data: NutritionData, sourceUrl: string } or { error: string }
 */

import { NextRequest, NextResponse } from 'next/server'
import { fetchLeclercNutritionByBarcode, LeclercNutritionData } from '@/lib/leclerc'
import { z } from 'zod'

// This endpoint requires Node.js runtime (not Edge) for external HTTP requests
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const requestSchema = z.object({
  barcode: z.string().min(1, 'Barcode is required'),
  force: z.boolean().optional().default(false),
})

export interface NutritionResolveResponse {
  data: LeclercNutritionData
  sourceUrl: string
  source: 'leclerc'
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    // Validate request body
    const parseResult = requestSchema.safeParse(body)
    if (!parseResult.success) {
      return NextResponse.json(
        { error: parseResult.error.errors[0].message },
        { status: 400 }
      )
    }
    
    const { barcode } = parseResult.data
    
    console.log(`[Nutrition Resolve] Resolving nutrition for barcode: ${barcode}`)
    
    // Try Leclerc.pl as the primary source
    const leclercResult = await fetchLeclercNutritionByBarcode(barcode)
    
    if (leclercResult) {
      console.log(`[Nutrition Resolve] Found data from Leclerc: ${leclercResult.url}`)
      
      const response: NutritionResolveResponse = {
        data: leclercResult.data,
        sourceUrl: leclercResult.url,
        source: 'leclerc',
      }
      
      return NextResponse.json(response, { status: 200 })
    }
    
    // No data found from any source
    console.log(`[Nutrition Resolve] No nutrition data found for barcode: ${barcode}`)
    return NextResponse.json(
      { error: 'Nie znaleziono danych o wartościach odżywczych dla tego kodu kreskowego' },
      { status: 404 }
    )
    
  } catch (error) {
    console.error('[Nutrition Resolve] Error:', error)
    
    // Handle specific error types
    if (error instanceof SyntaxError) {
      return NextResponse.json(
        { error: 'Nieprawidłowy format żądania' },
        { status: 400 }
      )
    }
    
    return NextResponse.json(
      { error: 'Błąd podczas pobierania danych o wartościach odżywczych' },
      { status: 500 }
    )
  }
}
