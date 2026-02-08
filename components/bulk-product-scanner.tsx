'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Check, X, Loader2, Package, Barcode, Save, Trash2, AlertCircle, Keyboard } from 'lucide-react'
import { toast } from 'sonner'
import { AlphanumericKeyboardModal } from '@/components/alphanumeric-keyboard-modal'
import { isValidBarcode, getBarcodeValidationError, generateUnknownProductName } from '@/lib/barcode'

// LocalStorage key for persisting bulk add list
const BULK_ADD_PRODUCTS_KEY = 'bulkAddProducts'

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
  source?: 'off' | 'leclerc' | 'off+leclerc' | 'none' // Source of data
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

  // Alphanumeric keyboard state
  const [showKeyboard, setShowKeyboard] = useState(false)
  const [keyboardProductId, setKeyboardProductId] = useState<string | null>(null)
  const [keyboardInitialValue, setKeyboardInitialValue] = useState('')
  const [isInitialized, setIsInitialized] = useState(false)

  // Load saved products from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(BULK_ADD_PRODUCTS_KEY)
      if (saved) {
        const savedProducts = JSON.parse(saved) as ScannedProduct[]
        if (Array.isArray(savedProducts) && savedProducts.length > 0) {
          setScannedProducts(savedProducts)
          toast.info(`Przywrócono ${savedProducts.length} zapisanych produktów z poprzedniej sesji`)
        }
      }
    } catch (error) {
      console.error('Error loading saved products from localStorage:', error)
    }
    setIsInitialized(true)
  }, [])

  // Save products to localStorage whenever the list changes (but only after initialization)
  useEffect(() => {
    if (!isInitialized) return
    
    try {
      if (scannedProducts.length > 0) {
        localStorage.setItem(BULK_ADD_PRODUCTS_KEY, JSON.stringify(scannedProducts))
      } else {
        localStorage.removeItem(BULK_ADD_PRODUCTS_KEY)
      }
    } catch (error) {
      console.error('Error saving products to localStorage:', error)
    }
  }, [scannedProducts, isInitialized])

  // Otwórz klawiaturę dla edycji nazwy produktu
  const openKeyboardForProduct = (productId: string, currentName: string) => {
    setKeyboardProductId(productId)
    setKeyboardInitialValue(currentName)
    setShowKeyboard(true)
  }

  // Obsłuż wartość z klawiatury
  const handleKeyboardConfirm = (value: string) => {
    if (keyboardProductId) {
      handleUpdateProductName(keyboardProductId, value)
    }
    setShowKeyboard(false)
    setKeyboardProductId(null)
    // Auto-focus barcode input after editing product name
    focusInput()
  }

  // Funkcja do ustawienia focusu na input
  const focusInput = useCallback(() => {
    // Małe opóźnienie żeby DOM zdążył się zaktualizować
    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus()
        inputRef.current.select()
      }
    }, 50)
  }, [])

  // Focus input when modal opens
  useEffect(() => {
    if (isOpen) {
      focusInput()
    } else {
      // Reset state when modal closes
      setCurrentBarcode('')
      barcodeBuffer.current = ''
    }
  }, [isOpen, focusInput])

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

    // Validate barcode format
    if (!isValidBarcode(barcode)) {
      toast.error('Nieprawidłowy kod kreskowy: ' + getBarcodeValidationError(barcode))
      focusInput()
      return
    }

    // Check if already scanned
    if (scannedProducts.some(p => p.barcode === barcode)) {
      toast.info(`Produkt ${barcode} już jest na liście`)
      focusInput()
      return
    }

    setIsSearching(true)

    try {
      const response = await fetch(`/api/products/barcode?code=${encodeURIComponent(barcode)}`)
      const data = await response.json()

      if (response.status === 409) {
        // Product already exists in database - don't add to list
        toast.info(`Produkt już istnieje w bazie: "${data.existingProduct?.name || barcode}"`)
        focusInput()
      } else if (response.ok) {
        // Found in Open Food Facts and/or Leclerc
        const source = data.source as ScannedProduct['source'] || 'off'
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
          allergens: data.allergens,
          source: source
        }
        setScannedProducts(prev => [...prev, newProduct])
        
        // Show appropriate toast message based on source
        if (source === 'off+leclerc') {
          toast.success(`Znaleziono: ${newProduct.name}`, {
            description: 'Dane uzupełnione z OpenFoodFacts + Leclerc'
          })
        } else if (source === 'leclerc') {
          toast.success(`Znaleziono: ${newProduct.name}`, {
            description: 'Dane pobrane z Leclerc'
          })
        } else {
          toast.success(`Znaleziono: ${newProduct.name}`)
        }
      } else {
        // Not found - show red flash
        setLastNotFoundBarcode(barcode)
        setShowNotFoundFlash(true)
        setTimeout(() => setShowNotFoundFlash(false), 2500)

        const newProduct: ScannedProduct = {
          id: `scan-${Date.now()}`,
          barcode: barcode,
          name: generateUnknownProductName(),
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
      focusInput()
    }
  }, [isSearching, scannedProducts, focusInput])

  const handleRemoveProduct = (id: string) => {
    setScannedProducts(prev => prev.filter(p => p.id !== id))
    focusInput()
  }

  const handleUpdateProductName = (id: string, newName: string) => {
    setScannedProducts(prev => prev.map(p => 
      p.id === id ? { ...p, name: newName } : p
    ))
  }

  const handleClearList = () => {
    setScannedProducts([])
    localStorage.removeItem(BULK_ADD_PRODUCTS_KEY)
    toast.info('Lista produktów została wyczyszczona')
    focusInput()
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
            initialStock: 0, // API wymaga initialStock, nie currentStock
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
          console.error('Error saving product:', product.name, error)
          errorCount++
        }
      } catch (error) {
        console.error('Error saving product:', product.name, error)
        errorCount++
      }
    }

    setIsSaving(false)

    const skippedCount = scannedProducts.filter(p => p.existingProductId).length
    const totalProcessed = savedCount + errorCount + skippedCount

    // Show summary toast
    toast.success(
      `Przetworzono ${totalProcessed} produktów: ${savedCount} dodano${errorCount > 0 ? `, ${errorCount} błędów` : ''}${skippedCount > 0 ? `, ${skippedCount} pominięto (już w bazie)` : ''}`,
      { duration: 5000 }
    )

    if (savedCount > 0) {
      if (onProductsAdded) {
        onProductsAdded()
      }
    }
    
    if (errorCount === 0) {
      // Clear the list and localStorage only after fully successful save
      setScannedProducts([])
      localStorage.removeItem(BULK_ADD_PRODUCTS_KEY)
      onClose()
    }
    // Don't close modal if there were errors - let user retry
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
        <DialogContent className="max-w-4xl h-[85vh] flex flex-col p-3 sm:p-6">
          <DialogHeader className="flex-shrink-0 pb-2">
            <DialogTitle className="flex items-center gap-2 text-base">
              <Barcode className="w-5 h-5" />
              Masowe dodawanie produktów
            </DialogTitle>
            <DialogDescription className="text-xs">
              Skanuj produkty czytnikiem kodów kreskowych. Po zeskanowaniu naciśnij Enter.
            </DialogDescription>
          </DialogHeader>

          {/* Barcode input - fixed at top */}
          <div className="flex-shrink-0 flex gap-2 items-center p-2 sm:p-4 bg-gray-50 rounded-lg">
            <Label htmlFor="barcode-input" className="whitespace-nowrap text-sm">Kod kreskowy:</Label>
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
              placeholder="Zeskanuj lub wpisz..."
              className="font-mono text-base"
              disabled={isSearching}
              autoFocus
            />
            {isSearching && <Loader2 className="w-5 h-5 animate-spin text-orange-500" />}
          </div>

          {/* Stats - compact */}
          <div className="flex-shrink-0 flex gap-3 text-xs py-1">
            <div className="flex items-center gap-1 text-green-600">
              <Check className="w-3 h-3" />
              <span>Znalezione: {foundProducts.length}</span>
            </div>
            <div className="flex items-center gap-1 text-red-600">
              <X className="w-3 h-3" />
              <span>Nieznalezione: {notFoundProducts.length}</span>
            </div>
            <div className="flex items-center gap-1 text-gray-600">
              <Package className="w-3 h-3" />
              <span>Razem: {scannedProducts.length}</span>
            </div>
          </div>

          {/* Product lists - scrollable area */}
          <div className="flex-1 min-h-0 overflow-auto">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 h-full">
              {/* Found products */}
              <div className="flex flex-col min-h-[120px] max-h-[35vh] md:max-h-none">
                <h3 className="font-medium text-green-700 mb-1 flex items-center gap-1 text-sm flex-shrink-0">
                  <Check className="w-3 h-3" />
                  Znalezione w Open Food Facts
                </h3>
                <div className="flex-1 border rounded-lg p-2 bg-green-50 overflow-auto">
                  {foundProducts.length === 0 ? (
                    <p className="text-xs text-gray-500 p-2 text-center">Brak zeskanowanych produktów</p>
                  ) : (
                    <div className="space-y-2">
                      {foundProducts.map(product => (
                        <div key={product.id} className="flex items-center gap-2 p-2 bg-white rounded border border-green-200">
                          <Check className="w-4 h-4 text-green-600 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="flex gap-1">
                              <Input
                                value={product.name}
                                onChange={(e) => handleUpdateProductName(product.id, e.target.value)}
                                className="h-7 text-sm flex-1"
                              />
                              <Button
                                type="button"
                                variant="outline"
                                size="icon"
                                onClick={() => openKeyboardForProduct(product.id, product.name)}
                                title="Otwórz klawiaturę"
                                className="h-7 w-7 shrink-0"
                              >
                                <Keyboard className="h-3 w-3" />
                              </Button>
                            </div>
                            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                              <p className="text-xs text-gray-500 font-mono">{product.barcode}</p>
                              {product.source && product.source !== 'none' && (
                                <span className={`text-xs px-1.5 py-0.5 rounded ${
                                  product.source === 'off+leclerc' 
                                    ? 'bg-purple-100 text-purple-700' 
                                    : product.source === 'leclerc'
                                    ? 'bg-orange-100 text-orange-700'
                                    : 'bg-blue-100 text-blue-700'
                                }`}>
                                  {product.source === 'off+leclerc' ? 'OFF+Leclerc' 
                                    : product.source === 'leclerc' ? 'Leclerc' 
                                    : 'OpenFoodFacts'}
                                </span>
                              )}
                            </div>
                            {product.existingProductId && (
                              <p className="text-xs text-blue-600">Już w bazie</p>
                            )}
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemoveProduct(product.id)}
                            className="text-red-500 hover:text-red-700 h-7 w-7 p-0"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Not found products */}
              <div className="flex flex-col min-h-[120px] max-h-[35vh] md:max-h-none">
                <h3 className="font-medium text-red-700 mb-1 flex items-center gap-1 text-sm flex-shrink-0">
                  <X className="w-3 h-3" />
                  Nieznalezione - uzupełnij nazwy ręcznie
                </h3>
                <div className="flex-1 border rounded-lg p-2 bg-red-50 overflow-auto">
                  {notFoundProducts.length === 0 ? (
                    <p className="text-xs text-gray-500 p-2 text-center">Brak nieznalezionych produktów</p>
                  ) : (
                    <div className="space-y-2">
                      {notFoundProducts.map(product => (
                        <div key={product.id} className="flex items-center gap-2 p-2 bg-white rounded border border-red-200">
                          <X className="w-4 h-4 text-red-600 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="flex gap-1">
                              <Input
                                value={product.name}
                                onChange={(e) => handleUpdateProductName(product.id, e.target.value)}
                                className="h-7 text-sm flex-1"
                                placeholder="Wpisz nazwę..."
                              />
                              <Button
                                type="button"
                                variant="outline"
                                size="icon"
                                onClick={() => openKeyboardForProduct(product.id, product.name)}
                                title="Otwórz klawiaturę"
                                className="h-7 w-7 shrink-0"
                              >
                                <Keyboard className="h-3 w-3" />
                              </Button>
                            </div>
                            <p className="text-xs text-gray-500 font-mono mt-0.5">{product.barcode}</p>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemoveProduct(product.id)}
                            className="text-red-500 hover:text-red-700 h-7 w-7 p-0"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Warning for not found products - compact */}
          {notFoundProducts.length > 0 && (
            <div className="flex-shrink-0 flex items-center gap-2 p-2 bg-yellow-50 border border-yellow-200 rounded text-xs">
              <AlertCircle className="w-4 h-4 text-yellow-600 flex-shrink-0" />
              <p className="text-yellow-800">Przed zapisaniem uzupełnij ich nazwy ręcznie.</p>
            </div>
          )}

          {/* Footer - always visible */}
          <DialogFooter className="flex-shrink-0 gap-2 pt-2 border-t flex-col sm:flex-row">
            <div className="flex gap-2 w-full sm:w-auto">
              <Button variant="outline" onClick={onClose} size="sm">
                Anuluj
              </Button>
              {scannedProducts.length > 0 && (
                <Button 
                  variant="outline" 
                  onClick={handleClearList} 
                  size="sm"
                  className="text-red-600 hover:text-red-700 hover:bg-red-50 border-red-300"
                >
                  <Trash2 className="w-4 h-4 mr-1" />
                  Wyczyść listę
                </Button>
              )}
            </div>
            <Button
              onClick={handleSaveAll}
              disabled={scannedProducts.length === 0 || isSaving}
              className="bg-green-600 hover:bg-green-700 w-full sm:w-auto"
              size="sm"
            >
              {isSaving ? (
                <><Loader2 className="w-4 h-4 mr-1 animate-spin" /> Zapisywanie...</>
              ) : (
                <><Save className="w-4 h-4 mr-1" /> Zapisz ({scannedProducts.filter(p => !p.existingProductId).length})</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Alphanumeric Keyboard Modal */}
      <AlphanumericKeyboardModal
        isOpen={showKeyboard}
        onClose={() => {
          setShowKeyboard(false)
          setKeyboardProductId(null)
        }}
        onConfirm={handleKeyboardConfirm}
        initialValue={keyboardInitialValue}
        title="Edytuj nazwę produktu"
        placeholder="Wpisz nazwę produktu..."
      />
    </>
  )
}
