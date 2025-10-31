
'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Checkbox } from '@/components/ui/checkbox'
import { UNITS } from '@/lib/types'
import { ALLERGENS } from '@/lib/allergens'
import { Package, AlertCircle } from 'lucide-react'
import { toast } from 'sonner'

interface AddProductModalProps {
  isOpen: boolean
  onClose: () => void
  initialName?: string
}

const UNIT_OPTIONS = [
  { value: 'kg', label: 'kg' },
  { value: 'szt', label: 'szt' },
  { value: 'l', label: 'l' },
  { value: 'opak', label: 'opak' },
  { value: 'g', label: 'g' },
  { value: 'ml', label: 'ml' },
  { value: 'inne', label: 'inne' },
]

export function AddProductModal({ isOpen, onClose, initialName = '' }: AddProductModalProps) {
  const [formData, setFormData] = useState({
    name: initialName,
    unit: 'szt' as typeof UNITS[number],
    manufacturer: '',
    initialStock: '0',
    calories: '',
    salt: '',
    protein: '',
    fat: '',
    saturatedFat: '',
    carbohydrates: '',
    sugars: '',
    calcium: '',
    iron: '',
    vitaminC: '',
    allergens: [] as number[],
  })
  const [isLoading, setIsLoading] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const router = useRouter()

  // Update initial name when prop changes
  useEffect(() => {
    if (initialName) {
      setFormData(prev => ({ ...prev, name: initialName }))
    }
  }, [initialName])

  const validateForm = () => {
    const newErrors: Record<string, string> = {}
    
    if (!formData.name?.trim()) {
      newErrors.name = 'Nazwa produktu jest wymagana'
    }
    
    if (!formData.unit) {
      newErrors.unit = 'Jednostka miary jest wymagana'
    }
    
    const stock = parseFloat(formData.initialStock)
    if (isNaN(stock) || stock < 0) {
      newErrors.initialStock = 'Stan początkowy musi być liczbą nie mniejszą od 0'
    }
    
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleAllergenToggle = (allergenId: number) => {
    setFormData(prev => {
      const allergens = prev.allergens.includes(allergenId)
        ? prev.allergens.filter(id => id !== allergenId)
        : [...prev.allergens, allergenId]
      return { ...prev, allergens }
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!validateForm()) {
      return
    }
    
    setIsLoading(true)
    
    try {
      const submitData = {
        name: formData.name.trim(),
        unit: formData.unit,
        manufacturer: formData.manufacturer || null,
        initialStock: parseFloat(formData.initialStock),
        calories: formData.calories ? parseFloat(formData.calories) : null,
        salt: formData.salt ? parseFloat(formData.salt) : null,
        protein: formData.protein ? parseFloat(formData.protein) : null,
        fat: formData.fat ? parseFloat(formData.fat) : null,
        saturatedFat: formData.saturatedFat ? parseFloat(formData.saturatedFat) : null,
        carbohydrates: formData.carbohydrates ? parseFloat(formData.carbohydrates) : null,
        sugars: formData.sugars ? parseFloat(formData.sugars) : null,
        calcium: formData.calcium ? parseFloat(formData.calcium) : null,
        iron: formData.iron ? parseFloat(formData.iron) : null,
        vitaminC: formData.vitaminC ? parseFloat(formData.vitaminC) : null,
        allergens: formData.allergens,
      }

      const response = await fetch('/api/products', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(submitData),
      })
      
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Błąd podczas dodawania produktu')
      }
      
      const product = await response.json()
      
      toast.success('Produkt został dodany pomyślnie!')
      
      // Emit event to notify other components (like RecipeForm) to refresh their product lists
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('productAdded', { detail: product }))
      }
      
      // Reset form
      setFormData({
        name: '',
        unit: 'szt' as typeof UNITS[number],
        manufacturer: '',
        initialStock: '0',
        calories: '',
        salt: '',
        protein: '',
        fat: '',
        saturatedFat: '',
        carbohydrates: '',
        sugars: '',
        calcium: '',
        iron: '',
        vitaminC: '',
        allergens: [],
      })
      setErrors({})
      
      onClose()
      router.refresh()
      
    } catch (error) {
      console.error('Error adding product:', error)
      toast.error(error instanceof Error ? error.message : 'Błąd podczas dodawania produktu')
    } finally {
      setIsLoading(false)
    }
  }

  const handleClose = () => {
    if (!isLoading) {
      setFormData({
        name: '',
        unit: 'szt' as typeof UNITS[number],
        manufacturer: '',
        initialStock: '0',
        calories: '',
        salt: '',
        protein: '',
        fat: '',
        saturatedFat: '',
        carbohydrates: '',
        sugars: '',
        calcium: '',
        iron: '',
        vitaminC: '',
        allergens: [],
      })
      setErrors({})
      onClose()
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <Package className="w-5 h-5 text-blue-600" />
            <span>Dodaj nowy produkt</span>
          </DialogTitle>
          <DialogDescription>
            Wypełnij podstawowe informacje i wartości odżywcze produktu.
          </DialogDescription>
        </DialogHeader>
        
        <ScrollArea className="max-h-[60vh] pr-4">
          <form onSubmit={handleSubmit} id="add-product-form">
            <div className="grid gap-6 py-4">
              {/* Basic Info */}
              <div className="space-y-4">
                <h3 className="font-semibold text-sm text-gray-700">Podstawowe informacje</h3>
                
                <div className="grid gap-2">
                  <Label htmlFor="name">Nazwa produktu *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Np. Mąka pszenna"
                    className={errors.name ? 'border-red-300' : ''}
                    disabled={isLoading}
                    required
                  />
                  {errors.name && (
                    <p className="text-sm text-red-600 flex items-center space-x-1">
                      <AlertCircle className="w-4 h-4" />
                      <span>{errors.name}</span>
                    </p>
                  )}
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="unit">Jednostka miary *</Label>
                  <Select
                    value={formData.unit}
                    onValueChange={(value) => setFormData({ ...formData, unit: value as typeof UNITS[number] })}
                    disabled={isLoading}
                    required
                  >
                    <SelectTrigger className={errors.unit ? 'border-red-300' : ''}>
                      <SelectValue placeholder="Wybierz jednostkę" />
                    </SelectTrigger>
                    <SelectContent>
                      {UNIT_OPTIONS.map((unit) => (
                        <SelectItem key={unit.value} value={unit.value}>
                          {unit.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.unit && (
                    <p className="text-sm text-red-600 flex items-center space-x-1">
                      <AlertCircle className="w-4 h-4" />
                      <span>{errors.unit}</span>
                    </p>
                  )}
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="manufacturer">Nazwa producenta</Label>
                  <Input
                    id="manufacturer"
                    value={formData.manufacturer}
                    onChange={(e) => setFormData({ ...formData, manufacturer: e.target.value })}
                    placeholder="Np. Młyny Polskie"
                    disabled={isLoading}
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="initialStock">Stan początkowy *</Label>
                  <Input
                    id="initialStock"
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    value={formData.initialStock}
                    onChange={(e) => setFormData({ ...formData, initialStock: e.target.value })}
                    className={errors.initialStock ? 'border-red-300' : ''}
                    disabled={isLoading}
                  />
                  {errors.initialStock && (
                    <p className="text-sm text-red-600 flex items-center space-x-1">
                      <AlertCircle className="w-4 h-4" />
                      <span>{errors.initialStock}</span>
                    </p>
                  )}
                </div>
              </div>

              {/* Nutritional Values */}
              <div className="space-y-4">
                <h3 className="font-semibold text-sm text-gray-700">
                  Wartości odżywcze (na 100{formData.unit === 'ml' || formData.unit === 'l' ? ' ml' : ' g'})
                </h3>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="calories">Kalorie (kcal)</Label>
                    <Input
                      id="calories"
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.calories}
                      onChange={(e) => setFormData({ ...formData, calories: e.target.value })}
                      placeholder="0"
                      disabled={isLoading}
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="salt">Sól (g)</Label>
                    <Input
                      id="salt"
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.salt}
                      onChange={(e) => setFormData({ ...formData, salt: e.target.value })}
                      placeholder="0"
                      disabled={isLoading}
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="protein">Białko (g)</Label>
                    <Input
                      id="protein"
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.protein}
                      onChange={(e) => setFormData({ ...formData, protein: e.target.value })}
                      placeholder="0"
                      disabled={isLoading}
                    />
                  </div>

                  <div className="grid gap-2 col-span-2">
                    <Label htmlFor="fat">Tłuszcz (g)</Label>
                    <Input
                      id="fat"
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.fat}
                      onChange={(e) => setFormData({ ...formData, fat: e.target.value })}
                      placeholder="0"
                      disabled={isLoading}
                    />
                  </div>

                  <div className="grid gap-2 col-span-2 pl-4">
                    <Label htmlFor="saturatedFat" className="text-sm text-muted-foreground">
                      w tym kwasy tłuszczowe nasycone (g)
                    </Label>
                    <Input
                      id="saturatedFat"
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.saturatedFat}
                      onChange={(e) => setFormData({ ...formData, saturatedFat: e.target.value })}
                      placeholder="0"
                      disabled={isLoading}
                    />
                  </div>

                  <div className="grid gap-2 col-span-2">
                    <Label htmlFor="carbohydrates">Węglowodany (g)</Label>
                    <Input
                      id="carbohydrates"
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.carbohydrates}
                      onChange={(e) => setFormData({ ...formData, carbohydrates: e.target.value })}
                      placeholder="0"
                      disabled={isLoading}
                    />
                  </div>

                  <div className="grid gap-2 col-span-2 pl-4">
                    <Label htmlFor="sugars" className="text-sm text-muted-foreground">
                      w tym cukry (g)
                    </Label>
                    <Input
                      id="sugars"
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.sugars}
                      onChange={(e) => setFormData({ ...formData, sugars: e.target.value })}
                      placeholder="0"
                      disabled={isLoading}
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="calcium">Wapń (mg)</Label>
                    <Input
                      id="calcium"
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.calcium}
                      onChange={(e) => setFormData({ ...formData, calcium: e.target.value })}
                      placeholder="0"
                      disabled={isLoading}
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="iron">Żelazo (mg)</Label>
                    <Input
                      id="iron"
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.iron}
                      onChange={(e) => setFormData({ ...formData, iron: e.target.value })}
                      placeholder="0"
                      disabled={isLoading}
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="vitaminC">Witamina C (mg)</Label>
                    <Input
                      id="vitaminC"
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.vitaminC}
                      onChange={(e) => setFormData({ ...formData, vitaminC: e.target.value })}
                      placeholder="0"
                      disabled={isLoading}
                    />
                  </div>
                </div>
              </div>

              {/* Allergens */}
              <div className="space-y-4">
                <h3 className="font-semibold text-sm text-gray-700">Alergeny</h3>
                <p className="text-xs text-gray-500 mb-3">
                  Wybierz alergeny, które występują w tym produkcie (pole opcjonalne)
                </p>
                
                <div className="grid grid-cols-1 gap-3 max-h-[200px] overflow-y-auto border rounded-md p-3">
                  {ALLERGENS.map((allergen) => (
                    <div key={allergen.id} className="flex items-start space-x-3">
                      <Checkbox
                        id={`allergen-${allergen.id}`}
                        checked={formData.allergens.includes(allergen.id)}
                        onCheckedChange={() => handleAllergenToggle(allergen.id)}
                        disabled={isLoading}
                      />
                      <div className="flex-1">
                        <Label
                          htmlFor={`allergen-${allergen.id}`}
                          className="text-sm font-medium leading-none cursor-pointer"
                        >
                          A:{allergen.id} - {allergen.name}
                        </Label>
                        <p className="text-xs text-gray-500 mt-1">
                          {allergen.description}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
                
                {formData.allergens.length > 0 && (
                  <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
                    <p className="text-sm font-medium text-blue-900">
                      Wybrane alergeny: {formData.allergens.sort((a, b) => a - b).map(id => `A:${id}`).join(', ')}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </form>
        </ScrollArea>

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
            form="add-product-form"
            className="flex-1 bg-blue-600 hover:bg-blue-700"
            disabled={isLoading}
          >
            {isLoading ? (
              <div className="flex items-center space-x-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                <span>Dodawanie...</span>
              </div>
            ) : (
              'Dodaj produkt'
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
