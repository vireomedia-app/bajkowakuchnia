
import { NextResponse } from 'next/server'
import { createBackup, getBackups } from '@/lib/backup-utils'

export async function GET() {
  try {
    const backups = await getBackups()
    return NextResponse.json(backups)
  } catch (error) {
    console.error('Error fetching backups:', error)
    return NextResponse.json(
      { error: 'Failed to fetch backups' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const { description } = await request.json()
    const backup = await createBackup(description)
    return NextResponse.json(backup)
  } catch (error) {
    console.error('Error creating backup:', error)
    return NextResponse.json(
      { error: 'Failed to create backup' },
      { status: 500 }
    )
  }
}
