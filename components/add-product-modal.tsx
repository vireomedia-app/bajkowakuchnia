
'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Checkbox } from '@/components/ui/checkbox'
import { UNITS } from '@/lib/types'
import { ALLERGENS } from '@/lib/allergens'
import { Package, AlertCircle, Camera } from 'lucide-react'
import { toast } from 'sonner'
import { BarcodeScanner } from './barcode-scanner'

interface AddProductModalProps {
  isOpen: boolean
  onClose: () => void
  initialName?: string
  initialData?: any
  onScanNext?: () => void
}

// Main unit options - weight, volume, or pieces
const UNIT_OPTIONS = [
  { value: 'kg', label: 'kg (kilogramy)' },
  { value: 'g', label: 'g (gramy)' },
  { value: 'l', label: 'l (litry)' },
  { value: 'ml', label: 'ml (mililitry)' },
  { value: 'szt', label: 'szt (sztuki)' },
]

// Package weight/volume unit options (same as main units)
const PACKAGE_UNIT_OPTIONS = [
  { value: 'g', label: 'g' },
  { value: 'kg', label: 'kg' },
  { value: 'ml', label: 'ml' },
  { value: 'l', label: 'l' },
  { value: 'szt', label: 'szt' },
]

// Packaging type options - simplified to 2 options
const PACKAGING_TYPE_OPTIONS = [
  { value: 'bulk', label: 'Luzem / na wagę', description: 'Np. marchew, mąka z worka, mleko z baniaka, bułki liczone pojedynczo' },
  { value: 'packaged', label: 'W opakowaniach', description: 'Np. makaron 500g, mleko 1l, ser 200g, jajka w kartonie 10 szt' },
]

export function AddProductModal({ isOpen, onClose, initialName = '', initialData, onScanNext }: AddProductModalProps) {
  const [formData, setFormData] = useState({
    name: initialName,
    unit: 'kg',
    packagingType: 'bulk' as 'bulk' | 'packaged',
    barcode: '',
    packageWeight: '',
    packageUnit: 'g',
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
  const [isScannerOpen, setIsScannerOpen] = useState(false)
  const [fromScanner, setFromScanner] = useState(false)
  const [showScanNextDialog, setShowScanNextDialog] = useState(false)
  const router = useRouter()

  // Update initial name when prop changes
  useEffect(() => {
    if (initialName) {
      setFormData(prev => ({ ...prev, name: initialName }))
    }
  }, [initialName])

  // Update all data when initialData prop changes
  useEffect(() => {
    if (initialData) {
      setFormData(prev => ({
        ...prev,
        name: initialData.name || prev.name,
        barcode: initialData.barcode || prev.barcode,
        packageWeight: prev.packageWeight,
        manufacturer: initialData.manufacturer || prev.manufacturer,
        calories: initialData.calories?.toString() || prev.calories,
        salt: initialData.salt?.toString() || prev.salt,
        protein: initialData.protein?.toString() || prev.protein,
        fat: initialData.fat?.toString() || prev.fat,
        saturatedFat: initialData.saturatedFat?.toString() || prev.saturatedFat,
        carbohydrates: initialData.carbohydrates?.toString() || prev.carbohydrates,
        sugars: initialData.sugars?.toString() || prev.sugars,
        calcium: initialData.calcium?.toString() || prev.calcium,
        iron: initialData.iron?.toString() || prev.iron,
        vitaminC: initialData.vitaminC?.toString() || prev.vitaminC,
        allergens: initialData.allergens?.length > 0 ? initialData.allergens : prev.allergens,
      }))
      
      // Oznacz że dane pochodzą ze skanera
      if (initialData.barcode) {
        setFromScanner(true)
      }
      
      if (initialData.name) {
        toast.success('Dane produktu zostały załadowane ze skanera. Sprawdź i dostosuj przed zapisaniem.')
      }
    }
  }, [initialData])

  const validateForm = () => {
    const newErrors: Record<string, string> = {}
    
    if (!formData.name?.trim()) {
      newErrors.name = 'Nazwa produktu jest wymagana'
    }
    
    // Unit is required for bulk products (for packaged, unit comes from packageUnit)
    if (formData.packagingType === 'bulk' && !formData.unit) {
      newErrors.unit = 'Jednostka miary jest wymagana'
    }
    
    // Package weight is required when packagingType is 'packaged'
    if (formData.packagingType === 'packaged') {
      const pkgWeight = parseFloat(formData.packageWeight)
      if (!formData.packageWeight || isNaN(pkgWeight) || pkgWeight <= 0) {
        newErrors.packageWeight = 'Waga/objętość opakowania jest wymagana dla produktów w opakowaniach'
      }
      if (!formData.packageUnit) {
        newErrors.packageUnit = 'Jednostka opakowania jest wymagana'
      }
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

  const handleScanSuccess = (productData: any) => {
    setFormData(prev => ({
      ...prev,
      name: productData.name || prev.name,
      barcode: productData.barcode || prev.barcode,
      packageWeight: prev.packageWeight,
      manufacturer: productData.manufacturer || prev.manufacturer,
      calories: productData.calories?.toString() || prev.calories,
      salt: productData.salt?.toString() || prev.salt,
      protein: productData.protein?.toString() || prev.protein,
      fat: productData.fat?.toString() || prev.fat,
      saturatedFat: productData.saturatedFat?.toString() || prev.saturatedFat,
      carbohydrates: productData.carbohydrates?.toString() || prev.carbohydrates,
      sugars: productData.sugars?.toString() || prev.sugars,
      calcium: productData.calcium?.toString() || prev.calcium,
      iron: productData.iron?.toString() || prev.iron,
      vitaminC: productData.vitaminC?.toString() || prev.vitaminC,
      allergens: productData.allergens?.length > 0 ? productData.allergens : prev.allergens,
    }))
    
    // Oznacz że dane pochodzą ze skanera
    if (productData.barcode) {
      setFromScanner(true)
    }
    
    // Show appropriate toast based on data source
    const source = productData.source as string | undefined
    if (source === 'off+leclerc') {
      toast.success('Dane uzupełnione z Open Food Facts i Leclerc. Sprawdź przed zapisaniem.')
    } else if (source === 'leclerc') {
      toast.success('Dane pobrane z Leclerc.pl. Sprawdź przed zapisaniem.')
    } else {
      toast.success('Dane produktu zostały uzupełnione. Sprawdź i dostosuj je przed zapisaniem.')
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!validateForm()) {
      return
    }
    
    setIsLoading(true)
    
    try {
      const isPackaged = formData.packagingType === 'packaged'
      const submitData = {
        name: formData.name.trim(),
        // For packaged products, unit is derived from packageUnit
        unit: isPackaged ? formData.packageUnit : formData.unit,
        packagingType: formData.packagingType,
        barcode: formData.barcode.trim() || null,
        packageWeight: isPackaged && formData.packageWeight ? parseFloat(formData.packageWeight) : null,
        packageUnit: isPackaged && formData.packageWeight ? formData.packageUnit : null,
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
        
        // Obsłuż duplikat (produkt z tym kodem już istnieje)
        if (response.status === 409 && error.existingProduct) {
          toast.error(
            `${error.error}\n\nProdukt: ${error.existingProduct.name} (${error.existingProduct.unit})\nStan: ${error.existingProduct.currentStock}`,
            { duration: 5000 }
          )
          return
        }
        
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
        unit: 'kg',
        packagingType: 'bulk' as 'bulk' | 'packaged',
        barcode: '',
        packageWeight: '',
        packageUnit: 'g',
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
      setErrors({})
      
      // Jeśli produkt był skanowany, zapytaj czy chce skanować kolejny
      if (fromScanner) {
        setShowScanNextDialog(true)
        setFromScanner(false)
      } else {
        onClose()
      }
      
      router.refresh()
      
    } catch (error) {
      console.error('Error adding product:', error)
      toast.error(error instanceof Error ? error.message : 'Błąd podczas dodawania produktu')
    } finally {
      setIsLoading(false)
    }
  }
  
  const handleScanNextYes = () => {
    setShowScanNextDialog(false)
    onClose()
    if (onScanNext) {
      onScanNext()
    }
  }
  
  const handleScanNextNo = () => {
    setShowScanNextDialog(false)
    onClose()
  }

  const handleClose = () => {
    if (!isLoading) {
      setFormData({
        name: '',
        unit: 'kg',
        packagingType: 'bulk' as 'bulk' | 'packaged',
        barcode: '',
        packageWeight: '',
        packageUnit: 'g',
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
      setErrors({})
      setFromScanner(false)
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
          <DialogDescription className="flex items-center justify-between">
            <span>Wypełnij podstawowe informacje i wartości odżywcze produktu lub zeskanuj kod kreskowy.</span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsScannerOpen(true)}
              className="flex items-center space-x-2 border-blue-300 text-blue-700 hover:bg-blue-50 ml-3 flex-shrink-0"
            >
              <Camera className="w-5 h-5" />
              <span className="hidden sm:inline">Skanuj</span>
            </Button>
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
                    placeholder=""
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

                {/* Packaging Type Selection */}
                <div className="grid gap-2">
                  <Label>Typ produktu *</Label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {PACKAGING_TYPE_OPTIONS.map((option) => (
                      <div
                        key={option.value}
                        onClick={() => !isLoading && setFormData({ ...formData, packagingType: option.value as 'bulk' | 'packaged' })}
                        className={`
                          relative flex flex-col p-3 rounded-lg border-2 cursor-pointer transition-all
                          ${formData.packagingType === option.value 
                            ? 'border-blue-500 bg-blue-50' 
                            : 'border-gray-200 hover:border-gray-300 bg-white'}
                          ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}
                        `}
                      >
                        <div className="flex items-center gap-2">
                          <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0
                            ${formData.packagingType === option.value ? 'border-blue-500' : 'border-gray-300'}
                          `}>
                            {formData.packagingType === option.value && (
                              <div className="w-2 h-2 rounded-full bg-blue-500" />
                            )}
                          </div>
                          <span className="font-medium text-sm">{option.label}</span>
                        </div>
                        <p className="text-xs text-gray-500 mt-1 ml-6">{option.description}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Unit selection - only for bulk products */}
                {formData.packagingType === 'bulk' && (
                  <div className="grid gap-2">
                    <Label htmlFor="unit">Jednostka miary *</Label>
                    <Select
                      value={formData.unit}
                      onValueChange={(value) => setFormData({ ...formData, unit: value })}
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
                )}

                {/* Package Weight - only shown for packaged products */}
                {formData.packagingType === 'packaged' && (
                  <div className="grid gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                    <Label htmlFor="packageWeight">Waga/Objętość jednego opakowania *</Label>
                    <div className="flex gap-2">
                      <Input
                        id="packageWeight"
                        type="number"
                        step="0.00001"
                        min="0"
                        value={formData.packageWeight}
                        onChange={(e) => setFormData({ ...formData, packageWeight: e.target.value })}
                        placeholder="np. 500"
                        disabled={isLoading}
                        className={`flex-1 bg-white ${errors.packageWeight ? 'border-red-300' : ''}`}
                        required
                      />
                      <Select
                        value={formData.packageUnit}
                        onValueChange={(value) => setFormData({ ...formData, packageUnit: value, unit: value })}
                        disabled={isLoading}
                      >
                        <SelectTrigger className="w-20 bg-white">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {PACKAGE_UNIT_OPTIONS.map((unit) => (
                            <SelectItem key={unit.value} value={unit.value}>
                              {unit.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    {errors.packageWeight && (
                      <p className="text-sm text-red-600 flex items-center space-x-1">
                        <AlertCircle className="w-4 h-4" />
                        <span>{errors.packageWeight}</span>
                      </p>
                    )}
                    <p className="text-xs text-gray-600">
                      Np. jeśli kupujesz makaron w opakowaniach 500g, wpisz "500" i wybierz "g".
                      <br />
                      Przy przyjęciu 10 opakowań system automatycznie przeliczy ilość.
                    </p>
                  </div>
                )}

                <div className="grid gap-2">
                  <Label htmlFor="manufacturer">Nazwa producenta</Label>
                  <Input
                    id="manufacturer"
                    value={formData.manufacturer}
                    onChange={(e) => setFormData({ ...formData, manufacturer: e.target.value })}
                    placeholder=""
                    disabled={isLoading}
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="barcode">Kod kreskowy (opcjonalnie)</Label>
                  <Input
                    id="barcode"
                    value={formData.barcode}
                    onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
                    placeholder=""
                    disabled={isLoading}
                  />
                  <p className="text-xs text-gray-500">
                    💡 Kod kreskowy jest automatycznie uzupełniany podczas skanowania
                  </p>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="initialStock">Stan początkowy *</Label>
                  <Input
                    id="initialStock"
                    type="number"
                    step="0.00001"
                    min="0"
                    placeholder=""
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
                  Wartości odżywcze (na {(() => {
                    const effectiveUnit = formData.packagingType === 'packaged' ? formData.packageUnit : formData.unit;
                    if (effectiveUnit === 'szt') return 'sztukę';
                    if (effectiveUnit === 'ml' || effectiveUnit === 'l') return '100 ml';
                    return '100 g';
                  })()})
                </h3>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="calories">Kalorie (kcal)</Label>
                    <Input
                      id="calories"
                      type="number"
                      step="0.00001"
                      min="0"
                      value={formData.calories}
                      onChange={(e) => setFormData({ ...formData, calories: e.target.value })}
                      placeholder=""
                      disabled={isLoading}
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="salt">Sól (g)</Label>
                    <Input
                      id="salt"
                      type="number"
                      step="0.00001"
                      min="0"
                      value={formData.salt}
                      onChange={(e) => setFormData({ ...formData, salt: e.target.value })}
                      placeholder=""
                      disabled={isLoading}
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="protein">Białko (g)</Label>
                    <Input
                      id="protein"
                      type="number"
                      step="0.00001"
                      min="0"
                      value={formData.protein}
                      onChange={(e) => setFormData({ ...formData, protein: e.target.value })}
                      placeholder=""
                      disabled={isLoading}
                    />
                  </div>

                  <div className="grid gap-2 col-span-2">
                    <Label htmlFor="fat">Tłuszcz (g)</Label>
                    <Input
                      id="fat"
                      type="number"
                      step="0.00001"
                      min="0"
                      value={formData.fat}
                      onChange={(e) => setFormData({ ...formData, fat: e.target.value })}
                      placeholder=""
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
                      step="0.00001"
                      min="0"
                      value={formData.saturatedFat}
                      onChange={(e) => setFormData({ ...formData, saturatedFat: e.target.value })}
                      placeholder=""
                      disabled={isLoading}
                    />
                  </div>

                  <div className="grid gap-2 col-span-2">
                    <Label htmlFor="carbohydrates">Węglowodany (g)</Label>
                    <Input
                      id="carbohydrates"
                      type="number"
                      step="0.00001"
                      min="0"
                      value={formData.carbohydrates}
                      onChange={(e) => setFormData({ ...formData, carbohydrates: e.target.value })}
                      placeholder=""
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
                      step="0.00001"
                      min="0"
                      value={formData.sugars}
                      onChange={(e) => setFormData({ ...formData, sugars: e.target.value })}
                      placeholder=""
                      disabled={isLoading}
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="calcium">Wapń (mg)</Label>
                    <Input
                      id="calcium"
                      type="number"
                      step="0.00001"
                      min="0"
                      value={formData.calcium}
                      onChange={(e) => setFormData({ ...formData, calcium: e.target.value })}
                      placeholder=""
                      disabled={isLoading}
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="iron">Żelazo (mg)</Label>
                    <Input
                      id="iron"
                      type="number"
                      step="0.00001"
                      min="0"
                      value={formData.iron}
                      onChange={(e) => setFormData({ ...formData, iron: e.target.value })}
                      placeholder=""
                      disabled={isLoading}
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="vitaminC">Witamina C (mg)</Label>
                    <Input
                      id="vitaminC"
                      type="number"
                      step="0.00001"
                      min="0"
                      value={formData.vitaminC}
                      onChange={(e) => setFormData({ ...formData, vitaminC: e.target.value })}
                      placeholder=""
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

      <BarcodeScanner
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onScanSuccess={handleScanSuccess}
      />
      
      <AlertDialog open={showScanNextDialog} onOpenChange={setShowScanNextDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center space-x-2">
              <Camera className="w-5 h-5 text-blue-600" />
              <span>Produkt dodany!</span>
            </AlertDialogTitle>
            <AlertDialogDescription>
              Czy chcesz zeskanować kolejny produkt?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleScanNextNo}>
              Nie, zakończ
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleScanNextYes} className="bg-blue-600 hover:bg-blue-700">
              Tak, skanuj kolejny
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  )
}
