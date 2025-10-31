
import { NextRequest, NextResponse } from 'next/server'
import { createProduct, getProducts } from '@/lib/db-utils'
import { createBackup, cleanupOldBackups } from '@/lib/backup-utils'
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
    
    // Create backup before making changes
    await createBackup('Przed dodaniem produktu')
    await cleanupOldBackups(50)
    
    // Create product
    const product = await createProduct(validatedData)
    
    return NextResponse.json(product, { status: 201 })
    
  } catch (error) {
    console.error('Error creating product:', error)
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Nieprawidłowe dane', details: error.errors },
        { status: 400 }
      )
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
