
import { PrismaClient } from '@prisma/client'
import * as fs from 'fs'
import * as path from 'path'

const prisma = new PrismaClient()

interface ProductData {
  name: string
  package_size: string
  unit: string
  nutritional_values: {
    calories: number
    protein: number
    fat: number
    carbohydrates: number
    calcium: number
    iron: number
    vitaminC: number
  }
}

async function main() {
  try {
    console.log('🌱 Rozpoczynam import produktów z emaja24.pl...')
    
    // Wczytaj plik JSON
    const jsonPath = path.join('/home/ubuntu', 'products_emaja24.json')
    const jsonData = JSON.parse(fs.readFileSync(jsonPath, 'utf-8')) as ProductData[]
    
    console.log(`📦 Znaleziono ${jsonData.length} produktów do importu`)
    
    let addedCount = 0
    let skippedCount = 0
    
    for (const product of jsonData) {
      // Sprawdź czy produkt już istnieje
      const existingProduct = await prisma.product.findFirst({
        where: {
          name: product.name
        }
      })
      
      if (existingProduct) {
        console.log(`⏭️  Pomijam: ${product.name} (już istnieje)`)
        skippedCount++
        continue
      }
      
      // Dodaj produkt
      await prisma.product.create({
        data: {
          name: product.name,
          unit: product.unit,
          currentStock: 0, // Początkowy stan magazynowy
          calories: product.nutritional_values.calories,
          protein: product.nutritional_values.protein,
          fat: product.nutritional_values.fat,
          carbohydrates: product.nutritional_values.carbohydrates,
          calcium: product.nutritional_values.calcium,
          iron: product.nutritional_values.iron,
          vitaminC: product.nutritional_values.vitaminC
        }
      })
      
      console.log(`✅ Dodano: ${product.name}`)
      addedCount++
    }
    
    console.log('\n📊 Podsumowanie importu:')
    console.log(`   ✅ Dodano: ${addedCount} produktów`)
    console.log(`   ⏭️  Pominięto: ${skippedCount} produktów (już istniały)`)
    console.log(`   📦 Łącznie przetworzono: ${jsonData.length} produktów`)
    
  } catch (error) {
    console.error('❌ Błąd podczas importu:', error)
    throw error
  }
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
