/**
 * Backup management API.
 * 
 * GET /api/backup - Get backup info (last backup, list of backups)
 * POST /api/backup - Trigger automatic backup if needed, or force a new backup
 */

import { NextRequest, NextResponse } from 'next/server'
import {
  performAutomaticBackupIfNeeded,
  performBackupWithEmail,
  getLastBackupInfo,
  listBackupFiles,
  cleanupOldBackups,
} from '@/lib/backup'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300 // 5 minutes timeout

/**
 * GET /api/backup
 * Returns information about backups.
 */
export async function GET() {
  try {
    const [lastBackupInfo, backupFiles] = await Promise.all([
      getLastBackupInfo(),
      listBackupFiles(),
    ])
    
    return NextResponse.json({
      lastBackup: lastBackupInfo,
      backups: backupFiles.slice(0, 10), // Return only last 10 backups
      totalBackups: backupFiles.length,
    })
  } catch (error) {
    console.error('[Backup API] Error getting backup info:', error)
    return NextResponse.json(
      { error: 'Błąd podczas pobierania informacji o backupach' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/backup
 * Trigger a backup.
 * 
 * Body: { force?: boolean, skipEmail?: boolean }
 * - force: true = always create a new backup
 * - force: false (default) = only create if needed (weekly interval)
 * - skipEmail: true = don't send email (useful for local dev)
 */
export async function POST(request: NextRequest) {
  try {
    let force = false
    let skipEmail = false
    
    try {
      const body = await request.json()
      force = body?.force === true
      skipEmail = body?.skipEmail === true
    } catch {
      // Empty body is OK
    }
    
    if (force) {
      console.log('[Backup API] Forcing new backup with email delivery...')
      
      const result = await performBackupWithEmail()
      
      // Clean up old backups (keep last 10)
      const deletedCount = await cleanupOldBackups(10)
      
      // Build message based on what happened
      let message = 'Backup utworzony pomyślnie'
      if (result.emailSent) {
        message += ' i wysłany e-mailem'
      } else if (result.emailError) {
        message += ` (błąd wysyłania e-maila: ${result.emailError})`
      }
      
      return NextResponse.json({
        success: result.success,
        message,
        backup: result.backupInfo,
        emailSent: result.emailSent,
        emailError: result.emailError,
        deletedOldBackups: deletedCount,
      })
    } else {
      // Check if backup is needed
      const backupInfo = await performAutomaticBackupIfNeeded({ skipEmail })
      
      if (backupInfo) {
        // Clean up old backups after successful backup
        const deletedCount = await cleanupOldBackups(10)
        
        return NextResponse.json({
          success: true,
          message: 'Automatyczny backup utworzony',
          backup: backupInfo,
          deletedOldBackups: deletedCount,
        })
      } else {
        return NextResponse.json({
          success: true,
          message: 'Backup nie był potrzebny',
          backup: null,
        })
      }
    }
  } catch (error) {
    console.error('[Backup API] Error creating backup:', error)
    return NextResponse.json(
      { 
        error: 'Błąd podczas tworzenia backupu',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
