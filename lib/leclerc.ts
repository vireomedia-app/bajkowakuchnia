/**
 * Leclerc.pl scraper for fetching product nutrition data.
 * 
 * This module implements a 2-step scraping process:
 * 1. Search for products by barcode on Leclerc.pl
 * 2. Scrape nutrition data from individual product pages
 * 
 * Units documentation:
 * - Macros (calories, protein, fat, carbs, etc.) are stored in their natural units:
 *   - Calories: kcal
 *   - Protein, fat, saturatedFat, carbohydrates, sugars, salt, fiber: grams (g)
 * - Minerals and vitamins are stored in milligrams (mg):
 *   - Calcium, iron, vitaminC: mg
 * 
 * Note: This must run in Node.js runtime (not Edge) due to external HTTP requests.
 */

import * as cheerio from 'cheerio'

const LECLERC_BASE_URL = 'https://leclerc.com.pl'
const LECLERC24_BASE_URL = 'https://leclerc24.net.pl'
const DEFAULT_TIMEOUT_MS = 15000
const DELAY_BETWEEN_REQUESTS_MS = 200

// Common headers to mimic a browser request
const DEFAULT_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
  'Accept-Language': 'pl-PL,pl;q=0.9,en-US;q=0.8,en;q=0.7',
  'Accept-Encoding': 'gzip, deflate, br',
  'Cache-Control': 'no-cache',
  'Pragma': 'no-cache',
}

export interface LeclercNutritionData {
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
  sourceUrl: string
}

export interface LeclercResolveResult {
  data: LeclercNutritionData
  url: string
}

/**
 * Helper to create a fetch with timeout using AbortController.
 */
async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeoutMs: number = DEFAULT_TIMEOUT_MS
): Promise<Response> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        ...DEFAULT_HEADERS,
        ...options.headers,
      },
    })
    return response
  } finally {
    clearTimeout(timeoutId)
  }
}

/**
 * Helper to sleep for a given number of milliseconds.
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Parse a numeric value from a Polish-formatted string.
 * Supports comma as decimal separator, handles various unit suffixes.
 * 
 * Examples:
 * - "52 kcal" -> 52
 * - "1,6 g" -> 1.6
 * - "0.12 mg" -> 0.12
 * - "< 0,5 g" -> 0.25 (uses half of threshold)
 * - "śladowe ilości" -> 0
 */
function parseNumericValue(text: string | undefined | null): number | null {
  if (!text) return null

  const trimmed = text.trim().toLowerCase()
  
  // Handle "trace amounts" type values
  if (trimmed.includes('śladow') || trimmed.includes('trace') || trimmed === '-' || trimmed === '') {
    return 0
  }

  // Handle "< X" values - use half of the threshold
  const lessThanMatch = trimmed.match(/[<]\s*([\d,\.]+)/)
  if (lessThanMatch) {
    const value = parseFloat(lessThanMatch[1].replace(',', '.'))
    return isNaN(value) ? null : value / 2
  }

  // Extract numeric part (handle comma as decimal separator)
  const numericMatch = trimmed.match(/([\d,\.]+)/)
  if (!numericMatch) return null

  const value = parseFloat(numericMatch[1].replace(',', '.'))
  return isNaN(value) ? null : value
}

/**
 * Parse a Polish number robustly.
 * - Strips all non-numeric characters except digits, comma, dot, minus
 * - Converts comma to dot
 * - Handles inequalities like "<0,5" or "< 0.50000" by extracting just the number
 * 
 * Examples:
 * - "318.00000" -> 318
 * - "79,00000" -> 79
 * - "< 0.50000" -> 0.5
 * - "<0,5 g" -> 0.5
 * - "0.00000" -> 0
 */
function parsePolishNumber(raw: string | undefined | null): number | null {
  if (!raw) return null
  
  const trimmed = raw.trim()
  if (!trimmed) return null
  
  // If the value starts with "<" (e.g., "<0,5 g", "< 1", "<0.1"), treat as 0
  if (trimmed.startsWith('<')) {
    return 0
  }
  
  // Remove everything except digits, comma, dot, minus
  const cleaned = trimmed.replace(/[^0-9,.\-]+/g, '')
  if (!cleaned) return null
  
  // Normalize: convert comma to dot
  const normalized = cleaned.replace(',', '.')
  
  const num = parseFloat(normalized)
  return isNaN(num) ? null : num
}

/**
 * Extract kcal value from combined energy strings like "442 kJ / 105 kcal" or "105 kcal".
 * Falls back to parsePolishNumber if no kcal pattern is found.
 */
function parseCalorieValue(raw: string | undefined | null): number | null {
  if (!raw) return null
  
  const trimmed = raw.trim()
  if (!trimmed) return null
  
  // Try to extract "NNN kcal" from the string (handles "442 kJ / 105 kcal")
  const kcalMatch = trimmed.match(/(\d+[,.]?\d*)\s*kcal/i)
  if (kcalMatch) {
    const normalized = kcalMatch[1].replace(',', '.')
    const num = parseFloat(normalized)
    return isNaN(num) ? null : num
  }
  
  // Fallback: just parse the number
  return parsePolishNumber(trimmed)
}

/**
 * Convert a value based on its unit to our standard units.
 * - For minerals/vitamins that might be in µg, convert to mg.
 */
function normalizeUnit(value: number | null, unit: string): number | null {
  if (value === null) return null
  
  const unitLower = unit.toLowerCase().trim()
  
  // Convert µg to mg
  if (unitLower.includes('µg') || unitLower.includes('mcg') || unitLower.includes('ug')) {
    return value / 1000
  }
  
  // Convert kg to g (unlikely but just in case)
  if (unitLower === 'kg') {
    return value * 1000
  }
  
  // Convert mg - keep as is for calcium, iron, vitaminC
  // Convert g - keep as is for macros
  return value
}

/**
 * Known category/navigation slugs that should be rejected.
 * These appear in the nav menu and are NOT product pages.
 */
const KNOWN_CATEGORY_SLUGS = new Set([
  'wiatrowki',
  'kalendarze-2026',
  'suplementy-diety',
  'odzywki-i-suplementy',
  'witaminy-i-mineraly',
  'soki-syropy-koncentraty',
  'herbaty-ziolowe',
  'napoje-i-zele-energetyczne',
  'zdrowa-zywnosc',
  'bio-i-eko',
  'bez-laktozy',
  'bez-dodatku-cukru',
  'bezglutenowe',
  'sojowe-i-ryzowe',
  'vege',
  'eko-i-natura',
  'srodki-czystosci',
  'kosmetyki',
  'kosmetyki-2',
  'spozywcze',
  'nabial-mrozonki',
  'nabial',
  'mrozonki',
  'sery-i-serki',
  'mieso-i-wedliny',
  'mieso',
  'wedliny-paczkowane',
  'wedliny-na-wage',
  'ryby-garmazeria',
  'ryby-i-przetwory-rybne',
  'garmazeria',
  'owoce-i-warzywa',
  'owoce',
  'warzywa',
  'slodkie-i-slone-przekaski',
  'chipsy-chrupki-przekaski',
  'slodycze',
  'napoje-soki-woda',
  'wody',
  'napoje',
  'soki-nektary',
  'alkohole',
  'wina',
  'piwa',
  'wodki',
  'chemia',
  'higiena',
  'dla-dzieci',
  'dla-zwierzat',
  'dom-i-ogrod',
  'agd',
  'rtv',
  'sport-i-turystyka',
  'motoryzacja',
  'dzemy-miody-owoce-w-zalewie',
  'miody',
  'produkty-promocyjne',
  'nowosci',
  'bestsellery',
])

/**
 * Check if a URL looks like a product page (not a category or nav link).
 */
function isLikelyProductUrl(href: string): boolean {
  let url: URL
  try {
    url = new URL(href, LECLERC_BASE_URL)
  } catch {
    return false
  }

  const path = url.pathname

  // Must be on leclerc.com.pl domain
  if (!url.hostname.includes('leclerc.com.pl')) return false

  // Reject root path
  if (path === '/' || path === '') return false

  // Reject obvious non-product paths
  const rejectPaths = [
    '/szukaj',
    '/konto',
    '/koszyk',
    '/moje',
    '/twoje',
    '/regulamin',
    '/polityka',
    '/pomoc',
    '/kontakt',
    '/o-nas',
    '/logowanie',
    '/rejestracja',
    '/haslo',
    '/newsletter',
    '/dostawa',
    '/platnosci',
    '/metody-platnosci',
    '/cart',
    '/checkout',
    '/produkty/promocje',
  ]
  if (rejectPaths.some(p => path.toLowerCase().startsWith(p))) return false

  // Reject if has query parameters suggesting search/filter
  if (url.search && (url.search.includes('word=') || url.search.includes('cat-'))) return false

  // Get slug (path without leading/trailing slashes)
  const slug = path.replace(/^\/+|\/+$/g, '')

  // Reject empty slugs
  if (!slug) return false

  // Reject known category slugs
  if (KNOWN_CATEGORY_SLUGS.has(slug.toLowerCase())) return false

  // Reject very short slugs (< 10 chars) - likely category pages
  // Product slugs are typically longer like "krolowa-pszczol-miod-nektarowy-wielokwiatowy-1"
  if (slug.length < 10) return false

  // Reject paths with multiple segments (category/subcategory structure)
  const segments = slug.split('/').filter(Boolean)
  if (segments.length > 1) return false

  // Product slugs typically contain hyphens and end with a number or have many hyphens
  const hyphenCount = (slug.match(/-/g) || []).length
  if (hyphenCount < 2) {
    // Few hyphens - likely a category like "miody" or "napoje"
    // But allow if it ends with a digit (product ID pattern)
    if (!/\d$/.test(slug)) return false
  }

  // Accept the rest as potential product URLs
  return true
}

/**
 * Search Leclerc.pl for products matching a barcode.
 * Returns an array of candidate product URLs.
 * 
 * Uses the AJAX search endpoint which returns the actual product listing HTML.
 * Only extracts links from the product listing container (not nav/footer).
 * 
 * @param barcode - The barcode to search for
 * @returns Array of product page URLs (up to 10)
 */
export async function searchLeclercProductUrls(barcode: string): Promise<string[]> {
  // Try multiple search URL patterns (AJAX endpoint may change)
  const searchUrls = [
    `${LECLERC_BASE_URL}/szukaj?word=${encodeURIComponent(barcode)}`,
    `${LECLERC_BASE_URL}/szukaj/search/1?word=${encodeURIComponent(barcode)}`,
  ]
  
  for (const searchUrl of searchUrls) {
    console.log('[Leclerc] Searching:', searchUrl)
    
    try {
      const results = await _searchLeclercWithUrl(searchUrl, barcode)
      if (results.length > 0) return results
    } catch (error) {
      console.error(`[Leclerc] Search failed for URL ${searchUrl}:`, error)
    }
  }
  
  return []
}

async function _searchLeclercWithUrl(searchUrl: string, barcode: string): Promise<string[]> {
  try {
    const response = await fetchWithTimeout(searchUrl, {
      headers: {
        ...DEFAULT_HEADERS,
        'X-Requested-With': 'XMLHttpRequest',
      },
    })
    
    if (!response.ok) {
      console.error(`[Leclerc] Search failed with status ${response.status}`)
      return []
    }
    
    const html = await response.text()
    const $ = cheerio.load(html)
    
    const productUrls = new Set<string>()
    
    // Strategy 1: Find links within product listing containers (most reliable)
    // These are the actual search result product cards
    const productListingSelectors = [
      '.product-listing-name a[href]',           // Product name links
      '.product-listing-figure a[href]',         // Product image links
      '.product-listing a[href]',                // Any link in product listing
      '.l-listing a[href]',                      // Listing container links
      '.ias-container a[href]',                  // Infinite scroll container
    ]
    
    for (const selector of productListingSelectors) {
      $(selector).each((_, element) => {
        const href = $(element).attr('href')
        if (!href) return
        
        // Build absolute URL
        let absoluteUrl: string
        try {
          absoluteUrl = new URL(href, LECLERC_BASE_URL).href
        } catch {
          return // Skip invalid URLs
        }
        
        // Apply URL-level filtering
        if (isLikelyProductUrl(absoluteUrl)) {
          productUrls.add(absoluteUrl)
        }
      })
      
      // If we found products with this selector, don't try broader selectors
      if (productUrls.size > 0) {
        break
      }
    }
    
    // Strategy 2: If no products found in listing containers, fall back to 
    // looking for any links that pass the strict isLikelyProductUrl check
    // but EXCLUDE links from nav, sidebar, footer, and menus
    if (productUrls.size === 0) {
      console.log('[Leclerc] No products in listing container, trying fallback extraction')
      
      // Only look at links NOT in navigation/menu/footer areas
      $('main a[href], .content a[href], article a[href]').each((_, element) => {
        const $el = $(element)
        
        // Skip if inside nav, menu, sidebar, or footer
        if ($el.closest('nav, .sidebar, .main-menu, .submenu, footer, .footer, .aside-menu').length > 0) {
          return
        }
        
        const href = $el.attr('href')
        if (!href) return
        
        let absoluteUrl: string
        try {
          absoluteUrl = new URL(href, LECLERC_BASE_URL).href
        } catch {
          return
        }
        
        if (isLikelyProductUrl(absoluteUrl)) {
          productUrls.add(absoluteUrl)
        }
      })
    }
    
    const results = Array.from(productUrls).slice(0, 10)
    console.log(`[Leclerc] Found ${results.length} candidate product URLs:`, results)
    
    return results
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      console.error('[Leclerc] Search request timed out')
    } else {
      console.error('[Leclerc] Search error:', error)
    }
    return []
  }
}

/**
 * Map a Polish nutrition label to a field name.
 * Handles the "Obliczona wartość odżywcza" table labels which include units in parentheses.
 * Case-insensitive matching.
 * 
 * @param label - The label text from the table (e.g., "Wartość energetyczna (kcal)")
 * @returns The field name or null if not recognized
 */
function mapLeclercLabelToField(label: string): keyof Omit<LeclercNutritionData, 'sourceUrl'> | null {
  const lower = label.toLowerCase().trim()
  
  // Calories: "Wartość energetyczna (kcal)" or just "Wartość energetyczna"
  // (the kcal value may be in the data cell, not the label)
  if (lower.includes('wartość energetyczna') || lower.includes('wartosc energetyczna')) {
    return 'calories'
  }
  if (lower.includes('energia')) {
    return 'calories'
  }
  
  // Fat: "Tłuszcz (g)" - starts with tłuszcz but NOT "kwasy tłuszczowe"
  if (lower.startsWith('tłuszcz') && !lower.includes('kwasy')) {
    return 'fat'
  }
  
  // Saturated fat: "w tym kwasy tłuszczowe nasycone (g)"
  if (lower.includes('kwasy tłuszczowe nasycone') || lower.includes('nasycone')) {
    return 'saturatedFat'
  }
  
  // Carbohydrates: "Węglowodany (g)" - starts with węglowodany but NOT "w tym"
  if (lower.startsWith('węglowodany')) {
    return 'carbohydrates'
  }
  
  // Sugars: "w tym cukry (g)"
  if (lower.includes('w tym cukry') || lower.includes('cukry')) {
    return 'sugars'
  }
  
  // Protein: "Białko (g)"
  if (lower.startsWith('białko') || lower.startsWith('białka')) {
    return 'protein'
  }
  
  // Salt: "Sól (g)"
  if (lower.startsWith('sól')) {
    return 'salt'
  }
  
  // Fiber: "Błonnik (g)"
  if (lower.startsWith('błonnik') || lower.startsWith('włókno')) {
    return 'fiber'
  }
  
  // Minerals and vitamins (less common in this table)
  if (lower.startsWith('wapń')) return 'calcium'
  if (lower.startsWith('żelazo')) return 'iron'
  if (lower.includes('witamina c') || lower.includes('wit. c')) return 'vitaminC'
  
  return null
}

/**
 * Scrape nutrition data from a Leclerc product page.
 * 
 * Primary strategy: Find the "Obliczona wartość odżywcza" heading and parse the table after it.
 * Fallback strategies: Generic table scanning, definition lists, regex patterns.
 * 
 * @param productUrl - The URL of the product page to scrape
 * @param barcode - Optional barcode to verify the product matches
 * @returns Nutrition data or null if not found/parseable
 */
export async function scrapeLeclercNutritionFromProductPage(
  productUrl: string,
  barcode?: string
): Promise<LeclercNutritionData | null> {
  console.log('[Leclerc] Scraping product page:', productUrl)
  
  try {
    const response = await fetchWithTimeout(productUrl)
    
    if (!response.ok) {
      console.error(`[Leclerc] Product page fetch failed with status ${response.status}`)
      return null
    }
    
    const html = await response.text()
    const $ = cheerio.load(html)
    
    // Check if barcode appears on the page (higher confidence)
    const pageText = $.text().toLowerCase()
    const barcodeFound = barcode ? pageText.includes(barcode.toLowerCase()) : false
    if (barcodeFound) {
      console.log('[Leclerc] Barcode found on page - high confidence match')
    }
    
    const nutrition: LeclercNutritionData = {
      sourceUrl: productUrl,
    }
    
    // ==========================================================================
    // STRATEGY 0 (Most reliable): Find .l-table--nutritional-values directly
    // ==========================================================================
    const $directLTable = $('.l-table--nutritional-values').first()
    
    if ($directLTable.length) {
      console.log('[Leclerc] Found nutrition table via .l-table--nutritional-values class')
      
      $directLTable.find('.l-table__row').each((_, row) => {
        const $row = $(row)
        const cells = $row.find('.l-table__cell')
        
        if (cells.length < 2) return
        
        const $labelSpan = $(cells[0]).find('.l-table__text')
        const $valueSpan = $(cells[1]).find('.l-table__text')
        const labelText = ($labelSpan.length ? $labelSpan.text() : $(cells[0]).text()).trim()
        const valueText = ($valueSpan.length ? $valueSpan.text() : $(cells[1]).text()).trim()
        
        const field = mapLeclercLabelToField(labelText)
        if (field) {
          const value = field === 'calories' ? parseCalorieValue(valueText) : parsePolishNumber(valueText)
          if (value !== null) {
            ;(nutrition as any)[field] = value
            console.log(`[Leclerc] Parsed ${field}: ${value}`)
          }
        }
      })
    }
    
    const hasDataAfterStrategy0 = nutrition.calories !== undefined ||
                                   nutrition.protein !== undefined ||
                                   nutrition.fat !== undefined ||
                                   nutrition.carbohydrates !== undefined
    
    if (hasDataAfterStrategy0) {
      console.log('[Leclerc] Successfully extracted nutrition via .l-table--nutritional-values')
      return nutrition
    }
    
    // ==========================================================================
    // STRATEGY 1: Find nutrition heading and table
    // Matches "Obliczona wartość odżywcza", "Wartości odżywcze", etc.
    // ==========================================================================
    let foundObliczonaTable = false
    let foundObliczonaHeading = false
    
    // Find all elements that might contain the heading text
    $('*').each((_, el) => {
      if (foundObliczonaTable) return false // Stop if already found
      
      const $el = $(el)
      const text = $el.clone().children().remove().end().text().trim().toLowerCase()
      
      // Check if this element contains a nutrition heading
      if (text.includes('obliczona wartość odżywcza') || 
          text.includes('obliczona wartosc odzywcza') ||
          text.includes('wartości odżywcze') ||
          text.includes('wartosci odzywcze') ||
          text.includes('wartość odżywcza') ||
          text.includes('wartosc odzywcza')) {
        foundObliczonaHeading = true
        console.log(`[Leclerc] Found nutrition section heading: "${text.substring(0, 60)}"`)
        
        // Find the nearest table after this element
        // Strategy: look in siblings, then parent's siblings, then traverse down
        let $table: ReturnType<typeof $> | null = null
        
        // Try 1: Next sibling is a table
        const $nextSibling = $el.next('table')
        if ($nextSibling.length) {
          $table = $nextSibling
        }
        
        // Try 2: Table inside next sibling
        if (!$table || !$table.length) {
          const $nextEl = $el.next()
          if ($nextEl.length) {
            const $innerTable = $nextEl.find('table').first()
            if ($innerTable.length) {
              $table = $innerTable
            }
          }
        }
        
        // Try 3: Table somewhere after within same parent
        if (!$table || !$table.length) {
          const $parent = $el.parent()
          const $tables = $parent.find('table')
          if ($tables.length) {
            // Find the first table that appears after our element
            $tables.each((_, tbl) => {
              if (!$table || !$table.length) {
                $table = $(tbl)
              }
            })
          }
        }
        
        // Try 4: Look in parent's next sibling
        if (!$table || !$table.length) {
          const $parentNext = $el.parent().next()
          if ($parentNext.length) {
            const $innerTable = $parentNext.is('table') ? $parentNext : $parentNext.find('table').first()
            if ($innerTable.length) {
              $table = $innerTable
            }
          }
        }
        
        // Try 5: Search all following siblings for a table
        if (!$table || !$table.length) {
          $el.nextAll().each((_, sib) => {
            if ($table && $table.length) return false
            const $sib = $(sib)
            if ($sib.is('table')) {
              $table = $sib
              return false
            }
            const $found = $sib.find('table').first()
            if ($found.length) {
              $table = $found
              return false
            }
          })
        }
        
        // Try to find the nutrition data container
        // Leclerc uses div-based "tables" with classes like:
        // <div class="l-table l-table--nutritional-values">
        //   <div class="l-table__row">
        //     <div class="l-table__cell"><span class="l-table__text">Label</span></div>
        //     <div class="l-table__cell"><span class="l-table__text">Value</span></div>
        //   </div>
        // </div>
        
        // Strategy A: Look for div-based table structure (l-table)
        let $nutritionContainer: ReturnType<typeof $> | null = null
        
        // Try 1: Find .l-table--nutritional-values in next siblings
        $el.nextAll().each((_, sib) => {
          if ($nutritionContainer && $nutritionContainer.length) return false
          const $sib = $(sib)
          if ($sib.hasClass('l-table') || $sib.hasClass('l-table--nutritional-values')) {
            $nutritionContainer = $sib
            return false
          }
          const $found = $sib.find('.l-table, .l-table--nutritional-values').first()
          if ($found.length) {
            $nutritionContainer = $found
            return false
          }
        })
        
        // Try 2: Look in parent's next sibling
        if ($nutritionContainer === null || ($nutritionContainer as any).length === 0) {
          const $parentNext = $el.parent().next()
          if ($parentNext.length) {
            if ($parentNext.hasClass('l-table')) {
              $nutritionContainer = $parentNext
            } else {
              const $found = $parentNext.find('.l-table').first()
              if ($found.length) {
                $nutritionContainer = $found
              }
            }
          }
        }
        
        // Try 3: Search all following siblings of parent
        if ($nutritionContainer === null || ($nutritionContainer as any).length === 0) {
          $el.parent().nextAll().each((_, sib) => {
            if ($nutritionContainer !== null && ($nutritionContainer as any).length > 0) return false
            const $sib = $(sib)
            if ($sib.hasClass('l-table')) {
              $nutritionContainer = $sib
              return false
            }
            const $found = $sib.find('.l-table').first()
            if ($found.length) {
              $nutritionContainer = $found
              return false
            }
          })
        }
        
        if ($nutritionContainer && $nutritionContainer.length) {
          console.log('[Leclerc] Found nutrition table (l-table structure)')
          foundObliczonaTable = true
          
          // Parse the div-based table rows
          const rows = $nutritionContainer.find('.l-table__row')
          
          rows.each((rowIdx, row) => {
            const $row = $(row)
            const cells = $row.find('.l-table__cell')
            
            if (cells.length < 2) return
            
            // Get text from span.l-table__text if present, otherwise from cell directly
            const $labelSpan = $(cells[0]).find('.l-table__text')
            const $valueSpan = $(cells[1]).find('.l-table__text')
            const labelText = ($labelSpan.length ? $labelSpan.text() : $(cells[0]).text()).trim()
            const valueText = ($valueSpan.length ? $valueSpan.text() : $(cells[1]).text()).trim()
            
            const field = mapLeclercLabelToField(labelText)
            if (field) {
              const value = field === 'calories' ? parseCalorieValue(valueText) : parsePolishNumber(valueText)
              if (value !== null) {
                ;(nutrition as any)[field] = value
                console.log(`[Leclerc] Parsed ${field}: ${value}`)
              }
            }
          })
        }
        
        // Strategy B: Also try looking for actual <table> elements (fallback)
        if (!foundObliczonaTable) {
          let foundTable: ReturnType<typeof $> | null = null
          
          // Try finding table in siblings
          $el.nextAll().each((_, sib) => {
            if (foundTable !== null && (foundTable as any).length > 0) return false
            const $sib = $(sib)
            if ($sib.is('table')) {
              foundTable = $sib
              return false
            }
            const $found = $sib.find('table').first()
            if ($found.length) {
              foundTable = $found
              return false
            }
          })
          
          if (foundTable !== null && (foundTable as any).length > 0) {
            console.log('[Leclerc] Found nutrition table (HTML table structure)')
            foundObliczonaTable = true
            
            const $tableEl = foundTable as ReturnType<typeof $>
            $tableEl.find('tr').each((rowIdx, row) => {
              const $row = $(row)
              const cells = $row.find('td, th')
              
              if (cells.length < 2) return
              
              const labelText = $(cells[0]).text().trim()
              const valueText = $(cells[1]).text().trim()
              
              const field = mapLeclercLabelToField(labelText)
              if (field) {
                const value = field === 'calories' ? parseCalorieValue(valueText) : parsePolishNumber(valueText)
                if (value !== null) {
                  ;(nutrition as any)[field] = value
                  console.log(`[Leclerc] Parsed ${field}: ${value}`)
                }
              }
            })
          }
        }
        
        return false // Stop searching for heading
      }
    })
    
    // Check if we got data from Strategy 1
    const hasDataAfterStrategy1 = nutrition.calories !== undefined ||
                                   nutrition.protein !== undefined ||
                                   nutrition.fat !== undefined ||
                                   nutrition.carbohydrates !== undefined
    
    if (hasDataAfterStrategy1) {
      console.log('[Leclerc] Successfully extracted nutrition from "Obliczona wartość odżywcza" table')
      return nutrition
    }
    
    // ==========================================================================
    // STRATEGY 2 (Fallback): Look for "Wartości odżywcze" table (descriptive values)
    // This is the first table with values like "1352 kJ/318 kcal", "79 g", etc.
    // ==========================================================================
    console.log('[Leclerc] Strategy 1 failed, trying fallback strategies...')
    
    // Common Polish labels for nutrition values (for fallback strategies)
    const labelMappings: { [key: string]: keyof Omit<LeclercNutritionData, 'sourceUrl'> } = {
      'wartość energetyczna': 'calories',
      'energia': 'calories',
      'kalorie': 'calories',
      'kcal': 'calories',
      'białko': 'protein',
      'białka': 'protein',
      'tłuszcz': 'fat',
      'tłuszcze': 'fat',
      'kwasy tłuszczowe nasycone': 'saturatedFat',
      'nasycone': 'saturatedFat',
      'węglowodany': 'carbohydrates',
      'węglowodanów': 'carbohydrates',
      'cukry': 'sugars',
      'cukier': 'sugars',
      'sól': 'salt',
      'sodu': 'salt', // Will need conversion from sodium
      'błonnik': 'fiber',
      'włókno': 'fiber',
      'wapń': 'calcium',
      'żelazo': 'iron',
      'witamina c': 'vitaminC',
      'wit. c': 'vitaminC',
    }
    
    // Look for any table with nutrition keywords
    $('table').each((_, table) => {
      const $table = $(table)
      const tableText = $table.text().toLowerCase()
      
      // Check if this table contains nutrition info
      const nutritionKeywords = ['wartość odżywcza', 'wartości odżywcze', 'składniki odżywcze', 'informacje żywieniowe', 'na 100', 'białko', 'tłuszcz', 'węglowodany', 'kcal', 'kj']
      const hasNutritionContent = nutritionKeywords.some(kw => tableText.includes(kw))
      
      if (!hasNutritionContent) return
      
      console.log('[Leclerc] Found potential nutrition table (fallback)')
      
      $table.find('tr').each((_, row) => {
        const $row = $(row)
        const cells = $row.find('td, th')
        
        if (cells.length < 2) return
        
        const labelCell = $(cells[0]).text().toLowerCase().trim()
        const valueCell = $(cells[1]).text().trim()
        
        // For "wartość energetyczna" with format "1352 kJ/318 kcal", extract kcal part
        if (labelCell.includes('wartość energetyczna') || labelCell.includes('energia')) {
          const kcalMatch = valueCell.match(/(\d+[,.]?\d*)\s*kcal/i)
          if (kcalMatch && nutrition.calories === undefined) {
            const value = parsePolishNumber(kcalMatch[1])
            if (value !== null) {
              nutrition.calories = value
            }
          }
          return // Continue to next row
        }
        
        // Try to match label to our fields
        for (const [label, field] of Object.entries(labelMappings)) {
          if (labelCell.includes(label)) {
            // Skip if we already have this field
            if ((nutrition as any)[field] !== undefined) break
            
            const value = parsePolishNumber(valueCell)
            if (value !== null) {
              // Handle sodium -> salt conversion (salt = sodium * 2.5)
              if (label === 'sodu') {
                nutrition.salt = value * 2.5
              } else {
                ;(nutrition as any)[field] = value
              }
            }
            break
          }
        }
      })
    })
    
    // ==========================================================================
    // STRATEGY 3: Look for definition lists (dl/dt/dd)
    // ==========================================================================
    $('dl').each((_, dl) => {
      const $dl = $(dl)
      $dl.find('dt').each((idx, dt) => {
        const label = $(dt).text().toLowerCase().trim()
        const $dd = $(dt).next('dd')
        if (!$dd.length) return
        
        const value = $dd.text().trim()
        
        for (const [labelKey, field] of Object.entries(labelMappings)) {
          if (label.includes(labelKey)) {
            // Skip if we already have this field
            if ((nutrition as any)[field] !== undefined) break
            
            const numValue = parsePolishNumber(value)
            if (numValue !== null) {
              if (labelKey === 'sodu') {
                nutrition.salt = numValue * 2.5
              } else {
                ;(nutrition as any)[field] = numValue
              }
            }
            break
          }
        }
      })
    })
    
    // ==========================================================================
    // STRATEGY 4: Look for labeled divs/spans with values
    // Pattern: <span class="label">Białko</span><span class="value">12 g</span>
    // ==========================================================================
    $('[class*="nutrition"], [class*="product-detail"], [class*="specification"], [class*="info"]').each((_, container) => {
      const $container = $(container)
      
      // Look for label-value pairs
      $container.find('[class*="label"], [class*="name"], [class*="title"]').each((_, labelEl) => {
        const $label = $(labelEl)
        const labelText = $label.text().toLowerCase().trim()
        
        // Try to find associated value element
        const $valueEl = $label.next('[class*="value"], [class*="amount"]')
        if (!$valueEl.length) return
        
        const valueText = $valueEl.text().trim()
        
        for (const [label, field] of Object.entries(labelMappings)) {
          if (labelText.includes(label)) {
            // Skip if we already have this field
            if ((nutrition as any)[field] !== undefined) break
            
            const numValue = parsePolishNumber(valueText)
            if (numValue !== null) {
              if (label === 'sodu') {
                nutrition.salt = numValue * 2.5
              } else {
                ;(nutrition as any)[field] = numValue
              }
            }
            break
          }
        }
      })
    })
    
    // ==========================================================================
    // STRATEGY 5: Regex-based extraction from page text
    // Look for patterns like "Białko: 12 g" or "Białko 12g"
    // ==========================================================================
    const textContent = $('body').text()
    const patterns: { regex: RegExp; field: keyof Omit<LeclercNutritionData, 'sourceUrl'> }[] = [
      { regex: /wartość\s*energetyczna[:\s]+(\d+[,.]?\d*)\s*kcal/gi, field: 'calories' },
      { regex: /energia[:\s]+(\d+[,.]?\d*)\s*kcal/gi, field: 'calories' },
      { regex: /białk[oa][:\s]+(\d+[,.]?\d*)\s*g/gi, field: 'protein' },
      { regex: /tłuszcz[e]?[:\s]+(\d+[,.]?\d*)\s*g/gi, field: 'fat' },
      { regex: /(?:kwasy\s*)?(?:tłuszczowe\s*)?nasycone[:\s]+(\d+[,.]?\d*)\s*g/gi, field: 'saturatedFat' },
      { regex: /węglowod[ay]n[óy]?[:\s]+(\d+[,.]?\d*)\s*g/gi, field: 'carbohydrates' },
      { regex: /cukr[y]?[:\s]+(\d+[,.]?\d*)\s*g/gi, field: 'sugars' },
      { regex: /sól[:\s]+(\d+[,.]?\d*)\s*g/gi, field: 'salt' },
      { regex: /błonnik[:\s]+(\d+[,.]?\d*)\s*g/gi, field: 'fiber' },
      { regex: /wapń[:\s]+(\d+[,.]?\d*)\s*mg/gi, field: 'calcium' },
      { regex: /żelazo[:\s]+(\d+[,.]?\d*)\s*mg/gi, field: 'iron' },
      { regex: /witamina\s*c[:\s]+(\d+[,.]?\d*)\s*mg/gi, field: 'vitaminC' },
    ]
    
    for (const { regex, field } of patterns) {
      if ((nutrition as any)[field] !== undefined) continue
      
      const match = textContent.match(regex)
      if (match && match[1]) {
        const value = parsePolishNumber(match[1])
        if (value !== null) {
          ;(nutrition as any)[field] = value
        }
      }
    }
    
    // Check if we found any meaningful data
    const hasData = nutrition.calories !== undefined ||
                    nutrition.protein !== undefined ||
                    nutrition.fat !== undefined ||
                    nutrition.carbohydrates !== undefined
    
    if (!hasData) {
      console.log('[Leclerc] No nutrition data found on page')
      return null
    }
    
    console.log('[Leclerc] Extracted nutrition data:', JSON.stringify(nutrition))
    return nutrition
    
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      console.error('[Leclerc] Product page request timed out')
    } else {
      console.error('[Leclerc] Product page scrape error:', error)
    }
    return null
  }
}

/**
 * Check if nutrition data has sufficient core fields.
 * Requires at least calories + 2 other macros, or all 4 core macros.
 */
function hasMinimumNutritionData(data: LeclercNutritionData): boolean {
  const coreFields = [
    data.calories,
    data.protein,
    data.fat,
    data.carbohydrates,
  ]
  
  const nonNullCount = coreFields.filter(v => v !== null && v !== undefined).length
  
  // Require at least 3 of 4 core fields (calories + 2 macros)
  return nonNullCount >= 3
}

/**
 * Fetch nutrition data from Leclerc.pl by barcode.
 * This performs a 2-step process:
 * 1. Search for products matching the barcode
 * 2. Scrape nutrition from each candidate until we find valid data
 * 
 * @param barcode - The barcode to search for
 * @returns Nutrition data with source URL, or null if not found
 */
export async function fetchLeclercNutritionByBarcode(
  barcode: string
): Promise<LeclercResolveResult | null> {
  console.log(`[Leclerc] Resolving nutrition for barcode: ${barcode}`)
  
  // Step 1: Search for product URLs
  const productUrls = await searchLeclercProductUrls(barcode)
  
  if (productUrls.length === 0) {
    console.log('[Leclerc] No product URLs found')
    return null
  }
  
  // Step 2: Try each candidate (max 5)
  const maxCandidates = Math.min(productUrls.length, 5)
  
  for (let i = 0; i < maxCandidates; i++) {
    const url = productUrls[i]
    
    // Add delay between requests to be polite
    if (i > 0) {
      await sleep(DELAY_BETWEEN_REQUESTS_MS)
    }
    
    const nutrition = await scrapeLeclercNutritionFromProductPage(url, barcode)
    
    if (nutrition && hasMinimumNutritionData(nutrition)) {
      console.log('[Leclerc] Found valid nutrition data from:', url)
      return {
        data: nutrition,
        url: url,
      }
    }
  }
  
  console.log('[Leclerc] No valid nutrition data found from any candidate')
  return null
}

// =============================================================================
// LECLERC24.NET.PL SCRAPER
// =============================================================================

/**
 * Check if a URL looks like a product page on leclerc24.net.pl
 */
function isLikelyLeclerc24ProductUrl(href: string): boolean {
  let url: URL
  try {
    url = new URL(href, LECLERC24_BASE_URL)
  } catch {
    return false
  }

  const path = url.pathname

  // Must be on leclerc24.net.pl domain
  if (!url.hostname.includes('leclerc24.net.pl')) return false

  // Reject root path
  if (path === '/' || path === '') return false

  // Reject obvious non-product paths
  const rejectPaths = [
    '/szukaj',
    '/koszyk',
    '/konto',
    '/login',
    '/rejestracja',
    '/regulamin',
    '/polityka',
    '/kontakt',
    '/o-nas',
    '/dostawa',
    '/platnosci',
    '/kategorie',
    '/promocje',
  ]
  if (rejectPaths.some(p => path.toLowerCase().startsWith(p))) return false

  // Get slug (path without leading/trailing slashes)
  const slug = path.replace(/^\/+|\/+$/g, '')

  // Reject empty slugs
  if (!slug) return false

  // Reject very short slugs (< 10 chars) - likely category pages
  if (slug.length < 10) return false

  // Reject paths with multiple segments (category/subcategory structure)
  const segments = slug.split('/').filter(Boolean)
  if (segments.length > 1) return false

  // Product slugs typically contain hyphens
  const hyphenCount = (slug.match(/-/g) || []).length
  if (hyphenCount < 2) return false

  return true
}

/**
 * Search Leclerc24.net.pl for products matching a barcode.
 * Returns an array of candidate product URLs.
 * 
 * @param barcode - The barcode to search for
 * @returns Array of product page URLs (up to 10)
 */
export async function searchLeclerc24ProductUrls(barcode: string): Promise<string[]> {
  // Leclerc24 uses a search URL pattern like: /szukaj?word=BARCODE
  const searchUrl = `${LECLERC24_BASE_URL}/szukaj?word=${encodeURIComponent(barcode)}`
  
  console.log(`[Leclerc24-Search] ========================================`)
  console.log(`[Leclerc24-Search] Searching for barcode: ${barcode}`)
  console.log(`[Leclerc24-Search] URL: ${searchUrl}`)
  console.log(`[Leclerc24-Search] Timeout: 25000ms`)
  
  const startTime = Date.now()
  
  try {
    const response = await fetchWithTimeout(searchUrl, {
      headers: {
        ...DEFAULT_HEADERS,
      },
    }, 25000) // Leclerc24 search can be very slow (~8s+)
    
    const elapsed = Date.now() - startTime
    console.log(`[Leclerc24-Search] Response received in ${elapsed}ms`)
    console.log(`[Leclerc24-Search] HTTP Status: ${response.status} ${response.statusText}`)
    console.log(`[Leclerc24-Search] Content-Type: ${response.headers.get('content-type')}`)
    
    if (!response.ok) {
      console.error(`[Leclerc24-Search] FAILED: HTTP ${response.status} ${response.statusText}`)
      return []
    }
    
    const html = await response.text()
    console.log(`[Leclerc24-Search] HTML body received: ${html.length} characters`)
    
    if (html.length < 500) {
      console.warn(`[Leclerc24-Search] WARNING: HTML body suspiciously small (${html.length} chars). Possibly blocked or error page.`)
    }
    
    const $ = cheerio.load(html)
    
    const productUrls = new Set<string>()
    
    // Strategy 1: Find links within product listing containers
    const productListingSelectors = [
      '.product-listing-name a[href]',
      '.product-listing-figure a[href]',
      '.product-listing a[href]',
      '.l-listing a[href]',
      '.products-list a[href]',
      '.product-item a[href]',
      '.product-card a[href]',
      '[class*="product"] a[href]',
    ]
    
    for (const selector of productListingSelectors) {
      const matches = $(selector)
      if (matches.length > 0) {
        console.log(`[Leclerc24-Search] Selector "${selector}" matched ${matches.length} elements`)
      }
      matches.each((_, element) => {
        const href = $(element).attr('href')
        if (!href) return
        
        let absoluteUrl: string
        try {
          absoluteUrl = new URL(href, LECLERC24_BASE_URL).href
        } catch {
          return
        }
        
        if (isLikelyLeclerc24ProductUrl(absoluteUrl)) {
          productUrls.add(absoluteUrl)
        }
      })
      
      if (productUrls.size > 0) {
        console.log(`[Leclerc24-Search] Found ${productUrls.size} product URL(s) via "${selector}"`)
        break
      }
    }
    
    // Strategy 2: Fallback - look at all links in main content
    if (productUrls.size === 0) {
      console.log('[Leclerc24-Search] No products in listing container, trying fallback link extraction...')
      
      $('main a[href], .content a[href], article a[href], body a[href]').each((_, element) => {
        const $el = $(element)
        
        // Skip navigation/footer
        if ($el.closest('nav, .sidebar, .main-menu, .submenu, footer, .footer, header').length > 0) {
          return
        }
        
        const href = $el.attr('href')
        if (!href) return
        
        let absoluteUrl: string
        try {
          absoluteUrl = new URL(href, LECLERC24_BASE_URL).href
        } catch {
          return
        }
        
        if (isLikelyLeclerc24ProductUrl(absoluteUrl)) {
          productUrls.add(absoluteUrl)
        }
      })
      
      if (productUrls.size === 0) {
        console.log('[Leclerc24-Search] Product not found on Leclerc24 - no matching product URLs in search results')
        // Log a snippet of the page title to help debug
        const pageTitle = $('title').text().trim()
        console.log(`[Leclerc24-Search] Page title: "${pageTitle}"`)
      }
    }
    
    const results = Array.from(productUrls).slice(0, 10)
    console.log(`[Leclerc24-Search] Final result: ${results.length} candidate URLs:`, results)
    console.log(`[Leclerc24-Search] ========================================`)
    
    return results
  } catch (error) {
    const elapsed = Date.now() - startTime
    if (error instanceof Error && error.name === 'AbortError') {
      console.error(`[Leclerc24-Search] TIMEOUT after ${elapsed}ms - search request aborted`)
    } else {
      console.error(`[Leclerc24-Search] ERROR after ${elapsed}ms:`, error instanceof Error ? error.message : error)
    }
    return []
  }
}

/**
 * Scrape nutrition data from a Leclerc24 product page.
 * The page structure is similar to leclerc.com.pl with "Wartości odżywcze" 
 * and "Obliczona wartość odżywcza" tables.
 * 
 * @param productUrl - The URL of the product page to scrape
 * @param barcode - Optional barcode to verify the product matches
 * @returns Nutrition data or null if not found/parseable
 */
export async function scrapeLeclerc24NutritionFromProductPage(
  productUrl: string,
  barcode?: string
): Promise<LeclercNutritionData | null> {
  console.log(`[Leclerc24-Scrape] ========================================`)
  console.log(`[Leclerc24-Scrape] Scraping product page: ${productUrl}`)
  console.log(`[Leclerc24-Scrape] Barcode: ${barcode || 'not provided'}`)
  console.log(`[Leclerc24-Scrape] Timeout: 25000ms`)
  
  const startTime = Date.now()
  
  try {
    const response = await fetchWithTimeout(productUrl, {}, 25000) // Leclerc24 can be slow
    
    const elapsed = Date.now() - startTime
    console.log(`[Leclerc24-Scrape] Response received in ${elapsed}ms`)
    console.log(`[Leclerc24-Scrape] HTTP Status: ${response.status} ${response.statusText}`)
    console.log(`[Leclerc24-Scrape] Content-Type: ${response.headers.get('content-type')}`)
    
    if (!response.ok) {
      console.error(`[Leclerc24-Scrape] FAILED: HTTP ${response.status} ${response.statusText}`)
      return null
    }
    
    const html = await response.text()
    console.log(`[Leclerc24-Scrape] HTML body received: ${html.length} characters`)
    
    if (html.length < 1000) {
      console.warn(`[Leclerc24-Scrape] WARNING: HTML body very small (${html.length} chars) - possible error/blocked page`)
    }
    
    const $ = cheerio.load(html)
    
    // Log page title for confirmation
    const pageTitle = $('title').text().trim()
    console.log(`[Leclerc24-Scrape] Page title: "${pageTitle}"`)
    
    // Check if barcode appears on the page
    const pageText = $.text()
    const barcodeFound = barcode ? pageText.includes(barcode) : false
    console.log(`[Leclerc24-Scrape] Barcode "${barcode}" found on page: ${barcodeFound}`)
    
    const nutrition: LeclercNutritionData = {
      sourceUrl: productUrl,
    }
    
    /**
     * Helper to parse a row from the l-table structure.
     * Handles special cases like "442 kJ / 105 kcal" for energy values.
     */
    const parseLTableRow = (labelText: string, valueText: string) => {
      const field = mapLeclercLabelToField(labelText)
      console.log(`[Leclerc24-Scrape]   Row: label="${labelText}" value="${valueText}" -> field=${field || 'UNMAPPED'}`)
      
      if (!field) return
      
      // For calories, use the specialized parser that extracts kcal from "kJ / kcal" format
      if (field === 'calories') {
        const value = parseCalorieValue(valueText)
        console.log(`[Leclerc24-Scrape]   parseCalorieValue("${valueText}") = ${value}`)
        if (value !== null && nutrition.calories === undefined) {
          nutrition.calories = value
          console.log(`[Leclerc24-Scrape]   >> SET calories = ${value}`)
        }
        return
      }
      
      const value = parsePolishNumber(valueText)
      console.log(`[Leclerc24-Scrape]   parsePolishNumber("${valueText}") = ${value}`)
      if (value !== null && (nutrition as any)[field] === undefined) {
        ;(nutrition as any)[field] = value
        console.log(`[Leclerc24-Scrape]   >> SET ${field} = ${value}`)
      }
    }
    
    // ==========================================================================
    // STRATEGY 0 (Most reliable): Find .l-table--nutritional-values directly
    // ==========================================================================
    console.log(`[Leclerc24-Scrape] --- STRATEGY 0: Direct CSS class lookup ---`)
    const $directTable = $('.l-table--nutritional-values').first()
    console.log(`[Leclerc24-Scrape] .l-table--nutritional-values found: ${$directTable.length > 0}`)
    
    if ($directTable.length) {
      const rows = $directTable.find('.l-table__row')
      console.log(`[Leclerc24-Scrape] Rows in nutrition table: ${rows.length}`)
      
      rows.each((idx, row) => {
        const $row = $(row)
        const cells = $row.find('.l-table__cell')
        
        console.log(`[Leclerc24-Scrape]  Row[${idx}]: ${cells.length} cell(s)`)
        if (cells.length < 2) return
        
        const $labelSpan = $(cells[0]).find('.l-table__text')
        const $valueSpan = $(cells[1]).find('.l-table__text')
        const labelText = ($labelSpan.length ? $labelSpan.text() : $(cells[0]).text()).trim()
        const valueText = ($valueSpan.length ? $valueSpan.text() : $(cells[1]).text()).trim()
        
        parseLTableRow(labelText, valueText)
      })
    }
    
    // Check if Strategy 0 found data
    const hasDataAfterStrategy0 = nutrition.calories !== undefined ||
                                   nutrition.protein !== undefined ||
                                   nutrition.fat !== undefined ||
                                   nutrition.carbohydrates !== undefined
    
    console.log(`[Leclerc24-Scrape] Strategy 0 result: hasData=${hasDataAfterStrategy0}`)
    
    if (hasDataAfterStrategy0) {
      console.log(`[Leclerc24-Scrape] SUCCESS via Strategy 0 (.l-table--nutritional-values)`)
      console.log(`[Leclerc24-Scrape] Final nutrition:`, JSON.stringify(nutrition, null, 2))
      console.log(`[Leclerc24-Scrape] ========================================`)
      return nutrition
    }
    
    // ==========================================================================
    // STRATEGY 1: Find nutrition heading and nearby l-table
    // Matches "Wartości odżywcze", "Obliczona wartość odżywcza", etc.
    // ==========================================================================
    console.log(`[Leclerc24-Scrape] --- STRATEGY 1: Heading text search ---`)
    let foundNutritionTable = false
    
    // Check for known section headers
    const sectionHeaders = $('h1, h2, h3, h4, h5, h6, .c-product-section-header__title')
    console.log(`[Leclerc24-Scrape] Section headers on page: ${sectionHeaders.length}`)
    sectionHeaders.each((i, el) => {
      const tag = 'tagName' in el ? (el as any).tagName : 'unknown'
      console.log(`[Leclerc24-Scrape]   Header[${i}]: <${tag}> "${$(el).text().trim().substring(0, 80)}"`)
    })
    
    // Also check what l-table elements exist on the page
    const allLTables = $('.l-table')
    console.log(`[Leclerc24-Scrape] .l-table elements on page: ${allLTables.length}`)
    allLTables.each((i, el) => {
      const classes = $(el).attr('class') || ''
      const textPreview = $(el).text().trim().substring(0, 100).replace(/\s+/g, ' ')
      console.log(`[Leclerc24-Scrape]   l-table[${i}]: class="${classes}" text="${textPreview}..."`)
    })
    
    $('*').each((_, el) => {
      if (foundNutritionTable) return false
      
      const $el = $(el)
      const text = $el.clone().children().remove().end().text().trim().toLowerCase()
      
      if (text.includes('obliczona wartość odżywcza') || 
          text.includes('obliczona wartosc odzywcza') ||
          text.includes('wartości odżywcze') ||
          text.includes('wartosci odzywcze') ||
          text.includes('wartość odżywcza') ||
          text.includes('wartosc odzywcza')) {
        const tagName = 'tagName' in el ? (el as any).tagName : 'unknown'
        console.log(`[Leclerc24-Scrape] Found nutrition heading: <${tagName}> "${text.substring(0, 80)}"`)
        
        // Look for nutrition table (div-based l-table structure)
        let $nutritionContainer: ReturnType<typeof $> | null = null
        
        // Try finding in next siblings
        $el.nextAll().each((_, sib) => {
          if ($nutritionContainer && $nutritionContainer.length) return false
          const $sib = $(sib)
          if ($sib.hasClass('l-table') || $sib.hasClass('l-table--nutritional-values')) {
            $nutritionContainer = $sib
            console.log(`[Leclerc24-Scrape] Found l-table in next sibling`)
            return false
          }
          const $found = $sib.find('.l-table, .l-table--nutritional-values').first()
          if ($found.length) {
            $nutritionContainer = $found
            console.log(`[Leclerc24-Scrape] Found l-table inside next sibling`)
            return false
          }
        })
        
        // Try parent's next sibling
        if ($nutritionContainer === null || ($nutritionContainer as any).length === 0) {
          const $parentNext = $el.parent().next()
          if ($parentNext.length) {
            if ($parentNext.hasClass('l-table') || $parentNext.hasClass('l-table--nutritional-values')) {
              $nutritionContainer = $parentNext
              console.log(`[Leclerc24-Scrape] Found l-table as parent's next sibling`)
            } else {
              const $found = $parentNext.find('.l-table, .l-table--nutritional-values').first()
              if ($found.length) {
                $nutritionContainer = $found
                console.log(`[Leclerc24-Scrape] Found l-table inside parent's next sibling`)
              }
            }
          }
        }
        
        // Try all following siblings of parent
        if ($nutritionContainer === null || ($nutritionContainer as any).length === 0) {
          $el.parent().nextAll().each((_, sib) => {
            if ($nutritionContainer !== null && ($nutritionContainer as any).length > 0) return false
            const $sib = $(sib)
            if ($sib.hasClass('l-table') || $sib.hasClass('l-table--nutritional-values')) {
              $nutritionContainer = $sib
              console.log(`[Leclerc24-Scrape] Found l-table in parent's following siblings`)
              return false
            }
            const $found = $sib.find('.l-table, .l-table--nutritional-values').first()
            if ($found.length) {
              $nutritionContainer = $found
              console.log(`[Leclerc24-Scrape] Found l-table inside parent's following siblings`)
              return false
            }
          })
        }
        
        if ($nutritionContainer && $nutritionContainer.length) {
          foundNutritionTable = true
          const rows = $nutritionContainer.find('.l-table__row')
          console.log(`[Leclerc24-Scrape] Nutrition l-table found with ${rows.length} rows`)
          
          rows.each((_, row) => {
            const $row = $(row)
            const cells = $row.find('.l-table__cell')
            
            if (cells.length < 2) return
            
            const $labelSpan = $(cells[0]).find('.l-table__text')
            const $valueSpan = $(cells[1]).find('.l-table__text')
            const labelText = ($labelSpan.length ? $labelSpan.text() : $(cells[0]).text()).trim()
            const valueText = ($valueSpan.length ? $valueSpan.text() : $(cells[1]).text()).trim()
            
            parseLTableRow(labelText, valueText)
          })
        } else {
          console.log(`[Leclerc24-Scrape] Heading found but no l-table nearby`)
        }
        
        // Also try HTML table structure
        if (!foundNutritionTable) {
          let foundTable: ReturnType<typeof $> | null = null
          
          $el.nextAll().each((_, sib) => {
            if (foundTable !== null && (foundTable as any).length > 0) return false
            const $sib = $(sib)
            if ($sib.is('table')) {
              foundTable = $sib
              return false
            }
            const $found = $sib.find('table').first()
            if ($found.length) {
              foundTable = $found
              return false
            }
          })
          
          if (foundTable !== null && (foundTable as any).length > 0) {
            console.log('[Leclerc24-Scrape] Found nutrition HTML <table>')
            foundNutritionTable = true
            
            const $tableEl = foundTable as ReturnType<typeof $>
            $tableEl.find('tr').each((_, row) => {
              const $row = $(row)
              const cells = $row.find('td, th')
              
              if (cells.length < 2) return
              
              const labelText = $(cells[0]).text().trim()
              const valueText = $(cells[1]).text().trim()
              
              parseLTableRow(labelText, valueText)
            })
          }
        }
        
        return false // Stop searching
      }
    })
    
    // Check if we got data from Strategy 1
    const hasDataAfterStrategy1 = nutrition.calories !== undefined ||
                                   nutrition.protein !== undefined ||
                                   nutrition.fat !== undefined ||
                                   nutrition.carbohydrates !== undefined
    
    console.log(`[Leclerc24-Scrape] Strategy 1 result: hasData=${hasDataAfterStrategy1}`)
    
    if (hasDataAfterStrategy1) {
      console.log(`[Leclerc24-Scrape] SUCCESS via Strategy 1 (heading search)`)
      console.log(`[Leclerc24-Scrape] Final nutrition:`, JSON.stringify(nutrition, null, 2))
      console.log(`[Leclerc24-Scrape] ========================================`)
      return nutrition
    }
    
    // ==========================================================================
    // STRATEGY 2 (Fallback): Look for any div.l-table or <table> with nutrition content
    // ==========================================================================
    console.log(`[Leclerc24-Scrape] --- STRATEGY 2: Keyword scan in all tables ---`)
    
    // 2a: Check any div.l-table elements
    $('.l-table').each((_, ltable) => {
      const $ltable = $(ltable)
      const ltableText = $ltable.text().toLowerCase()
      
      const nutritionKeywords = ['wartość odżywcza', 'wartości odżywcze', 'na 100', 'białko', 'tłuszcz', 'węglowodany', 'kcal']
      const hasNutritionContent = nutritionKeywords.some(kw => ltableText.includes(kw))
      
      if (!hasNutritionContent) return
      
      console.log('[Leclerc24-Scrape] Found potential nutrition l-table (fallback)')
      
      $ltable.find('.l-table__row').each((_, row) => {
        const $row = $(row)
        const cells = $row.find('.l-table__cell')
        
        if (cells.length < 2) return
        
        const $labelSpan = $(cells[0]).find('.l-table__text')
        const $valueSpan = $(cells[1]).find('.l-table__text')
        const labelText = ($labelSpan.length ? $labelSpan.text() : $(cells[0]).text()).trim()
        const valueText = ($valueSpan.length ? $valueSpan.text() : $(cells[1]).text()).trim()
        
        parseLTableRow(labelText, valueText)
      })
    })
    
    // 2b: Look for any HTML <table> with nutrition keywords
    $('table').each((_, table) => {
      const $table = $(table)
      const tableText = $table.text().toLowerCase()
      
      const nutritionKeywords = ['wartość odżywcza', 'wartości odżywcze', 'na 100', 'białko', 'tłuszcz', 'węglowodany', 'kcal']
      const hasNutritionContent = nutritionKeywords.some(kw => tableText.includes(kw))
      
      if (!hasNutritionContent) return
      
      console.log('[Leclerc24-Scrape] Found potential nutrition HTML table (fallback)')
      
      $table.find('tr').each((_, row) => {
        const $row = $(row)
        const cells = $row.find('td, th')
        
        if (cells.length < 2) return
        
        const labelText = $(cells[0]).text().trim()
        const valueText = $(cells[1]).text().trim()
        
        parseLTableRow(labelText, valueText)
      })
    })
    
    // Check if we found any meaningful data
    const hasData = nutrition.calories !== undefined ||
                    nutrition.protein !== undefined ||
                    nutrition.fat !== undefined ||
                    nutrition.carbohydrates !== undefined
    
    console.log(`[Leclerc24-Scrape] Strategy 2 result: hasData=${hasData}`)
    
    if (!hasData) {
      console.log('[Leclerc24-Scrape] Product found, but nutrition table missing - no parseable nutrition data on page')
      console.log(`[Leclerc24-Scrape] ========================================`)
      return null
    }
    
    console.log(`[Leclerc24-Scrape] SUCCESS via Strategy 2 (fallback)`)
    console.log(`[Leclerc24-Scrape] Final nutrition:`, JSON.stringify(nutrition, null, 2))
    console.log(`[Leclerc24-Scrape] ========================================`)
    return nutrition
    
  } catch (error) {
    const elapsed = Date.now() - startTime
    if (error instanceof Error && error.name === 'AbortError') {
      console.error(`[Leclerc24-Scrape] TIMEOUT after ${elapsed}ms - product page request aborted`)
    } else {
      console.error(`[Leclerc24-Scrape] ERROR after ${elapsed}ms:`, error instanceof Error ? `${error.name}: ${error.message}` : error)
    }
    return null
  }
}

/**
 * Fetch nutrition data from Leclerc24.net.pl by barcode.
 * 
 * @param barcode - The barcode to search for
 * @returns Nutrition data with source URL, or null if not found
 */
export async function fetchLeclerc24NutritionByBarcode(
  barcode: string
): Promise<LeclercResolveResult | null> {
  console.log(`[Leclerc24] ================================================`)
  console.log(`[Leclerc24] fetchLeclerc24NutritionByBarcode("${barcode}")`)
  console.log(`[Leclerc24] ================================================`)
  
  const totalStart = Date.now()
  
  // Step 1: Search for product URLs
  console.log(`[Leclerc24] Step 1: Searching for product URLs...`)
  const productUrls = await searchLeclerc24ProductUrls(barcode)
  
  if (productUrls.length === 0) {
    console.log('[Leclerc24] RESULT: No product URLs found on Leclerc24 for this barcode')
    console.log(`[Leclerc24] Total time: ${Date.now() - totalStart}ms`)
    return null
  }
  
  console.log(`[Leclerc24] Step 2: Scraping ${productUrls.length} candidate page(s)...`)
  
  // Step 2: Try each candidate (max 5)
  const maxCandidates = Math.min(productUrls.length, 5)
  
  for (let i = 0; i < maxCandidates; i++) {
    const url = productUrls[i]
    console.log(`[Leclerc24] Candidate ${i + 1}/${maxCandidates}: ${url}`)
    
    // Add delay between requests
    if (i > 0) {
      await sleep(DELAY_BETWEEN_REQUESTS_MS)
    }
    
    const nutrition = await scrapeLeclerc24NutritionFromProductPage(url, barcode)
    
    if (nutrition) {
      const hasMin = hasMinimumNutritionData(nutrition)
      console.log(`[Leclerc24] Nutrition from candidate ${i + 1}: calories=${nutrition.calories}, protein=${nutrition.protein}, fat=${nutrition.fat}, carbs=${nutrition.carbohydrates}`)
      console.log(`[Leclerc24] hasMinimumNutritionData: ${hasMin} (need >=3 of 4 core fields)`)
      
      if (hasMin) {
        console.log(`[Leclerc24] SUCCESS: Found valid nutrition data from: ${url}`)
        console.log(`[Leclerc24] Total time: ${Date.now() - totalStart}ms`)
        return {
          data: nutrition,
          url: url,
        }
      } else {
        console.log(`[Leclerc24] Candidate ${i + 1} has insufficient data, trying next...`)
      }
    } else {
      console.log(`[Leclerc24] Candidate ${i + 1} returned null`)
    }
  }
  
  console.log('[Leclerc24] RESULT: No valid nutrition data found from any candidate page')
  console.log(`[Leclerc24] Total time: ${Date.now() - totalStart}ms`)
  return null
}
