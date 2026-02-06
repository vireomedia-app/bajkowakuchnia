
'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Download } from 'lucide-react'
import { toast } from 'sonner'

export function ExportButton() {
  const [isExporting, setIsExporting] = useState(false)

  const handleExport = async () => {
    setIsExporting(true)
    
    try {
      const response = await fetch('/api/export', {
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
      link.download = `kartoteka_magazynowa_${dateStr}.xlsx`
      
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)
      
      toast.success('Plik Excel został pobrany pomyślnie!')
      
    } catch (error) {
      console.error('Export error:', error)
      toast.error('Błąd podczas eksportu danych')
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <Button
      onClick={handleExport}
      variant="outline"
      disabled={isExporting}
      className="border-gray-300 hover:bg-gray-50 px-6 py-2.5 rounded-lg font-medium shadow-sm hover:shadow-md transition-all duration-200"
    >
      {isExporting ? (
        <div className="flex items-center space-x-2">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
          <span>Eksportowanie...</span>
        </div>
      ) : (
        <>
          <Download className="w-5 h-5 mr-2" />
          Eksportuj do Excel
        </>
      )}
    </Button>
  )
}
