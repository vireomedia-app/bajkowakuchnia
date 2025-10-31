
import { prisma } from '@/lib/db'

export interface BackupData {
  products: any[]
  transactions: any[]
  recipes: any[]
  recipeIngredients: any[]
  timestamp: string
}

// Create a backup snapshot
export async function createBackup(description?: string) {
  try {
    const products = await prisma.product.findMany({
      include: {
        transactions: true
      }
    })
    
    const transactions = await prisma.transaction.findMany()
    
    const recipes = await prisma.recipe.findMany({
      include: {
        ingredients: true
      }
    })
    
    const recipeIngredients = await prisma.recipeIngredient.findMany()

    const backupData: BackupData = {
      products,
      transactions,
      recipes,
      recipeIngredients,
      timestamp: new Date().toISOString()
    }

    const backup = await prisma.backup.create({
      data: {
        data: JSON.stringify(backupData),
        description: description || 'Automatyczny backup'
      }
    })

    return backup
  } catch (error) {
    console.error('Error creating backup:', error)
    throw error
  }
}

// Get all backups
export async function getBackups() {
  try {
    const backups = await prisma.backup.findMany({
      orderBy: {
        createdAt: 'desc'
      }
    })
    return backups
  } catch (error) {
    console.error('Error getting backups:', error)
    throw error
  }
}

// Restore from backup
export async function restoreBackup(backupId: string) {
  try {
    const backup = await prisma.backup.findUnique({
      where: { id: backupId }
    })

    if (!backup) {
      throw new Error('Backup not found')
    }

    const backupData: BackupData = JSON.parse(backup.data)

    // Delete all current data (in correct order due to foreign key constraints)
    await prisma.recipeIngredient.deleteMany()
    await prisma.recipe.deleteMany()
    await prisma.transaction.deleteMany()
    await prisma.product.deleteMany()

    // Restore products
    for (const product of backupData.products) {
      await prisma.product.create({
        data: {
          id: product.id,
          name: product.name,
          unit: product.unit,
          currentStock: product.currentStock,
          manufacturer: product.manufacturer,
          calories: product.calories,
          protein: product.protein,
          fat: product.fat,
          saturatedFat: product.saturatedFat,
          carbohydrates: product.carbohydrates,
          sugars: product.sugars,
          salt: product.salt,
          calcium: product.calcium,
          iron: product.iron,
          vitaminC: product.vitaminC,
          createdAt: product.createdAt,
          updatedAt: product.updatedAt
        }
      })
    }

    // Restore transactions
    for (const transaction of backupData.transactions) {
      await prisma.transaction.create({
        data: {
          id: transaction.id,
          productId: transaction.productId,
          date: transaction.date,
          document: transaction.document,
          type: transaction.type,
          quantity: transaction.quantity,
          balance: transaction.balance,
          createdAt: transaction.createdAt
        }
      })
    }

    // Restore recipes (if they exist in backup - backward compatibility)
    if (backupData.recipes) {
      for (const recipe of backupData.recipes) {
        await prisma.recipe.create({
          data: {
            id: recipe.id,
            name: recipe.name,
            description: recipe.description,
            servings: recipe.servings,
            createdAt: recipe.createdAt,
            updatedAt: recipe.updatedAt
          }
        })
      }
    }

    // Restore recipe ingredients (if they exist in backup)
    if (backupData.recipeIngredients) {
      for (const ingredient of backupData.recipeIngredients) {
        await prisma.recipeIngredient.create({
          data: {
            id: ingredient.id,
            recipeId: ingredient.recipeId,
            productId: ingredient.productId,
            productName: ingredient.productName,
            quantity: ingredient.quantity,
            unit: ingredient.unit
          }
        })
      }
    }

    return { success: true }
  } catch (error) {
    console.error('Error restoring backup:', error)
    throw error
  }
}

// Delete old backups (keep only last N backups)
export async function cleanupOldBackups(keepCount: number = 50) {
  try {
    const backups = await prisma.backup.findMany({
      orderBy: {
        createdAt: 'desc'
      },
      select: {
        id: true
      }
    })

    if (backups.length > keepCount) {
      const toDelete = backups.slice(keepCount)
      await prisma.backup.deleteMany({
        where: {
          id: {
            in: toDelete.map(b => b.id)
          }
        }
      })
    }
  } catch (error) {
    console.error('Error cleaning up backups:', error)
    throw error
  }
}
