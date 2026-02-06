/**
 * Backup utilities for the inventory management system.
 * 
 * This module provides functions for:
 * - Generating full database exports
 * - Saving backups to the filesystem
 * - Sending backups via email
 * - Managing backup files
 */

import { prisma } from '@/lib/db'
import * as fs from 'fs/promises'
import * as path from 'path'
import { sendBackupByEmail } from './email'

// Backup directory relative to project root
const BACKUPS_DIR = 'backups'

// Key for storing last backup info in database
const LAST_BACKUP_KEY = 'last_automatic_backup'

// Minimum interval between automatic backups (7 days in milliseconds)
const BACKUP_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000

export interface ExportData {
  version: string
  exportDate: string
  data: {
    products: any[]
    transactions: any[]
    recipes: any[]
    recipeIngredients: any[]
    nutritionalStandards: any[]
    mealPlans: any[]
    mealPlanDays: any[]
    mealPlanMeals: any[]
    mealPlanRecipes: any[]
    appSettings: any[]
  }
}

export interface BackupInfo {
  fileName: string
  filePath: string
  createdAt: string
  sizeBytes: number
}

export interface LastBackupInfo {
  timestamp: string
  fileName: string
  status: 'success' | 'failed'
  error?: string
  // Email delivery info
  emailSent?: boolean
  emailRecipient?: string
  emailError?: string
}

// Default backup email address
const DEFAULT_BACKUP_EMAIL = 'zaopatrzenie@bajkowydworek.pl'

/**
 * Generate export data from the database.
 * This is the core export function used by both manual export and automatic backup.
 */
export async function generateExportData(): Promise<ExportData> {
  console.log('[Backup] Generating export data...')
  
  const [
    products,
    transactions,
    recipes,
    recipeIngredients,
    nutritionalStandards,
    mealPlans,
    mealPlanDays,
    mealPlanMeals,
    mealPlanRecipes,
    appSettings
  ] = await Promise.all([
    prisma.product.findMany(),
    prisma.transaction.findMany(),
    prisma.recipe.findMany(),
    prisma.recipeIngredient.findMany(),
    prisma.nutritionalStandards.findMany(),
    prisma.mealPlan.findMany(),
    prisma.mealPlanDay.findMany(),
    prisma.mealPlanMeal.findMany(),
    prisma.mealPlanRecipe.findMany(),
    prisma.appSettings.findMany()
  ])

  const exportData: ExportData = {
    version: '2.0',
    exportDate: new Date().toISOString(),
    data: {
      products: products.map(p => ({
        id: p.id,
        name: p.name,
        unit: p.unit,
        packagingType: p.packagingType,
        currentStock: p.currentStock,
        barcode: p.barcode,
        packageWeight: p.packageWeight,
        packageUnit: p.packageUnit,
        manufacturer: p.manufacturer,
        calories: p.calories,
        salt: p.salt,
        protein: p.protein,
        fat: p.fat,
        saturatedFat: p.saturatedFat,
        carbohydrates: p.carbohydrates,
        sugars: p.sugars,
        calcium: p.calcium,
        iron: p.iron,
        vitaminC: p.vitaminC,
        allergens: p.allergens,
        createdAt: p.createdAt.toISOString(),
        updatedAt: p.updatedAt.toISOString()
      })),
      transactions: transactions.map(t => ({
        id: t.id,
        productId: t.productId,
        date: t.date.toISOString(),
        document: t.document,
        type: t.type,
        quantity: t.quantity,
        loss: t.loss,
        balance: t.balance,
        createdAt: t.createdAt.toISOString()
      })),
      recipes: recipes.map(r => ({
        id: r.id,
        name: r.name,
        description: r.description,
        servings: r.servings,
        mealType: r.mealType,
        categories: r.categories,
        createdAt: r.createdAt.toISOString(),
        updatedAt: r.updatedAt.toISOString()
      })),
      recipeIngredients: recipeIngredients.map(ri => ({
        id: ri.id,
        recipeId: ri.recipeId,
        productId: ri.productId,
        productName: ri.productName,
        quantity: ri.quantity,
        unit: ri.unit
      })),
      nutritionalStandards: nutritionalStandards.map(ns => ({
        id: ns.id,
        name: ns.name,
        energyMin: ns.energyMin,
        energyMax: ns.energyMax,
        proteinPercentMin: ns.proteinPercentMin,
        proteinPercentMax: ns.proteinPercentMax,
        fatPercentMin: ns.fatPercentMin,
        fatPercentMax: ns.fatPercentMax,
        carbohydratesPercentMin: ns.carbohydratesPercentMin,
        carbohydratesPercentMax: ns.carbohydratesPercentMax,
        calcium: ns.calcium,
        iron: ns.iron,
        vitaminC: ns.vitaminC,
        createdAt: ns.createdAt.toISOString(),
        updatedAt: ns.updatedAt.toISOString()
      })),
      mealPlans: mealPlans.map(mp => ({
        id: mp.id,
        name: mp.name,
        weekNumber: mp.weekNumber,
        startDate: mp.startDate?.toISOString(),
        endDate: mp.endDate?.toISOString(),
        season: mp.season,
        description: mp.description,
        standardsId: mp.standardsId,
        displayOrder: mp.displayOrder,
        createdAt: mp.createdAt.toISOString(),
        updatedAt: mp.updatedAt.toISOString()
      })),
      mealPlanDays: mealPlanDays.map(mpd => ({
        id: mpd.id,
        mealPlanId: mpd.mealPlanId,
        dayOfWeek: mpd.dayOfWeek,
        date: mpd.date?.toISOString(),
        createdAt: mpd.createdAt.toISOString(),
        updatedAt: mpd.updatedAt.toISOString()
      })),
      mealPlanMeals: mealPlanMeals.map(mpm => ({
        id: mpm.id,
        mealPlanDayId: mpm.mealPlanDayId,
        mealType: mpm.mealType,
        order: mpm.order,
        createdAt: mpm.createdAt.toISOString(),
        updatedAt: mpm.updatedAt.toISOString()
      })),
      mealPlanRecipes: mealPlanRecipes.map(mpr => ({
        id: mpr.id,
        mealPlanMealId: mpr.mealPlanMealId,
        recipeId: mpr.recipeId,
        servings: mpr.servings,
        order: mpr.order,
        createdAt: mpr.createdAt.toISOString()
      })),
      appSettings: appSettings.map(settings => ({
        id: settings.id,
        enabledMeals: settings.enabledMeals,
        includeInCalories: settings.includeInCalories,
        exportForParents: settings.exportForParents,
        exportForSanepid: settings.exportForSanepid,
        customMeals: settings.customMeals,
        nutritionalGuidelines: settings.nutritionalGuidelines,
        createdAt: settings.createdAt.toISOString(),
        updatedAt: settings.updatedAt.toISOString()
      }))
    }
  }

  console.log('[Backup] Export data generated successfully')
  return exportData
}

/**
 * Get the absolute path to the backups directory.
 */
export function getBackupsDir(): string {
  return path.join(process.cwd(), BACKUPS_DIR)
}

/**
 * Ensure the backups directory exists.
 */
export async function ensureBackupsDir(): Promise<void> {
  const backupsDir = getBackupsDir()
  try {
    await fs.access(backupsDir)
  } catch {
    console.log('[Backup] Creating backups directory:', backupsDir)
    await fs.mkdir(backupsDir, { recursive: true })
  }
}

/**
 * Generate a backup filename with timestamp.
 */
export function generateBackupFileName(): string {
  const now = new Date()
  const timestamp = now.toISOString()
    .replace(/[:.]/g, '-')
    .replace('T', '-')
    .replace('Z', '')
  return `backup-${timestamp}.json`
}

/**
 * Save export data to a backup file.
 * 
 * @param exportData - The data to save
 * @returns Information about the created backup file
 */
export async function saveBackupToFile(exportData: ExportData): Promise<BackupInfo> {
  await ensureBackupsDir()
  
  const fileName = generateBackupFileName()
  const filePath = path.join(getBackupsDir(), fileName)
  const jsonContent = JSON.stringify(exportData, null, 2)
  
  console.log('[Backup] Saving backup to:', filePath)
  await fs.writeFile(filePath, jsonContent, 'utf-8')
  
  const stats = await fs.stat(filePath)
  
  const backupInfo: BackupInfo = {
    fileName,
    filePath,
    createdAt: exportData.exportDate,
    sizeBytes: stats.size,
  }
  
  console.log(`[Backup] Weekly export saved to: ${filePath} (${(stats.size / 1024).toFixed(2)} KB)`)
  
  return backupInfo
}

/**
 * Get list of existing backup files, sorted by date (newest first).
 */
export async function listBackupFiles(): Promise<BackupInfo[]> {
  await ensureBackupsDir()
  
  const backupsDir = getBackupsDir()
  const files = await fs.readdir(backupsDir)
  
  const backups: BackupInfo[] = []
  
  for (const fileName of files) {
    if (!fileName.startsWith('backup-') || !fileName.endsWith('.json')) {
      continue
    }
    
    const filePath = path.join(backupsDir, fileName)
    try {
      const stats = await fs.stat(filePath)
      backups.push({
        fileName,
        filePath,
        createdAt: stats.mtime.toISOString(),
        sizeBytes: stats.size,
      })
    } catch (error) {
      console.error(`[Backup] Error reading backup file ${fileName}:`, error)
    }
  }
  
  // Sort by creation date, newest first
  backups.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  
  return backups
}

/**
 * Get the most recent backup file.
 */
export async function getLatestBackup(): Promise<BackupInfo | null> {
  const backups = await listBackupFiles()
  return backups.length > 0 ? backups[0] : null
}

/**
 * Read a backup file and return its contents.
 */
export async function readBackupFile(fileName: string): Promise<string> {
  const filePath = path.join(getBackupsDir(), fileName)
  return await fs.readFile(filePath, 'utf-8')
}

/**
 * Store last backup info in the database.
 */
export async function storeLastBackupInfo(info: LastBackupInfo): Promise<void> {
  // We'll store this in a simple key-value approach using appSettings
  // For now, we'll use a JSON file in the backups directory
  const infoPath = path.join(getBackupsDir(), 'last-backup-info.json')
  await fs.writeFile(infoPath, JSON.stringify(info, null, 2), 'utf-8')
}

/**
 * Get last backup info from storage.
 */
export async function getLastBackupInfo(): Promise<LastBackupInfo | null> {
  try {
    const infoPath = path.join(getBackupsDir(), 'last-backup-info.json')
    const content = await fs.readFile(infoPath, 'utf-8')
    return JSON.parse(content) as LastBackupInfo
  } catch {
    return null
  }
}

/**
 * Check if a new automatic backup is needed (based on time interval).
 */
export async function isBackupNeeded(): Promise<boolean> {
  const lastBackup = await getLastBackupInfo()
  
  if (!lastBackup || lastBackup.status === 'failed') {
    return true
  }
  
  const lastBackupTime = new Date(lastBackup.timestamp).getTime()
  const now = Date.now()
  
  return (now - lastBackupTime) >= BACKUP_INTERVAL_MS
}

/**
 * Get the backup email address from settings.
 * Falls back to default if not configured.
 */
export async function getBackupEmail(): Promise<string> {
  try {
    const settings = await prisma.appSettings.findFirst()
    return settings?.backupEmail || DEFAULT_BACKUP_EMAIL
  } catch (error) {
    console.error('[Backup] Error getting backup email from settings:', error)
    return DEFAULT_BACKUP_EMAIL
  }
}

/**
 * Perform an automatic weekly backup if needed.
 * Saves to filesystem (for local dev) and sends via email (for production).
 * 
 * @param options - Optional settings
 * @param options.skipEmail - Skip email delivery (default: false)
 * @returns Information about the backup, or null if no backup was needed/created
 */
export async function performAutomaticBackupIfNeeded(options?: { 
  skipEmail?: boolean 
}): Promise<BackupInfo | null> {
  console.log('[Backup] Checking if automatic backup is needed...')
  
  if (!await isBackupNeeded()) {
    console.log('[Backup] Automatic backup not needed yet')
    return null
  }
  
  console.log('[Backup] Starting automatic weekly backup...')
  
  const backupResult: LastBackupInfo = {
    timestamp: new Date().toISOString(),
    fileName: '',
    status: 'success',
  }
  
  let backupInfo: BackupInfo | null = null
  let jsonContent: string = ''
  
  try {
    // Generate export data
    const exportData = await generateExportData()
    jsonContent = JSON.stringify(exportData, null, 2)
    
    // Try to save to filesystem (may fail on read-only systems like Vercel)
    try {
      backupInfo = await saveBackupToFile(exportData)
      backupResult.fileName = backupInfo.fileName
      console.log('[Backup] File saved successfully')
    } catch (fsError) {
      console.warn('[Backup] Could not save to filesystem (may be read-only):', fsError)
      // Continue - email delivery is the primary method for production
    }
    
    // Send via email (primary delivery method for production)
    if (!options?.skipEmail) {
      const recipientEmail = await getBackupEmail()
      backupResult.emailRecipient = recipientEmail
      
      console.log(`[Backup] Sending backup email to: ${recipientEmail}`)
      
      const emailResult = await sendBackupByEmail({
        recipientEmail,
        jsonData: jsonContent,
        date: new Date(),
      })
      
      if (emailResult.success) {
        backupResult.emailSent = true
        console.log('[Backup] Email sent successfully')
      } else {
        backupResult.emailSent = false
        backupResult.emailError = emailResult.error
        console.error(`[Backup] Failed to send email: ${emailResult.error}`)
      }
    }
    
    // Store success info
    await storeLastBackupInfo(backupResult)
    
    console.log('[Backup] Automatic backup completed successfully')
    return backupInfo
    
  } catch (error) {
    console.error('[Backup] Weekly export failed:', error)
    
    // Store failure info
    await storeLastBackupInfo({
      timestamp: new Date().toISOString(),
      fileName: '',
      status: 'failed',
      error: error instanceof Error ? error.message : 'Unknown error',
    })
    
    return null
  }
}

/**
 * Perform a backup and send via email.
 * This can be called manually or by the scheduled job.
 * 
 * @param recipientEmail - Optional override for recipient email
 * @returns Result of the backup operation
 */
export async function performBackupWithEmail(recipientEmail?: string): Promise<{
  success: boolean
  backupInfo?: BackupInfo | null
  emailSent: boolean
  emailError?: string
}> {
  console.log('[Backup] Performing backup with email delivery...')
  
  try {
    // Generate export data
    const exportData = await generateExportData()
    const jsonContent = JSON.stringify(exportData, null, 2)
    
    // Try to save to filesystem
    let backupInfo: BackupInfo | null = null
    try {
      backupInfo = await saveBackupToFile(exportData)
    } catch (fsError) {
      console.warn('[Backup] Could not save to filesystem:', fsError)
    }
    
    // Get recipient email
    const email = recipientEmail || await getBackupEmail()
    
    // Send via email
    const emailResult = await sendBackupByEmail({
      recipientEmail: email,
      jsonData: jsonContent,
      date: new Date(),
    })
    
    // Store backup info
    await storeLastBackupInfo({
      timestamp: new Date().toISOString(),
      fileName: backupInfo?.fileName || '',
      status: 'success',
      emailSent: emailResult.success,
      emailRecipient: email,
      emailError: emailResult.error,
    })
    
    return {
      success: true,
      backupInfo,
      emailSent: emailResult.success,
      emailError: emailResult.error,
    }
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('[Backup] Backup with email failed:', errorMessage)
    
    await storeLastBackupInfo({
      timestamp: new Date().toISOString(),
      fileName: '',
      status: 'failed',
      error: errorMessage,
      emailSent: false,
    })
    
    return {
      success: false,
      emailSent: false,
      emailError: errorMessage,
    }
  }
}

/**
 * Delete old backup files, keeping only the most recent N files.
 * 
 * @param keepCount - Number of recent backups to keep (default: 10)
 */
export async function cleanupOldBackups(keepCount: number = 10): Promise<number> {
  const backups = await listBackupFiles()
  
  if (backups.length <= keepCount) {
    return 0
  }
  
  const toDelete = backups.slice(keepCount)
  let deletedCount = 0
  
  for (const backup of toDelete) {
    try {
      await fs.unlink(backup.filePath)
      deletedCount++
      console.log(`[Backup] Deleted old backup: ${backup.fileName}`)
    } catch (error) {
      console.error(`[Backup] Failed to delete ${backup.fileName}:`, error)
    }
  }
  
  return deletedCount
}
