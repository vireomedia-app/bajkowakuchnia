
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { createBackup, cleanupOldBackups } from '@/lib/backup-utils'

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = params.id
    const body = await request.json()
    
    const { 
      name, 
      unit, 
      manufacturer,
      calories,
      salt,
      protein,
      fat,
      saturatedFat,
      carbohydrates,
      sugars,
      calcium,
      iron,
      vitaminC,
      allergens
    } = body

    // Validate input
    if (!name || !unit) {
      return NextResponse.json(
        { error: 'Nazwa i jednostka miary są wymagane' },
        { status: 400 }
      )
    }

    // Create backup before making changes
    await createBackup('Przed edycją produktu')
    await cleanupOldBackups(50)

    // Update product
    const updatedProduct = await prisma.product.update({
      where: { id },
      data: {
        name,
        unit,
        manufacturer,
        calories,
        salt,
        protein,
        fat,
        saturatedFat,
        carbohydrates,
        sugars,
        calcium,
        iron,
        vitaminC,
        allergens: allergens || [],
      },
    })

    return NextResponse.json(updatedProduct)
  } catch (error) {
    console.error('Error updating product:', error)
    return NextResponse.json(
      { error: 'Nie udało się zaktualizować produktu' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = params.id

    // Create backup before making changes
    await createBackup('Przed usunięciem produktu')
    await cleanupOldBackups(50)

    // Delete all transactions for this product first
    await prisma.transaction.deleteMany({
      where: { productId: id },
    })

    // Delete the product
    await prisma.product.delete({
      where: { id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting product:', error)
    return NextResponse.json(
      { error: 'Nie udało się usunąć produktu' },
      { status: 500 }
    )
  }
}
