
'use client'

import { useState, useRef } from 'react'
import { Download, Upload, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { 
  AlertDialog, 
  AlertDialogAction, 
  AlertDialogCancel, 
  AlertDialogContent, 
  AlertDialogDescription, 
  AlertDialogFooter, 
  AlertDialogHeader, 
  AlertDialogTitle 
} from '@/components/ui/alert-dialog'
import { toast } from 'sonner'

export function DataManagement() {
  const [isExporting, setIsExporting] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const [showImportWarning, setShowImportWarning] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleExport = async () => {
    setIsExporting(true)
    try {
      const response = await fetch('/api/data/export')
      
      if (!response.ok) {
        throw new Error('Błąd podczas eksportowania danych')
      }

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `kartoteka_full_export_${new Date().toISOString().split('T')[0]}.json`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)

      toast.success('Dane zostały pomyślnie wyeksportowane')
    } catch (error) {
      console.error('Export error:', error)
      toast.error('Błąd podczas eksportowania danych')
    } finally {
      setIsExporting(false)
    }
  }

  const handleImportClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click()
    }
  }

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      if (!file.name.endsWith('.json')) {
        toast.error('Wybierz plik w formacie JSON')
        event.target.value = ''
        return
      }
      setSelectedFile(file)
      setShowImportWarning(true)
    }
  }

  const handleImport = async () => {
    if (!selectedFile) return

    setIsImporting(true)
    setShowImportWarning(false)

    try {
      const formData = new FormData()
      formData.append('file', selectedFile)

      const response = await fetch('/api/data/import', {
        method: 'POST',
        body: formData
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Błąd podczas importowania danych')
      }

      toast.success(
        `Dane zostały pomyślnie zaimportowane!\n` +
        `Produkty: ${result.stats.productsCount}\n` +
        `Transakcje: ${result.stats.transactionsCount}\n` +
        `Receptury: ${result.stats.recipesCount}\n` +
        `Jadłospisy: ${result.stats.mealPlansCount}`
      )

      // Odśwież stronę po 2 sekundach
      setTimeout(() => {
        window.location.reload()
      }, 2000)
    } catch (error) {
      console.error('Import error:', error)
      toast.error(error instanceof Error ? error.message : 'Błąd podczas importowania danych')
    } finally {
      setIsImporting(false)
      setSelectedFile(null)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const handleCancelImport = () => {
    setSelectedFile(null)
    setShowImportWarning(false)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  return (
    <>
      <div className="mt-12 border-t border-gray-200 pt-8">
        <div className="text-center space-y-4">
          <h3 className="text-lg font-semibold text-gray-900">
            Zarządzanie danymi
          </h3>
          <p className="text-sm text-gray-600 max-w-2xl mx-auto">
            Eksportuj wszystkie dane do pliku JSON lub zaimportuj dane z wcześniejszego backupu
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Button
              onClick={handleExport}
              disabled={isExporting}
              className="gap-2 bg-blue-600 hover:bg-blue-700 min-w-[200px]"
            >
              <Download className="w-4 h-4" />
              {isExporting ? 'Eksportowanie...' : 'Eksportuj wszystkie dane'}
            </Button>

            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              onChange={handleFileSelect}
              className="hidden"
              disabled={isImporting}
            />
            <Button
              onClick={handleImportClick}
              disabled={isImporting}
              className="gap-2 bg-green-600 hover:bg-green-700 min-w-[200px]"
            >
              <Upload className="w-4 h-4" />
              {isImporting ? 'Importowanie...' : 'Importuj wszystkie dane'}
            </Button>
          </div>

          <div className="flex items-start gap-2 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3 max-w-2xl mx-auto">
            <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <p className="text-left">
              <strong>Uwaga:</strong> Import danych zastąpi wszystkie obecne dane w systemie. 
              Upewnij się, że masz backup przed wykonaniem importu.
            </p>
          </div>
        </div>
      </div>

      <AlertDialog open={showImportWarning} onOpenChange={setShowImportWarning}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-amber-700">
              <AlertTriangle className="w-5 h-5" />
              Czy na pewno chcesz zaimportować dane?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-left space-y-2">
              <p>
                Import danych spowoduje <strong>usunięcie wszystkich obecnych danych</strong> w systemie i zastąpienie ich danymi z pliku:
              </p>
              <p className="font-medium text-gray-900">
                {selectedFile?.name}
              </p>
              <p className="text-amber-700 font-medium">
                Ta operacja jest nieodwracalna! Upewnij się, że masz backup obecnych danych.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleCancelImport}>
              Anuluj
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleImport}
              className="bg-amber-600 hover:bg-amber-700"
            >
              Tak, importuj dane
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
