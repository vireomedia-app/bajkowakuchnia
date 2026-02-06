'use client'

import { useState, useEffect } from 'react'
import { Search, Package } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { toast } from 'sonner'

interface Product {
  id: string
  name: string
  unit: string
  currentStock: number
  barcode?: string | null
}

interface SearchProductForManualAddProps {
  onProductSelect: (product: Product) => void
}

export function SearchProductForManualAdd({ onProductSelect }: SearchProductForManualAddProps) {
  const [query, setQuery] = useState('')
  const [products, setProducts] = useState<Product[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [showResults, setShowResults] = useState(false)

  useEffect(() => {
    const searchProducts = async () => {
      if (query.length < 2) {
        setProducts([])
        setShowResults(false)
        return
      }

      setIsLoading(true)
      try {
        const response = await fetch(`/api/products?search=${encodeURIComponent(query)}`)
        if (!response.ok) throw new Error('Błąd wyszukiwania')
        
        const data = await response.json()
        setProducts(data)
        setShowResults(true)
      } catch (error) {
        console.error('Error searching products:', error)
        toast.error('Błąd podczas wyszukiwania produktów')
      } finally {
        setIsLoading(false)
      }
    }

    const debounceTimer = setTimeout(searchProducts, 300)
    return () => clearTimeout(debounceTimer)
  }, [query])

  const handleProductSelect = (product: Product) => {
    onProductSelect(product)
    setQuery('')
    setProducts([])
    setShowResults(false)
  }

  return (
    <div className="relative w-full">
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <Search className="h-5 w-5 text-gray-400" />
        </div>
        <Input
          type="text"
          placeholder="Wyszukaj produkt po nazwie..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="pl-10 pr-4 py-3 w-full text-lg"
        />
        {isLoading && (
          <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
          </div>
        )}
      </div>

      {/* Lista wyników */}
      {showResults && products.length > 0 && (
        <div className="absolute z-50 w-full mt-2 bg-white border border-gray-200 rounded-lg shadow-lg">
          <ScrollArea className="max-h-64">
            <div className="p-2 space-y-1">
              {products.map((product) => (
                <button
                  key={product.id}
                  onClick={() => handleProductSelect(product)}
                  className="w-full text-left p-3 rounded-md hover:bg-blue-50 transition-colors flex items-center space-x-3"
                >
                  <Package className="w-5 h-5 text-blue-600 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 truncate">{product.name}</p>
                    <p className="text-sm text-gray-500">
                      Stan: {product.currentStock} {product.unit}
                      {product.barcode && ` • Kod: ${product.barcode}`}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </ScrollArea>
        </div>
      )}

      {/* Brak wyników */}
      {showResults && products.length === 0 && query.length >= 2 && !isLoading && (
        <div className="absolute z-50 w-full mt-2 bg-white border border-gray-200 rounded-lg shadow-lg p-4 text-center text-gray-500">
          <p>Nie znaleziono produktów dla &quot;{query}&quot;</p>
        </div>
      )}
    </div>
  )
}
