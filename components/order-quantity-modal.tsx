
'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Package, ArrowLeft, Check, Delete } from 'lucide-react'

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

// Własna klawiatura numeryczna - działa nawet gdy Bluetooth jest podłączony
function NumericKeypad({ 
  value, 
  onChange, 
  onSubmit 
}: { 
  value: string
  onChange: (val: string) => void
  onSubmit: () => void 
}) {
  const handleKeyPress = (key: string) => {
    if (key === 'C') {
      onChange('')
    } else if (key === '⌫') {
      onChange(value.slice(0, -1))
    } else if (key === '.') {
      // Tylko jedna kropka dozwolona
      if (!value.includes('.')) {
        onChange(value + '.')
      }
    } else if (key === 'OK') {
      onSubmit()
    } else {
      onChange(value + key)
    }
  }

  const keys = [
    ['1', '2', '3'],
    ['4', '5', '6'],
    ['7', '8', '9'],
    ['.', '0', '⌫'],
  ]

  return (
    <div className="space-y-2">
      {/* Wyświetlacz */}
      <div className="bg-gray-100 border-2 border-gray-300 rounded-lg p-4 text-right">
        <span className="text-3xl font-mono font-bold text-gray-800">
          {value || '0'}
        </span>
      </div>
      
      {/* Klawisze */}
      <div className="grid grid-cols-3 gap-2">
        {keys.map((row, rowIndex) => (
          row.map((key) => (
            <Button
              key={key}
              type="button"
              variant={key === '⌫' ? 'destructive' : 'outline'}
              className={`h-14 text-2xl font-bold ${
                key === '⌫' ? 'bg-red-100 hover:bg-red-200 text-red-700 border-red-300' : 
                'bg-white hover:bg-gray-100'
              }`}
              onClick={() => handleKeyPress(key)}
            >
              {key === '⌫' ? <Delete className="w-6 h-6" /> : key}
            </Button>
          ))
        ))}
      </div>
      
      {/* Przyciski akcji */}
      <div className="grid grid-cols-2 gap-2 mt-2">
        <Button
          type="button"
          variant="outline"
          className="h-12 text-lg font-semibold bg-gray-100 hover:bg-gray-200"
          onClick={() => handleKeyPress('C')}
        >
          Wyczyść
        </Button>
        <Button
          type="button"
          className="h-12 text-lg font-semibold bg-green-600 hover:bg-green-700 text-white"
          onClick={() => handleKeyPress('OK')}
          disabled={!value || parseFloat(value) <= 0}
        >
          <Check className="w-5 h-5 mr-2" />
          Zatwierdź
        </Button>
      </div>
    </div>
  )
}

export function OrderQuantityModal({ 
  isOpen, 
  onClose, 
  product, 
  onSubmit,
  isProcessing 
}: OrderQuantityModalProps) {
  const [quantity, setQuantity] = useState('')
  const [unit, setUnit] = useState(product.unit || 'szt')

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

          {/* Wybór jednostki */}
          <div className="space-y-2">
            <Label htmlFor="unit">Jednostka</Label>
            <Select value={unit} onValueChange={setUnit}>
              <SelectTrigger id="unit" className="text-lg">
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

          {/* Klawiatura numeryczna */}
          <div className="space-y-2">
            <Label>Ilość dostarczona</Label>
            <NumericKeypad 
              value={quantity}
              onChange={setQuantity}
              onSubmit={handleSubmit}
            />
          </div>

          {/* Podgląd */}
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

          {/* Przycisk anuluj */}
          <Button
            onClick={onClose}
            variant="outline"
            className="w-full"
            disabled={isProcessing}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Anuluj i wróć
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
