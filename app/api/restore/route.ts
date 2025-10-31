
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { seedDatabase } from '@/lib/db-utils'

export async function POST() {
  try {
    // Delete all transactions first (due to foreign key constraints)
    await prisma.transaction.deleteMany({})
    
    // Delete all products
    await prisma.product.deleteMany({})
    
    // Reseed the database
    await seedDatabase()
    
    return NextResponse.json({ 
      success: true, 
      message: 'Dane zostały przywrócone do stanu początkowego' 
    })
  } catch (error) {
    console.error('Error restoring backup:', error)
    return NextResponse.json(
      { error: 'Nie udało się przywrócić danych' },
      { status: 500 }
    )
  }
}
