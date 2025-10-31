
import { prisma } from './db'
import { Prisma } from '@prisma/client'
import * as XLSX from 'xlsx'
import path from 'path'

export async function getProducts() {
  try {
    return await prisma.product.findMany({
      orderBy: { name: 'asc' },
      where: {
        NOT: {
          name: 'Lp.' // Exclude header row that was incorrectly imported
        }
      }
    })
  } catch (error) {
    console.error('Error fetching products:', error)
    return []
  }
}

export async function getProductById(id: string) {
  try {
    return await prisma.product.findUnique({
      where: { id },
      include: {
        transactions: {
          orderBy: { date: 'asc' }
        }
      }
    })
  } catch (error) {
    console.error('Error fetching product:', error)
    return null
  }
}

export async function createProduct(data: {
  name: string
  unit: string
  initialStock: number
  manufacturer?: string | null
  calories?: number | null
  salt?: number | null
  protein?: number | null
  fat?: number | null
  saturatedFat?: number | null
  carbohydrates?: number | null
  sugars?: number | null
  calcium?: number | null
  iron?: number | null
  vitaminC?: number | null
}) {
  try {
    return await prisma.$transaction(async (tx) => {
      // Create product
      const product = await tx.product.create({
        data: {
          name: data.name,
          unit: data.unit,
          currentStock: data.initialStock,
          manufacturer: data.manufacturer,
          calories: data.calories,
          salt: data.salt,
          protein: data.protein,
          fat: data.fat,
          saturatedFat: data.saturatedFat,
          carbohydrates: data.carbohydrates,
          sugars: data.sugars,
          calcium: data.calcium,
          iron: data.iron,
          vitaminC: data.vitaminC,
        }
      })
      
      // Create initial transaction if stock > 0
      if (data.initialStock > 0) {
        await tx.transaction.create({
          data: {
            productId: product.id,
            date: new Date(),
            document: 'Stan początkowy',
            type: 'INCOME',
            quantity: data.initialStock,
            balance: data.initialStock
          }
        })
      }
      
      return product
    })
  } catch (error) {
    console.error('Error creating product:', error)
    throw error
  }
}

export async function createTransaction(productId: string, data: {
  date: Date
  document: string
  type: 'INCOME' | 'OUTCOME'
  quantity: number
}) {
  try {
    return await prisma.$transaction(async (tx) => {
      // Get current stock
      const product = await tx.product.findUnique({
        where: { id: productId }
      })
      
      if (!product) {
        throw new Error('Product not found')
      }
      
      // Calculate new balance
      let newBalance = product.currentStock
      if (data.type === 'INCOME') {
        newBalance += data.quantity
      } else {
        newBalance -= data.quantity
      }
      
      // Ensure balance doesn't go below 0
      if (newBalance < 0) {
        throw new Error('Niewystarczający stan magazynowy')
      }
      
      // Create transaction
      const transaction = await tx.transaction.create({
        data: {
          productId,
          date: data.date,
          document: data.document,
          type: data.type,
          quantity: data.quantity,
          balance: newBalance
        }
      })
      
      // Update product stock
      await tx.product.update({
        where: { id: productId },
        data: { currentStock: newBalance }
      })
      
      return transaction
    })
  } catch (error) {
    console.error('Error creating transaction:', error)
    throw error
  }
}

export async function searchProducts(query: string) {
  try {
    return await prisma.product.findMany({
      where: {
        AND: [
          {
            name: {
              contains: query,
              mode: 'insensitive'
            }
          },
          {
            NOT: {
              name: 'Lp.'
            }
          }
        ]
      },
      orderBy: { name: 'asc' }
    })
  } catch (error) {
    console.error('Error searching products:', error)
    return []
  }
}

export async function recalculateBalances(productId: string) {
  try {
    return await prisma.$transaction(async (tx) => {
      // Get all transactions for this product, ordered by date
      const transactions = await tx.transaction.findMany({
        where: { productId },
        orderBy: { date: 'asc' }
      })

      let runningBalance = 0

      // Recalculate balance for each transaction
      for (const transaction of transactions) {
        if (transaction.type === 'INCOME') {
          runningBalance += transaction.quantity
        } else {
          runningBalance -= transaction.quantity
        }

        // Update the transaction with the new balance
        await tx.transaction.update({
          where: { id: transaction.id },
          data: { balance: runningBalance }
        })
      }

      // Update the product's current stock
      await tx.product.update({
        where: { id: productId },
        data: { currentStock: runningBalance }
      })

      return runningBalance
    })
  } catch (error) {
    console.error('Error recalculating balances:', error)
    throw error
  }
}

export async function seedDatabase() {
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
    
  } catch (error) {
    console.error('❌ Błąd podczas importu:', error)
    throw error
  }
}
