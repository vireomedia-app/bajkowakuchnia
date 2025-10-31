
import { NextResponse } from 'next/server'
import { restoreBackup } from '@/lib/backup-utils'

export async function POST(request: Request) {
  try {
    const { backupId } = await request.json()
    
    if (!backupId) {
      return NextResponse.json(
        { error: 'Backup ID is required' },
        { status: 400 }
      )
    }

    await restoreBackup(backupId)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error restoring backup:', error)
    return NextResponse.json(
      { error: 'Failed to restore backup' },
      { status: 500 }
    )
  }
}
