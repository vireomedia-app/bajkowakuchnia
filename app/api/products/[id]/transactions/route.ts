
import { NextRequest, NextResponse } from 'next/server'
import { createTransaction } from '@/lib/db-utils'
import { createBackup, cleanupOldBackups } from '@/lib/backup-utils'
import { z } from 'zod'

export const dynamic = "force-dynamic";

const createTransactionSchema = z.object({
  date: z.string().transform((str) => new Date(str)),
  document: z.string().optional().default(''),
  type: z.enum(['INCOME', 'OUTCOME']),
  quantity: z.number().min(0.01, 'Ilość musi być większa od 0')
})

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const productId = params.id
    const body = await request.json()
    
    // Validate input
    const validatedData = createTransactionSchema.parse(body)
    
    // Create backup before making changes
    await createBackup('Przed dodaniem transakcji')
    await cleanupOldBackups(50)
    
    // Create transaction
    const transaction = await createTransaction(productId, validatedData)
    
    return NextResponse.json(transaction, { status: 201 })
    
  } catch (error) {
    console.error('Error creating transaction:', error)
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Nieprawidłowe dane', details: error.errors },
        { status: 400 }
      )
    }
    
    if (error instanceof Error) {
      if (error.message === 'Product not found') {
        return NextResponse.json(
          { error: 'Nie znaleziono produktu' },
          { status: 404 }
        )
      }
      
      if (error.message === 'Niewystarczający stan magazynowy') {
        return NextResponse.json(
          { error: 'Niewystarczający stan magazynowy' },
          { status: 400 }
        )
      }
    }
    
    return NextResponse.json(
      { error: 'Błąd serwera podczas tworzenia transakcji' },
      { status: 500 }
    )
  }
}
