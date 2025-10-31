
'use client'

import { Product } from '@/lib/types'
import { Package, TrendingUp, TrendingDown, AlertTriangle, ArrowUp, ArrowDown } from 'lucide-react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { formatAllergens } from '@/lib/allergens'

interface ProductsListProps {
  products: Product[]
}

// Helper function to check if nutritional value exists
function hasValue(value: number | null | undefined): boolean {
  return value !== null && value !== undefined && value > 0
}

// Component for nutritional indicators
function NutritionalIndicators({ product }: { product: Product }) {
  const indicators = [
    { key: 'K', label: 'Kalorie', value: product.calories },
    { key: 'B', label: 'Białko', value: product.protein },
    { key: 'T', label: 'Tłuszcz', value: product.fat },
    { key: 'W', label: 'Węglowodany', value: product.carbohydrates },
    { key: 'Ca', label: 'Wapń', value: product.calcium },
    { key: 'Fe', label: 'Żelazo', value: product.iron },
    { key: 'C', label: 'Witamina C', value: product.vitaminC },
  ]

  return (
    <div className="flex items-center gap-1 flex-wrap">
      {indicators.map(({ key, label, value }) => {
        const hasData = hasValue(value)
        return (
          <div
            key={key}
            title={`${label}: ${hasData ? 'uzupełnione' : 'brak danych'}`}
            className={`inline-flex items-center justify-center px-1.5 py-0.5 rounded text-xs font-semibold border ${
              hasData
                ? 'bg-green-100 text-green-700 border-green-300'
                : 'bg-red-100 text-red-700 border-red-300'
            }`}
            style={{ minWidth: key === 'Ca' || key === 'Fe' ? '26px' : '18px' }}
          >
            {key}
          </div>
        )
      })}
    </div>
  )
}

export function ProductsList({ products }: ProductsListProps) {
  if (!products || products.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-md border border-gray-100 p-12 text-center">
        <Package className="w-12 h-12 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">Brak produktów</h3>
        <p className="text-gray-600 mb-4">Nie znaleziono żadnych produktów w magazynie.</p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow-md border border-gray-100 overflow-hidden">
      <div className="px-4 sm:px-6 py-4 bg-gray-50 border-b border-gray-200">
        <h3 className="text-base sm:text-lg font-medium text-gray-900 flex items-center space-x-2">
          <Package className="w-4 h-4 sm:w-5 sm:h-5" />
          <span>Lista Produktów</span>
        </h3>
      </div>

      {/* Desktop View - Table */}
      <div className="hidden sm:block overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Nazwa Produktu
              </th>
              <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-20">
                Jedn.
              </th>
              <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider w-28">
                Stan
              </th>
              <th className="px-2 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-12">
                St.
              </th>
              <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-24">
                Alergeny
              </th>
              <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-48">
                Wartości Odżywcze
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {products.map((product, index) => {
              const hasAllergens = product?.allergens && product.allergens.length > 0
              
              return (
                <motion.tr 
                  key={product?.id || `product-${index}`}
                  initial={{ opacity: 1, y: 0 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0 }}
                  className="hover:bg-gray-50 cursor-pointer transition-colors"
                  onClick={() => window.location.href = `/product/${product?.id || ''}`}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center space-x-2">
                      <div className="flex-shrink-0">
                        <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
                          <Package className="w-4 h-4 text-white" />
                        </div>
                      </div>
                      <div className="min-w-0">
                        <div className={`text-sm text-gray-900 ${hasAllergens ? 'font-bold' : 'font-medium'}`} style={{ color: '#111827' }}>
                          {product?.name || 'Nieznany produkt'}
                          {product?.manufacturer && (
                            <span className="text-gray-700 font-normal text-xs" style={{ color: '#374151' }}> - {product.manufacturer}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-3 text-center">
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-700 text-white border border-gray-800">
                      {product?.unit || 'szt'}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-right">
                    <div className="text-sm font-medium text-gray-900" style={{ color: '#111827' }}>
                      {(product?.currentStock ?? 0).toFixed(2)}
                    </div>
                  </td>
                  <td className="px-2 py-3 text-center">
                    {(product?.currentStock ?? 0) > 0 ? (
                      <div title="Na stanie">
                        <ArrowUp className="w-5 h-5 text-green-600 mx-auto" />
                      </div>
                    ) : (
                      <div title="Brak stanu">
                        <ArrowDown className="w-5 h-5 text-red-600 mx-auto" />
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-3">
                    {product?.allergens && product.allergens.length > 0 ? (
                      <div className="flex items-center space-x-1">
                        <AlertTriangle className="w-4 h-4 text-orange-600 flex-shrink-0" />
                        <span className="text-xs font-medium text-gray-900" style={{ color: '#111827' }}>
                          {formatAllergens(product.allergens)}
                        </span>
                      </div>
                    ) : (
                      <span className="text-xs text-gray-500">-</span>
                    )}
                  </td>
                  <td className="px-3 py-3">
                    <NutritionalIndicators product={product} />
                  </td>
                </motion.tr>
              )
            })}
          </tbody>
        </table>
      </div>
      
      {/* Mobile View - Cards */}
      <div className="sm:hidden divide-y divide-gray-200">
        {products.map((product, index) => {
          const hasAllergens = product?.allergens && product.allergens.length > 0
          
          return (
            <motion.div
              key={product?.id || `product-mobile-${index}`}
              initial={{ opacity: 1, y: 0 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0 }}
              className="p-4 hover:bg-gray-50 cursor-pointer transition-colors"
              onClick={() => window.location.href = `/product/${product?.id || ''}`}
            >
              <div className="flex items-center space-x-3 mb-3">
                <div className="flex-shrink-0">
                  <div className="h-12 w-12 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
                    <Package className="w-6 h-6 text-white" />
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className={`text-sm text-gray-900 ${hasAllergens ? 'font-bold' : 'font-medium'}`} style={{ color: '#111827' }}>
                    {product?.name || 'Nieznany produkt'}
                    {product?.manufacturer && (
                      <span className="text-gray-700 font-normal text-xs" style={{ color: '#374151' }}> - {product.manufacturer}</span>
                    )}
                  </div>
                  <div className="mt-1 flex items-center gap-2">
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-700 text-white border border-gray-800">
                      {product?.unit || 'szt'}
                    </span>
                  </div>
                </div>
              </div>
            
              <div className="flex items-center justify-between mb-2">
                <div className="text-left">
                  <div className="text-xs text-gray-700 font-medium" style={{ color: '#374151' }}>Aktualny stan</div>
                  <div className="text-sm font-medium text-gray-900" style={{ color: '#111827' }}>
                    {(product?.currentStock ?? 0).toFixed(2)} {product?.unit || 'szt'}
                  </div>
                </div>
                <div>
                  {(product?.currentStock ?? 0) > 0 ? (
                    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-green-600 text-white border border-green-700">
                      <TrendingUp className="w-3 h-3 mr-1" />
                      Na stanie
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-red-600 text-white border border-red-700">
                      <TrendingDown className="w-3 h-3 mr-1" />
                      Brak
                    </span>
                  )}
                </div>
              </div>

              <div className="mb-2">
                <div className="text-xs text-gray-700 font-medium mb-1" style={{ color: '#374151' }}>Wartości odżywcze</div>
                <NutritionalIndicators product={product} />
              </div>
            
              {product?.allergens && product.allergens.length > 0 && (
                <div className="pt-2 border-t border-gray-200">
                  <div className="flex items-start space-x-2">
                    <AlertTriangle className="w-4 h-4 text-orange-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <div className="text-xs text-gray-700 font-medium" style={{ color: '#374151' }}>Alergeny</div>
                      <div className="text-xs font-medium text-gray-900 mt-0.5" style={{ color: '#111827' }}>
                        {formatAllergens(product.allergens)}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
          )
        })}
      </div>
    </div>
  )
}
