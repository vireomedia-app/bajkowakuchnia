'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Check, X, Loader2, Package, Barcode, Save, Trash2, AlertCircle } from 'lucide-react'
import { toast } from 'sonner'

interface ScannedProduct {
  id: string
  barcode: string
  name: string
  unit: string
  found: boolean
  manufacturer?: string
  calories?: number | null
  protein?: number | null
  fat?: number | null
  carbohydrates?: number | null
  allergens?: number[]
  existingProductId?: string // Jeśli produkt już istnieje w bazie
}

interface BulkProductScannerProps {
  isOpen: boolean
  onClose: () => void
  onProductsAdded?: () => void
}

export function BulkProductScanner({ isOpen, onClose, onProductsAdded }: BulkProductScannerProps) {
  const [scannedProducts, setScannedProducts] = useState<ScannedProduct[]>([])
  const [currentBarcode, setCurrentBarcode] = useState('')
  const [isSearching, setIsSearching] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [showNotFoundFlash, setShowNotFoundFlash] = useState(false)
  const [lastNotFoundBarcode, setLastNotFoundBarcode] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const barcodeBuffer = useRef('')
  const lastKeyTime = useRef(0)

  // Focus input when modal opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        inputRef.current?.focus()
      }, 100)
    } else {
      // Reset state when modal closes
      setCurrentBarcode('')
      barcodeBuffer.current = ''
    }
  }, [isOpen])

  // Handle keyboard input from Bluetooth scanner
  useEffect(() => {
    if (!isOpen) return

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
        const barcode = barcodeBuffer.current.trim() || currentBarcode.trim()
        if (barcode) {
          handleBarcodeScanned(barcode)
          barcodeBuffer.current = ''
          setCurrentBarcode('')
        }
        return
      }

      // Collect characters for barcode (scanners type fast)
      if (e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
        barcodeBuffer.current += e.key
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, currentBarcode])

  const handleBarcodeScanned = useCallback(async (barcode: string) => {
    if (!barcode || isSearching) return

    // Check if already scanned
    if (scannedProducts.some(p => p.barcode === barcode)) {
      toast.info(`Produkt ${barcode} już jest na liście`)
      return
    }

    setIsSearching(true)

    try {
      const response = await fetch(`/api/products/barcode?code=${encodeURIComponent(barcode)}`)
      const data = await response.json()

      if (response.status === 409) {
        // Product already exists in database
        const newProduct: ScannedProduct = {
          id: `scan-${Date.now()}`,
          barcode: barcode,
          name: data.existingProduct?.name || `Istniejący: ${barcode}`,
          unit: data.existingProduct?.unit || 'g',
          found: true,
          existingProductId: data.existingProduct?.id
        }
        setScannedProducts(prev => [...prev, newProduct])
        toast.success(`Produkt "${newProduct.name}" już istnieje w bazie`)
      } else if (response.ok) {
        // Found in Open Food Facts
        const newProduct: ScannedProduct = {
          id: `scan-${Date.now()}`,
          barcode: barcode,
          name: data.name || `Produkt ${barcode}`,
          unit: 'g',
          found: true,
          manufacturer: data.manufacturer,
          calories: data.calories,
          protein: data.protein,
          fat: data.fat,
          carbohydrates: data.carbohydrates,
          allergens: data.allergens
        }
        setScannedProducts(prev => [...prev, newProduct])
        toast.success(`Znaleziono: ${newProduct.name}`)
      } else {
        // Not found - show red flash
        setLastNotFoundBarcode(barcode)
        setShowNotFoundFlash(true)
        setTimeout(() => setShowNotFoundFlash(false), 2500)

        const newProduct: ScannedProduct = {
          id: `scan-${Date.now()}`,
          barcode: barcode,
          name: `Nieznany produkt`,
          unit: 'g',
          found: false
        }
        setScannedProducts(prev => [...prev, newProduct])
      }
    } catch (error) {
      console.error('Error scanning barcode:', error)
      toast.error('Błąd podczas skanowania')
    } finally {
      setIsSearching(false)
      inputRef.current?.focus()
    }
  }, [isSearching, scannedProducts])

  const handleRemoveProduct = (id: string) => {
    setScannedProducts(prev => prev.filter(p => p.id !== id))
  }

  const handleUpdateProductName = (id: string, newName: string) => {
    setScannedProducts(prev => prev.map(p => 
      p.id === id ? { ...p, name: newName } : p
    ))
  }

  const handleSaveAll = async () => {
    const productsToSave = scannedProducts.filter(p => !p.existingProductId)
    
    if (productsToSave.length === 0) {
      toast.info('Brak nowych produktów do zapisania')
      return
    }

    setIsSaving(true)
    let savedCount = 0
    let errorCount = 0

    for (const product of productsToSave) {
      try {
        const response = await fetch('/api/products', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: product.name,
            unit: product.unit,
            currentStock: 0,
            barcode: product.barcode,
            manufacturer: product.manufacturer || '',
            calories: product.calories || null,
            protein: product.protein || null,
            fat: product.fat || null,
            carbohydrates: product.carbohydrates || null,
            allergens: product.allergens || []
          })
        })

        if (response.ok) {
          savedCount++
        } else {
          const error = await response.json()
          console.error('Error saving product:', error)
          errorCount++
        }
      } catch (error) {
        console.error('Error saving product:', error)
        errorCount++
      }
    }

    setIsSaving(false)

    if (savedCount > 0) {
      toast.success(`Zapisano ${savedCount} produktów`)
      if (onProductsAdded) {
        onProductsAdded()
      }
    }
    if (errorCount > 0) {
      toast.error(`Nie udało się zapisać ${errorCount} produktów`)
    }

    // Clear the list after saving
    setScannedProducts([])
    onClose()
  }

  const foundProducts = scannedProducts.filter(p => p.found)
  const notFoundProducts = scannedProducts.filter(p => !p.found)

  return (
    <>
      {/* Red flash overlay for not found products */}
      {showNotFoundFlash && (
        <div className="fixed inset-0 z-[100] bg-red-600 flex items-center justify-center animate-pulse">
          <div className="text-center text-white">
            <X className="w-32 h-32 mx-auto mb-4" strokeWidth={3} />
            <p className="text-3xl font-bold">NIE ZNALEZIONO</p>
            <p className="text-xl mt-2 font-mono">{lastNotFoundBarcode}</p>
          </div>
        </div>
      )}

      <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Barcode className="w-5 h-5" />
              Masowe dodawanie produktów
            </DialogTitle>
            <DialogDescription>
              Skanuj produkty czytnikiem kodów kreskowych. Po zeskanowaniu naciśnij Enter.
            </DialogDescription>
          </DialogHeader>

          {/* Barcode input */}
          <div className="flex gap-2 items-center p-4 bg-gray-50 rounded-lg">
            <Label htmlFor="barcode-input" className="whitespace-nowrap">Kod kreskowy:</Label>
            <Input
              ref={inputRef}
              id="barcode-input"
              value={currentBarcode}
              onChange={(e) => setCurrentBarcode(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  const barcode = currentBarcode.trim()
                  if (barcode) {
                    handleBarcodeScanned(barcode)
                    setCurrentBarcode('')
                  }
                }
              }}
              placeholder="Zeskanuj lub wpisz kod..."
              className="font-mono text-lg"
              disabled={isSearching}
              autoFocus
            />
            {isSearching && <Loader2 className="w-5 h-5 animate-spin text-orange-500" />}
          </div>

          {/* Stats */}
          <div className="flex gap-4 text-sm">
            <div className="flex items-center gap-2 text-green-600">
              <Check className="w-4 h-4" />
              <span>Znalezione: {foundProducts.length}</span>
            </div>
            <div className="flex items-center gap-2 text-red-600">
              <X className="w-4 h-4" />
              <span>Nieznalezione: {notFoundProducts.length}</span>
            </div>
            <div className="flex items-center gap-2 text-gray-600">
              <Package className="w-4 h-4" />
              <span>Razem: {scannedProducts.length}</span>
            </div>
          </div>

          {/* Product lists */}
          <div className="flex-1 min-h-0 grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Found products */}
            <div className="flex flex-col">
              <h3 className="font-medium text-green-700 mb-2 flex items-center gap-2">
                <Check className="w-4 h-4" />
                Znalezione w Open Food Facts
              </h3>
              <ScrollArea className="flex-1 border rounded-lg p-2 bg-green-50">
                {foundProducts.length === 0 ? (
                  <p className="text-sm text-gray-500 p-4 text-center">Brak zeskanowanych produktów</p>
                ) : (
                  <div className="space-y-2">
                    {foundProducts.map(product => (
                      <div key={product.id} className="flex items-center gap-2 p-2 bg-white rounded border border-green-200">
                        <Check className="w-5 h-5 text-green-600 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <Input
                            value={product.name}
                            onChange={(e) => handleUpdateProductName(product.id, e.target.value)}
                            className="h-8 text-sm"
                          />
                          <p className="text-xs text-gray-500 font-mono mt-1">{product.barcode}</p>
                          {product.existingProductId && (
                            <p className="text-xs text-blue-600">Już w bazie</p>
                          )}
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveProduct(product.id)}
                          className="text-red-500 hover:text-red-700"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </div>

            {/* Not found products */}
            <div className="flex flex-col">
              <h3 className="font-medium text-red-700 mb-2 flex items-center gap-2">
                <X className="w-4 h-4" />
                Nieznalezione - do uzupełnienia ręcznie
              </h3>
              <ScrollArea className="flex-1 border rounded-lg p-2 bg-red-50">
                {notFoundProducts.length === 0 ? (
                  <p className="text-sm text-gray-500 p-4 text-center">Brak nieznalezionych produktów</p>
                ) : (
                  <div className="space-y-2">
                    {notFoundProducts.map(product => (
                      <div key={product.id} className="flex items-center gap-2 p-2 bg-white rounded border border-red-200">
                        <X className="w-5 h-5 text-red-600 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <Input
                            value={product.name}
                            onChange={(e) => handleUpdateProductName(product.id, e.target.value)}
                            className="h-8 text-sm"
                            placeholder="Wpisz nazwę produktu..."
                          />
                          <p className="text-xs text-gray-500 font-mono mt-1">{product.barcode}</p>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveProduct(product.id)}
                          className="text-red-500 hover:text-red-700"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </div>
          </div>

          {/* Warning for not found products */}
          {notFoundProducts.length > 0 && (
            <div className="flex items-start gap-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm">
              <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-yellow-800">Uwaga: {notFoundProducts.length} produktów nie znaleziono w bazie Open Food Facts</p>
                <p className="text-yellow-700">Przed zapisaniem uzupełnij ich nazwy ręcznie.</p>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={onClose}>
              Anuluj
            </Button>
            <Button
              onClick={handleSaveAll}
              disabled={scannedProducts.length === 0 || isSaving}
              className="bg-green-600 hover:bg-green-700"
            >
              {isSaving ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Zapisywanie...</>
              ) : (
                <><Save className="w-4 h-4 mr-2" /> Zapisz wszystkie ({scannedProducts.filter(p => !p.existingProductId).length})</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
