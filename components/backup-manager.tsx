
'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Clock, Database, Undo2, Redo2 } from 'lucide-react'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { pl } from 'date-fns/locale'

interface Backup {
  id: string
  description: string | null
  createdAt: string
}

export function BackupManager() {
  const [backups, setBackups] = useState<Backup[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isOpen, setIsOpen] = useState(false)
  const [selectedBackup, setSelectedBackup] = useState<string | null>(null)
  const [showConfirm, setShowConfirm] = useState(false)

  const fetchBackups = async () => {
    try {
      const response = await fetch('/api/backups')
      if (response.ok) {
        const data = await response.json()
        setBackups(data)
      }
    } catch (error) {
      console.error('Error fetching backups:', error)
    }
  }

  useEffect(() => {
    if (isOpen) {
      fetchBackups()
    }
  }, [isOpen])

  const handleCreateBackup = async () => {
    setIsLoading(true)
    try {
      const response = await fetch('/api/backups', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          description: 'Ręczny backup'
        }),
      })

      if (response.ok) {
        toast.success('Backup utworzony pomyślnie')
        fetchBackups()
      } else {
        toast.error('Błąd podczas tworzenia backupu')
      }
    } catch (error) {
      console.error('Error creating backup:', error)
      toast.error('Błąd podczas tworzenia backupu')
    } finally {
      setIsLoading(false)
    }
  }

  const handleRestoreBackup = async () => {
    if (!selectedBackup) return

    setIsLoading(true)
    setShowConfirm(false)
    
    try {
      const response = await fetch('/api/backups/restore', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          backupId: selectedBackup
        }),
      })

      if (response.ok) {
        toast.success('Dane zostały przywrócone pomyślnie')
        setIsOpen(false)
        // Refresh the page to show restored data
        window.location.reload()
      } else {
        toast.error('Błąd podczas przywracania danych')
      }
    } catch (error) {
      console.error('Error restoring backup:', error)
      toast.error('Błąd podczas przywracania danych')
    } finally {
      setIsLoading(false)
      setSelectedBackup(null)
    }
  }

  const initiateRestore = (backupId: string) => {
    setSelectedBackup(backupId)
    setShowConfirm(true)
  }

  return (
    <>
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm">
            <Clock className="w-4 h-4 mr-2" />
            Historia zmian
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Historia zmian i backupy</DialogTitle>
            <DialogDescription>
              Przeglądaj historię zmian i przywracaj poprzednie stany systemu
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 mt-4">
            <div className="flex justify-between items-center">
              <p className="text-sm text-muted-foreground">
                Znaleziono {backups.length} zapisanych stanów
              </p>
              <Button
                onClick={handleCreateBackup}
                disabled={isLoading}
                size="sm"
              >
                <Database className="w-4 h-4 mr-2" />
                Utwórz backup teraz
              </Button>
            </div>

            <div className="border rounded-lg divide-y">
              {backups.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">
                  <Database className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>Brak zapisanych backupów</p>
                </div>
              ) : (
                backups.map((backup, index) => (
                  <div
                    key={backup.id}
                    className="p-4 hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3">
                          <Clock className="w-5 h-5 text-blue-600" />
                          <div>
                            <p className="font-medium">
                              {format(new Date(backup.createdAt), 'dd MMMM yyyy, HH:mm:ss', { locale: pl })}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {backup.description || 'Automatyczny backup'}
                            </p>
                          </div>
                        </div>
                        {index === 0 && (
                          <span className="inline-block mt-2 text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
                            Najnowszy
                          </span>
                        )}
                      </div>
                      <Button
                        onClick={() => initiateRestore(backup.id)}
                        disabled={isLoading}
                        variant="outline"
                        size="sm"
                      >
                        <Undo2 className="w-4 h-4 mr-2" />
                        Przywróć
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Czy na pewno chcesz przywrócić ten backup?</AlertDialogTitle>
            <AlertDialogDescription>
              Ta akcja nadpisze wszystkie obecne dane i przywróci stan z wybranego backupu.
              Przed przywróceniem zostanie utworzony backup obecnego stanu.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Anuluj</AlertDialogCancel>
            <AlertDialogAction onClick={handleRestoreBackup}>
              Przywróć backup
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
