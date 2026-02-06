
'use client'

import { RecipeWithNutrition } from '@/lib/types'
import { ChefHat, Flame, Egg, Wheat } from 'lucide-react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { Badge } from '@/components/ui/badge'

interface RecipesListProps {
  recipes: RecipeWithNutrition[]
}

export function RecipesList({ recipes }: RecipesListProps) {
  if (!recipes || recipes.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-md border border-gray-100 p-12 text-center">
        <ChefHat className="w-12 h-12 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">Brak receptur</h3>
        <p className="text-gray-600 mb-4">Nie znaleziono żadnych receptur.</p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {recipes.map((recipe, index) => (
        <motion.div
          key={recipe?.id || `recipe-${index}`}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.1 }}
        >
          <Link href={`/menu/recipes/${recipe.id}`}>
            <div className="bg-white rounded-lg shadow-md border border-gray-100 overflow-hidden hover:shadow-xl transition-all duration-300 cursor-pointer group h-full">
              {/* Header */}
              <div className="bg-gradient-to-r from-orange-600 to-orange-700 px-4 py-4 text-white">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-white/20 rounded-lg flex-shrink-0">
                    <ChefHat className="w-6 h-6" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-lg truncate text-white transition-colors">
                      {recipe?.name || 'Bez nazwy'}
                    </h3>
                    <p className="text-orange-50 text-sm">
                      {recipe?.servings || 1} {recipe?.servings === 1 ? 'porcja' : 'porcje'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Nutrition Summary */}
              <div className="p-4">
                <div className="grid grid-cols-3 gap-3 mb-3">
                  <div className="text-center p-2 bg-red-50 rounded-lg">
                    <Flame className="w-4 h-4 text-red-600 mx-auto mb-1" />
                    <div className="text-xs font-semibold text-gray-700">Kalorie</div>
                    <div className="text-sm font-bold text-gray-900">
                      {Math.round(recipe?.nutrition?.calories || 0)}
                    </div>
                  </div>
                  <div className="text-center p-2 bg-blue-50 rounded-lg">
                    <Egg className="w-4 h-4 text-blue-600 mx-auto mb-1" />
                    <div className="text-xs font-semibold text-gray-700">Białko</div>
                    <div className="text-sm font-bold text-gray-900">
                      {(recipe?.nutrition?.protein || 0).toFixed(1)}g
                    </div>
                  </div>
                  <div className="text-center p-2 bg-amber-50 rounded-lg">
                    <Wheat className="w-4 h-4 text-amber-600 mx-auto mb-1" />
                    <div className="text-xs font-semibold text-gray-700">Węgl.</div>
                    <div className="text-sm font-bold text-gray-900">
                      {(recipe?.nutrition?.carbohydrates || 0).toFixed(1)}g
                    </div>
                  </div>
                </div>

                {/* Ingredients count */}
                <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                  <span className="text-sm font-semibold text-gray-900">
                    Składniki: {recipe?.ingredients?.length || 0}
                  </span>
                  {recipe?.ingredients?.some(ing => !ing.productId) && (
                    <Badge variant="outline" className="text-xs bg-amber-100 border-amber-300 font-semibold text-amber-900">
                      Wymaga uzupełnienia
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          </Link>
        </motion.div>
      ))}
    </div>
  )
}
