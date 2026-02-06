/**
 * Backup download API.
 * 
 * GET /api/backup/download?file=backup-xxx.json - Download a specific backup
 * GET /api/backup/download - Download the latest backup
 */

import { NextRequest, NextResponse } from 'next/server'
import { getLatestBackup, readBackupFile, listBackupFiles } from '@/lib/backup'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const fileName = searchParams.get('file')
    
    let backupFileName: string
    
    if (fileName) {
      // Validate filename to prevent directory traversal
      if (!fileName.startsWith('backup-') || !fileName.endsWith('.json') || fileName.includes('..') || fileName.includes('/')) {
        return NextResponse.json(
          { error: 'Nieprawidłowa nazwa pliku' },
          { status: 400 }
        )
      }
      
      // Check if file exists
      const backups = await listBackupFiles()
      const found = backups.find(b => b.fileName === fileName)
      if (!found) {
        return NextResponse.json(
          { error: 'Plik backupu nie istnieje' },
          { status: 404 }
        )
      }
      
      backupFileName = fileName
    } else {
      // Get latest backup
      const latestBackup = await getLatestBackup()
      if (!latestBackup) {
        return NextResponse.json(
          { error: 'Brak dostępnych backupów' },
          { status: 404 }
        )
      }
      backupFileName = latestBackup.fileName
    }
    
    const content = await readBackupFile(backupFileName)
    
    return new NextResponse(content, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="${backupFileName}"`,
      },
    })
  } catch (error) {
    console.error('[Backup Download] Error:', error)
    return NextResponse.json(
      { error: 'Błąd podczas pobierania backupu' },
      { status: 500 }
    )
  }
}
