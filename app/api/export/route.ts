
import { NextResponse } from 'next/server'
import { getProducts, getProductById } from '@/lib/db-utils'
import * as XLSX from 'xlsx'

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    // Get all products
    const products = await getProducts()
    
    if (!products || products.length === 0) {
      return NextResponse.json(
        { error: 'Brak produktów do eksportu' },
        { status: 404 }
      )
    }
    
    // Create new workbook
    const workbook = XLSX.utils.book_new()
    
    // Create main sheet with products list
    const mainSheetData = [
      ['Lp.', 'Nazwa Produktu', 'Jednostka Miary', 'Aktualny Stan'],
      ...products.map((product, index) => [
        index + 1,
        product?.name || '',
        product?.unit || '',
        product?.currentStock || 0
      ])
    ]
    
    const mainSheet = XLSX.utils.aoa_to_sheet(mainSheetData)
    
    // Set column widths
    mainSheet['!cols'] = [
      { width: 10 }, // Lp.
      { width: 30 }, // Nazwa Produktu
      { width: 15 }, // Jednostka Miary
      { width: 15 }  // Aktualny Stan
    ]
    
    XLSX.utils.book_append_sheet(workbook, mainSheet, 'Lista Produktów')
    
    // Create individual sheets for each product with transactions
    for (const product of products) {
      if (!product?.id) continue
      
      try {
        const productWithTransactions = await getProductById(product.id)
        
        if (!productWithTransactions?.transactions) continue
        
        // Build sheet data with nutritional information at the top
        const sheetData: any[] = []
        
        // Add product info and nutritional values header
        sheetData.push(['INFORMACJE O PRODUKCIE'])
        sheetData.push(['Nazwa produktu:', productWithTransactions?.name || ''])
        sheetData.push(['Jednostka miary:', productWithTransactions?.unit || ''])
        
        if (productWithTransactions?.manufacturer) {
          sheetData.push(['Producent:', productWithTransactions.manufacturer])
        }
        
        // Add nutritional values if any exist
        const hasNutritionalData = 
          productWithTransactions?.calories ||
          productWithTransactions?.salt ||
          productWithTransactions?.protein ||
          productWithTransactions?.fat ||
          productWithTransactions?.saturatedFat ||
          productWithTransactions?.carbohydrates ||
          productWithTransactions?.sugars ||
          productWithTransactions?.calcium ||
          productWithTransactions?.iron ||
          productWithTransactions?.vitaminC
        
        if (hasNutritionalData) {
          sheetData.push([]) // Empty row for spacing
          
          // Dynamic unit text based on product unit
          const isVolumeUnit = productWithTransactions?.unit === 'ml' || productWithTransactions?.unit === 'l'
          const unitText = isVolumeUnit ? '100 ml' : '100 g'
          sheetData.push([`WARTOŚCI ODŻYWCZE (na ${unitText})`])
          
          if (productWithTransactions?.calories != null) {
            sheetData.push(['Kalorie:', `${productWithTransactions.calories} kcal`])
          }
          if (productWithTransactions?.protein != null) {
            sheetData.push(['Białko:', `${productWithTransactions.protein} g`])
          }
          if (productWithTransactions?.fat != null) {
            sheetData.push(['Tłuszcz:', `${productWithTransactions.fat} g`])
          }
          if (productWithTransactions?.saturatedFat != null) {
            sheetData.push(['  w tym kwasy tłuszczowe nasycone:', `${productWithTransactions.saturatedFat} g`])
          }
          if (productWithTransactions?.carbohydrates != null) {
            sheetData.push(['Węglowodany:', `${productWithTransactions.carbohydrates} g`])
          }
          if (productWithTransactions?.sugars != null) {
            sheetData.push(['  w tym cukry:', `${productWithTransactions.sugars} g`])
          }
          if (productWithTransactions?.salt != null) {
            sheetData.push(['Sól:', `${productWithTransactions.salt} g`])
          }
          if (productWithTransactions?.calcium != null) {
            sheetData.push(['Wapń:', `${productWithTransactions.calcium} mg`])
          }
          if (productWithTransactions?.iron != null) {
            sheetData.push(['Żelazo:', `${productWithTransactions.iron} mg`])
          }
          if (productWithTransactions?.vitaminC != null) {
            sheetData.push(['Witamina C:', `${productWithTransactions.vitaminC} mg`])
          }
        }
        
        // Add spacing before transactions
        sheetData.push([])
        sheetData.push([])
        
        // Add transactions header
        sheetData.push(['HISTORIA TRANSAKCJI'])
        sheetData.push(['Data', 'Dokument', 'Przychód', 'Rozchód', 'Saldo'])
        
        // Add transactions
        productWithTransactions.transactions.forEach((transaction) => {
          const income = transaction?.type === 'INCOME' ? (transaction?.quantity || 0) : 0
          const outcome = transaction?.type === 'OUTCOME' ? (transaction?.quantity || 0) : 0
          
          sheetData.push([
            transaction?.date ? new Date(transaction.date).toLocaleDateString('pl-PL') : '',
            transaction?.document || '',
            income.toString(),
            outcome.toString(),
            (transaction?.balance || 0).toString()
          ])
        })
        
        const transactionSheet = XLSX.utils.aoa_to_sheet(sheetData)
        
        // Set column widths
        transactionSheet['!cols'] = [
          { width: 20 }, // First column (labels or Data)
          { width: 30 }, // Second column (values or Dokument)
          { width: 12 }, // Przychód
          { width: 12 }, // Rozchód
          { width: 12 }  // Saldo
        ]
        
        // Clean product name for sheet name (Excel sheet names have limitations)
        const cleanProductName = (product?.name || 'Produkt')
          .replace(/[\/\\?*:[\]]/g, '')
          .substring(0, 31)
        
        XLSX.utils.book_append_sheet(workbook, transactionSheet, cleanProductName)
        
      } catch (error) {
        console.error(`Error processing product ${product.name}:`, error)
        continue
      }
    }
    
    // Generate buffer
    const buffer = XLSX.write(workbook, {
      type: 'buffer',
      bookType: 'xlsx'
    })
    
    // Return file as response
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="kartoteka_magazynowa_${new Date().toISOString().split('T')[0]}.xlsx"`
      }
    })
    
  } catch (error) {
    console.error('Export error:', error)
    return NextResponse.json(
      { error: 'Błąd podczas eksportu danych' },
      { status: 500 }
    )
  }
}
