
import { PrismaClient } from '@prisma/client'
import * as XLSX from 'xlsx'
import path from 'path'

const prisma = new PrismaClient()

async function main() {
  try {
    console.log('🌱 Rozpoczynam import danych z pliku Excel...')
    
    // Ścieżka do pliku Excel
    const excelPath = path.join(process.cwd(), 'data', 'Kartoteka_Magazynowa_W_Malej_Kuchni.xlsx')
    
    // Wczytaj plik Excel
    const workbook = XLSX.readFile(excelPath)
    
    console.log('📊 Znalezione arkusze:', workbook.SheetNames)
    
    // Znajdź główny arkusz z listą produktów
    const mainSheetName = workbook.SheetNames.find(name => 
      name.includes('Lista Produktów') || name.includes('Arkusz1') || name === workbook.SheetNames[0]
    ) || workbook.SheetNames[0]
    
    console.log(`📋 Przetwarzam główny arkusz: ${mainSheetName}`)
    
    const mainSheet = workbook.Sheets[mainSheetName]
    const mainData = XLSX.utils.sheet_to_json<any>(mainSheet)
    
    console.log(`📦 Znaleziono ${mainData.length} produktów`)
    
    // Wyczyść istniejące dane (opcjonalnie)
    await prisma.transaction.deleteMany()
    await prisma.product.deleteMany()
    
    // Importuj produkty
    for (let i = 0; i < mainData.length; i++) {
      const row = mainData[i]
      
      // Pobierz dane produktu z różnych możliwych nazw kolumn
      const productName = row['Nazwa Produktu'] || row['Nazwa produktu'] || row['Nazwa'] || 
                         row['Product Name'] || row['Name'] || row['nazwa'] || 
                         Object.values(row).find(val => typeof val === 'string' && val.length > 2)
      
      const unit = row['Jednostka Miary'] || row['Jednostka miary'] || row['Jednostka'] || 
                   row['Unit'] || row['jednostka'] || 'szt'
      
      const currentStock = parseFloat(row['Aktualny Stan'] || row['Stan'] || row['Stock'] || row['stan'] || '0') || 0
      
      if (!productName) {
        console.log(`⚠️  Pominięto wiersz ${i + 1} - brak nazwy produktu`)
        continue
      }
      
      console.log(`➕ Dodaję produkt: ${productName} (${unit}, stan: ${currentStock})`)
      
      // Utwórz produkt
      const product = await prisma.product.create({
        data: {
          name: String(productName).trim(),
          unit: String(unit).trim(),
          currentStock: currentStock
        }
      })
      
      // Sprawdź czy istnieje osobny arkusz dla tego produktu
      const productSheetName = workbook.SheetNames.find(name => 
        name.includes(String(productName)) || 
        String(productName).includes(name) ||
        name === String(productName)
      )
      
      if (productSheetName && productSheetName !== mainSheetName) {
        console.log(`📈 Przetwarzam transakcje dla produktu z arkusza: ${productSheetName}`)
        
        const productSheet = workbook.Sheets[productSheetName]
        const transactions = XLSX.utils.sheet_to_json<any>(productSheet)
        
        let runningBalance = 0
        
        for (const transaction of transactions) {
          const date = transaction['Data'] || transaction['Date'] || new Date()
          const document = transaction['Dokument'] || transaction['Document'] || 'Import'
          const income = parseFloat(transaction['Przychód'] || transaction['Income'] || '0') || 0
          const outcome = parseFloat(transaction['Rozchód'] || transaction['Outcome'] || '0') || 0
          const saldo = parseFloat(transaction['Saldo'] || transaction['Balance'] || '0') || 0
          
          // Jeśli mamy podane saldo, użyj go, w przeciwnym razie oblicz
          if (saldo !== 0) {
            runningBalance = saldo
          } else {
            runningBalance += income - outcome
          }
          
          // Dodaj transakcję przychodu
          if (income > 0) {
            await prisma.transaction.create({
              data: {
                productId: product.id,
                date: new Date(date),
                document: String(document),
                type: 'INCOME',
                quantity: income,
                balance: runningBalance
              }
            })
          }
          
          // Dodaj transakcję rozchodu
          if (outcome > 0) {
            await prisma.transaction.create({
              data: {
                productId: product.id,
                date: new Date(date),
                document: String(document),
                type: 'OUTCOME',
                quantity: outcome,
                balance: runningBalance
              }
            })
          }
        }
        
        // Zaktualizuj stan produktu na podstawie ostatniej transakcji
        if (runningBalance !== currentStock) {
          await prisma.product.update({
            where: { id: product.id },
            data: { currentStock: runningBalance }
          })
        }
        
        console.log(`✅ Zaimportowano ${transactions.length} transakcji dla produktu ${productName}`)
      } else {
        // Jeśli nie ma osobnego arkusza, utwórz transakcję początkową jeśli stan > 0
        if (currentStock > 0) {
          await prisma.transaction.create({
            data: {
              productId: product.id,
              date: new Date(),
              document: 'Stan początkowy',
              type: 'INCOME',
              quantity: currentStock,
              balance: currentStock
            }
          })
        }
      }
    }
    
    // Pokaż podsumowanie
    const totalProducts = await prisma.product.count()
    const totalTransactions = await prisma.transaction.count()
    
    console.log(`🎉 Import zakończony pomyślnie!`)
    console.log(`📦 Zaimportowano ${totalProducts} produktów`)
    console.log(`📈 Zaimportowano ${totalTransactions} transakcji`)
    
    // Dodaj przykładowe receptury
    console.log('\n📝 Dodawanie przykładowych receptur...')
    await seedRecipes()
    
  } catch (error) {
    console.error('❌ Błąd podczas importu:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

async function seedRecipes() {
  try {
    // Pobierz istniejące produkty
    const products = await prisma.product.findMany()
    const productMap = new Map(products.map(p => [p.name.toLowerCase(), p]))

    // Sprawdź czy receptury już istnieją
    const existingRecipes = await prisma.recipe.count()
    if (existingRecipes > 0) {
      console.log('⏭️  Receptury już istnieją, pomijam dodawanie')
      return
    }

    // Przykładowe receptury
    const recipes = [
      {
        name: 'Borowiki w cieście',
        description: 'Pyszne borowiki w chrupiącym cieście',
        servings: 4,
        ingredients: [
          { name: 'Grzyby mrożone', quantity: 500, unit: 'g' },
          { name: 'Mąka pszenna', quantity: 200, unit: 'g' },
          { name: 'Jajka', quantity: 2, unit: 'szt' },
          { name: 'Olej', quantity: 50, unit: 'ml' },
          { name: 'Sól', quantity: 5, unit: 'g' }
        ]
      },
      {
        name: 'Zupa pomidorowa',
        description: 'Tradycyjna zupa pomidorowa z makaronem',
        servings: 6,
        ingredients: [
          { name: 'Pomidory', quantity: 800, unit: 'g' },
          { name: 'Marchew', quantity: 200, unit: 'g' },
          { name: 'Cebula', quantity: 100, unit: 'g' },
          { name: 'Makaron', quantity: 100, unit: 'g' },
          { name: 'Śmietana', quantity: 200, unit: 'ml' }
        ]
      },
      {
        name: 'Pierogi z mięsem',
        description: 'Domowe pierogi z farszem mięsnym',
        servings: 4,
        ingredients: [
          { name: 'Mąka pszenna', quantity: 500, unit: 'g' },
          { name: 'Mięso mielone', quantity: 400, unit: 'g' },
          { name: 'Cebula', quantity: 150, unit: 'g' },
          { name: 'Jajka', quantity: 1, unit: 'szt' },
          { name: 'Sól', quantity: 10, unit: 'g' },
          { name: 'Pieprz', quantity: 2, unit: 'g' }
        ]
      },
      {
        name: 'Sałatka grecka',
        description: 'Świeża sałatka z serem feta',
        servings: 4,
        ingredients: [
          { name: 'Ogórek', quantity: 300, unit: 'g' },
          { name: 'Pomidory', quantity: 400, unit: 'g' },
          { name: 'Ser feta', quantity: 200, unit: 'g' },
          { name: 'Oliwki', quantity: 100, unit: 'g' },
          { name: 'Cebula czerwona', quantity: 50, unit: 'g' },
          { name: 'Oliwa z oliwek', quantity: 30, unit: 'ml' }
        ]
      }
    ]

    for (const recipe of recipes) {
      // Znajdź produkty w bazie lub oznacz jako brakujące
      const ingredientsData = recipe.ingredients.map(ing => {
        const product = productMap.get(ing.name.toLowerCase())
        return {
          productId: product?.id || null,
          productName: ing.name,
          quantity: ing.quantity,
          unit: ing.unit
        }
      })

      await prisma.recipe.create({
        data: {
          name: recipe.name,
          description: recipe.description,
          servings: recipe.servings,
          ingredients: {
            create: ingredientsData
          }
        }
      })

      console.log(`✅ Dodano recepturę: ${recipe.name}`)
    }

    const totalRecipes = await prisma.recipe.count()
    console.log(`🎉 Dodano ${totalRecipes} receptur`)

  } catch (error) {
    console.error('❌ Błąd podczas dodawania receptur:', error)
  }
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
