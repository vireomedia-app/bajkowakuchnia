
'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { PackagePlus, X, CheckCircle, Barcode, Package } from 'lucide-react'
import { BarcodeScanner } from './barcode-scanner'
import { OrderQuantityModal } from './order-quantity-modal'
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

export function OrderReceivingModal({ isOpen, onClose }: OrderReceivingModalProps) {
  const [showScanner, setShowScanner] = useState(false)
  const [showQuantityModal, setShowQuantityModal] = useState(false)
  const [currentProduct, setCurrentProduct] = useState<any>(null)
  const [scannedProducts, setScannedProducts] = useState<ScannedProduct[]>([])
  const [isProcessing, setIsProcessing] = useState(false)

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
      // Dodaj transakcję przychodu
      const response = await fetch(`/api/products/${currentProduct.id}/transactions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: new Date().toISOString(),
          type: 'INCOME',
          quantity: quantity,
          document: `Dostawa - ${new Date().toLocaleDateString('pl-PL')}`
        })
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
          barcode: currentProduct.barcode,
          quantity: quantity
        }
      ])

      toast.success(`Dodano ${quantity} ${unit} - ${currentProduct.name}`)

      // Resetuj stan i wróć do skanera
      setCurrentProduct(null)
      setShowQuantityModal(false)
      setShowScanner(true)

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
    onClose()
  }

  const handleStartScanning = () => {
    setShowScanner(true)
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
          </DialogHeader>

          <div className="space-y-6 overflow-y-auto flex-1">
            {/* Podsumowanie */}
            {scannedProducts.length > 0 && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center space-x-2">
                    <CheckCircle className="w-5 h-5 text-green-600" />
                    <p className="font-medium text-green-900">
                      Zeskanowano {scannedProducts.length} {
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
                          <p className="text-xs text-gray-500">Kod: {product.barcode}</p>
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

            {/* Instrukcje */}
            {scannedProducts.length === 0 && (
              <div className="text-center py-6">
                <Barcode className="w-16 h-16 mx-auto mb-4 text-gray-400" />
                <p className="text-gray-600 mb-2">
                  Zeskanuj kolejne produkty z dostawy
                </p>
                <p className="text-sm text-gray-500">
                  Po zeskanowaniu każdego produktu podasz jego ilość
                </p>
              </div>
            )}

            {scannedProducts.length > 0 && (
              <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
                <p className="text-sm text-blue-900">
                  💡 Zeskanuj kolejny produkt lub kliknij &quot;Zakończ&quot; aby zamknąć przyjęcie zamówienia
                </p>
              </div>
            )}

            {/* Przyciski */}
            <div className="flex flex-col sm:flex-row gap-3">
              <Button
                onClick={handleStartScanning}
                className="flex-1 bg-green-600 hover:bg-green-700"
                size="lg"
              >
                <Barcode className="w-5 h-5 mr-2" />
                <span className="truncate">
                  {scannedProducts.length === 0 ? 'Rozpocznij skanowanie' : 'Skanuj kolejny produkt'}
                </span>
              </Button>

              <Button
                onClick={handleClose}
                variant="outline"
                size="lg"
                className="sm:w-auto w-full"
              >
                <X className="w-5 h-5 mr-2" />
                {scannedProducts.length === 0 ? 'Anuluj' : 'Zakończ'}
              </Button>
            </div>
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
