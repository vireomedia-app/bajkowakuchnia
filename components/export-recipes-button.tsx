
'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Download } from 'lucide-react'
import { toast } from 'sonner'

export function ExportRecipesButton() {
  const [isExporting, setIsExporting] = useState(false)

  const handleExport = async () => {
    setIsExporting(true)
    
    try {
      const response = await fetch('/api/menu/export', {
        method: 'GET',
      })
      
      if (!response.ok) {
        throw new Error('Błąd podczas eksportu danych')
      }
      
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      
      // Get current date for filename
      const now = new Date()
      const dateStr = now.toISOString().split('T')[0]
      link.download = `receptury_jadlospis_${dateStr}.xlsx`
      
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)
      
      toast.success('Plik Excel z recepturami został pobrany pomyślnie!')
      
    } catch (error) {
      console.error('Export error:', error)
      toast.error('Błąd podczas eksportu receptur')
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <Button
      onClick={handleExport}
      variant="outline"
      disabled={isExporting}
      size="sm"
    >
      {isExporting ? (
        <div className="flex items-center space-x-2">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
          <span>Eksportowanie...</span>
        </div>
      ) : (
        <>
          <Download className="w-4 h-4 mr-2" />
          Eksportuj receptury do Excel
        </>
      )}
    </Button>
  )
}
