
'use client'

import { useState, useRef, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Package, ArrowLeft, Check, Keyboard } from 'lucide-react'

interface OrderQuantityModalProps {
  isOpen: boolean
  onClose: () => void
  product: {
    name: string
    unit: string
    barcode: string
    currentStock: number
  }
  onSubmit: (quantity: number, unit: string) => Promise<void>
  isProcessing: boolean
}

const COMMON_UNITS = [
  { value: 'kg', label: 'kilogramy (kg)' },
  { value: 'l', label: 'litry (l)' },
  { value: 'szt', label: 'sztuki (szt)' },
  { value: 'opak', label: 'opakowania (opak)' },
  { value: 'g', label: 'gramy (g)' },
  { value: 'ml', label: 'mililitry (ml)' },
  { value: 'puszka', label: 'puszki' },
  { value: 'słoik', label: 'słoiki' },
  { value: 'butelka', label: 'butelki' }
]

export function OrderQuantityModal({ 
  isOpen, 
  onClose, 
  product, 
  onSubmit,
  isProcessing 
}: OrderQuantityModalProps) {
  const [quantity, setQuantity] = useState('')
  const [unit, setUnit] = useState(product.unit || 'szt')
  const quantityInputRef = useRef<HTMLInputElement>(null)

  // Funkcja wymuszająca pokazanie klawiatury na urządzeniach mobilnych
  // (problem gdy skaner Bluetooth jest podłączony jako zewnętrzna klawiatura)
  const forceShowKeyboard = () => {
    if (quantityInputRef.current) {
      // Blur i focus z małym opóźnieniem wymusza otwarcie klawiatury
      quantityInputRef.current.blur()
      setTimeout(() => {
        if (quantityInputRef.current) {
          quantityInputRef.current.focus()
          // Na niektórych urządzeniach potrzebne jest też kliknięcie
          quantityInputRef.current.click()
        }
      }, 100)
    }
  }

  // Auto-focus gdy modal się otworzy
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        forceShowKeyboard()
      }, 300)
    }
  }, [isOpen])

  // Funkcja konwersji jednostek
  const convertToBaseUnit = (qty: number, fromUnit: string, toUnit: string): number => {
    // Jeśli jednostki są takie same, nie konwertuj
    if (fromUnit === toUnit) return qty
    
    // Konwersje wagowe
    if ((fromUnit === 'kg' && toUnit === 'g') || (fromUnit === 'g' && toUnit === 'kg')) {
      if (fromUnit === 'kg' && toUnit === 'g') return qty * 1000  // kg → g
      if (fromUnit === 'g' && toUnit === 'kg') return qty / 1000  // g → kg
    }
    
    // Konwersje objętościowe
    if ((fromUnit === 'l' && toUnit === 'ml') || (fromUnit === 'ml' && toUnit === 'l')) {
      if (fromUnit === 'l' && toUnit === 'ml') return qty * 1000  // l → ml
      if (fromUnit === 'ml' && toUnit === 'l') return qty / 1000  // ml → l
    }
    
    // Jeśli nie ma konwersji, zwróć oryginalną wartość
    return qty
  }

  const handleSubmit = async () => {
    const qty = parseFloat(quantity)
    
    if (isNaN(qty) || qty <= 0) {
      return
    }

    // Konwertuj do jednostki bazowej produktu
    const convertedQty = convertToBaseUnit(qty, unit, product.unit)

    await onSubmit(convertedQty, product.unit)
    
    // Resetuj formularz
    setQuantity('')
    setUnit(product.unit || 'szt')
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleSubmit()
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <Package className="w-5 h-5 text-green-600" />
            <span>Podaj ilość produktu</span>
          </DialogTitle>
          <DialogDescription>
            Wprowadź ilość dostarczonego produktu
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 overflow-y-auto flex-1">
          {/* Informacje o produkcie */}
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <div className="space-y-2">
              <div>
                <p className="text-xs text-gray-500">Produkt:</p>
                <p className="font-semibold text-gray-900">{product.name}</p>
              </div>
              <div className="flex justify-between items-center">
                <div>
                  <p className="text-xs text-gray-500">Kod kreskowy:</p>
                  <p className="text-sm text-gray-700">{product.barcode}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-gray-500">Aktualny stan:</p>
                  <p className="text-sm font-medium text-gray-900">
                    {product.currentStock} {product.unit}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Formularz ilości */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="quantity">Ilość dostarczona</Label>
              <div className="flex gap-2">
                <Input
                  ref={quantityInputRef}
                  id="quantity"
                  type="number"
                  inputMode="decimal"
                  step="0.00001"
                  min="0.01"
                  placeholder="np. 10.5"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  onKeyPress={handleKeyPress}
                  autoFocus
                  className="text-lg flex-1"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={forceShowKeyboard}
                  className="px-3 bg-blue-50 border-blue-200 hover:bg-blue-100"
                  title="Pokaż klawiaturę"
                >
                  <Keyboard className="w-5 h-5 text-blue-600" />
                </Button>
              </div>
              <p className="text-xs text-gray-500">
                💡 Jeśli klawiatura się nie pojawia, kliknij ikonę klawiatury
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="unit">Jednostka</Label>
              <Select value={unit} onValueChange={setUnit}>
                <SelectTrigger id="unit">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {COMMON_UNITS.map((u) => (
                    <SelectItem key={u.value} value={u.value}>
                      {u.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {quantity && parseFloat(quantity) > 0 && (
              <div className="bg-green-50 border border-green-200 rounded-md p-3">
                <p className="text-sm text-green-900">
                  ✓ Zostanie dodane: <span className="font-semibold">+{quantity} {unit}</span>
                </p>
                {unit !== product.unit && (
                  <p className="text-xs text-blue-700 mt-1">
                    → Przeliczono: {convertToBaseUnit(parseFloat(quantity), unit, product.unit).toFixed(2)} {product.unit}
                  </p>
                )}
                <p className="text-xs text-green-700 mt-1">
                  Nowy stan: {(product.currentStock + convertToBaseUnit(parseFloat(quantity), unit, product.unit)).toFixed(2)} {product.unit}
                </p>
              </div>
            )}
          </div>

          {/* Przyciski */}
          <div className="flex space-x-3">
            <Button
              onClick={onClose}
              variant="outline"
              className="flex-1"
              disabled={isProcessing}
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Wróć do skanera
            </Button>

            <Button
              onClick={handleSubmit}
              disabled={!quantity || parseFloat(quantity) <= 0 || isProcessing}
              className="flex-1 bg-green-600 hover:bg-green-700"
            >
              {isProcessing ? (
                <>Zapisywanie...</>
              ) : (
                <>
                  <Check className="w-4 h-4 mr-2" />
                  Dodaj i kontynuuj
                </>
              )}
            </Button>
          </div>

          <p className="text-xs text-center text-gray-500">
            Po zapisaniu automatycznie powrócisz do skanowania kolejnych produktów
          </p>
        </div>
      </DialogContent>
    </Dialog>
  )
}
