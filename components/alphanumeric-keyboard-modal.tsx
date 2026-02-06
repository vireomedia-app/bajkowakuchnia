'use client'

import { useState, useEffect } from 'react'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Delete, Check, X } from 'lucide-react'

interface AlphanumericKeyboardModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: (value: string) => void
  initialValue?: string
  title?: string
  placeholder?: string
}

export function AlphanumericKeyboardModal({
  isOpen,
  onClose,
  onConfirm,
  initialValue = '',
  title = 'Wpisz wartość',
  placeholder = 'Wpisz tekst...'
}: AlphanumericKeyboardModalProps) {
  const [value, setValue] = useState(initialValue)

  useEffect(() => {
    if (isOpen) {
      setValue(initialValue)
    }
  }, [isOpen, initialValue])

  const handleKey = (key: string) => {
    setValue(prev => prev + key)
  }

  const handleBackspace = () => {
    setValue(prev => prev.slice(0, -1))
  }

  const handleConfirm = () => {
    onConfirm(value)
    onClose()
  }

  // Układ klawiatury QWERTY - super kompaktowy
  const row1 = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0']
  const row2 = ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P']
  const row3 = ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L', '←']
  const row4 = ['Z', 'X', 'C', 'V', 'B', 'N', 'M', '.', '-', '/']

  const keyClass = "h-7 min-w-0 flex-1 text-xs font-medium bg-gray-100 hover:bg-gray-200 active:bg-gray-300 border border-gray-300 rounded-sm px-0"

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-[95vw] w-full sm:max-w-xs p-2 gap-0 [&>button]:hidden">
        {/* Tytuł inline */}
        <p className="text-xs text-gray-500 mb-1">{title}</p>

        {/* Pole tekstowe - mini */}
        <div className="bg-gray-50 border border-gray-300 rounded p-1.5 min-h-[28px] font-mono text-sm break-all mb-1">
          {value || <span className="text-gray-400 text-xs">{placeholder}</span>}
        </div>

        {/* Klawiatura - super kompaktowa */}
        <div className="space-y-0.5">
          {/* Rząd 1: Cyfry */}
          <div className="flex gap-px">
            {row1.map(key => (
              <Button key={key} variant="outline" className={keyClass} onClick={() => handleKey(key)}>
                {key}
              </Button>
            ))}
          </div>

          {/* Rząd 2: QWERTYUIOP */}
          <div className="flex gap-px">
            {row2.map(key => (
              <Button key={key} variant="outline" className={keyClass} onClick={() => handleKey(key)}>
                {key}
              </Button>
            ))}
          </div>

          {/* Rząd 3: ASDFGHJKL + ← */}
          <div className="flex gap-px">
            {row3.map(key => (
              <Button 
                key={key} 
                variant="outline" 
                className={key === '←' ? "h-7 min-w-0 flex-1 text-xs font-medium bg-yellow-100 hover:bg-yellow-200 border-yellow-400 rounded-sm px-0" : keyClass} 
                onClick={() => key === '←' ? handleBackspace() : handleKey(key)}
              >
                {key}
              </Button>
            ))}
          </div>

          {/* Rząd 4: ZXCVBNM + znaki */}
          <div className="flex gap-px">
            {row4.map(key => (
              <Button key={key} variant="outline" className={keyClass} onClick={() => handleKey(key)}>
                {key}
              </Button>
            ))}
          </div>

          {/* Rząd 5: Spacja + Akcje */}
          <div className="flex gap-0.5 pt-0.5">
            <Button
              variant="outline"
              className="h-8 flex-[3] text-xs bg-gray-100 hover:bg-gray-200 border-gray-300"
              onClick={() => handleKey(' ')}
            >
              SPACJA
            </Button>
            <Button
              variant="outline"
              className="h-8 flex-[2] text-xs bg-gray-200 hover:bg-gray-300 border-gray-400"
              onClick={onClose}
            >
              <X className="w-3 h-3 mr-0.5" />
              Anuluj
            </Button>
            <Button
              className="h-8 flex-[2] text-xs bg-green-600 hover:bg-green-700 text-white"
              onClick={handleConfirm}
            >
              <Check className="w-3 h-3 mr-0.5" />
              OK
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
