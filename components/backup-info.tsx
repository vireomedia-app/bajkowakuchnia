'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Download, RefreshCw, Clock, CheckCircle, XCircle, Loader2, HardDrive, Mail, Save } from 'lucide-react'
import { toast } from 'sonner'

interface BackupFile {
  fileName: string
  createdAt: string
  sizeBytes: number
}

interface LastBackup {
  timestamp: string
  fileName: string
  status: 'success' | 'failed'
  error?: string
  emailSent?: boolean
  emailRecipient?: string
  emailError?: string
}

interface BackupInfoData {
  lastBackup: LastBackup | null
  backups: BackupFile[]
  totalBackups: number
}

export function BackupInfo() {
  const [data, setData] = useState<BackupInfoData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isCreatingBackup, setIsCreatingBackup] = useState(false)
  const [isDownloading, setIsDownloading] = useState(false)
  
  // Email settings
  const [backupEmail, setBackupEmail] = useState('')
  const [originalEmail, setOriginalEmail] = useState('')
  const [isSavingEmail, setIsSavingEmail] = useState(false)
  const [isLoadingSettings, setIsLoadingSettings] = useState(true)

  const fetchBackupInfo = async () => {
    try {
      const response = await fetch('/api/backup')
      if (response.ok) {
        const info = await response.json()
        setData(info)
      }
    } catch (error) {
      console.error('Error fetching backup info:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const fetchSettings = async () => {
    try {
      const response = await fetch('/api/settings')
      if (response.ok) {
        const settings = await response.json()
        const email = settings.backupEmail || 'zaopatrzenie@bajkowydworek.pl'
        setBackupEmail(email)
        setOriginalEmail(email)
      }
    } catch (error) {
      console.error('Error fetching settings:', error)
    } finally {
      setIsLoadingSettings(false)
    }
  }

  useEffect(() => {
    fetchBackupInfo()
    fetchSettings()
  }, [])

  const handleCreateBackup = async () => {
    setIsCreatingBackup(true)
    try {
      const response = await fetch('/api/backup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ force: true }),
      })
      
      const result = await response.json()
      
      if (response.ok) {
        toast.success(result.message || 'Backup utworzony pomyślnie')
        fetchBackupInfo() // Refresh info
      } else {
        toast.error(result.error || 'Błąd podczas tworzenia backupu')
      }
    } catch (error) {
      console.error('Error creating backup:', error)
      toast.error('Błąd podczas tworzenia backupu')
    } finally {
      setIsCreatingBackup(false)
    }
  }

  const handleDownloadLatest = async () => {
    if (!data?.backups?.length) {
      toast.error('Brak dostępnych backupów')
      return
    }

    setIsDownloading(true)
    try {
      const response = await fetch('/api/backup/download')
      
      if (!response.ok) {
        throw new Error('Download failed')
      }
      
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = data.backups[0].fileName
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
      
      toast.success('Backup pobrany')
    } catch (error) {
      console.error('Error downloading backup:', error)
      toast.error('Błąd podczas pobierania backupu')
    } finally {
      setIsDownloading(false)
    }
  }

  const handleSaveEmail = async () => {
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(backupEmail)) {
      toast.error('Podaj poprawny adres e-mail')
      return
    }

    setIsSavingEmail(true)
    try {
      const response = await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ backupEmail }),
      })

      if (response.ok) {
        setOriginalEmail(backupEmail)
        toast.success('Adres e-mail do backupów został zaktualizowany')
      } else {
        const error = await response.json()
        toast.error(error.error || 'Błąd podczas zapisywania ustawień')
      }
    } catch (error) {
      console.error('Error saving email:', error)
      toast.error('Błąd podczas zapisywania ustawień')
    } finally {
      setIsSavingEmail(false)
    }
  }

  const hasEmailChanged = backupEmail !== originalEmail

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleString('pl-PL', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <HardDrive className="w-5 h-5" />
            Automatyczne backupy
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <HardDrive className="w-5 h-5" />
          Automatyczne backupy
        </CardTitle>
        <CardDescription>
          System automatycznie tworzy kopie zapasowe co tydzień i wysyła je na skonfigurowany adres e-mail.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Last backup status */}
        <div className="flex items-start gap-3 p-4 bg-gray-50 rounded-lg">
          {data?.lastBackup ? (
            <>
              {data.lastBackup.status === 'success' ? (
                <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />
              ) : (
                <XCircle className="w-5 h-5 text-red-600 mt-0.5" />
              )}
              <div className="flex-1">
                <p className="font-medium text-gray-900">
                  {data.lastBackup.status === 'success' 
                    ? 'Ostatni backup zakończony pomyślnie' 
                    : 'Ostatni backup nie powiódł się'}
                </p>
                <p className="text-sm text-gray-600 flex items-center gap-1 mt-1">
                  <Clock className="w-4 h-4" />
                  {formatDate(data.lastBackup.timestamp)}
                </p>
                {data.lastBackup.fileName && (
                  <p className="text-xs text-gray-500 mt-1">
                    Plik: {data.lastBackup.fileName}
                  </p>
                )}
                {/* Email delivery status */}
                {data.lastBackup.emailRecipient && (
                  <div className="flex items-center gap-1 mt-2">
                    <Mail className="w-3.5 h-3.5 text-gray-500" />
                    <span className="text-xs text-gray-500">
                      {data.lastBackup.emailSent ? (
                        <span className="text-green-600">
                          Wysłano na: {data.lastBackup.emailRecipient}
                        </span>
                      ) : (
                        <span className="text-red-600">
                          Błąd wysyłania: {data.lastBackup.emailError || 'Nieznany błąd'}
                        </span>
                      )}
                    </span>
                  </div>
                )}
                {data.lastBackup.error && (
                  <p className="text-xs text-red-600 mt-1">
                    Błąd: {data.lastBackup.error}
                  </p>
                )}
              </div>
            </>
          ) : (
            <>
              <Clock className="w-5 h-5 text-gray-400 mt-0.5" />
              <div>
                <p className="font-medium text-gray-900">Brak automatycznych backupów</p>
                <p className="text-sm text-gray-600">Utwórz pierwszy backup ręcznie</p>
              </div>
            </>
          )}
        </div>

        {/* Backup count */}
        {data?.totalBackups && data.totalBackups > 0 && (
          <div className="text-sm text-gray-600">
            Dostępnych backupów: <span className="font-medium">{data.totalBackups}</span>
            {data.backups?.[0] && (
              <span className="text-gray-500">
                {' '}(najnowszy: {formatSize(data.backups[0].sizeBytes)})
              </span>
            )}
          </div>
        )}

        {/* Action buttons */}
        <div className="flex flex-wrap gap-3 pt-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleCreateBackup}
            disabled={isCreatingBackup}
          >
            {isCreatingBackup ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4 mr-2" />
            )}
            Utwórz backup teraz
          </Button>
          
          {data?.backups && data.backups.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleDownloadLatest}
              disabled={isDownloading}
            >
              {isDownloading ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Download className="w-4 h-4 mr-2" />
              )}
              Pobierz ostatni backup
            </Button>
          )}
        </div>

        {/* Separator */}
        <hr className="border-gray-200" />

        {/* Email configuration */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Mail className="w-4 h-4 text-gray-600" />
            <Label htmlFor="backup-email" className="text-sm font-medium text-gray-900">
              Adres e-mail do backupów
            </Label>
          </div>
          <p className="text-xs text-gray-500">
            Automatyczne backupy będą wysyłane na ten adres co tydzień.
          </p>
          <div className="flex gap-2">
            <Input
              id="backup-email"
              type="email"
              value={backupEmail}
              onChange={(e) => setBackupEmail(e.target.value)}
              placeholder="zaopatrzenie@bajkowydworek.pl"
              className="flex-1"
              disabled={isLoadingSettings}
            />
            <Button
              variant="default"
              size="sm"
              onClick={handleSaveEmail}
              disabled={isSavingEmail || !hasEmailChanged || isLoadingSettings}
            >
              {isSavingEmail ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              <span className="ml-2 hidden sm:inline">Zapisz</span>
            </Button>
          </div>
        </div>

        {/* Info about automatic backups */}
        <p className="text-xs text-gray-500 pt-2">
          Automatyczne backupy są tworzone co tydzień. W środowisku produkcyjnym (Vercel) są wysyłane wyłącznie 
          e-mailem, lokalnie zapisywane również w katalogu <code className="bg-gray-100 px-1 rounded">backups/</code>.
        </p>
      </CardContent>
    </Card>
  )
}
