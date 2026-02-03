'use client'

import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { Loader2, AlertTriangle, Check, X, Plus, PackageSearch } from 'lucide-react'
import { toast } from 'sonner'
import { ALLERGENS } from '@/lib/allergens'

interface AddProductFromBarcodeModalProps {
  isOpen: boolean
  onClose: () => void
  barcode: string
  onProductAdded: (product: any) => void
}

type Step = 'confirm' | 'loading' | 'form' | 'not_found_form'

const COMMON_UNITS = [
  { value: 'g', label: 'gramy (g)' },
  { value: 'kg', label: 'kilogramy (kg)' },
  { value: 'ml', label: 'mililitry (ml)' },
  { value: 'l', label: 'litry (l)' },
  { value: 'szt', label: 'sztuki (szt)' },
  { value: 'opak', label: 'opakowania (opak)' },
  { value: 'puszka', label: 'puszki' },
  { value: 'słoik', label: 'słoiki' },
  { value: 'butelka', label: 'butelki' }
]

const NUTRITIONAL_FIELDS = [
  { key: 'calories', label: 'Kalorie (kcal/100g)', required: true },
  { key: 'protein', label: 'Białko (g/100g)', required: true },
  { key: 'fat', label: 'Tłuszcz (g/100g)', required: true },
  { key: 'saturatedFat', label: 'Tłuszcz nasycony (g/100g)', required: false },
  { key: 'carbohydrates', label: 'Węglowodany (g/100g)', required: true },
  { key: 'sugars', label: 'Cukry (g/100g)', required: true },
  { key: 'salt', label: 'Sól (g/100g)', required: false },
  { key: 'calcium', label: 'Wapń (mg/100g)', required: false },
  { key: 'iron', label: 'Żelazo (mg/100g)', required: false },
  { key: 'vitaminC', label: 'Witamina C (mg/100g)', required: false }
]

export function AddProductFromBarcodeModal({
  isOpen,
  onClose,
  barcode,
  onProductAdded
}: AddProductFromBarcodeModalProps) {
  const [step, setStep] = useState<Step>('confirm')
  const [openFoodFactsData, setOpenFoodFactsData] = useState<any>(null)
  const [missingFields, setMissingFields] = useState<string[]>([])
  const [isSaving, setIsSaving] = useState(false)

  // Form data
  const [name, setName] = useState('')
  const [manufacturer, setManufacturer] = useState('')
  const [unit, setUnit] = useState('g')
  const [initialStock, setInitialStock] = useState('0')
  const [allergens, setAllergens] = useState<number[]>([])
  const [nutritionalValues, setNutritionalValues] = useState<Record<string, string>>(
    NUTRITIONAL_FIELDS.reduce((acc, f) => ({ ...acc, [f.key]: '' }), {})
  )

  // Reset when modal opens
  useEffect(() => {
    if (isOpen) {
      setStep('confirm')
      setOpenFoodFactsData(null)
      setMissingFields([])
      resetForm()
    }
  }, [isOpen, barcode])

  const resetForm = () => {
    setName('')
    setManufacturer('')
    setUnit('g')
    setInitialStock('0')
    setAllergens([])
    setNutritionalValues(
      NUTRITIONAL_FIELDS.reduce((acc, f) => ({ ...acc, [f.key]: '' }), {})
    )
  }

  const checkOpenFoodFacts = async () => {
    setStep('loading')
    
    try {
      const response = await fetch(`/api/products/barcode?code=${encodeURIComponent(barcode)}`)
      const data = await response.json()

      if (response.status === 409 && data.existingProduct) {
        // Product already exists - this shouldn't happen but handle it
        toast.error(`Produkt "${data.existingProduct.name}" jest już w bazie!`)
        onClose()
        return
      }

      if (response.ok && data.name) {
        // Found in Open Food Facts - pre-fill form
        setOpenFoodFactsData(data)
        prefillFromOpenFoodFacts(data)
        setStep('form')
      } else {
        // Not found in Open Food Facts
        setStep('not_found_form')
        setName('')
      }
    } catch (error) {
      console.error('Error checking Open Food Facts:', error)
      setStep('not_found_form')
    }
  }

  const prefillFromOpenFoodFacts = (data: any) => {
    setName(data.name || '')
    setManufacturer(data.manufacturer || '')
    setAllergens(data.allergens || [])

    // Fill nutritional values and track missing required fields
    const newValues: Record<string, string> = {}
    const missing: string[] = []

    NUTRITIONAL_FIELDS.forEach(field => {
      const value = data[field.key]
      if (value !== null && value !== undefined) {
        newValues[field.key] = String(value)
      } else {
        newValues[field.key] = ''
        if (field.required) {
          missing.push(field.label)
        }
      }
    })

    setNutritionalValues(newValues)
    setMissingFields(missing)
  }

  const handleNutritionalChange = (key: string, value: string) => {
    setNutritionalValues(prev => ({ ...prev, [key]: value }))
  }

  const toggleAllergen = (allergenId: number) => {
    setAllergens(prev =>
      prev.includes(allergenId)
        ? prev.filter(a => a !== allergenId)
        : [...prev, allergenId]
    )
  }

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error('Nazwa produktu jest wymagana')
      return
    }

    setIsSaving(true)

    try {
      const productData = {
        name: name.trim(),
        manufacturer: manufacturer.trim() || null,
        unit,
        initialStock: parseFloat(initialStock) || 0,
        barcode,
        allergens,
        calories: nutritionalValues.calories ? parseFloat(nutritionalValues.calories) : null,
        protein: nutritionalValues.protein ? parseFloat(nutritionalValues.protein) : null,
        fat: nutritionalValues.fat ? parseFloat(nutritionalValues.fat) : null,
        saturatedFat: nutritionalValues.saturatedFat ? parseFloat(nutritionalValues.saturatedFat) : null,
        carbohydrates: nutritionalValues.carbohydrates ? parseFloat(nutritionalValues.carbohydrates) : null,
        sugars: nutritionalValues.sugars ? parseFloat(nutritionalValues.sugars) : null,
        salt: nutritionalValues.salt ? parseFloat(nutritionalValues.salt) : null,
        calcium: nutritionalValues.calcium ? parseFloat(nutritionalValues.calcium) : null,
        iron: nutritionalValues.iron ? parseFloat(nutritionalValues.iron) : null,
        vitaminC: nutritionalValues.vitaminC ? parseFloat(nutritionalValues.vitaminC) : null,
      }

      const response = await fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(productData)
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Nie udało się dodać produktu')
      }

      const savedProduct = await response.json()
      toast.success(`Dodano produkt: ${savedProduct.name}`)
      onProductAdded(savedProduct)
      onClose()
    } catch (error: any) {
      console.error('Error saving product:', error)
      toast.error(error.message || 'Błąd podczas zapisywania produktu')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PackageSearch className="w-5 h-5 text-orange-600" />
            <span>Produkt nie jest w magazynie</span>
          </DialogTitle>
          <DialogDescription className="font-mono text-sm">
            Kod: {barcode}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto">
          {/* KROK 1: Potwierdzenie dodania */}
          {step === 'confirm' && (
            <div className="space-y-4 py-4">
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-orange-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium text-orange-900">Produkt nie został znaleziony</p>
                    <p className="text-sm text-orange-700 mt-1">
                      Produkt o tym kodzie kreskowym nie istnieje jeszcze w Twojej bazie magazynowej.
                    </p>
                  </div>
                </div>
              </div>

              <p className="text-center text-gray-700">
                Czy chcesz teraz dodać ten produkt do magazynu?
              </p>

              <div className="flex gap-3">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={onClose}
                >
                  <X className="w-4 h-4 mr-2" />
                  Nie, wróć
                </Button>
                <Button
                  className="flex-1 bg-green-600 hover:bg-green-700"
                  onClick={checkOpenFoodFacts}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Tak, dodaj
                </Button>
              </div>
            </div>
          )}

          {/* KROK 2: Ładowanie z Open Food Facts */}
          {step === 'loading' && (
            <div className="text-center py-12">
              <Loader2 className="w-12 h-12 mx-auto text-blue-600 animate-spin mb-4" />
              <p className="text-gray-700 font-medium">Szukam w bazie Open Food Facts...</p>
              <p className="text-sm text-gray-500 mt-1">Próbuję pobrać dane produktu automatycznie</p>
            </div>
          )}

          {/* KROK 3: Formularz - produkt znaleziony w OFF */}
          {step === 'form' && (
            <div className="space-y-4 py-2">
              {/* Alert o brakujących danych */}
              {missingFields.length > 0 && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-yellow-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-yellow-800">Niepełne dane z Open Food Facts</p>
                      <p className="text-xs text-yellow-700 mt-1">
                        Brakuje: {missingFields.join(', ')}. Uzupełnij ręcznie.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {openFoodFactsData && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                  <div className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-green-600" />
                    <span className="text-sm text-green-800">Dane pobrane z Open Food Facts</span>
                  </div>
                </div>
              )}

              <ProductForm
                name={name}
                setName={setName}
                manufacturer={manufacturer}
                setManufacturer={setManufacturer}
                unit={unit}
                setUnit={setUnit}
                initialStock={initialStock}
                setInitialStock={setInitialStock}
                allergens={allergens}
                toggleAllergen={toggleAllergen}
                nutritionalValues={nutritionalValues}
                handleNutritionalChange={handleNutritionalChange}
                missingFields={missingFields}
              />

              <div className="flex gap-3 pt-2">
                <Button variant="outline" className="flex-1" onClick={onClose} disabled={isSaving}>
                  Anuluj
                </Button>
                <Button
                  className="flex-1 bg-green-600 hover:bg-green-700"
                  onClick={handleSave}
                  disabled={isSaving || !name.trim()}
                >
                  {isSaving ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Check className="w-4 h-4 mr-2" />
                  )}
                  Zapisz produkt
                </Button>
              </div>
            </div>
          )}

          {/* KROK 4: Formularz - produkt NIE znaleziony w OFF */}
          {step === 'not_found_form' && (
            <div className="space-y-4 py-2">
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-orange-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-orange-800">Nie znaleziono w Open Food Facts</p>
                    <p className="text-xs text-orange-700 mt-1">
                      Wprowadź wszystkie dane produktu ręcznie.
                    </p>
                  </div>
                </div>
              </div>

              <ProductForm
                name={name}
                setName={setName}
                manufacturer={manufacturer}
                setManufacturer={setManufacturer}
                unit={unit}
                setUnit={setUnit}
                initialStock={initialStock}
                setInitialStock={setInitialStock}
                allergens={allergens}
                toggleAllergen={toggleAllergen}
                nutritionalValues={nutritionalValues}
                handleNutritionalChange={handleNutritionalChange}
                missingFields={[]} // All fields are "missing" in manual mode
              />

              <div className="flex gap-3 pt-2">
                <Button variant="outline" className="flex-1" onClick={onClose} disabled={isSaving}>
                  Anuluj
                </Button>
                <Button
                  className="flex-1 bg-green-600 hover:bg-green-700"
                  onClick={handleSave}
                  disabled={isSaving || !name.trim()}
                >
                  {isSaving ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Check className="w-4 h-4 mr-2" />
                  )}
                  Zapisz produkt
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

// Subcomponent for product form
function ProductForm({
  name, setName,
  manufacturer, setManufacturer,
  unit, setUnit,
  initialStock, setInitialStock,
  allergens, toggleAllergen,
  nutritionalValues, handleNutritionalChange,
  missingFields
}: {
  name: string
  setName: (v: string) => void
  manufacturer: string
  setManufacturer: (v: string) => void
  unit: string
  setUnit: (v: string) => void
  initialStock: string
  setInitialStock: (v: string) => void
  allergens: number[]
  toggleAllergen: (id: number) => void
  nutritionalValues: Record<string, string>
  handleNutritionalChange: (key: string, value: string) => void
  missingFields: string[]
}) {
  return (
    <div className="space-y-4">
      {/* Nazwa i producent */}
      <div className="grid grid-cols-1 gap-3">
        <div>
          <Label htmlFor="name" className="text-sm">Nazwa produktu *</Label>
          <Input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="np. Mleko 3.2%"
            className="mt-1"
          />
        </div>
        <div>
          <Label htmlFor="manufacturer" className="text-sm">Producent</Label>
          <Input
            id="manufacturer"
            value={manufacturer}
            onChange={(e) => setManufacturer(e.target.value)}
            placeholder="np. Mlekovita"
            className="mt-1"
          />
        </div>
      </div>

      {/* Jednostka i stan początkowy */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-sm">Jednostka</Label>
          <Select value={unit} onValueChange={setUnit}>
            <SelectTrigger className="mt-1">
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
        <div>
          <Label htmlFor="stock" className="text-sm">Stan początkowy</Label>
          <Input
            id="stock"
            type="number"
            value={initialStock}
            onChange={(e) => setInitialStock(e.target.value)}
            min="0"
            step="0.01"
            className="mt-1"
          />
        </div>
      </div>

      {/* Wartości odżywcze - kompaktowy układ */}
      <div>
        <Label className="text-sm font-medium">Wartości odżywcze (na 100g)</Label>
        <div className="grid grid-cols-2 gap-2 mt-2">
          {NUTRITIONAL_FIELDS.map(field => {
            const isMissing = missingFields.includes(field.label)
            return (
              <div key={field.key}>
                <Label 
                  htmlFor={field.key} 
                  className={`text-xs ${isMissing ? 'text-yellow-600 font-medium' : 'text-gray-600'}`}
                >
                  {field.label.split(' (')[0]} {field.required && '*'}
                  {isMissing && ' ⚠️'}
                </Label>
                <Input
                  id={field.key}
                  type="number"
                  value={nutritionalValues[field.key]}
                  onChange={(e) => handleNutritionalChange(field.key, e.target.value)}
                  placeholder="0"
                  step="0.01"
                  className={`mt-0.5 h-8 text-sm ${isMissing ? 'border-yellow-300 bg-yellow-50' : ''}`}
                />
              </div>
            )
          })}
        </div>
      </div>

      {/* Alergeny - kompaktowy */}
      <div>
        <Label className="text-sm font-medium">Alergeny</Label>
        <div className="grid grid-cols-2 gap-1 mt-2">
          {ALLERGENS.map(allergen => (
            <label
              key={allergen.id}
              className="flex items-center gap-2 p-1.5 rounded hover:bg-gray-50 cursor-pointer text-xs"
            >
              <Checkbox
                checked={allergens.includes(allergen.id)}
                onCheckedChange={() => toggleAllergen(allergen.id)}
              />
              <span className="text-gray-700">
                {allergen.id}. {allergen.name}
              </span>
            </label>
          ))}
        </div>
      </div>
    </div>
  )
}
