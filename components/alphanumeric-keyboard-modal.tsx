'use client'

import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
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

  const handleClear = () => {
    setValue('')
  }

  const handleConfirm = () => {
    onConfirm(value)
    onClose()
  }

  const handleCancel = () => {
    onClose()
  }

  // Układ klawiatury QWERTY
  const row1 = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0']
  const row2 = ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P']
  const row3 = ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L']
  const row4 = ['Z', 'X', 'C', 'V', 'B', 'N', 'M']
  const specialChars = ['-', '/', '.', ',']

  const keyClass = "h-10 min-w-[32px] flex-1 text-base font-medium bg-gray-100 hover:bg-gray-200 active:bg-gray-300 border border-gray-300 rounded"
  const actionKeyClass = "h-10 px-3 text-base font-medium border rounded"

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-[95vw] w-full sm:max-w-md p-3">
        <DialogHeader className="pb-2">
          <DialogTitle className="text-base">{title}</DialogTitle>
        </DialogHeader>

        {/* Pole tekstowe */}
        <div className="bg-gray-50 border-2 border-gray-300 rounded-lg p-3 min-h-[48px] font-mono text-lg break-all">
          {value || <span className="text-gray-400">{placeholder}</span>}
        </div>

        {/* Klawiatura */}
        <div className="space-y-1.5 mt-2">
          {/* Rząd 1: Cyfry */}
          <div className="flex gap-1">
            {row1.map(key => (
              <Button
                key={key}
                variant="outline"
                className={keyClass}
                onClick={() => handleKey(key)}
              >
                {key}
              </Button>
            ))}
          </div>

          {/* Rząd 2: QWERTYUIOP */}
          <div className="flex gap-1">
            {row2.map(key => (
              <Button
                key={key}
                variant="outline"
                className={keyClass}
                onClick={() => handleKey(key)}
              >
                {key}
              </Button>
            ))}
          </div>

          {/* Rząd 3: ASDFGHJKL */}
          <div className="flex gap-1 px-3">
            {row3.map(key => (
              <Button
                key={key}
                variant="outline"
                className={keyClass}
                onClick={() => handleKey(key)}
              >
                {key}
              </Button>
            ))}
          </div>

          {/* Rząd 4: ZXCVBNM + specjalne */}
          <div className="flex gap-1 px-6">
            {row4.map(key => (
              <Button
                key={key}
                variant="outline"
                className={keyClass}
                onClick={() => handleKey(key)}
              >
                {key}
              </Button>
            ))}
          </div>

          {/* Rząd 5: Znaki specjalne + Backspace */}
          <div className="flex gap-1">
            {specialChars.map(key => (
              <Button
                key={key}
                variant="outline"
                className={keyClass}
                onClick={() => handleKey(key)}
              >
                {key}
              </Button>
            ))}
            <Button
              variant="outline"
              className={`${actionKeyClass} flex-[2] bg-yellow-100 hover:bg-yellow-200 border-yellow-400`}
              onClick={handleBackspace}
            >
              <Delete className="w-5 h-5" />
            </Button>
            <Button
              variant="outline"
              className={`${actionKeyClass} flex-[2] bg-red-100 hover:bg-red-200 border-red-400 text-red-700`}
              onClick={handleClear}
            >
              Wyczyść
            </Button>
          </div>

          {/* Rząd 6: Spacja + Akcje */}
          <div className="flex gap-1 mt-2">
            <Button
              variant="outline"
              className={`${actionKeyClass} flex-[4] bg-gray-100 hover:bg-gray-200 border-gray-300`}
              onClick={() => handleKey(' ')}
            >
              SPACJA
            </Button>
            <Button
              variant="outline"
              className={`${actionKeyClass} flex-[2] bg-gray-200 hover:bg-gray-300 border-gray-400`}
              onClick={handleCancel}
            >
              <X className="w-4 h-4 mr-1" />
              Anuluj
            </Button>
            <Button
              className={`${actionKeyClass} flex-[2] bg-green-600 hover:bg-green-700 text-white border-green-700`}
              onClick={handleConfirm}
            >
              <Check className="w-4 h-4 mr-1" />
              OK
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
