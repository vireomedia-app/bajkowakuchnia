/**
 * POST /api/deliveries/parse-wz
 *
 * Accepts OCR text (extracted client-side) from a delivery note
 * (WZ / Faktura VAT), sends it to RouteLLM **text** model to parse
 * structured product lines, then fuzzy-matches each item against
 * existing products in the database.
 *
 * Request body (JSON):
 *   { ocrText: string, originalFileName?: string, documentNameHint?: string }
 *
 * Returns (JSON):
 *   { documentNumber: string | null, items: MatchedItem[], warning?: string }
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import Fuse from 'fuse.js'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ExtractedItem {
  rawLine?: string
  name: string
  quantity: number
  unit: string
}

interface MatchedItem {
  rawName: string
  quantity: number
  unit: string
  matchedProductId: string | null
  matchedProductName: string | null
  matchedProductUnit: string | null
  confidence: 'exact' | 'partial' | 'none'
  suggestions: { id: string; name: string; unit: string; score: number }[]
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Normalise a Polish product name for better matching. */
function normalise(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-ząćęłńóśźżA-ZĄĆĘŁŃÓŚŹŻ0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Common / noise words that should be ignored during keyword matching.
 * Includes units, weights, packaging terms, and very short filler words.
 */
const STOP_WORDS = new Set([
  // units & weights
  'szt', 'kg', 'op', 'opak', 'but', 'l', 'ml', 'g', 'dag',
  '1kg', '2kg', '5kg', '10kg', '500g', '250g', '100g', '400g', '200g', '300g', '1l', '2l',
  // common filler
  'do', 'na', 'ze', 'od', 'za', 'po', 'we', 'lub', 'bez', 'dla',
  'nie', 'tak', 'nr', 'lp', 'poz', 'vat', 'netto', 'brutto',
  'cena', 'kwota', 'suma', 'razem', 'wartosc', 'wartość',
])

/**
 * Extract significant keywords from a product name.
 * Removes noise words, short tokens, and numeric-only tokens.
 */
function extractKeywords(name: string): string[] {
  return normalise(name)
    .split(' ')
    .filter((w) => {
      if (w.length < 3) return false
      if (STOP_WORDS.has(w)) return false
      // Skip pure numbers or weight patterns like "1,5" or "0.5"
      if (/^\d+([.,]\d+)?$/.test(w)) return false
      return true
    })
}

/** Default model when ROUTELLM_TEXT_MODEL env var is not set. */
const DEFAULT_TEXT_MODEL = 'gpt-4o-mini'

/** Build the system prompt for text-only LLM parsing. */
function buildPrompt(): string {
  return `Jesteś parserem tekstu OCR z polskich dokumentów magazynowych (WZ, Faktura VAT, dokument dostawy).

TWOJE ZADANIE: Przeanalizuj surowy tekst OCR i wyciągnij listę pozycji produktowych.

KRYTYCZNE ZASADY:
1. Wyciągaj TYLKO to, co jest obecne w tekście. NIE WYMYŚLAJ marek, produktów ani ilości których nie ma w tekście.
2. Tekst pochodzi z OCR silnika angielskiego - polskie znaki diakrytyczne mogą być zastąpione ASCII (a zamiast ą, c zamiast ć, e zamiast ę, l zamiast ł, n zamiast ń, o zamiast ó, s zamiast ś, z zamiast ź/ż). Zrekonstruuj poprawne polskie nazwy na podstawie kontekstu.
3. Jeśli linia nie wygląda na pozycję produktową (np. nagłówki, stopki, sumy, dane firmy, adresy), POMIŃ ją.
4. Nie dodawaj produktów, których nie ma w tekście!

Dla każdej pozycji produktowej podaj:
- "rawLine": oryginalny fragment linii z tekstu OCR (tak jak jest, bez zmian)
- "name": OCZYSZCZONA nazwa produktu (zasady czyszczenia poniżej)
- "quantity": ilość (liczba). Jeśli nie odczytano, wpisz 0.
- "unit": znormalizowana jednostka: "szt", "kg", "g", "l", "ml", "opak". Domyślnie "szt".

### ZASADY CZYSZCZENIA NAZWY:
1. USUŃ kody wewnętrzne dostawcy (np. M004297, K00123, P-5544)
2. USUŃ numery PKWiU (np. 10.13.14, 15.81.11)
3. USUŃ ceny, kwoty, stawki VAT
4. USUŃ numery pozycji i numerację (1., Lp. 2, Poz. 3)
5. ZACHOWAJ markę/producenta, nazwę produktu, wariant, smak, rozmiar opakowania
6. Przywróć polskie znaki diakrytyczne w nazwie (np. "Maslo" → "Masło", "Miod" → "Miód")

### PRZYKŁADY:
Linia OCR: "1 M004297 CD Miod Wielokwiatowy 1kg 15 szt 12,50"
→ { "rawLine": "1 M004297 CD Miod Wielokwiatowy 1kg 15 szt 12,50", "name": "CD Miód Wielokwiatowy 1kg", "quantity": 15, "unit": "szt" }

Linia OCR: "2 K00556 Maslo Extra 82% 200g Mlekovita 10 szt"
→ { "rawLine": "2 K00556 Maslo Extra 82% 200g Mlekovita 10 szt", "name": "Masło Extra 82% 200g Mlekovita", "quantity": 10, "unit": "szt" }

Linia OCR: "3. Pudliszki Fasola Czerwona 400g szt 12,50"
→ { "rawLine": "3. Pudliszki Fasola Czerwona 400g szt 12,50", "name": "Pudliszki Fasola Czerwona 400g", "quantity": 1, "unit": "szt" }

Szukaj również numeru dokumentu (WZ/..., FV/..., FA/...). Jeśli jest widoczny, dodaj w polu "documentNumber".

Odpowiedz WYŁĄCZNIE czystym JSON (bez bloków kodu, bez markdown, bez komentarzy):
{
  "documentNumber": "numer dokumentu lub null",
  "items": [
    { "rawLine": "...", "name": "...", "quantity": 0, "unit": "szt" }
  ]
}

KLUCZOWE:
- NIE WYMYŚLAJ produktów! Wyciągaj TYLKO to, co widzisz w tekście OCR.
- Ilości ułamkowe zapisuj jako liczby dziesiętne (1,5 → 1.5).
- Jeśli tekst jest nieczytelny lub nie zawiera pozycji, zwróć pustą listę items: [].`
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  const start = Date.now()

  try {
    // -------------------------------------------------------------------
    // 1. Parse JSON body
    // -------------------------------------------------------------------
    let body: { ocrText?: string; originalFileName?: string; documentNameHint?: string }
    try {
      body = await request.json()
    } catch {
      return NextResponse.json(
        { error: 'Nieprawidłowe dane wejściowe. Oczekiwano JSON.' },
        { status: 400 },
      )
    }

    const { ocrText, originalFileName } = body

    if (!ocrText || typeof ocrText !== 'string' || ocrText.trim().length < 10) {
      return NextResponse.json(
        {
          error: 'Tekst OCR jest zbyt krótki lub pusty. Spróbuj z wyraźniejszym zdjęciem.',
          documentNumber: null,
          items: [],
        },
        { status: 400 },
      )
    }

    const trimmedText = ocrText.trim()
    console.log(
      `[parse-wz] OCR text received (${trimmedText.length} chars) from "${originalFileName || 'unknown'}"`,
    )
    console.log(`[parse-wz] First 300 chars: ${trimmedText.substring(0, 300)}`)

    // -------------------------------------------------------------------
    // 2. Call RouteLLM Text Model (no vision, no image)
    // -------------------------------------------------------------------
    const apiKey = process.env.ABACUSAI_API_KEY
    if (!apiKey) {
      console.error('[parse-wz] ABACUSAI_API_KEY is not set')
      return NextResponse.json(
        { error: 'Brak klucza API. Skontaktuj się z administratorem.' },
        { status: 500 },
      )
    }

    const model = process.env.ROUTELLM_TEXT_MODEL || DEFAULT_TEXT_MODEL
    console.log(`[parse-wz] Calling RouteLLM text model: ${model}`)

    const llmResponse = await fetch('https://routellm.abacus.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: buildPrompt() },
          {
            role: 'user',
            content: `Przeanalizuj poniższy tekst OCR z dokumentu dostawy i wyciągnij pozycje produktowe w formacie JSON.\n\n--- TEKST OCR ---\n${trimmedText}\n--- KONIEC ---`,
          },
        ],
        max_tokens: 4000,
        temperature: 0,
      }),
    })

    if (!llmResponse.ok) {
      const errText = await llmResponse.text()
      console.error(`[parse-wz] RouteLLM API error ${llmResponse.status}: ${errText}`)
      // Return a valid response so the user can still add items manually
      return NextResponse.json({
        documentNumber: null,
        items: [],
        warning: `Błąd API (${llmResponse.status}). Dodaj pozycje ręcznie.`,
      })
    }

    const llmData = await llmResponse.json()
    const rawContent = llmData.choices?.[0]?.message?.content ?? ''

    console.log(
      `[parse-wz] Raw LLM response (${rawContent.length} chars): ${rawContent.substring(0, 500)}`,
    )

    // -------------------------------------------------------------------
    // 3. Parse the JSON response
    // -------------------------------------------------------------------
    let parsed: { documentNumber?: string | null; items: ExtractedItem[] }

    try {
      // Strip markdown code fences if present
      let cleaned = rawContent.trim()
      if (cleaned.startsWith('```')) {
        cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '')
      }
      parsed = JSON.parse(cleaned)
    } catch (parseErr) {
      console.error('[parse-wz] Failed to parse LLM JSON:', parseErr)
      // Return valid response so user can proceed manually
      return NextResponse.json({
        documentNumber: null,
        items: [],
        warning:
          'Nie udało się odczytać pozycji z tekstu. Spróbuj lepszego zdjęcia lub dodaj ręcznie.',
      })
    }

    if (!Array.isArray(parsed.items)) {
      parsed.items = []
    }

    console.log(
      `[parse-wz] Extracted ${parsed.items.length} items, documentNumber: ${parsed.documentNumber ?? 'none'}`,
    )

    // -------------------------------------------------------------------
    // 4. Fuzzy-match items against existing products
    // -------------------------------------------------------------------
    const allProducts = await prisma.product.findMany({
      select: { id: true, name: true, unit: true },
      orderBy: { name: 'asc' },
    })

    // Pre-compute normalised names and keyword sets for all products
    const productsWithKeywords = allProducts.map((p) => ({
      ...p,
      normName: normalise(p.name),
      keywords: extractKeywords(p.name),
    }))

    // Fuse.js as a secondary matcher for fuzzy individual word matching
    const fuse = new Fuse(allProducts, {
      keys: ['name'],
      threshold: 0.45,
      distance: 300,
      includeScore: true,
      minMatchCharLength: 2,
    })

    const matchedItems: MatchedItem[] = parsed.items.map((item) => {
      const itemName = item.name || item.rawLine || ''
      const rawKeywords = extractKeywords(itemName)
      const normalisedName = normalise(itemName)

      // ---- Strategy 1: Keyword overlap scoring ----
      const keywordScored: {
        product: (typeof productsWithKeywords)[0]
        score: number
        matchedCount: number
      }[] = []

      for (const product of productsWithKeywords) {
        if (rawKeywords.length === 0) break

        let matchedCount = 0
        for (const kw of rawKeywords) {
          if (product.normName.includes(kw)) {
            matchedCount++
          } else {
            for (const pk of product.keywords) {
              if (pk.includes(kw) || kw.includes(pk)) {
                matchedCount += 0.7
                break
              }
            }
          }
        }

        if (matchedCount > 0) {
          const ratio = matchedCount / rawKeywords.length
          const productExtraWords = Math.max(0, product.keywords.length - rawKeywords.length)
          const precisionPenalty = productExtraWords * 0.05
          const score = Math.min(100, Math.round(ratio * 100 - precisionPenalty))
          keywordScored.push({ product, score, matchedCount })
        }
      }

      keywordScored.sort((a, b) => b.score - a.score || b.matchedCount - a.matchedCount)

      // ---- Strategy 2: Fuse.js full-string fuzzy match ----
      const fuseResults = fuse.search(normalisedName)

      const fuseWordResults: Map<string, { item: (typeof allProducts)[0]; score: number }> =
        new Map()
      for (const kw of rawKeywords) {
        const wr = fuse.search(kw)
        for (const r of wr.slice(0, 5)) {
          const existing = fuseWordResults.get(r.item.id)
          const newScore = r.score ?? 1
          if (!existing || newScore < existing.score) {
            fuseWordResults.set(r.item.id, { item: r.item, score: newScore })
          }
        }
      }

      // ---- Combine both strategies ----
      const scoreMap = new Map<string, { id: string; name: string; unit: string; score: number }>()

      for (const ks of keywordScored.slice(0, 10)) {
        scoreMap.set(ks.product.id, {
          id: ks.product.id,
          name: ks.product.name,
          unit: ks.product.unit,
          score: ks.score,
        })
      }

      for (const fr of fuseResults.slice(0, 10)) {
        const fuseScore = Math.round((1 - (fr.score ?? 1)) * 100)
        const existing = scoreMap.get(fr.item.id)
        if (!existing) {
          scoreMap.set(fr.item.id, {
            id: fr.item.id,
            name: fr.item.name,
            unit: fr.item.unit,
            score: fuseScore,
          })
        } else {
          existing.score = Math.max(existing.score, fuseScore)
        }
      }

      for (const [, { item, score }] of fuseWordResults) {
        const fuseScore = Math.round((1 - score) * 100) - 5
        const existing = scoreMap.get(item.id)
        if (!existing) {
          scoreMap.set(item.id, {
            id: item.id,
            name: item.name,
            unit: item.unit,
            score: Math.max(0, fuseScore),
          })
        } else {
          existing.score = Math.max(existing.score, fuseScore)
        }
      }

      const suggestions = Array.from(scoreMap.values())
        .sort((a, b) => b.score - a.score)
        .slice(0, 5)

      // Determine confidence level
      let confidence: 'exact' | 'partial' | 'none' = 'none'
      let matchedProductId: string | null = null
      let matchedProductName: string | null = null
      let matchedProductUnit: string | null = null

      if (suggestions.length > 0) {
        const best = suggestions[0]
        if (best.score >= 75) {
          confidence = 'exact'
          matchedProductId = best.id
          matchedProductName = best.name
          matchedProductUnit = best.unit
        } else if (best.score >= 40) {
          confidence = 'partial'
          matchedProductId = best.id
          matchedProductName = best.name
          matchedProductUnit = best.unit
        }
      }

      return {
        rawName: itemName,
        quantity: typeof item.quantity === 'number' ? item.quantity : 0,
        unit: item.unit || 'szt',
        matchedProductId,
        matchedProductName,
        matchedProductUnit,
        confidence,
        suggestions,
      }
    })

    const elapsed = Date.now() - start
    console.log(
      `[parse-wz] Done in ${elapsed}ms. Matched ${matchedItems.filter((i) => i.confidence !== 'none').length}/${matchedItems.length} items.`,
    )

    return NextResponse.json({
      documentNumber: parsed.documentNumber ?? null,
      items: matchedItems,
    })
  } catch (error) {
    console.error('[parse-wz] Unexpected error:', error)
    // Always return a usable response so the frontend can still function
    return NextResponse.json({
      documentNumber: null,
      items: [],
      warning: 'Wystąpił nieoczekiwany błąd. Spróbuj ponownie.',
    })
  }
}
