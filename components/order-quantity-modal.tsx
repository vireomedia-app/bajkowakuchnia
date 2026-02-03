
'use client'

import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ArrowLeft, Check, Delete } from 'lucide-react'

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
  { value: 'kg', label: 'kg' },
  { value: 'l', label: 'l' },
  { value: 'szt', label: 'szt' },
  { value: 'opak', label: 'opak' },
  { value: 'g', label: 'g' },
  { value: 'ml', label: 'ml' },
  { value: 'puszka', label: 'puszka' },
  { value: 'słoik', label: 'słoik' },
  { value: 'butelka', label: 'butelka' }
]

// Kompaktowa klawiatura numeryczna - zoptymalizowana dla mobile
function NumericKeypad({ 
  value, 
  onChange, 
  onSubmit,
  onCancel,
  isDisabled
}: { 
  value: string
  onChange: (val: string) => void
  onSubmit: () => void
  onCancel: () => void
  isDisabled: boolean
}) {
  const handleKeyPress = (key: string) => {
    if (key === '⌫') {
      onChange(value.slice(0, -1))
    } else if (key === '.') {
      if (!value.includes('.')) {
        onChange(value + '.')
      }
    } else {
      onChange(value + key)
    }
  }

  return (
    <div className="space-y-1.5">
      {/* Wyświetlacz z jednostką */}
      <div className="bg-gray-100 border-2 border-gray-300 rounded-lg px-3 py-2 flex items-center justify-end">
        <span className="text-2xl font-mono font-bold text-gray-800">
          {value || '0'}
        </span>
      </div>
      
      {/* Klawisze - 4 kolumny, kompaktowe */}
      <div className="grid grid-cols-4 gap-1.5">
        {['1','2','3','⌫'].map((key) => (
          <Button
            key={key}
            type="button"
            variant={key === '⌫' ? 'destructive' : 'outline'}
            className={`h-11 text-xl font-bold ${
              key === '⌫' ? 'bg-red-100 hover:bg-red-200 text-red-700 border-red-300' : 
              'bg-white hover:bg-gray-100'
            }`}
            onClick={() => handleKeyPress(key)}
          >
            {key === '⌫' ? <Delete className="w-5 h-5" /> : key}
          </Button>
        ))}
        {['4','5','6','C'].map((key) => (
          <Button
            key={key}
            type="button"
            variant="outline"
            className={`h-11 text-xl font-bold ${
              key === 'C' ? 'bg-gray-200 hover:bg-gray-300 text-gray-700' : 
              'bg-white hover:bg-gray-100'
            }`}
            onClick={() => key === 'C' ? onChange('') : handleKeyPress(key)}
          >
            {key}
          </Button>
        ))}
        {['7','8','9','.'].map((key) => (
          <Button
            key={key}
            type="button"
            variant="outline"
            className="h-11 text-xl font-bold bg-white hover:bg-gray-100"
            onClick={() => handleKeyPress(key)}
          >
            {key}
          </Button>
        ))}
        <Button
          type="button"
          variant="outline"
          className="h-11 text-xl font-bold bg-white hover:bg-gray-100"
          onClick={() => handleKeyPress('0')}
        >
          0
        </Button>
        <Button
          type="button"
          variant="outline"
          className="h-11 text-sm font-semibold bg-gray-100 hover:bg-gray-200 text-gray-700"
          onClick={onCancel}
        >
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <Button
          type="button"
          className="h-11 text-sm font-semibold bg-green-600 hover:bg-green-700 text-white col-span-2"
          onClick={onSubmit}
          disabled={!value || parseFloat(value) <= 0 || isDisabled}
        >
          <Check className="w-4 h-4 mr-1" />
          OK
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

  // Reset unit when product changes
  useEffect(() => {
    setUnit(product.unit || 'szt')
  }, [product.unit])

  // Funkcja konwersji jednostek
  const convertToBaseUnit = (qty: number, fromUnit: string, toUnit: string): number => {
    if (fromUnit === toUnit) return qty
    
    if (fromUnit === 'kg' && toUnit === 'g') return qty * 1000
    if (fromUnit === 'g' && toUnit === 'kg') return qty / 1000
    if (fromUnit === 'l' && toUnit === 'ml') return qty * 1000
    if (fromUnit === 'ml' && toUnit === 'l') return qty / 1000
    
    return qty
  }

  const handleSubmit = async () => {
    const qty = parseFloat(quantity)
    
    if (isNaN(qty) || qty <= 0) {
      return
    }

    const convertedQty = convertToBaseUnit(qty, unit, product.unit)
    await onSubmit(convertedQty, product.unit)
    
    setQuantity('')
    setUnit(product.unit || 'szt')
  }

  const convertedValue = quantity && parseFloat(quantity) > 0 
    ? convertToBaseUnit(parseFloat(quantity), unit, product.unit) 
    : 0

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[400px] p-4">
        <DialogHeader className="pb-2">
          <DialogTitle className="text-base font-semibold text-gray-900 truncate">
            {product.name}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          {/* Kompaktowa informacja o produkcie */}
          <div className="flex items-center justify-between text-sm bg-gray-50 rounded-md px-3 py-2">
            <span className="text-gray-500">Stan: <span className="font-medium text-gray-900">{product.currentStock} {product.unit}</span></span>
            <span className="text-gray-400 font-mono text-xs">{product.barcode}</span>
          </div>

          {/* Wybór jednostki - inline */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600">Jednostka:</span>
            <Select value={unit} onValueChange={setUnit}>
              <SelectTrigger className="w-24 h-9">
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
            {unit !== product.unit && quantity && parseFloat(quantity) > 0 && (
              <span className="text-xs text-blue-600">
                → {convertedValue.toFixed(convertedValue % 1 === 0 ? 0 : 2)} {product.unit}
              </span>
            )}
          </div>

          {/* Klawiatura numeryczna */}
          <NumericKeypad 
            value={quantity}
            onChange={setQuantity}
            onSubmit={handleSubmit}
            onCancel={onClose}
            isDisabled={isProcessing}
          />

          {/* Podgląd - kompaktowy */}
          {quantity && parseFloat(quantity) > 0 && (
            <div className="bg-green-50 border border-green-200 rounded-md px-3 py-2 text-sm text-green-800">
              <span className="font-medium">+{quantity} {unit}</span>
              <span className="mx-2">→</span>
              <span>Nowy stan: {(product.currentStock + convertedValue).toFixed(convertedValue % 1 === 0 ? 0 : 2)} {product.unit}</span>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
