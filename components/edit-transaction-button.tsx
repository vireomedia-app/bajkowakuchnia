
'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Pencil } from 'lucide-react'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import { format } from 'date-fns'

interface EditTransactionButtonProps {
  transaction: {
    id: string
    date: Date
    document: string
    type: 'INCOME' | 'OUTCOME'
    quantity: number
  }
}

export function EditTransactionButton({ transaction }: EditTransactionButtonProps) {
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [formData, setFormData] = useState({
    date: format(new Date(transaction.date), 'yyyy-MM-dd'),
    document: transaction.document,
    type: transaction.type,
    quantity: transaction.quantity.toString()
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      const response = await fetch(`/api/transactions/${transaction.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      })

      if (response.ok) {
        toast.success('Transakcja została zaktualizowana')
        setIsOpen(false)
        router.refresh()
      } else {
        toast.error('Błąd podczas aktualizacji transakcji')
      }
    } catch (error) {
      console.error('Error updating transaction:', error)
      toast.error('Błąd podczas aktualizacji transakcji')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm">
          <Pencil className="w-4 h-4" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edytuj transakcję</DialogTitle>
          <DialogDescription>
            Zmień dane transakcji. Wszystkie kolejne stany magazynowe zostaną automatycznie przeliczone.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="date">Data</Label>
            <Input
              id="date"
              name="date"
              type="date"
              value={formData.date}
              onChange={(e) => setFormData({ ...formData, date: e.target.value })}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="document">Nr dokumentu (opcjonalnie)</Label>
            <Input
              id="document"
              name="document"
              value={formData.document}
              onChange={(e) => setFormData({ ...formData, document: e.target.value })}
              placeholder="Nr faktury, WZ, itp."
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="type">Typ transakcji</Label>
            <Select
              value={formData.type}
              onValueChange={(value: 'INCOME' | 'OUTCOME') => 
                setFormData({ ...formData, type: value })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="INCOME">Przychód</SelectItem>
                <SelectItem value="OUTCOME">Rozchód</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="quantity">Ilość</Label>
            <Input
              id="quantity"
              name="quantity"
              type="number"
              step="0.5"
              value={formData.quantity}
              onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
              required
            />
          </div>

          <div className="flex justify-end gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsOpen(false)}
              disabled={isLoading}
            >
              Anuluj
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? 'Zapisywanie...' : 'Zapisz zmiany'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
