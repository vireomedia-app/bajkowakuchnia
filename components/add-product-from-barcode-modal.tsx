'use client'

import { useState, useEffect, useRef } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { Loader2, AlertTriangle, Check, X, Plus, PackageSearch, AlertCircle } from 'lucide-react'
import { toast } from 'sonner'
import { ALLERGENS } from '@/lib/allergens'
import { generateUnknownProductName } from '@/lib/barcode'

interface AddProductFromBarcodeModalProps {
  isOpen: boolean
  onClose: () => void
  barcode: string
  onProductAdded: (product: any) => void
  /** Pre-fetched data from external APIs (OFF/Leclerc) passed by parent to avoid double fetch */
  prefetchedData?: any
}

type Step = 'confirm' | 'loading' | 'form' | 'not_found_form'

const UNIT_OPTIONS = [
  { value: 'kg', label: 'kg (kilogramy)' },
  { value: 'g', label: 'g (gramy)' },
  { value: 'l', label: 'l (litry)' },
  { value: 'ml', label: 'ml (mililitry)' },
  { value: 'szt', label: 'szt (sztuki)' },
]

const PACKAGE_UNIT_OPTIONS = [
  { value: 'g', label: 'g' },
  { value: 'kg', label: 'kg' },
  { value: 'ml', label: 'ml' },
  { value: 'l', label: 'l' },
  { value: 'szt', label: 'szt' },
]

const PACKAGING_TYPE_OPTIONS = [
  {
    value: 'bulk',
    label: 'Luzem / na wagę',
    description: 'Np. marchew, mąka z worka, mleko z baniaka',
  },
  {
    value: 'packaged',
    label: 'W opakowaniach',
    description: 'Np. makaron 500g, mleko 1l, ser 200g',
  },
]

const NUTRITIONAL_FIELDS = [
  { key: 'calories', label: 'Kalorie (kcal)', required: true },
  { key: 'fat', label: 'Tłuszcz (g)', required: true },
  { key: 'saturatedFat', label: 'Tłuszcz nasycony (g)', required: false },
  { key: 'carbohydrates', label: 'Węglowodany (g)', required: true },
  { key: 'sugars', label: 'Cukry (g)', required: true },
  { key: 'fiber', label: 'Błonnik (g)', required: false },
  { key: 'protein', label: 'Białko (g)', required: true },
  { key: 'salt', label: 'Sól (g)', required: false },
  { key: 'calcium', label: 'Wapń (mg)', required: false },
  { key: 'iron', label: 'Żelazo (mg)', required: false },
  { key: 'vitaminC', label: 'Witamina C (mg)', required: false },
]

export function AddProductFromBarcodeModal({
  isOpen,
  onClose,
  barcode,
  onProductAdded,
  prefetchedData,
}: AddProductFromBarcodeModalProps) {
  const [step, setStep] = useState<Step>('confirm')
  const [openFoodFactsData, setOpenFoodFactsData] = useState<any>(null)
  const [missingFields, setMissingFields] = useState<string[]>([])
  const [isSaving, setIsSaving] = useState(false)

  // AbortController for API calls
  const abortControllerRef = useRef<AbortController | null>(null)

  // Form data
  const [name, setName] = useState('')
  const [manufacturer, setManufacturer] = useState('')
  const [packagingType, setPackagingType] = useState<'bulk' | 'packaged'>('bulk')
  const [unit, setUnit] = useState('g')
  const [packageWeight, setPackageWeight] = useState('')
  const [packageUnit, setPackageUnit] = useState('g')
  const [initialStock, setInitialStock] = useState('0')
  const [allergens, setAllergens] = useState<number[]>([])
  const [nutritionalValues, setNutritionalValues] = useState<Record<string, string>>(
    NUTRITIONAL_FIELDS.reduce((acc, f) => ({ ...acc, [f.key]: '' }), {}),
  )
  const [errors, setErrors] = useState<Record<string, string>>({})

  // Reset when modal opens – handle prefetchedData to skip double-fetch
  useEffect(() => {
    if (isOpen && barcode) {
      resetForm()
      setOpenFoodFactsData(null)
      setMissingFields([])
      setErrors({})

      if (prefetchedData && !prefetchedData._externalNotFound && prefetchedData.name) {
        // We have prefetched external API data – skip confirm + loading, go directly to form
        setOpenFoodFactsData(prefetchedData)
        prefillFromExternalData(prefetchedData)
        setStep('form')
      } else if (prefetchedData?._externalNotFound) {
        // External APIs already checked and found nothing – go to manual form
        setName(generateUnknownProductName())
        setStep('not_found_form')
      } else {
        // No prefetched data – show confirmation step (this path used by
        // legacy callers or when parent didn't pre-fetch)
        setStep('confirm')
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, barcode])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort()
    }
  }, [])

  const resetForm = () => {
    setName('')
    setManufacturer('')
    setPackagingType('bulk')
    setUnit('g')
    setPackageWeight('')
    setPackageUnit('g')
    setInitialStock('0')
    setAllergens([])
    setNutritionalValues(
      NUTRITIONAL_FIELDS.reduce((acc, f) => ({ ...acc, [f.key]: '' }), {}),
    )
    setErrors({})
  }

  const prefillFromExternalData = (data: any) => {
    setName(data.name || '')
    setManufacturer(data.manufacturer || '')
    setAllergens(data.allergens || [])

    const newValues: Record<string, string> = {}
    const missing: string[] = []

    NUTRITIONAL_FIELDS.forEach((field) => {
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

  // Fallback: fetch from API if no prefetched data was provided
  const checkExternalApis = async () => {
    setStep('loading')

    // Cancel any previous request
    abortControllerRef.current?.abort()
    const controller = new AbortController()
    abortControllerRef.current = controller

    try {
      const response = await fetch(
        `/api/products/barcode?code=${encodeURIComponent(barcode)}`,
        { signal: controller.signal },
      )
      const data = await response.json()

      // Guard: if aborted while awaiting, bail out
      if (controller.signal.aborted) return

      if (response.status === 409 && data.existingProduct) {
        toast.error(`Produkt "${data.existingProduct.name}" jest już w bazie!`)
        onClose()
        return
      }

      if (response.ok && data.name) {
        setOpenFoodFactsData(data)
        prefillFromExternalData(data)
        setStep('form')
      } else {
        setStep('not_found_form')
        setName(generateUnknownProductName())
      }
    } catch (error: any) {
      if (error?.name === 'AbortError') return // user cancelled – silent
      console.error('Error checking external APIs:', error)
      setStep('not_found_form')
      setName(generateUnknownProductName())
    }
  }

  const handleNutritionalChange = (key: string, value: string) => {
    setNutritionalValues((prev) => ({ ...prev, [key]: value }))
  }

  const toggleAllergen = (allergenId: number) => {
    setAllergens((prev) =>
      prev.includes(allergenId)
        ? prev.filter((a) => a !== allergenId)
        : [...prev, allergenId],
    )
  }

  const validateForm = () => {
    const newErrors: Record<string, string> = {}
    if (!name.trim()) {
      newErrors.name = 'Nazwa produktu jest wymagana'
    }
    if (packagingType === 'packaged') {
      const pw = parseFloat(packageWeight)
      if (!packageWeight || isNaN(pw) || pw <= 0) {
        newErrors.packageWeight = 'Waga/objętość opakowania jest wymagana'
      }
    }
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSave = async () => {
    if (!validateForm()) return

    setIsSaving(true)

    try {
      const isPackaged = packagingType === 'packaged'
      const productData = {
        name: name.trim(),
        manufacturer: manufacturer.trim() || null,
        unit: isPackaged ? packageUnit : unit,
        packagingType,
        packageWeight: isPackaged && packageWeight ? parseFloat(packageWeight) : null,
        packageUnit: isPackaged && packageWeight ? packageUnit : null,
        initialStock: parseFloat(initialStock) || 0,
        barcode,
        allergens,
        calories: nutritionalValues.calories ? parseFloat(nutritionalValues.calories) : null,
        protein: nutritionalValues.protein ? parseFloat(nutritionalValues.protein) : null,
        fat: nutritionalValues.fat ? parseFloat(nutritionalValues.fat) : null,
        saturatedFat: nutritionalValues.saturatedFat
          ? parseFloat(nutritionalValues.saturatedFat)
          : null,
        carbohydrates: nutritionalValues.carbohydrates
          ? parseFloat(nutritionalValues.carbohydrates)
          : null,
        sugars: nutritionalValues.sugars ? parseFloat(nutritionalValues.sugars) : null,
        fiber: nutritionalValues.fiber ? parseFloat(nutritionalValues.fiber) : null,
        salt: nutritionalValues.salt ? parseFloat(nutritionalValues.salt) : null,
        calcium: nutritionalValues.calcium ? parseFloat(nutritionalValues.calcium) : null,
        iron: nutritionalValues.iron ? parseFloat(nutritionalValues.iron) : null,
        vitaminC: nutritionalValues.vitaminC ? parseFloat(nutritionalValues.vitaminC) : null,
      }

      const response = await fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(productData),
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

  // Cancel: immediately close, abort any pending requests
  const handleCancel = () => {
    abortControllerRef.current?.abort()
    abortControllerRef.current = null
    onClose()
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleCancel}>
      <DialogContent className="sm:max-w-[550px] max-h-[90vh] flex flex-col">
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
          {/* STEP: Confirm (only when no prefetched data) */}
          {step === 'confirm' && (
            <div className="space-y-4 py-4">
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-orange-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium text-orange-900">Produkt nie został znaleziony</p>
                    <p className="text-sm text-orange-700 mt-1">
                      Produkt o tym kodzie kreskowym nie istnieje jeszcze w Twojej bazie
                      magazynowej.
                    </p>
                  </div>
                </div>
              </div>

              <p className="text-center text-gray-700">
                Czy chcesz teraz dodać ten produkt do magazynu?
              </p>

              <div className="flex gap-3">
                <Button variant="outline" className="flex-1" onClick={handleCancel}>
                  <X className="w-4 h-4 mr-2" />
                  Nie, wróć
                </Button>
                <Button
                  className="flex-1 bg-green-600 hover:bg-green-700"
                  onClick={checkExternalApis}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Tak, dodaj
                </Button>
              </div>
            </div>
          )}

          {/* STEP: Loading (fetching from external APIs) */}
          {step === 'loading' && (
            <div className="text-center py-12">
              <Loader2 className="w-12 h-12 mx-auto text-blue-600 animate-spin mb-4" />
              <p className="text-gray-700 font-medium">Szukam w bazie Open Food Facts...</p>
              <p className="text-sm text-gray-500 mt-1">
                Próbuję pobrać dane produktu automatycznie
              </p>
              <Button variant="ghost" size="sm" className="mt-4" onClick={handleCancel}>
                Anuluj
              </Button>
            </div>
          )}

          {/* STEP: Form – product found in external API */}
          {(step === 'form' || step === 'not_found_form') && (
            <div className="space-y-4 py-2">
              {/* Status banner */}
              {step === 'form' && missingFields.length > 0 && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-yellow-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-yellow-800">
                        Niepełne dane z Open Food Facts
                      </p>
                      <p className="text-xs text-yellow-700 mt-1">
                        Brakuje: {missingFields.join(', ')}. Uzupełnij ręcznie.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {step === 'form' && openFoodFactsData && missingFields.length === 0 && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                  <div className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-green-600" />
                    <span className="text-sm text-green-800">
                      Dane pobrane z Open Food Facts
                    </span>
                  </div>
                </div>
              )}

              {step === 'not_found_form' && (
                <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-orange-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-orange-800">
                        Nie znaleziono w zewnętrznych bazach
                      </p>
                      <p className="text-xs text-orange-700 mt-1">
                        Wprowadź wszystkie dane produktu ręcznie.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* ---- Product Form ---- */}
              <div className="space-y-4">
                {/* Name */}
                <div>
                  <Label htmlFor="barcode-name" className="text-sm">
                    Nazwa produktu *
                  </Label>
                  <Input
                    id="barcode-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder=""
                    className={`mt-1 ${errors.name ? 'border-red-300' : ''}`}
                    disabled={isSaving}
                  />
                  {errors.name && (
                    <p className="text-sm text-red-600 flex items-center gap-1 mt-1">
                      <AlertCircle className="w-3 h-3" />
                      <span>{errors.name}</span>
                    </p>
                  )}
                </div>

                {/* Manufacturer */}
                <div>
                  <Label htmlFor="barcode-manufacturer" className="text-sm">
                    Producent
                  </Label>
                  <Input
                    id="barcode-manufacturer"
                    value={manufacturer}
                    onChange={(e) => setManufacturer(e.target.value)}
                    placeholder=""
                    className="mt-1"
                    disabled={isSaving}
                  />
                </div>

                {/* Packaging Type */}
                <div className="space-y-2">
                  <Label className="text-sm">Typ produktu *</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {PACKAGING_TYPE_OPTIONS.map((option) => (
                      <div
                        key={option.value}
                        onClick={() =>
                          !isSaving &&
                          setPackagingType(option.value as 'bulk' | 'packaged')
                        }
                        className={`relative flex flex-col p-2.5 rounded-lg border-2 cursor-pointer transition-all ${
                          packagingType === option.value
                            ? 'border-blue-500 bg-blue-50'
                            : 'border-gray-200 hover:border-gray-300 bg-white'
                        } ${isSaving ? 'opacity-50 cursor-not-allowed' : ''}`}
                      >
                        <div className="flex items-center gap-2">
                          <div
                            className={`w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                              packagingType === option.value
                                ? 'border-blue-500'
                                : 'border-gray-300'
                            }`}
                          >
                            {packagingType === option.value && (
                              <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                            )}
                          </div>
                          <span className="font-medium text-xs">{option.label}</span>
                        </div>
                        <p className="text-[10px] text-gray-500 mt-1 ml-5">
                          {option.description}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Unit (bulk) */}
                {packagingType === 'bulk' && (
                  <div>
                    <Label className="text-sm">Jednostka miary *</Label>
                    <Select value={unit} onValueChange={setUnit} disabled={isSaving}>
                      <SelectTrigger className="mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {UNIT_OPTIONS.map((u) => (
                          <SelectItem key={u.value} value={u.value}>
                            {u.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* Package Weight (packaged) */}
                {packagingType === 'packaged' && (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg space-y-2">
                    <Label className="text-sm">Waga/Objętość jednego opakowania *</Label>
                    <div className="flex gap-2">
                      <Input
                        type="number"
                        step="0.00001"
                        min="0"
                        value={packageWeight}
                        onChange={(e) => setPackageWeight(e.target.value)}
                        placeholder=""
                        className={`flex-1 bg-white ${errors.packageWeight ? 'border-red-300' : ''}`}
                        disabled={isSaving}
                      />
                      <Select
                        value={packageUnit}
                        onValueChange={(v) => {
                          setPackageUnit(v)
                          setUnit(v)
                        }}
                        disabled={isSaving}
                      >
                        <SelectTrigger className="w-20 bg-white">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {PACKAGE_UNIT_OPTIONS.map((u) => (
                            <SelectItem key={u.value} value={u.value}>
                              {u.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    {errors.packageWeight && (
                      <p className="text-sm text-red-600 flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" />
                        <span>{errors.packageWeight}</span>
                      </p>
                    )}
                    <p className="text-[10px] text-gray-600">
                      Np. makaron 500g → wpisz &quot;500&quot; i wybierz &quot;g&quot;.
                    </p>
                  </div>
                )}

                {/* Initial stock */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="barcode-stock" className="text-sm">
                      Stan początkowy
                    </Label>
                    <Input
                      id="barcode-stock"
                      type="number"
                      value={initialStock}
                      onChange={(e) => setInitialStock(e.target.value)}
                      min="0"
                      step="0.01"
                      className="mt-1"
                      disabled={isSaving}
                    />
                  </div>
                </div>

                {/* Nutritional values */}
                <div>
                  <Label className="text-sm font-medium">
                    Wartości odżywcze (na{' '}
                    {(() => {
                      const eu = packagingType === 'packaged' ? packageUnit : unit
                      if (eu === 'szt') return 'sztukę'
                      if (eu === 'ml' || eu === 'l') return '100 ml'
                      return '100 g'
                    })()}
                    )
                  </Label>
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    {NUTRITIONAL_FIELDS.map((field) => {
                      const isMissing = missingFields.includes(field.label)
                      return (
                        <div key={field.key}>
                          <Label
                            htmlFor={`barcode-${field.key}`}
                            className={`text-xs ${isMissing ? 'text-yellow-600 font-medium' : 'text-gray-600'}`}
                          >
                            {field.label.split(' (')[0]} {field.required && '*'}
                            {isMissing && ' ⚠️'}
                          </Label>
                          <Input
                            id={`barcode-${field.key}`}
                            type="number"
                            value={nutritionalValues[field.key]}
                            onChange={(e) =>
                              handleNutritionalChange(field.key, e.target.value)
                            }
                            placeholder=""
                            step="0.01"
                            className={`mt-0.5 h-8 text-sm ${isMissing ? 'border-yellow-300 bg-yellow-50' : ''}`}
                            disabled={isSaving}
                          />
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* Allergens */}
                <div>
                  <Label className="text-sm font-medium">Alergeny</Label>
                  <div className="grid grid-cols-2 gap-1 mt-2">
                    {ALLERGENS.map((allergen) => (
                      <label
                        key={allergen.id}
                        className="flex items-center gap-2 p-1.5 rounded hover:bg-gray-50 cursor-pointer text-xs"
                      >
                        <Checkbox
                          checked={allergens.includes(allergen.id)}
                          onCheckedChange={() => toggleAllergen(allergen.id)}
                          disabled={isSaving}
                        />
                        <span className="text-gray-700">
                          {allergen.id}. {allergen.name}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={handleCancel}
                  disabled={isSaving}
                >
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
