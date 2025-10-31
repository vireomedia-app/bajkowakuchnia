
'use client'
// Force rebuild - deployment fix
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Plus, Trash2, AlertCircle, Check, ChevronsUpDown, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { Product, MealType } from '@/lib/types'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Checkbox } from '@/components/ui/checkbox'
import { cn } from '@/lib/utils'

interface RecipeFormProps {
  initialProducts?: Product[]
  initialRecipe?: {
    id: string
    name: string
    description: string
    servings: number
    categories?: MealType[]
    ingredients: Array<{
      productId: string | null
      productName: string
      quantity: number
      unit: string
    }>
  }
  isEditing?: boolean
}

interface Ingredient {
  productId: string | null
  productName: string
  quantity: number | string
  unit: string
}

const UNITS = ['kg', 'g', 'l', 'ml', 'szt', 'opak', 'inne']

const MEAL_CATEGORIES = [
  { value: 'BREAKFAST', label: 'Śniadanie' },
  { value: 'SECOND_BREAKFAST', label: 'Drugie śniadanie' },
  { value: 'LUNCH', label: 'Obiad' },
  { value: 'FIRST_SNACK', label: 'Podwieczorek pierwszy' },
  { value: 'SECOND_SNACK', label: 'Podwieczorek drugi' },
] as const

export function RecipeForm({ initialProducts = [], initialRecipe, isEditing = false }: RecipeFormProps) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [products, setProducts] = useState<Product[]>(initialProducts)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [name, setName] = useState(initialRecipe?.name || '')
  const [description, setDescription] = useState(initialRecipe?.description || '')
  const [servings, setServings] = useState(initialRecipe?.servings.toString() || '1')
  const [selectedCategories, setSelectedCategories] = useState<MealType[]>(
    initialRecipe?.categories || []
  )
  const [ingredients, setIngredients] = useState<Ingredient[]>(
    initialRecipe?.ingredients && initialRecipe.ingredients.length > 0
      ? initialRecipe.ingredients.map(ing => ({
          productId: ing.productId,
          productName: ing.productName,
          quantity: ing.quantity,
          unit: ing.unit
        }))
      : [{ productId: null, productName: '', quantity: '', unit: 'g' }]
  )

  // Function to refresh products list
  const refreshProducts = async () => {
    setIsRefreshing(true)
    try {
      const response = await fetch('/api/products', {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache',
        }
      })
      
      if (response.ok) {
        const updatedProducts = await response.json()
        setProducts(updatedProducts)
        
        // Update ingredient productIds if they were just added
        setIngredients(prev => prev.map(ing => {
          if (!ing.productId && ing.productName) {
            const matchingProduct = updatedProducts.find(
              (p: Product) => p.name.toLowerCase() === ing.productName.toLowerCase()
            )
            if (matchingProduct) {
              return { ...ing, productId: matchingProduct.id }
            }
          }
          return ing
        }))
      }
    } catch (error) {
      console.error('Error refreshing products:', error)
    } finally {
      setIsRefreshing(false)
    }
  }

  // Listen for product additions from modal
  useEffect(() => {
    const handleProductAdded = () => {
      refreshProducts()
    }
    
    window.addEventListener('productAdded', handleProductAdded)
    return () => window.removeEventListener('productAdded', handleProductAdded)
  }, [])

  const handleAddIngredient = () => {
    setIngredients([...ingredients, { productId: null, productName: '', quantity: '', unit: 'g' }])
  }

  const handleRemoveIngredient = (index: number) => {
    const newIngredients = ingredients.filter((_, i) => i !== index)
    setIngredients(newIngredients)
  }

  const handleIngredientChange = (index: number, field: keyof Ingredient, value: string) => {
    const newIngredients = [...ingredients]
    
    if (field === 'productName') {
      // Check if product exists in database
      const product = products.find(p => p.name.toLowerCase() === value.toLowerCase())
      newIngredients[index] = {
        ...newIngredients[index],
        productId: product?.id || null,
        productName: value
      }
    } else {
      newIngredients[index] = {
        ...newIngredients[index],
        [field]: value
      }
    }
    
    setIngredients(newIngredients)
  }

  const handleProductSelect = (index: number, productId: string, productName: string) => {
    const newIngredients = [...ingredients]
    newIngredients[index] = {
      ...newIngredients[index],
      productId,
      productName
    }
    setIngredients(newIngredients)
  }

  const handleCategoryToggle = (category: MealType) => {
    setSelectedCategories(prev => {
      if (prev.includes(category)) {
        return prev.filter(c => c !== category)
      } else {
        return [...prev, category]
      }
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!name.trim()) {
      toast.error('Podaj nazwę receptury')
      return
    }

    if (selectedCategories.length === 0) {
      toast.error('Wybierz przynajmniej jedną kategorię posiłku')
      return
    }

    if (ingredients.length === 0 || !ingredients[0].productName) {
      toast.error('Dodaj przynajmniej jeden składnik')
      return
    }

    setIsLoading(true)

    try {
      const url = isEditing && initialRecipe 
        ? `/api/recipes/${initialRecipe.id}` 
        : '/api/recipes'
      const method = isEditing ? 'PATCH' : 'POST'

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || null,
          servings: parseInt(servings) || 1,
          categories: selectedCategories,
          ingredients: ingredients
            .filter(ing => ing.productName.trim())
            .map(ing => ({
              productId: ing.productId,
              productName: ing.productName.trim(),
              quantity: parseFloat(ing.quantity as string) || 0,
              unit: ing.unit
            }))
        })
      })

      if (!response.ok) {
        throw new Error(`Failed to ${isEditing ? 'update' : 'create'} recipe`)
      }

      const recipe = await response.json()
      toast.success(isEditing ? 'Receptura została zaktualizowana' : 'Receptura została utworzona')
      
      // Użyj window.location.href zamiast router.push dla pewności
      window.location.href = `/menu/recipes/${recipe.id}`
    } catch (error) {
      toast.error(`Błąd podczas ${isEditing ? 'aktualizacji' : 'tworzenia'} receptury`)
      console.error(error)
    } finally {
      setIsLoading(false)
    }
  }

  const missingProducts = ingredients.filter(ing => ing.productName && !ing.productId)

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Basic Info */}
      <div className="bg-white rounded-lg shadow-md border border-gray-100 p-6 space-y-4">
        <h3 className="text-lg font-semibold text-gray-900">Podstawowe informacje</h3>
        
        <div className="grid gap-4">
          <div>
            <Label htmlFor="name">Nazwa receptury *</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Np. Zupa pomidorowa"
              required
            />
          </div>

          <div>
            <Label htmlFor="description">Opis (opcjonalnie)</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Krótki opis receptury"
              rows={3}
            />
          </div>

          <div>
            <Label htmlFor="servings">Liczba porcji *</Label>
            <Input
              id="servings"
              type="number"
              min="1"
              value={servings}
              onChange={(e) => setServings(e.target.value)}
              required
            />
          </div>
        </div>
      </div>

      {/* Categories */}
      <div className="bg-white rounded-lg shadow-md border border-gray-100 p-6 space-y-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Kategorie posiłków *</h3>
          <p className="text-sm text-gray-600 mb-4">
            Wybierz co najmniej jedną kategorię, w której receptura może być wykorzystana
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {MEAL_CATEGORIES.map((category) => (
            <div key={category.value} className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-gray-50 transition-colors">
              <Checkbox
                id={`category-${category.value}`}
                checked={selectedCategories.includes(category.value)}
                onCheckedChange={() => handleCategoryToggle(category.value)}
              />
              <Label
                htmlFor={`category-${category.value}`}
                className="flex-1 cursor-pointer font-medium text-gray-700"
              >
                {category.label}
              </Label>
            </div>
          ))}
        </div>

        {selectedCategories.length === 0 && (
          <Alert className="bg-amber-50 border-amber-200">
            <AlertCircle className="h-4 w-4 text-amber-600" />
            <AlertDescription className="text-amber-800">
              Musisz wybrać przynajmniej jedną kategorię posiłku
            </AlertDescription>
          </Alert>
        )}

        {selectedCategories.length > 0 && (
          <div className="flex flex-wrap gap-2 pt-2">
            <span className="text-sm text-gray-600">Wybrane kategorie:</span>
            {selectedCategories.map((cat) => {
              const categoryLabel = MEAL_CATEGORIES.find(c => c.value === cat)?.label
              return (
                <Badge key={cat} variant="default" className="bg-green-600">
                  {categoryLabel}
                </Badge>
              )
            })}
          </div>
        )}
      </div>

      {/* Ingredients */}
      <div className="bg-white rounded-lg shadow-md border border-gray-100 p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">Składniki</h3>
          <div className="flex gap-2">
            <Button 
              type="button" 
              onClick={refreshProducts} 
              size="sm" 
              variant="outline"
              className="gap-2"
              disabled={isRefreshing}
            >
              <RefreshCw className={cn("w-4 h-4", isRefreshing && "animate-spin")} />
              Odśwież listę
            </Button>
            <Button type="button" onClick={handleAddIngredient} size="sm" className="gap-2">
              <Plus className="w-4 h-4" />
              Dodaj składnik
            </Button>
          </div>
        </div>

        {missingProducts.length > 0 && (
          <Alert className="bg-amber-50 border-amber-200">
            <AlertCircle className="h-4 w-4 text-amber-600" />
            <AlertDescription className="text-amber-800">
              {missingProducts.length} składnik(ów) nie istnieje w bazie produktów. 
              Będą oznaczone jako wymagające dodania do magazynu.
            </AlertDescription>
          </Alert>
        )}

        <div className="space-y-3">
          {ingredients.map((ingredient, index) => (
            <div key={index} className="grid grid-cols-12 gap-3 items-start p-3 bg-gray-50 rounded-lg">
              <div className="col-span-5">
                <Label htmlFor={`ingredient-name-${index}`}>Nazwa składnika</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      className={cn(
                        "w-full justify-between font-normal",
                        !ingredient.productName && "text-muted-foreground"
                      )}
                    >
                      {ingredient.productName || "Wybierz składnik..."}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[300px] p-0" align="start">
                    <Command shouldFilter={false}>
                      <CommandInput 
                        placeholder="Szukaj składnika..." 
                        onValueChange={(value) => handleIngredientChange(index, 'productName', value)}
                      />
                      <CommandList>
                        <CommandEmpty>
                          {ingredient.productName ? (
                            <div className="p-2 text-sm text-center">
                              <p className="text-amber-600 font-medium">Nie znaleziono w bazie</p>
                              <p className="text-gray-600 mt-1">
                                Składnik "{ingredient.productName}" zostanie dodany jako brakujący
                              </p>
                            </div>
                          ) : (
                            <p className="p-2 text-sm text-center text-gray-500">Wpisz nazwę składnika</p>
                          )}
                        </CommandEmpty>
                        <CommandGroup>
                          {products
                            .filter(product => {
                              // Jeśli nie ma wartości wyszukiwania, pokaż wszystkie produkty
                              if (!ingredient.productName || ingredient.productName.trim() === '') {
                                return true
                              }
                              // Jeśli jest wartość, filtruj po nazwie
                              return product.name.toLowerCase().includes(ingredient.productName.toLowerCase().trim())
                            })
                            .slice(0, 50) // Limit do 50 produktów dla wydajności
                            .map((product) => (
                              <CommandItem
                                key={product.id}
                                value={product.name}
                                onSelect={() => handleProductSelect(index, product.id, product.name)}
                              >
                                <Check
                                  className={cn(
                                    "mr-2 h-4 w-4",
                                    ingredient.productId === product.id ? "opacity-100" : "opacity-0"
                                  )}
                                />
                                <div className="flex-1">
                                  <div className="font-medium">{product.name}</div>
                                  {product.manufacturer && (
                                    <div className="text-xs text-gray-500">{product.manufacturer}</div>
                                  )}
                                </div>
                                <Badge variant="outline" className="ml-2 text-xs">
                                  {product.unit}
                                </Badge>
                              </CommandItem>
                            ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
                
                {ingredient.productName && !ingredient.productId && (
                  <Badge variant="outline" className="mt-1 text-xs bg-amber-100 text-amber-800 border-amber-300">
                    Nie ma w bazie
                  </Badge>
                )}
                {ingredient.productId && (
                  <Badge variant="outline" className="mt-1 text-xs bg-green-100 text-green-800 border-green-300">
                    W bazie
                  </Badge>
                )}
              </div>

              <div className="col-span-3">
                <Label htmlFor={`ingredient-quantity-${index}`}>Ilość na porcję</Label>
                <Input
                  id={`ingredient-quantity-${index}`}
                  type="number"
                  step="0.01"
                  min="0"
                  value={ingredient.quantity}
                  onChange={(e) => handleIngredientChange(index, 'quantity', e.target.value)}
                  placeholder="0"
                />
              </div>

              <div className="col-span-3">
                <Label htmlFor={`ingredient-unit-${index}`}>Jednostka</Label>
                <Select
                  value={ingredient.unit}
                  onValueChange={(value) => handleIngredientChange(index, 'unit', value)}
                >
                  <SelectTrigger id={`ingredient-unit-${index}`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {UNITS.map(unit => (
                      <SelectItem key={unit} value={unit}>{unit}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="col-span-1 flex justify-end pt-6">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => handleRemoveIngredient(index)}
                  disabled={ingredients.length === 1}
                >
                  <Trash2 className="w-4 h-4 text-red-600" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Submit */}
      <div className="flex justify-end gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.back()}
          disabled={isLoading}
        >
          Anuluj
        </Button>
        <Button type="submit" disabled={isLoading}>
          {isLoading 
            ? (isEditing ? 'Zapisywanie...' : 'Tworzenie...') 
            : (isEditing ? 'Zapisz zmiany' : 'Stwórz recepturę')
          }
        </Button>
      </div>
    </form>
  )
}
