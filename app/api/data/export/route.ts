
import { NextResponse } from 'next/server'
import { generateExportData } from '@/lib/backup'

export const dynamic = "force-dynamic"
export const maxDuration = 300 // 5 minut timeout

export async function GET() {
  try {
    // Use shared export function
    const exportData = await generateExportData()

    // Zwróć dane jako JSON
    return NextResponse.json(exportData, {
      status: 200,
      headers: {
        'Content-Disposition': `attachment; filename="kartoteka_full_export_${new Date().toISOString().split('T')[0]}.json"`
      }
    })

  } catch (error) {
    console.error('Export error:', error)
    return NextResponse.json(
      { 
        error: 'Błąd podczas eksportu danych',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
