
'use client'

import { useState, useEffect, useRef } from 'react'
import { Html5Qrcode } from 'html5-qrcode'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Camera, X, AlertCircle, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

interface BarcodeScannerProps {
  isOpen: boolean
  onClose: () => void
  onScanSuccess: (productData: any) => void
}

export function BarcodeScanner({ isOpen, onClose, onScanSuccess }: BarcodeScannerProps) {
  const [isScanning, setIsScanning] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const scannerRef = useRef<Html5Qrcode | null>(null)
  const [cameraPermission, setCameraPermission] = useState<'granted' | 'denied' | 'prompt'>('prompt')

  useEffect(() => {
    if (isOpen) {
      checkCameraPermission()
    }
    return () => {
      stopScanner()
    }
  }, [isOpen])

  const checkCameraPermission = async () => {
    try {
      const result = await navigator.permissions.query({ name: 'camera' as PermissionName })
      setCameraPermission(result.state as 'granted' | 'denied' | 'prompt')
      
      result.addEventListener('change', () => {
        setCameraPermission(result.state as 'granted' | 'denied' | 'prompt')
      })
    } catch (err) {
      console.log('Permission API not supported', err)
      setCameraPermission('prompt')
    }
  }

  const startScanner = async () => {
    try {
      setError(null)
      setIsScanning(true)

      const scanner = new Html5Qrcode('barcode-reader')
      scannerRef.current = scanner

      const config = {
        fps: 10,
        qrbox: { width: 250, height: 250 },
        aspectRatio: 1.0,
        formatsToSupport: [
          0, // QR_CODE (może być czasem użyty)
          8, // EAN_13 (najpopularniejszy w Europie)
          9, // EAN_8
          13, // UPC_A
          14, // UPC_E
        ]
      }

      await scanner.start(
        { facingMode: 'environment' },
        config,
        async (decodedText) => {
          console.log('Zeskanowano kod:', decodedText)
          await handleBarcodeScanned(decodedText)
        },
        (errorMessage) => {
          // Ignoruj błędy ciągłego skanowania
          if (!errorMessage.includes('NotFoundException')) {
            console.log('Scanner error:', errorMessage)
          }
        }
      )
    } catch (err: any) {
      console.error('Error starting scanner:', err)
      setError(err?.message || 'Nie można uruchomić kamery. Sprawdź uprawnienia.')
      setIsScanning(false)
      toast.error('Nie można uruchomić kamery')
    }
  }

  const stopScanner = async () => {
    try {
      if (scannerRef.current) {
        await scannerRef.current.stop()
        scannerRef.current.clear()
        scannerRef.current = null
      }
      setIsScanning(false)
    } catch (err) {
      console.error('Error stopping scanner:', err)
    }
  }

  const handleBarcodeScanned = async (barcode: string) => {
    try {
      setIsLoading(true)
      await stopScanner()

      toast.loading('Wyszukiwanie produktu...', { id: 'barcode-search' })

      const response = await fetch(`/api/products/barcode?code=${barcode}`)
      
      if (!response.ok) {
        throw new Error('Produkt nie został znaleziony w bazie Open Food Facts')
      }

      const productData = await response.json()
      
      toast.success('Produkt znaleziony!', { id: 'barcode-search' })
      
      onScanSuccess(productData)
      onClose()
      
    } catch (err: any) {
      console.error('Error fetching product data:', err)
      toast.error(err.message || 'Nie znaleziono produktu', { id: 'barcode-search' })
      setError(err.message)
      setIsLoading(false)
      // Restart scanner po błędzie
      setTimeout(() => {
        setError(null)
        startScanner()
      }, 2000)
    }
  }

  const handleClose = async () => {
    await stopScanner()
    setError(null)
    setIsLoading(false)
    onClose()
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <Camera className="w-5 h-5 text-blue-600" />
            <span>Skanuj kod kreskowy</span>
          </DialogTitle>
          <DialogDescription>
            Zeskanuj kod kreskowy produktu, aby automatycznie uzupełnić dane
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {!isScanning && !isLoading && (
            <div className="text-center py-8">
              <Camera className="w-16 h-16 mx-auto mb-4 text-gray-400" />
              <p className="text-sm text-gray-600 mb-4">
                Kliknij przycisk poniżej, aby uruchomić kamerę i zeskanować kod kreskowy produktu
              </p>
              <Button
                onClick={startScanner}
                className="bg-blue-600 hover:bg-blue-700"
                disabled={cameraPermission === 'denied'}
              >
                <Camera className="w-4 h-4 mr-2" />
                Uruchom kamerę
              </Button>
              {cameraPermission === 'denied' && (
                <p className="text-sm text-red-600 mt-3">
                  Brak uprawnień do kamery. Włącz dostęp w ustawieniach przeglądarki.
                </p>
              )}
            </div>
          )}

          {isScanning && (
            <div className="space-y-4">
              <div id="barcode-reader" className="w-full rounded-lg overflow-hidden bg-black"></div>
              
              <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
                <p className="text-sm text-blue-900">
                  📱 Ustaw kod kreskowy w ramce. Skanowanie działa automatycznie.
                </p>
              </div>

              <Button
                onClick={stopScanner}
                variant="outline"
                className="w-full"
              >
                <X className="w-4 h-4 mr-2" />
                Zatrzymaj kamerę
              </Button>
            </div>
          )}

          {isLoading && (
            <div className="text-center py-8">
              <Loader2 className="w-12 h-12 mx-auto mb-4 text-blue-600 animate-spin" />
              <p className="text-sm text-gray-600">
                Wyszukiwanie produktu w bazie Open Food Facts...
              </p>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-md p-4">
              <div className="flex items-start space-x-3">
                <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-red-900">Błąd</p>
                  <p className="text-sm text-red-700 mt-1">{error}</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
