
'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './components/ui/dialog'
import { Button } from './components/ui/button'
import { Input } from './components/ui/input'
import { Label } from './components/ui/label'
import { PackagePlus, X, CheckCircle, Barcode, Package, Edit3, ArrowRight } from 'lucide-react'
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
  const [addingMethod, setAddingMethod] = useState<'scan' | 'manual' | null>(null)

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

  const handleMethodChoice = (method: 'scan' | 'manual') => {
    setAddingMethod(method)
    setCurrentStep('processing')
    
    if (method === 'scan') {
      setShowScanner(true)
    }
  }

  const handleManualAdd = async () => {
    // Otwórz modal z listą produktów do wyboru
    // Będziemy używać wbudowanej funkcjonalności przez SearchProducts
    toast.info('Wyszukaj produkt, aby go dodać')
  }

  return (
    <>
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
                      setDocumentNumberError('') // Wyczyść błąd podczas wpisywania
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
                    className="w-full h-auto py-6 bg-green-600 hover:bg-green-700 flex flex-col items-center space-y-2"
                  >
                    <Barcode className="w-12 h-12" />
                    <div className="text-center">
                      <p className="font-semibold text-lg">Skanowanie kodów kreskowych</p>
                      <p className="text-sm opacity-90">Dla produktów z kodem kreskowym</p>
                    </div>
                  </Button>

                  <Button
                    onClick={() => handleMethodChoice('manual')}
                    className="w-full h-auto py-6 bg-blue-600 hover:bg-blue-700 flex flex-col items-center space-y-2"
                  >
                    <Edit3 className="w-12 h-12" />
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
