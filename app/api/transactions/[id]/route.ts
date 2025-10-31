
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { recalculateBalances } from '@/lib/db-utils'
import { createBackup, cleanupOldBackups } from '@/lib/backup-utils'

// Update transaction
export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    // Create backup before making changes
    await createBackup('Przed edycją transakcji')
    await cleanupOldBackups(50)

    const { id } = params
    const body = await request.json()
    const { date, document, type, quantity } = body

    // Get the transaction and product
    const transaction = await prisma.transaction.findUnique({
      where: { id },
      include: { product: true }
    })

    if (!transaction) {
      return NextResponse.json(
        { error: 'Transaction not found' },
        { status: 404 }
      )
    }

    // Update the transaction
    await prisma.transaction.update({
      where: { id },
      data: {
        date: new Date(date),
        document,
        type,
        quantity: parseFloat(quantity)
      }
    })

    // Recalculate all balances for this product
    await recalculateBalances(transaction.productId)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error updating transaction:', error)
    return NextResponse.json(
      { error: 'Failed to update transaction' },
      { status: 500 }
    )
  }
}

// Delete transaction
export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    // Create backup before making changes
    await createBackup('Przed usunięciem transakcji')
    await cleanupOldBackups(50)

    const { id } = params

    // Get the transaction to know which product to recalculate
    const transaction = await prisma.transaction.findUnique({
      where: { id }
    })

    if (!transaction) {
      return NextResponse.json(
        { error: 'Transaction not found' },
        { status: 404 }
      )
    }

    const productId = transaction.productId

    // Delete the transaction
    await prisma.transaction.delete({
      where: { id }
    })

    // Recalculate all balances for this product
    await recalculateBalances(productId)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting transaction:', error)
    return NextResponse.json(
      { error: 'Failed to delete transaction' },
      { status: 500 }
    )
  }
}
