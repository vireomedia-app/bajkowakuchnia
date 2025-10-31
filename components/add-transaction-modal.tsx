
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { TrendingUp, TrendingDown, AlertCircle, Edit3 } from 'lucide-react'
import { toast } from 'sonner'

interface AddTransactionModalProps {
  isOpen: boolean
  onClose: () => void
  productId: string
}

export function AddTransactionModal({ isOpen, onClose, productId }: AddTransactionModalProps) {
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    document: '',
    type: 'INCOME' as 'INCOME' | 'OUTCOME',
    quantity: '0'
  })
  const [isLoading, setIsLoading] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [submitAttempts, setSubmitAttempts] = useState(0)
  const router = useRouter()

  const validateForm = () => {
    const newErrors: Record<string, string> = {}
    
    if (!formData.date) {
      newErrors.date = 'Data jest wymagana'
    }
    
    // Numer dokumentu - pierwsze kliknięcie pokazuje ostrzeżenie, drugie pozwala dodać
    if (!formData.document?.trim() && submitAttempts === 0) {
      newErrors.document = '⚠️ Dodajesz transakcję bez numeru dokumentu. Kliknij ponownie "Dodaj transakcję" aby potwierdzić.'
    }
    
    const quantity = parseFloat(formData.quantity)
    if (isNaN(quantity) || quantity <= 0) {
      newErrors.quantity = 'Ilość musi być liczbą większą od 0'
    }
    
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!validateForm()) {
      // Zwiększ liczbę prób, jeśli brakuje dokumentu
      if (!formData.document?.trim() && submitAttempts === 0) {
        setSubmitAttempts(prev => prev + 1)
      }
      return
    }
    
    setIsLoading(true)
    
    try {
      const response = await fetch(`/api/products/${productId}/transactions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          date: formData.date,
          document: formData.document?.trim() || '',
          type: formData.type,
          quantity: parseFloat(formData.quantity)
        }),
      })
      
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Błąd podczas dodawania transakcji')
      }
      
      const transaction = await response.json()
      
      toast.success('Transakcja została dodana pomyślnie!')
      
      // Reset form
      setFormData({
        date: new Date().toISOString().split('T')[0],
        document: '',
        type: 'INCOME',
        quantity: '0'
      })
      setErrors({})
      setSubmitAttempts(0)
      
      onClose()
      router.refresh()
      
    } catch (error) {
      console.error('Error adding transaction:', error)
      toast.error(error instanceof Error ? error.message : 'Błąd podczas dodawania transakcji')
    } finally {
      setIsLoading(false)
    }
  }

  const handleClose = () => {
    if (!isLoading) {
      setFormData({
        date: new Date().toISOString().split('T')[0],
        document: '',
        type: 'INCOME',
        quantity: '0'
      })
      setErrors({})
      setSubmitAttempts(0)
      onClose()
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <Edit3 className="w-5 h-5 text-green-600" />
            <span>Dodaj transakcję</span>
          </DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="date">Data</Label>
            <Input
              id="date"
              type="date"
              value={formData.date}
              onChange={(e) => setFormData({ ...formData, date: e.target.value })}
              className={errors.date ? 'border-red-300 focus:border-red-500 focus:ring-red-500' : ''}
              disabled={isLoading}
            />
            {errors.date && (
              <p className="text-sm text-red-600 flex items-center space-x-1">
                <AlertCircle className="w-4 h-4" />
                <span>{errors.date}</span>
              </p>
            )}
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="document">Numer dokumentu</Label>
            <Input
              id="document"
              type="text"
              placeholder="Wprowadź numer dokumentu..."
              value={formData.document}
              onChange={(e) => setFormData({ ...formData, document: e.target.value })}
              className={errors.document ? 'border-red-300 focus:border-red-500 focus:ring-red-500' : ''}
              disabled={isLoading}
            />
            {errors.document && (
              <p className="text-sm text-red-600 flex items-center space-x-1">
                <AlertCircle className="w-4 h-4" />
                <span>{errors.document}</span>
              </p>
            )}
          </div>
          
          <div className="space-y-3">
            <Label>Typ transakcji</Label>
            <RadioGroup
              value={formData.type}
              onValueChange={(value: 'INCOME' | 'OUTCOME') => {
                setFormData({ ...formData, type: value })
                setErrors({}) // Wyczyść błędy
                setSubmitAttempts(0) // Reset prób
              }}
              disabled={isLoading}
              className="flex space-x-6"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="INCOME" id="income" />
                <Label htmlFor="income" className="flex items-center space-x-2 cursor-pointer">
                  <TrendingUp className="w-4 h-4 text-green-600" />
                  <span>Przychód</span>
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="OUTCOME" id="outcome" />
                <Label htmlFor="outcome" className="flex items-center space-x-2 cursor-pointer">
                  <TrendingDown className="w-4 h-4 text-red-600" />
                  <span>Rozchód</span>
                </Label>
              </div>
            </RadioGroup>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="quantity">Ilość</Label>
            <Input
              id="quantity"
              type="number"
              step="0.5"
              min="0"
              placeholder="0.00"
              value={formData.quantity}
              onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
              className={errors.quantity ? 'border-red-300 focus:border-red-500 focus:ring-red-500' : ''}
              disabled={isLoading}
            />
            {errors.quantity && (
              <p className="text-sm text-red-600 flex items-center space-x-1">
                <AlertCircle className="w-4 h-4" />
                <span>{errors.quantity}</span>
              </p>
            )}
          </div>
          
          <div className="flex space-x-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={isLoading}
              className="flex-1"
            >
              Anuluj
            </Button>
            <Button
              type="submit"
              className="flex-1 bg-green-600 hover:bg-green-700"
              disabled={isLoading}
            >
              {isLoading ? (
                <div className="flex items-center space-x-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  <span>Dodawanie...</span>
                </div>
              ) : (
                'Dodaj transakcję'
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
