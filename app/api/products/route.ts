
import { NextRequest, NextResponse } from 'next/server'
import { createProduct, getProducts } from '@/lib/db-utils'
import { createBackup, cleanupOldBackups } from '@/lib/backup-utils'
import { prisma } from '@/lib/db'
import { z } from 'zod'

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const search = searchParams.get('search')
    
    let products
    
    if (search) {
      // Wyszukiwanie produktów po nazwie lub fragmencie kodu kreskowego
      products = await prisma.product.findMany({
        where: {
          OR: [
            {
              name: {
                contains: search,
                mode: 'insensitive'
              }
            },
            {
              barcode: {
                contains: search,
              }
            }
          ]
        },
        orderBy: {
          name: 'asc'
        },
        take: 20 // Limit wyników
      })
    } else {
      // Pobierz wszystkie produkty
      products = await getProducts()
    }
    
    return NextResponse.json(products, { 
      status: 200,
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      }
    })
  } catch (error) {
    console.error('Error fetching products:', error)
    return NextResponse.json(
      { error: 'Błąd serwera podczas pobierania produktów' },
      { status: 500 }
    )
  }
}

const createProductSchema = z.object({
  name: z.string().min(1, 'Nazwa produktu jest wymagana'),
  unit: z.enum(['g', 'kg', 'ml', 'l', 'szt'], { 
    errorMap: () => ({ message: 'Jednostka miary musi być jedną z: g, kg, ml, l, szt' })
  }),
  packagingType: z.enum(['bulk', 'packaged']).default('bulk'),
  initialStock: z.number().min(0, 'Stan początkowy nie może być ujemny'),
  barcode: z.string().nullable().optional(),
  packageWeight: z.number().nullable().optional(),
  packageUnit: z.enum(['g', 'kg', 'ml', 'l', 'szt']).nullable().optional(),
  manufacturer: z.string().nullable().optional(),
  calories: z.number().nullable().optional(),
  salt: z.number().nullable().optional(),
  protein: z.number().nullable().optional(),
  fat: z.number().nullable().optional(),
  saturatedFat: z.number().nullable().optional(),
  carbohydrates: z.number().nullable().optional(),
  sugars: z.number().nullable().optional(),
  fiber: z.number().nullable().optional(),
  calcium: z.number().nullable().optional(),
  iron: z.number().nullable().optional(),
  vitaminC: z.number().nullable().optional(),
  allergens: z.array(z.number().min(1).max(14)).optional().default([]),
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    // Validate input
    const validatedData = createProductSchema.parse(body)
    
    // Clean barcode: convert empty string to null, trim whitespace
    if (validatedData.barcode !== null && validatedData.barcode !== undefined) {
      const cleanedBarcode = validatedData.barcode.trim()
      validatedData.barcode = cleanedBarcode === '' ? null : cleanedBarcode
    }
    
    // Check for duplicate barcode using raw SQL (to avoid TypeScript issues)
    if (validatedData.barcode) {
      const existingProducts = await prisma.$queryRaw<Array<{ id: string; name: string; barcode: string }>>`
        SELECT id, name, barcode 
        FROM "products" 
        WHERE barcode = ${validatedData.barcode}
        LIMIT 1
      `
      
      if (existingProducts && existingProducts.length > 0) {
        return NextResponse.json(
          { 
            error: `Produkt z kodem kreskowym "${validatedData.barcode}" już istnieje w bazie: "${existingProducts[0].name}"`,
            existingProduct: existingProducts[0]
          },
          { status: 409 }
        )
      }
    }
    
    // Create backup before making changes
    await createBackup('Przed dodaniem produktu')
    await cleanupOldBackups(50)
    
    // Create product
    const product = await createProduct(validatedData)
    
    return NextResponse.json(product, { status: 201 })
    
  } catch (error: any) {
    console.error('Error creating product:', error)
    console.error('Error code:', error.code)
    console.error('Error meta:', error.meta)
    console.error('Error message:', error.message)
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Nieprawidłowe dane', details: error.errors },
        { status: 400 }
      )
    }
    
    // Handle Prisma unique constraint violations (P2002)
    if (error.code === 'P2002') {
      const target = error.meta?.target || []
      if (target.includes('barcode')) {
        return NextResponse.json(
          { error: 'Produkt z tym kodem kreskowym już istnieje w bazie' },
          { status: 409 }
        )
      }
      if (target.includes('name')) {
        return NextResponse.json(
          { error: 'Produkt o tej nazwie już istnieje' },
          { status: 409 }
        )
      }
    }
    
    if (error instanceof Error && error.message.includes('Unique constraint')) {
      return NextResponse.json(
        { error: 'Produkt o tej nazwie już istnieje' },
        { status: 409 }
      )
    }
    
    return NextResponse.json(
      { 
        error: 'Błąd serwera podczas tworzenia produktu',
        details: error.message || 'Nieznany błąd'
      },
      { status: 500 }
    )
  }
}
