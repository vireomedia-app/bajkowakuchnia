
'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PackagePlus, X, CheckCircle, Barcode, Package, Edit3, ArrowRight, Bluetooth, Camera, Loader2 } from 'lucide-react'
import { BarcodeScanner } from './barcode-scanner'
import { OrderQuantityModal } from './order-quantity-modal'
import { SearchProductForManualAdd } from './search-product-for-manual-add'
import { toast } from 'sonner'

interface ScannedProduct {
  id: string
  name: string
  unit: string
  barcode: string
  quantity?: number
}

interface OrderReceivingModalProps {
  isOpen: boolean
  onClose: () => void
}

type ModalStep = 'document_number' | 'method_choice' | 'processing'

export function OrderReceivingModal({ isOpen, onClose }: OrderReceivingModalProps) {
  const [currentStep, setCurrentStep] = useState<ModalStep>('document_number')
  const [documentNumber, setDocumentNumber] = useState('')
  const [documentNumberError, setDocumentNumberError] = useState('')
  const [showScanner, setShowScanner] = useState(false)
  const [showQuantityModal, setShowQuantityModal] = useState(false)
  const [currentProduct, setCurrentProduct] = useState<any>(null)
  const [scannedProducts, setScannedProducts] = useState<ScannedProduct[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [addingMethod, setAddingMethod] = useState<'scan' | 'manual' | 'bluetooth' | null>(null)
  
  // Bluetooth scanner state
  const [bluetoothBarcode, setBluetoothBarcode] = useState('')
  const [isSearchingBluetooth, setIsSearchingBluetooth] = useState(false)
  const [showNotFoundFlash, setShowNotFoundFlash] = useState(false)
  const [lastNotFoundBarcode, setLastNotFoundBarcode] = useState('')
  const bluetoothInputRef = useRef<HTMLInputElement>(null)
  const barcodeBuffer = useRef('')
  const lastKeyTime = useRef(0)

  // Focus na input Bluetooth
  const focusBluetoothInput = useCallback(() => {
    setTimeout(() => {
      if (bluetoothInputRef.current) {
        bluetoothInputRef.current.focus()
        bluetoothInputRef.current.select()
      }
    }, 50)
  }, [])

  // Focus input when switching to bluetooth mode
  useEffect(() => {
    if (addingMethod === 'bluetooth' && currentStep === 'processing' && !showQuantityModal) {
      focusBluetoothInput()
    }
  }, [addingMethod, currentStep, showQuantityModal, focusBluetoothInput])

  // Handle keyboard input from Bluetooth scanner
  useEffect(() => {
    if (addingMethod !== 'bluetooth' || currentStep !== 'processing' || showQuantityModal) return

    const handleKeyDown = (e: KeyboardEvent) => {
      const now = Date.now()
      
      // If more than 100ms passed, it's probably manual typing - reset buffer
      if (now - lastKeyTime.current > 100) {
        barcodeBuffer.current = ''
      }
      lastKeyTime.current = now

      // Enter key - process barcode
      if (e.key === 'Enter') {
        e.preventDefault()
        const barcode = barcodeBuffer.current.trim() || bluetoothBarcode.trim()
        if (barcode) {
          handleBluetoothScan(barcode)
          barcodeBuffer.current = ''
          setBluetoothBarcode('')
        }
        return
      }

      // Collect characters for barcode
      if (e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
        barcodeBuffer.current += e.key
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [addingMethod, currentStep, showQuantityModal, bluetoothBarcode])

  // Bluetooth scan handler - find existing product
  const handleBluetoothScan = async (barcode: string) => {
    if (!barcode || isSearchingBluetooth) return

    setIsSearchingBluetooth(true)

    try {
      // Search for product by barcode in our database
      const response = await fetch(`/api/products/barcode?code=${encodeURIComponent(barcode)}`)
      const data = await response.json()

      if (response.status === 409 && data.existingProduct) {
        // Product found in database - show quantity modal
        setCurrentProduct(data.existingProduct)
        setShowQuantityModal(true)
        toast.success(`Znaleziono: ${data.existingProduct.name}`)
      } else if (response.ok && data.name) {
        // Product found in Open Food Facts but not in our database
        setLastNotFoundBarcode(barcode)
        setShowNotFoundFlash(true)
        setTimeout(() => setShowNotFoundFlash(false), 2500)
        toast.error(`Produkt "${data.name}" nie istnieje w magazynie. Najpierw go dodaj.`)
      } else {
        // Product not found anywhere
        setLastNotFoundBarcode(barcode)
        setShowNotFoundFlash(true)
        setTimeout(() => setShowNotFoundFlash(false), 2500)
        toast.error(`Nie znaleziono produktu o kodzie: ${barcode}`)
      }
    } catch (error) {
      console.error('Error searching barcode:', error)
      toast.error('Błąd podczas wyszukiwania produktu')
    } finally {
      setIsSearchingBluetooth(false)
      focusBluetoothInput()
    }
  }

  const handleScanSuccess = async (productData: any) => {
    // BarcodeScanner w trybie receive_order przekazuje tylko istniejące produkty
    // więc możemy od razu pokazać modal ilości
    setCurrentProduct(productData)
    setShowScanner(false)
    setShowQuantityModal(true)
  }

  const handleQuantitySubmit = async (quantity: number, unit: string) => {
    if (!currentProduct) return

    setIsProcessing(true)

    try {
      // Dodaj transakcję przychodu z numerem dokumentu
      const payload: any = {
        date: new Date().toISOString(),
        type: 'INCOME',
        quantity: quantity,
        document: `Dostawa - ${new Date().toLocaleDateString('pl-PL')}`,
      }
      
      // Dodaj documentNumber tylko jeśli nie jest pusty
      if (documentNumber && documentNumber.trim()) {
        payload.documentNumber = documentNumber.trim()
      }
      
      const response = await fetch(`/api/products/${currentProduct.id}/transactions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      if (!response.ok) {
        throw new Error('Nie udało się dodać transakcji')
      }

      // Dodaj do listy zeskanowanych produktów
      setScannedProducts(prev => [
        ...prev,
        {
          id: currentProduct.id,
          name: currentProduct.name,
          unit: unit,
          barcode: currentProduct.barcode || 'brak',
          quantity: quantity
        }
      ])

      toast.success(`Dodano ${quantity} ${unit} - ${currentProduct.name}`)

      // Resetuj stan i wróć do odpowiedniej metody
      setCurrentProduct(null)
      setShowQuantityModal(false)
      
      if (addingMethod === 'scan') {
        setShowScanner(true)
      } else if (addingMethod === 'bluetooth') {
        // W trybie Bluetooth - focus na input
        focusBluetoothInput()
      } else {
        // W trybie ręcznym pozostajemy w głównym oknie
        setCurrentStep('processing')
      }

    } catch (err: any) {
      console.error('Error adding transaction:', err)
      toast.error(err.message || 'Błąd podczas dodawania produktu')
    } finally {
      setIsProcessing(false)
    }
  }

  const handleClose = () => {
    // Pokaż podsumowanie jeśli były zeskanowane produkty
    if (scannedProducts.length > 0) {
      const message = `Pomyślnie przyjęto ${scannedProducts.length} ${
        scannedProducts.length === 1 ? 'produkt' : 
        scannedProducts.length < 5 ? 'produkty' : 'produktów'
      }`
      toast.success(message, { duration: 5000 })
    }

    // Resetuj stan
    setScannedProducts([])
    setCurrentProduct(null)
    setShowScanner(false)
    setShowQuantityModal(false)
    setCurrentStep('document_number')
    setDocumentNumber('')
    setAddingMethod(null)
    setBluetoothBarcode('')
    barcodeBuffer.current = ''
    onClose()
  }

  const handleDocumentNumberSubmit = () => {
    // Walidacja - wymagany numer dokumentu
    if (!documentNumber || !documentNumber.trim()) {
      setDocumentNumberError('Numer dokumentu jest wymagany. Kliknij "Przyjmij bez numeru" jeśli chcesz pominąć.')
      return
    }
    
    // Wyczyść błąd i przejdź dalej
    setDocumentNumberError('')
    setCurrentStep('method_choice')
  }

  const handleSkipDocumentNumber = () => {
    // Pomiń walidację - przejdź dalej bez numeru
    setDocumentNumberError('')
    setCurrentStep('method_choice')
  }

  const handleMethodChoice = (method: 'scan' | 'manual' | 'bluetooth') => {
    setAddingMethod(method)
    setCurrentStep('processing')
    
    if (method === 'scan') {
      setShowScanner(true)
    } else if (method === 'bluetooth') {
      // Focus na input po przejściu do ekranu przetwarzania
      setTimeout(() => focusBluetoothInput(), 100)
    }
  }

  const handleManualAdd = async () => {
    // Otwórz modal z listą produktów do wyboru
    // Będziemy używać wbudowanej funkcjonalności przez SearchProducts
    toast.info('Wyszukaj produkt, aby go dodać')
  }

  return (
    <>
      {/* Red flash overlay for not found products (Bluetooth mode) */}
      {showNotFoundFlash && (
        <div className="fixed inset-0 z-[100] bg-red-600 flex items-center justify-center animate-pulse">
          <div className="text-center text-white">
            <X className="w-32 h-32 mx-auto mb-4" strokeWidth={3} />
            <p className="text-3xl font-bold">NIE ZNALEZIONO</p>
            <p className="text-xl mt-2 font-mono">{lastNotFoundBarcode}</p>
          </div>
        </div>
      )}

      <Dialog open={isOpen && !showScanner && !showQuantityModal} onOpenChange={handleClose}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              <PackagePlus className="w-5 h-5 text-green-600" />
              <span>Przyjmij nowe zamówienie</span>
            </DialogTitle>
            {currentStep === 'document_number' && (
              <DialogDescription>
                Podaj numer dokumentu dostawy (WZ lub Faktura VAT)
              </DialogDescription>
            )}
            {currentStep === 'method_choice' && (
              <DialogDescription>
                Wybierz sposób dodawania produktów
              </DialogDescription>
            )}
          </DialogHeader>

          <div className="space-y-6 overflow-y-auto flex-1">
            {/* KROK 1: Podanie numeru dokumentu */}
            {currentStep === 'document_number' && (
              <div className="space-y-4">
                <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                  <p className="text-sm text-orange-900">
                    📋 Przed rozpoczęciem przyjmowania produktów, wpisz numer dokumentu dostawy
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="documentNumber" className="text-base">
                    Numer dokumentu (WZ / Faktura VAT)
                  </Label>
                  <Input
                    id="documentNumber"
                    type="text"
                    placeholder="np. WZ/2025/01/001 lub FV 123/2025"
                    value={documentNumber}
                    onChange={(e) => {
                      setDocumentNumber(e.target.value)
                      setDocumentNumberError('')
                    }}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        handleDocumentNumberSubmit()
                      }
                    }}
                    autoFocus
                    className={`text-lg ${documentNumberError ? 'border-red-300 focus:border-red-500 focus:ring-red-500' : ''}`}
                  />
                  {documentNumberError && (
                    <p className="text-sm text-red-600 flex items-center space-x-1">
                      <span>⚠️ {documentNumberError}</span>
                    </p>
                  )}
                  <p className="text-xs text-gray-500">
                    Ten numer będzie przypisany do wszystkich produktów w tej dostawie
                  </p>
                </div>

                <div className="flex space-x-3 pt-4">
                  <Button
                    onClick={handleClose}
                    variant="outline"
                    className="flex-1"
                  >
                    <X className="w-4 h-4 mr-2" />
                    Anuluj
                  </Button>
                  <Button
                    onClick={handleSkipDocumentNumber}
                    variant="ghost"
                    className="flex-1 text-orange-600 hover:text-orange-700 hover:bg-orange-50"
                  >
                    Przyjmij bez numeru
                  </Button>
                  <Button
                    onClick={handleDocumentNumberSubmit}
                    className="flex-1 bg-green-600 hover:bg-green-700"
                  >
                    Dalej
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </div>
              </div>
            )}

            {/* KROK 2: Wybór metody dodawania */}
            {currentStep === 'method_choice' && (
              <div className="space-y-4">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <p className="text-sm text-blue-900">
                    📄 Dokument: <span className="font-semibold">{documentNumber}</span>
                  </p>
                </div>

                <div className="space-y-3">
                  <Button
                    onClick={() => handleMethodChoice('scan')}
                    className="w-full h-auto py-5 bg-green-600 hover:bg-green-700 flex flex-col items-center space-y-2"
                  >
                    <Camera className="w-10 h-10" />
                    <div className="text-center">
                      <p className="font-semibold text-lg">Kamera telefonu/tabletu</p>
                      <p className="text-sm opacity-90">Skanowanie aparatem urządzenia</p>
                    </div>
                  </Button>

                  <Button
                    onClick={() => handleMethodChoice('bluetooth')}
                    className="w-full h-auto py-5 bg-orange-600 hover:bg-orange-700 flex flex-col items-center space-y-2"
                  >
                    <Bluetooth className="w-10 h-10" />
                    <div className="text-center">
                      <p className="font-semibold text-lg">Skaner Bluetooth</p>
                      <p className="text-sm opacity-90">Skaner laserowy podłączony przez Bluetooth</p>
                    </div>
                  </Button>

                  <Button
                    onClick={() => handleMethodChoice('manual')}
                    className="w-full h-auto py-5 bg-blue-600 hover:bg-blue-700 flex flex-col items-center space-y-2"
                  >
                    <Edit3 className="w-10 h-10" />
                    <div className="text-center">
                      <p className="font-semibold text-lg">Dodawanie ręczne</p>
                      <p className="text-sm opacity-90">Dla produktów bez kodu (warzywa, owoce itp.)</p>
                    </div>
                  </Button>
                </div>

                <Button
                  onClick={() => setCurrentStep('document_number')}
                  variant="outline"
                  className="w-full"
                >
                  <X className="w-4 h-4 mr-2" />
                  Wróć
                </Button>
              </div>
            )}

            {/* KROK 3: Przetwarzanie (dodawanie produktów) */}
            {currentStep === 'processing' && (
              <>
                {/* Podsumowanie */}
                {scannedProducts.length > 0 && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center space-x-2">
                        <CheckCircle className="w-5 h-5 text-green-600" />
                        <p className="font-medium text-green-900">
                          Dodano {scannedProducts.length} {
                            scannedProducts.length === 1 ? 'produkt' : 
                            scannedProducts.length < 5 ? 'produkty' : 'produktów'
                          }
                        </p>
                      </div>
                    </div>

                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {scannedProducts.map((product, index) => (
                        <div
                          key={`${product.id}-${index}`}
                          className="flex items-center justify-between bg-white rounded-md p-3 text-sm"
                        >
                          <div className="flex items-center space-x-3">
                            <Package className="w-4 h-4 text-green-600" />
                            <div>
                              <p className="font-medium text-gray-900">{product.name}</p>
                              <p className="text-xs text-gray-500">
                                {product.barcode !== 'brak' ? `Kod: ${product.barcode}` : 'Dodano ręcznie'}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="font-semibold text-green-600">
                              +{product.quantity} {product.unit}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Informacja o dokumencie */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <p className="text-xs text-blue-900">
                    📄 Dokument: <span className="font-semibold">{documentNumber}</span>
                  </p>
                </div>

                {/* Instrukcje dla metody ręcznej */}
                {addingMethod === 'manual' && (
                  <div className="text-center py-4">
                    <Edit3 className="w-12 h-12 mx-auto mb-3 text-blue-500" />
                    <p className="text-gray-700 mb-2 font-medium">
                      Wyszukaj produkt w bazie
                    </p>
                    <p className="text-sm text-gray-500">
                      Kliknij &quot;Wyszukaj produkt&quot; i wybierz z listy
                    </p>
                  </div>
                )}

                {/* Interfejs dla skanera Bluetooth */}
                {addingMethod === 'bluetooth' && (
                  <div className="space-y-4">
                    <div className="flex gap-2 items-center p-4 bg-orange-50 rounded-lg border border-orange-200">
                      <Bluetooth className="w-6 h-6 text-orange-600 flex-shrink-0" />
                      <div className="flex-1">
                        <Input
                          ref={bluetoothInputRef}
                          value={bluetoothBarcode}
                          onChange={(e) => setBluetoothBarcode(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault()
                              const barcode = bluetoothBarcode.trim()
                              if (barcode) {
                                handleBluetoothScan(barcode)
                                setBluetoothBarcode('')
                              }
                            }
                          }}
                          placeholder="Zeskanuj kod skanerem Bluetooth..."
                          className="font-mono text-lg"
                          inputMode="none"
                          disabled={isSearchingBluetooth}
                          autoFocus
                        />
                      </div>
                      {isSearchingBluetooth && <Loader2 className="w-5 h-5 animate-spin text-orange-500" />}
                    </div>
                    <div className="text-center text-sm text-gray-500">
                      <p>Skieruj skaner na kod kreskowy produktu.</p>
                      <p>Skaner automatycznie wyśle kod i przejdzie do następnego produktu.</p>
                    </div>
                  </div>
                )}

                {scannedProducts.length > 0 && (
                  <div className="bg-orange-50 border border-orange-200 rounded-md p-3">
                    <p className="text-sm text-orange-900">
                      💡 Dodaj kolejny produkt lub kliknij &quot;Zakończ&quot;
                    </p>
                  </div>
                )}

                {/* Przyciski */}
                <div className="flex flex-col gap-3">
                  {addingMethod === 'scan' && (
                    <Button
                      onClick={() => setShowScanner(true)}
                      className="w-full bg-green-600 hover:bg-green-700 text-lg py-6"
                      size="lg"
                    >
                      <Barcode className="w-6 h-6 mr-2" />
                      <span className="font-semibold">
                        {scannedProducts.length === 0 ? 'Rozpocznij skanowanie' : 'Skanuj kolejny produkt'}
                      </span>
                    </Button>
                  )}

                  {addingMethod === 'manual' && (
                    <SearchProductForManualAdd 
                      onProductSelect={(product) => {
                        setCurrentProduct(product)
                        setShowQuantityModal(true)
                      }}
                    />
                  )}

                  <Button
                    onClick={handleClose}
                    variant="outline"
                    size="default"
                    className="w-full"
                  >
                    <X className="w-4 h-4 mr-2" />
                    {scannedProducts.length === 0 ? 'Anuluj' : 'Zakończ'}
                  </Button>
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Scanner Modal */}
      <BarcodeScanner
        isOpen={showScanner}
        onClose={() => setShowScanner(false)}
        onScanSuccess={handleScanSuccess}
        mode="receive_order"
      />

      {/* Quantity Input Modal */}
      {currentProduct && (
        <OrderQuantityModal
          isOpen={showQuantityModal}
          onClose={() => {
            setShowQuantityModal(false)
            setCurrentProduct(null)
            setShowScanner(true)
          }}
          product={currentProduct}
          onSubmit={handleQuantitySubmit}
          isProcessing={isProcessing}
        />
      )}
    </>
  )
}
