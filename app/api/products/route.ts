
import { NextRequest, NextResponse } from 'next/server'
import { createProduct, getProducts } from '@/lib/db-utils'
import { createBackup, cleanupOldBackups } from '@/lib/backup-utils'
import { prisma } from '@/lib/db'
import { z } from 'zod'

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const products = await getProducts()
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
  unit: z.string().min(1, 'Jednostka miary jest wymagana'),
  initialStock: z.number().min(0, 'Stan początkowy nie może być ujemny'),
  barcode: z.string().nullable().optional(),
  manufacturer: z.string().nullable().optional(),
  calories: z.number().nullable().optional(),
  salt: z.number().nullable().optional(),
  protein: z.number().nullable().optional(),
  fat: z.number().nullable().optional(),
  saturatedFat: z.number().nullable().optional(),
  carbohydrates: z.number().nullable().optional(),
  sugars: z.number().nullable().optional(),
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
    
    // Check for duplicate barcode BEFORE creating (extra safety layer)
    if (validatedData.barcode && validatedData.barcode.trim()) {
      const existingByBarcode = await prisma.product.findFirst({
        where: { 
          barcode: validatedData.barcode.trim() 
        }
      })
      
      if (existingByBarcode) {
        return NextResponse.json(
          { error: `Produkt z kodem kreskowym "${validatedData.barcode}" już istnieje w bazie: "${existingByBarcode.name}"` },
          { status: 409 }
        )
      }
    }
    
    // Create backup before making changes
    await createBackup('Przed dodaniem produktu')
    await cleanupOldBackups(50)
    
    // Create product - database will also handle duplicate barcode via UNIQUE constraint
    const product = await createProduct(validatedData)
    
    return NextResponse.json(product, { status: 201 })
    
  } catch (error: any) {
    console.error('Error creating product:', error)
    
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
      { error: 'Błąd serwera podczas tworzenia produktu' },
      { status: 500 }
    )
  }
}
