
import { ProductWithTransactions } from '@/lib/types'
import { Package, TrendingUp, TrendingDown, Calendar, AlertTriangle } from 'lucide-react'
import { EditProductButton } from './edit-product-button'
import { DeleteProductButton } from './delete-product-button'
import { getAllergenDescriptions } from '@/lib/allergens'

interface ProductHeaderProps {
  product: ProductWithTransactions
}

export function ProductHeader({ product }: ProductHeaderProps) {
  const totalTransactions = product?.transactions?.length || 0
  const lastTransaction = product?.transactions?.[product.transactions.length - 1]
  
  return (
    <div className="bg-white rounded-lg shadow-md border border-gray-100 overflow-hidden">
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-4 sm:px-6 py-6 sm:py-8 text-white">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center space-x-3 sm:space-x-4">
            <div className="p-3 sm:p-4 bg-white/20 rounded-lg flex-shrink-0">
              <Package className="w-6 h-6 sm:w-8 sm:h-8" />
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="text-xl sm:text-2xl md:text-3xl font-bold break-words">
                {product?.name || 'Nieznany produkt'}
                {product?.manufacturer && (
                  <span className="text-blue-100"> - {product.manufacturer}</span>
                )}
              </h1>
              <p className="text-blue-100 mt-1 text-sm sm:text-base">Karta produktu - historia transakcji</p>
            </div>
          </div>
          <div className="flex gap-2 sm:gap-3 flex-shrink-0">
            <EditProductButton product={{
              id: product.id,
              name: product.name,
              unit: product.unit,
              manufacturer: product.manufacturer,
              calories: product.calories,
              salt: product.salt,
              protein: product.protein,
              fat: product.fat,
              saturatedFat: product.saturatedFat,
              carbohydrates: product.carbohydrates,
              sugars: product.sugars,
              calcium: product.calcium,
              iron: product.iron,
              vitaminC: product.vitaminC,
              allergens: product.allergens,
            }} />
            <DeleteProductButton product={{
              id: product.id,
              name: product.name
            }} />
          </div>
        </div>
      </div>
      
      <div className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {/* Current Stock */}
          <div className="text-center p-4 bg-blue-50 rounded-lg">
            <div className="text-2xl font-bold text-blue-900">
              {(product?.currentStock || 0).toFixed(2)}
            </div>
            <div className="text-sm text-blue-700">
              Aktualny stan ({product?.unit || 'szt'})
            </div>
            <div className="mt-2">
              {(product?.currentStock || 0) > 0 ? (
                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-green-100 text-green-800">
                  <TrendingUp className="w-3 h-3 mr-1" />
                  Na stanie
                </span>
              ) : (
                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-red-100 text-red-800">
                  <TrendingDown className="w-3 h-3 mr-1" />
                  Brak stanu
                </span>
              )}
            </div>
          </div>
          
          {/* Unit */}
          <div className="text-center p-4 bg-gray-50 rounded-lg">
            <div className="text-xl font-semibold text-gray-900">
              {product?.unit || 'szt'}
            </div>
            <div className="text-sm text-gray-600">Jednostka miary</div>
          </div>
          
          {/* Total Transactions */}
          <div className="text-center p-4 bg-gray-50 rounded-lg">
            <div className="text-xl font-semibold text-gray-900">
              {totalTransactions}
            </div>
            <div className="text-sm text-gray-600">Łączna liczba transakcji</div>
          </div>
          
          {/* Last Transaction */}
          <div className="text-center p-4 bg-gray-50 rounded-lg">
            <div className="text-lg font-semibold text-gray-900">
              {lastTransaction ? (
                new Date(lastTransaction.date).toLocaleDateString('pl-PL')
              ) : (
                'Brak'
              )}
            </div>
            <div className="text-sm text-gray-600 flex items-center justify-center">
              <Calendar className="w-3 h-3 mr-1" />
              Ostatnia transakcja
            </div>
          </div>
        </div>
        
        {/* Allergens Section */}
        {product.allergens && product.allergens.length > 0 && (
          <div className="mt-6 pt-6 border-t border-gray-200">
            <div className="flex items-center space-x-2 mb-4">
              <AlertTriangle className="w-5 h-5 text-orange-600" />
              <h3 className="text-lg font-semibold text-gray-900">
                Alergeny
              </h3>
            </div>
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
              <div className="space-y-2">
                {getAllergenDescriptions(product.allergens).map((description, index) => (
                  <div key={index} className="text-sm text-gray-900 flex items-start space-x-2">
                    <span className="font-semibold text-orange-600">•</span>
                    <span>{description}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
        
        {/* Nutritional Values Section */}
        <div className="mt-6 pt-6 border-t border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            Wartości odżywcze (na 100 {product.unit === 'ml' || product.unit === 'l' ? 'ml' : 'g'})
          </h3>
          <p className="text-sm text-gray-600 mb-4">
            Pola podświetlone na czerwono wymagają uzupełnienia
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {/* Kalorie */}
            <div className={`rounded-lg p-3 border-2 ${
              product.calories && product.calories > 0 
                ? 'bg-gray-50 border-gray-200' 
                : 'bg-red-50 border-red-300'
            }`}>
              <div className="text-sm text-gray-600">Kalorie</div>
              <div className="text-lg font-semibold text-gray-900">
                {product.calories && product.calories > 0 ? `${product.calories} kcal` : 'Brak danych'}
              </div>
            </div>

            {/* Białko */}
            <div className={`rounded-lg p-3 border-2 ${
              product.protein !== null && product.protein !== undefined && product.protein > 0
                ? 'bg-gray-50 border-gray-200' 
                : 'bg-red-50 border-red-300'
            }`}>
              <div className="text-sm text-gray-600">Białko</div>
              <div className="text-lg font-semibold text-gray-900">
                {product.protein !== null && product.protein !== undefined && product.protein > 0 
                  ? `${product.protein} g` 
                  : 'Brak danych'}
              </div>
            </div>

            {/* Tłuszcz */}
            <div className={`rounded-lg p-3 border-2 ${
              product.fat !== null && product.fat !== undefined && product.fat > 0
                ? 'bg-gray-50 border-gray-200' 
                : 'bg-red-50 border-red-300'
            }`}>
              <div className="text-sm text-gray-600">Tłuszcz</div>
              <div className="text-lg font-semibold text-gray-900">
                {product.fat !== null && product.fat !== undefined && product.fat > 0 
                  ? `${product.fat} g` 
                  : 'Brak danych'}
              </div>
              {product.saturatedFat !== null && product.saturatedFat !== undefined && product.saturatedFat > 0 && (
                <div className="text-xs text-gray-500 mt-1">w tym nasycone: {product.saturatedFat} g</div>
              )}
            </div>

            {/* Węglowodany */}
            <div className={`rounded-lg p-3 border-2 ${
              product.carbohydrates !== null && product.carbohydrates !== undefined && product.carbohydrates > 0
                ? 'bg-gray-50 border-gray-200' 
                : 'bg-red-50 border-red-300'
            }`}>
              <div className="text-sm text-gray-600">Węglowodany</div>
              <div className="text-lg font-semibold text-gray-900">
                {product.carbohydrates !== null && product.carbohydrates !== undefined && product.carbohydrates > 0 
                  ? `${product.carbohydrates} g` 
                  : 'Brak danych'}
              </div>
              {product.sugars !== null && product.sugars !== undefined && product.sugars > 0 && (
                <div className="text-xs text-gray-500 mt-1">w tym cukry: {product.sugars} g</div>
              )}
            </div>

            {/* Sól */}
            <div className={`rounded-lg p-3 border-2 ${
              product.salt !== null && product.salt !== undefined
                ? 'bg-gray-50 border-gray-200' 
                : 'bg-red-50 border-red-300'
            }`}>
              <div className="text-sm text-gray-600">Sól</div>
              <div className="text-lg font-semibold text-gray-900">
                {product.salt !== null && product.salt !== undefined 
                  ? `${product.salt} g` 
                  : 'Brak danych'}
              </div>
            </div>

            {/* Wapń */}
            <div className={`rounded-lg p-3 border-2 ${
              product.calcium !== null && product.calcium !== undefined && product.calcium > 0
                ? 'bg-gray-50 border-gray-200' 
                : 'bg-red-50 border-red-300'
            }`}>
              <div className="text-sm text-gray-600">Wapń</div>
              <div className="text-lg font-semibold text-gray-900">
                {product.calcium !== null && product.calcium !== undefined && product.calcium > 0 
                  ? `${product.calcium} mg` 
                  : 'Brak danych'}
              </div>
            </div>

            {/* Żelazo */}
            <div className={`rounded-lg p-3 border-2 ${
              product.iron !== null && product.iron !== undefined && product.iron > 0
                ? 'bg-gray-50 border-gray-200' 
                : 'bg-red-50 border-red-300'
            }`}>
              <div className="text-sm text-gray-600">Żelazo</div>
              <div className="text-lg font-semibold text-gray-900">
                {product.iron !== null && product.iron !== undefined && product.iron > 0 
                  ? `${product.iron} mg` 
                  : 'Brak danych'}
              </div>
            </div>

            {/* Witamina C */}
            <div className={`rounded-lg p-3 border-2 ${
              product.vitaminC !== null && product.vitaminC !== undefined && product.vitaminC > 0
                ? 'bg-gray-50 border-gray-200' 
                : 'bg-red-50 border-red-300'
            }`}>
              <div className="text-sm text-gray-600">Witamina C</div>
              <div className="text-lg font-semibold text-gray-900">
                {product.vitaminC !== null && product.vitaminC !== undefined && product.vitaminC > 0 
                  ? `${product.vitaminC} mg` 
                  : 'Brak danych'}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
