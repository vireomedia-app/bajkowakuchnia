/**
 * Test script for debugging Leclerc nutrition scraper.
 * 
 * Run with: npx tsx scripts/test-leclerc-final.ts
 */

import 'dotenv/config'
import { fetchLeclercNutritionByBarcode } from '../lib/leclerc'

const TEST_BARCODE = '5901749001608'

async function main() {
  console.log('='.repeat(60))
  console.log(`=== TESTING LECLERC SCRAPER FOR BARCODE: ${TEST_BARCODE} ===`)
  console.log('='.repeat(60))
  console.log('')

  try {
    const result = await fetchLeclercNutritionByBarcode(TEST_BARCODE)

    console.log('')
    console.log('='.repeat(60))
    console.log(`=== RESULT FOR ${TEST_BARCODE} ===`)
    console.log('='.repeat(60))

    if (result) {
      console.log(JSON.stringify(result, null, 2))
    } else {
      console.log('NULL - No nutrition data found')
    }
  } catch (error) {
    console.error('ERROR:', error)
  }

  console.log('')
  console.log('='.repeat(60))
  console.log('Run with: npx tsx scripts/test-leclerc-final.ts')
  console.log('='.repeat(60))

  process.exit(0)
}

main()
