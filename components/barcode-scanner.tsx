
'use client'

import { useState, useEffect, useRef } from 'react'
import { Html5Qrcode } from 'html5-qrcode'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Camera, X, AlertCircle, Loader2, Settings, PackagePlus } from 'lucide-react'
import { toast } from 'sonner'
import { isValidBarcode, getBarcodeValidationError, generateUnknownProductName } from '@/lib/barcode'

interface BarcodeScannerProps {
  isOpen: boolean
  onClose: () => void
  onScanSuccess: (productData: any) => void
  mode?: 'add_product' | 'receive_order' // Tryb działania skanera
}

export function BarcodeScanner({ isOpen, onClose, onScanSuccess, mode = 'add_product' }: BarcodeScannerProps) {
  const [isScanning, setIsScanning] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [permissionDenied, setPermissionDenied] = useState(false)
  const [showManualAddDialog, setShowManualAddDialog] = useState(false)
  const [scannedBarcode, setScannedBarcode] = useState<string>('')
  const scannerRef = useRef<Html5Qrcode | null>(null)
  const hasAutoStarted = useRef(false)

  // Auto-start scanner when modal opens
  useEffect(() => {
    if (isOpen && !hasAutoStarted.current) {
      hasAutoStarted.current = true
      // Małe opóźnienie aby DOM zdążył się wyrenderować
      const timer = setTimeout(() => {
        startScanner()
      }, 300)
      return () => clearTimeout(timer)
    }
  }, [isOpen])

  // Cleanup when modal closes
  useEffect(() => {
    if (!isOpen) {
      hasAutoStarted.current = false
      stopScanner()
    }
    
    return () => {
      stopScanner()
    }
  }, [isOpen])

  const startScanner = async () => {
    try {
      setError(null)
      setPermissionDenied(false)
      setIsScanning(true)

      // Czekamy na następną ramkę, aby React zdążył wyrenderować element DOM
      await new Promise(resolve => setTimeout(resolve, 100))

      // Sprawdzamy czy element istnieje
      const element = document.getElementById('barcode-reader')
      if (!element) {
        throw new Error('Element skanera nie został wyrenderowany')
      }

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

      // Próbujemy uruchomić kamerę - przeglądarka automatycznie zapyta o uprawnienia
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
      setIsScanning(false)
      
      // Sprawdź czy to problem z uprawnieniami
      const errorMsg = err?.message || err?.toString() || ''
      const isPermissionError = 
        errorMsg.toLowerCase().includes('permission') ||
        errorMsg.toLowerCase().includes('notallowed') ||
        errorMsg.toLowerCase().includes('denied') ||
        errorMsg.toLowerCase().includes('not allowed')
      
      if (isPermissionError) {
        setPermissionDenied(true)
        setError('Brak dostępu do kamery')
        toast.error('Odmówiono dostępu do kamery')
      } else {
        setError(errorMsg || 'Nie można uruchomić kamery')
        toast.error('Nie można uruchomić kamery')
      }
    }
  }

  const stopScanner = async () => {
    try {
      if (scannerRef.current) {
        const scanner = scannerRef.current
        scannerRef.current = null // Najpierw czyścimy referencję
        
        // Sprawdzamy czy skaner jest aktywny
        if (scanner.getState() === 2) { // 2 = SCANNING
          await scanner.stop()
        }
        
        // Czyścimy zasoby
        scanner.clear()
      }
      setIsScanning(false)
    } catch (err) {
      console.error('Error stopping scanner:', err)
      // Mimo błędu, upewniamy się że stan jest czysty
      setIsScanning(false)
      scannerRef.current = null
    }
  }

  const handleBarcodeScanned = async (barcode: string) => {
    // Validate barcode format
    if (!isValidBarcode(barcode)) {
      toast.error('Nieprawidłowy kod kreskowy: ' + getBarcodeValidationError(barcode))
      return
    }

    try {
      setIsLoading(true)
      await stopScanner()

      toast.loading('Wyszukiwanie produktu (OFF, Leclerc)...', { id: 'barcode-search' })

      const response = await fetch(`/api/products/barcode?code=${barcode}`)
      
      if (!response.ok) {
        const errorData = await response.json()
        
        // Jeśli produkt już istnieje w bazie (409)
        if (response.status === 409 && errorData.existingProduct) {
          if (mode === 'receive_order') {
            // W trybie przyjmowania zamówienia - produkt istniejący to sukces!
            toast.success('Produkt znaleziony w bazie!', { id: 'barcode-search' })
            onScanSuccess(errorData.existingProduct)
            onClose()
          } else {
            // W trybie dodawania produktu - produkt istniejący to błąd
            toast.error(
              `${errorData.error}\n\nProdukt: ${errorData.existingProduct.name}\nJednostka: ${errorData.existingProduct.unit}\nStan: ${errorData.existingProduct.currentStock}`,
              { id: 'barcode-search', duration: 5000 }
            )
            setError(`Produkt "${errorData.existingProduct.name}" jest już w bazie danych`)
            setIsLoading(false)
          }
          return
        }
        
        throw new Error(errorData.error || 'Produkt nie został znaleziony w bazie Open Food Facts')
      }

      const productData = await response.json()

      if (mode === 'receive_order') {
        // W trybie przyjmowania zamówienia - produkt nie jest w bazie
        // Przekaż dane z API (OFF/Leclerc) razem z kodem, aby uniknąć podwójnego fetcha
        // Flaga _externalNotFound jest przekazywana z backendu jeśli nic nie znaleziono
        toast.dismiss('barcode-search')
        onScanSuccess({ _notInDatabase: true, barcode: barcode, ...productData })
        onClose()
      } else {
        // W trybie dodawania produktu
        if (productData._externalNotFound) {
          // Backend zwrócił 200 ale żadne zewnętrzne API nie znalazło produktu
          toast.dismiss('barcode-search')
          setScannedBarcode(barcode)
          setShowManualAddDialog(true)
          setIsLoading(false)
        } else {
          toast.success('Produkt znaleziony!', { id: 'barcode-search' })
          onScanSuccess(productData)
          onClose()
        }
      }
      
    } catch (err: any) {
      console.error('Error fetching product data:', err)
      
      // Prawdziwy błąd sieci/parsowania – zapytaj użytkownika
      if (mode === 'add_product') {
        toast.dismiss('barcode-search')
        setScannedBarcode(barcode)
        setShowManualAddDialog(true)
        setIsLoading(false)
      } else {
        toast.dismiss('barcode-search')
        onScanSuccess({ _notInDatabase: true, _externalNotFound: true, barcode: barcode })
        onClose()
      }
    }
  }

  const handleClose = async () => {
    await stopScanner()
    setError(null)
    setIsLoading(false)
    setShowManualAddDialog(false)
    setScannedBarcode('')
    onClose()
  }
  
  const handleManualAddYes = () => {
    setShowManualAddDialog(false)
    // Wywołaj callback z danymi zawierającymi kod kreskowy i unikatową nazwę tymczasową
    onScanSuccess({ barcode: scannedBarcode, name: generateUnknownProductName() })
    onClose()
  }
  
  const handleManualAddNo = () => {
    setShowManualAddDialog(false)
    setScannedBarcode('')
    setError(null)
    // Wznów skanowanie
    startScanner()
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <Camera className="w-5 h-5 text-blue-600" />
            <span>Skanuj kod kreskowy</span>
          </DialogTitle>
          <DialogDescription>
            Zeskanuj kod kreskowy produktu, aby automatycznie uzupełnić dane
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 overflow-y-auto flex-1">
          {!isScanning && !isLoading && (
            <div className="text-center py-8">
              <Camera className="w-16 h-16 mx-auto mb-4 text-gray-400" />
              <p className="text-sm text-gray-600 mb-4">
                Kliknij przycisk poniżej, aby uruchomić kamerę i zeskanować kod kreskowy produktu
              </p>
              <Button
                onClick={startScanner}
                className="bg-blue-600 hover:bg-blue-700"
              >
                <Camera className="w-4 h-4 mr-2" />
                Uruchom kamerę
              </Button>
              <p className="text-xs text-gray-500 mt-3">
                💡 Przeglądarka zapyta o dostęp do kamery
              </p>
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
                Wyszukiwanie produktu...
              </p>
              <p className="text-xs text-gray-500 mt-2">
                Sprawdzanie: Open Food Facts, Leclerc.pl
              </p>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-md p-4">
              <div className="flex items-start space-x-3">
                <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-red-900">Błąd</p>
                  <p className="text-sm text-red-700 mt-1">{error}</p>
                  
                  {permissionDenied && (
                    <div className="mt-3 bg-white rounded-md p-3 border border-red-100">
                      <div className="flex items-start space-x-2 mb-2">
                        <Settings className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
                        <p className="text-xs font-medium text-red-900">Jak włączyć dostęp do kamery:</p>
                      </div>
                      
                      <div className="text-xs text-gray-700 space-y-2 ml-6">
                        <div>
                          <p className="font-medium">📱 Safari (iPhone/iPad):</p>
                          <p className="text-gray-600 ml-3">
                            Ustawienia → Safari → Kamera → Zezwól
                          </p>
                        </div>
                        
                        <div>
                          <p className="font-medium">🌐 Chrome (Android):</p>
                          <p className="text-gray-600 ml-3">
                            Ustawienia → Witryny → Uprawnienia → Kamera → Zezwól
                          </p>
                        </div>
                        
                        <div>
                          <p className="font-medium">💻 Inne przeglądarki:</p>
                          <p className="text-gray-600 ml-3">
                            Kliknij ikonę kłódki w pasku adresu → Uprawnienia → Kamera
                          </p>
                        </div>
                      </div>
                      
                      <Button
                        onClick={startScanner}
                        size="sm"
                        className="w-full mt-3 bg-blue-600 hover:bg-blue-700"
                      >
                        Spróbuj ponownie
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
      
      {/* Dialog pytający o ręczne dodanie produktu */}
      <AlertDialog open={showManualAddDialog} onOpenChange={setShowManualAddDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center space-x-2">
              <AlertCircle className="w-5 h-5 text-orange-600" />
              <span>Produkt nie został znaleziony</span>
            </AlertDialogTitle>
            <AlertDialogDescription>
              <div className="space-y-2">
                <p>Produkt o kodzie kreskowym <strong>{scannedBarcode}</strong> nie został znaleziony w bazie Open Food Facts.</p>
                <p className="text-sm">Czy chcesz dodać ten produkt ręcznie?</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleManualAddNo}>
              <X className="w-4 h-4 mr-2" />
              Nie, skanuj dalej
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleManualAddYes} className="bg-blue-600 hover:bg-blue-700">
              <PackagePlus className="w-4 h-4 mr-2" />
              Tak, dodaj ręcznie
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  )
}
