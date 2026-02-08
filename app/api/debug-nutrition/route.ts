/**
 * DEBUG endpoint to test the nutrition scraper pipeline for a specific barcode.
 * 
 * Usage:
 *   GET /api/debug-nutrition?barcode=5900783006969
 * 
 * This endpoint runs the full nutrition resolution pipeline and returns
 * detailed results including which sources succeeded/failed and all parsed data.
 * 
 * This is for DEBUGGING ONLY - consider removing in production.
 */

import { NextRequest, NextResponse } from 'next/server'
import { resolveNutritionWithFallbacks } from '@/lib/nutrition'
import { 
  searchLeclerc24ProductUrls,
  scrapeLeclerc24NutritionFromProductPage 
} from '@/lib/leclerc'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const barcode = request.nextUrl.searchParams.get('barcode')
  
  if (!barcode) {
    return NextResponse.json(
      { error: 'Missing ?barcode= parameter' },
      { status: 400 }
    )
  }
  
  console.log(`\n[DEBUG-NUTRITION] ============================================`)
  console.log(`[DEBUG-NUTRITION] Testing nutrition pipeline for barcode: ${barcode}`)
  console.log(`[DEBUG-NUTRITION] ============================================`)
  
  const results: Record<string, unknown> = {
    barcode,
    timestamp: new Date().toISOString(),
  }
  
  // Step 1: Test Leclerc24 search
  console.log(`[DEBUG-NUTRITION] Step 1: Testing Leclerc24 search...`)
  const searchStart = Date.now()
  try {
    const urls = await searchLeclerc24ProductUrls(barcode)
    results.leclerc24Search = {
      success: true,
      timeMs: Date.now() - searchStart,
      urlsFound: urls.length,
      urls,
    }
  } catch (error) {
    results.leclerc24Search = {
      success: false,
      timeMs: Date.now() - searchStart,
      error: error instanceof Error ? error.message : String(error),
    }
  }
  
  // Step 2: Test Leclerc24 direct scrape (if we found URLs)
  const searchResult = results.leclerc24Search as any
  if (searchResult?.success && searchResult?.urls?.length > 0) {
    console.log(`[DEBUG-NUTRITION] Step 2: Testing Leclerc24 scrape for first URL...`)
    const scrapeStart = Date.now()
    try {
      const nutrition = await scrapeLeclerc24NutritionFromProductPage(
        searchResult.urls[0],
        barcode
      )
      results.leclerc24Scrape = {
        success: nutrition !== null,
        timeMs: Date.now() - scrapeStart,
        url: searchResult.urls[0],
        nutrition,
      }
    } catch (error) {
      results.leclerc24Scrape = {
        success: false,
        timeMs: Date.now() - scrapeStart,
        error: error instanceof Error ? error.message : String(error),
      }
    }
  }
  
  // Step 3: Test full resolver pipeline
  console.log(`[DEBUG-NUTRITION] Step 3: Testing full resolver pipeline...`)
  const resolveStart = Date.now()
  try {
    const resolveResult = await resolveNutritionWithFallbacks(barcode)
    results.fullResolve = {
      success: resolveResult.hasData,
      timeMs: Date.now() - resolveStart,
      sources: resolveResult.sourceInfo,
      sourceUrls: resolveResult.sourceUrls,
      merged: resolveResult.merged,
      fromOpenFoodFacts: resolveResult.fromOpenFoodFacts || null,
      fromLeclerc: resolveResult.fromLeclerc || null,
      fromLeclerc24: resolveResult.fromLeclerc24 || null,
    }
  } catch (error) {
    results.fullResolve = {
      success: false,
      timeMs: Date.now() - resolveStart,
      error: error instanceof Error ? error.message : String(error),
    }
  }
  
  results.totalTimeMs = Date.now() - searchStart
  
  console.log(`[DEBUG-NUTRITION] ============================================`)
  console.log(`[DEBUG-NUTRITION] Full results:`, JSON.stringify(results, null, 2))
  console.log(`[DEBUG-NUTRITION] ============================================\n`)
  
  return NextResponse.json(results, { status: 200 })
}
