
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { ArrowLeft, ChefHat, AlertCircle, Plus } from 'lucide-react'
import { RecipeWithNutrition } from '@/lib/types'
import { notFound } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { DeleteRecipeButton } from '@/components/delete-recipe-button'
import { EditRecipeButton } from '@/components/edit-recipe-button'
import { formatAllergens, getAllergenDescriptions } from '@/lib/allergens'
import { cn } from '@/lib/utils'
import { prisma } from '@/lib/db'

export const dynamic = "force-dynamic";

async function getRecipe(id: string): Promise<RecipeWithNutrition | null> {
  try {
    const recipe = await prisma.recipe.findUnique({
      where: { id },
      include: {
        ingredients: {
          include: {
            product: true,
          },
        },
      },
    });

    if (!recipe) {
      return null;
    }

    // Oblicz wartości odżywcze
    const nutrition = {
      calories: 0,
      protein: 0,
      fat: 0,
      saturatedFat: 0,
      carbohydrates: 0,
      sugars: 0,
      salt: 0,
      calcium: 0,
      iron: 0,
      vitaminC: 0
    };

    recipe.ingredients.forEach(ingredient => {
      if (ingredient.product) {
        const multiplier = ingredient.quantity / 100;
        
        nutrition.calories += (ingredient.product.calories || 0) * multiplier;
        nutrition.protein += (ingredient.product.protein || 0) * multiplier;
        nutrition.fat += (ingredient.product.fat || 0) * multiplier;
        nutrition.saturatedFat += (ingredient.product.saturatedFat || 0) * multiplier;
        nutrition.carbohydrates += (ingredient.product.carbohydrates || 0) * multiplier;
        nutrition.sugars += (ingredient.product.sugars || 0) * multiplier;
        nutrition.salt += (ingredient.product.salt || 0) * multiplier;
        nutrition.calcium += (ingredient.product.calcium || 0) * multiplier;
        nutrition.iron += (ingredient.product.iron || 0) * multiplier;
        nutrition.vitaminC += (ingredient.product.vitaminC || 0) * multiplier;
      }
    });

    return {
      ...recipe,
      nutrition
    };
  } catch (error) {
    console.error('Error fetching recipe:', error)
    return null
  }
}

export default async function RecipeDetailPage({ params }: { params: { id: string } }) {
  const recipe = await getRecipe(params.id)

  if (!recipe) {
    notFound()
  }

  const missingProducts = recipe.ingredients.filter(ing => !ing.productId)
  
  // Zbierz wszystkie alergeny z receptury
  const recipeAllergens = new Set<number>()
  recipe.ingredients.forEach(ingredient => {
    if (ingredient.product?.allergens) {
      ingredient.product.allergens.forEach(allergenId => recipeAllergens.add(allergenId))
    }
  })
  const allergensList = Array.from(recipeAllergens).sort((a, b) => a - b)

  return (
    <div className="space-y-8">
      {/* Navigation */}
      <Link href="/menu/recipes">
        <Button variant="ghost" className="gap-2">
          <ArrowLeft className="w-4 h-4" />
          Powrót do listy receptur
        </Button>
      </Link>

      {/* Recipe Header */}
      <div className="bg-white rounded-lg shadow-md border border-gray-100 overflow-hidden">
        <div className="bg-gradient-to-r from-orange-600 to-orange-700 px-6 py-8 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4 flex-1">
              <div className="p-4 bg-white/20 rounded-lg flex-shrink-0">
                <ChefHat className="w-8 h-8" />
              </div>
              <div className="flex-1">
                <h1 className="text-3xl font-bold">{recipe.name}</h1>
                {recipe.description && (
                  <p className="text-orange-100 mt-2">{recipe.description}</p>
                )}
                <p className="text-orange-100 mt-2">
                  Porcje: {recipe.servings}
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <EditRecipeButton recipeId={recipe.id} />
              <DeleteRecipeButton recipeId={recipe.id} recipeName={recipe.name} />
            </div>
          </div>
        </div>

        {/* Nutrition Summary - Only per serving */}
        <div className="p-6 space-y-6">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Wartości odżywcze na 1 porcję
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-red-50 rounded-lg p-3">
                <div className="text-sm text-gray-600">Kalorie</div>
                <div className="text-xl font-bold text-gray-900">
                  {Math.round(recipe.nutrition.calories / recipe.servings)} kcal
                </div>
              </div>
              <div className="bg-blue-50 rounded-lg p-3">
                <div className="text-sm text-gray-600">Białko</div>
                <div className="text-xl font-bold text-gray-900">
                  {(recipe.nutrition.protein / recipe.servings).toFixed(1)} g
                </div>
              </div>
              <div className="bg-yellow-50 rounded-lg p-3">
                <div className="text-sm text-gray-600">Tłuszcz</div>
                <div className="text-xl font-bold text-gray-900">
                  {(recipe.nutrition.fat / recipe.servings).toFixed(1)} g
                </div>
              </div>
              <div className="bg-yellow-100 rounded-lg p-3">
                <div className="text-sm text-gray-600">w tym nasycone</div>
                <div className="text-lg font-bold text-gray-900">
                  {(recipe.nutrition.saturatedFat / recipe.servings).toFixed(1)} g
                </div>
              </div>
              <div className="bg-amber-50 rounded-lg p-3">
                <div className="text-sm text-gray-600">Węglowodany</div>
                <div className="text-xl font-bold text-gray-900">
                  {(recipe.nutrition.carbohydrates / recipe.servings).toFixed(1)} g
                </div>
              </div>
              <div className="bg-amber-100 rounded-lg p-3">
                <div className="text-sm text-gray-600">w tym cukry</div>
                <div className="text-lg font-bold text-gray-900">
                  {(recipe.nutrition.sugars / recipe.servings).toFixed(1)} g
                </div>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <div className="text-sm text-gray-600">Sól</div>
                <div className="text-xl font-bold text-gray-900">
                  {(recipe.nutrition.salt / recipe.servings).toFixed(1)} g
                </div>
              </div>
            </div>

            {/* Vitamins and minerals */}
            {(recipe.nutrition.calcium > 0 || recipe.nutrition.iron > 0 || recipe.nutrition.vitaminC > 0) && (
              <div className="mt-6">
                <h4 className="text-sm font-semibold text-gray-700 mb-3">Witaminy i minerały</h4>
                <div className="grid grid-cols-3 gap-4">
                  {recipe.nutrition.calcium > 0 && (
                    <div className="bg-purple-50 rounded-lg p-3">
                      <div className="text-sm text-gray-600">Wapń</div>
                      <div className="text-lg font-semibold text-gray-900">
                        {(recipe.nutrition.calcium / recipe.servings).toFixed(1)} mg
                      </div>
                    </div>
                  )}
                  {recipe.nutrition.iron > 0 && (
                    <div className="bg-orange-50 rounded-lg p-3">
                      <div className="text-sm text-gray-600">Żelazo</div>
                      <div className="text-lg font-semibold text-gray-900">
                        {(recipe.nutrition.iron / recipe.servings).toFixed(1)} mg
                      </div>
                    </div>
                  )}
                  {recipe.nutrition.vitaminC > 0 && (
                    <div className="bg-green-50 rounded-lg p-3">
                      <div className="text-sm text-gray-600">Witamina C</div>
                      <div className="text-lg font-semibold text-gray-900">
                        {(recipe.nutrition.vitaminC / recipe.servings).toFixed(1)} mg
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Allergens */}
            {allergensList.length > 0 && (
              <div className="mt-6">
                <h4 className="text-sm font-semibold text-gray-700 mb-3">Alergeny występujące w posiłku</h4>
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <div className="text-sm font-medium text-red-900 mb-2">
                    {formatAllergens(allergensList)}
                  </div>
                  <div className="space-y-1">
                    {getAllergenDescriptions(allergensList).map((desc, idx) => (
                      <div key={idx} className="text-xs text-red-800">
                        {desc}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Missing Products Alert */}
      {missingProducts.length > 0 && (
        <Alert className="bg-amber-50 border-amber-200">
          <AlertCircle className="h-4 w-4 text-amber-600" />
          <AlertDescription className="text-amber-800">
            Niektóre składniki nie są jeszcze dodane do bazy produktów magazynowych. 
            Dodaj je, aby obliczyć pełne wartości odżywcze.
          </AlertDescription>
        </Alert>
      )}

      {/* Ingredients */}
      <div className="bg-white rounded-lg shadow-md border border-gray-100 overflow-hidden">
        <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">
            Składniki ({recipe.ingredients.length})
          </h3>
        </div>

        <div className="divide-y divide-gray-200">
          {recipe.ingredients.map((ingredient) => {
            const hasAllergens = ingredient.product?.allergens && ingredient.product.allergens.length > 0
            
            return (
              <div key={ingredient.id} className="px-6 py-4 hover:bg-gray-50 transition-colors">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <h4 className={cn(
                        "text-gray-900",
                        hasAllergens ? "font-bold" : "font-medium"
                      )}>
                        {ingredient.productName}
                        {hasAllergens && ingredient.product?.allergens && (
                          <span className="ml-2 text-xs text-red-600">
                            ({formatAllergens(ingredient.product.allergens)})
                          </span>
                        )}
                      </h4>
                    {!ingredient.productId && (
                      <Badge variant="outline" className="bg-amber-100 text-amber-800 border-amber-300">
                        Brak w bazie
                      </Badge>
                    )}
                    {ingredient.productId && ingredient.product?.currentStock === 0 && (
                      <Badge variant="outline" className="bg-red-100 text-red-800 border-red-300">
                        Brak w magazynie
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-gray-600 mt-1">
                    {ingredient.quantity} {ingredient.unit} na porcję
                    {ingredient.product?.manufacturer && (
                      <span className="text-gray-400"> • {ingredient.product.manufacturer}</span>
                    )}
                  </p>
                  
                  {/* Nutrition info if product exists */}
                  {ingredient.product && (
                    <div className="mt-3 bg-gray-50 rounded-lg p-3 border border-gray-200">
                      <h5 className="text-xs font-semibold text-gray-700 mb-2">Wartości odżywcze w tej porcji:</h5>
                      {(ingredient.product.calories || ingredient.product.protein || ingredient.product.fat || ingredient.product.carbohydrates || ingredient.product.salt || ingredient.product.calcium || ingredient.product.iron || ingredient.product.vitaminC) ? (
                        <div className="space-y-3">
                          {/* Makroskładniki */}
                          <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-xs">
                            {ingredient.product.calories ? (
                              <div>
                                <span className="text-gray-500">Kalorie:</span>
                                <span className="ml-1 font-medium text-gray-900">
                                  {((ingredient.product.calories * ingredient.quantity) / 100).toFixed(0)} kcal
                                </span>
                              </div>
                            ) : null}
                            {ingredient.product.protein ? (
                              <div>
                                <span className="text-gray-500">Białko:</span>
                                <span className="ml-1 font-medium text-gray-900">
                                  {((ingredient.product.protein * ingredient.quantity) / 100).toFixed(1)} g
                                </span>
                              </div>
                            ) : null}
                            {ingredient.product.fat ? (
                              <div>
                                <span className="text-gray-500">Tłuszcz:</span>
                                <span className="ml-1 font-medium text-gray-900">
                                  {((ingredient.product.fat * ingredient.quantity) / 100).toFixed(1)} g
                                </span>
                              </div>
                            ) : null}
                            {ingredient.product.carbohydrates ? (
                              <div>
                                <span className="text-gray-500">Węgl.:</span>
                                <span className="ml-1 font-medium text-gray-900">
                                  {((ingredient.product.carbohydrates * ingredient.quantity) / 100).toFixed(1)} g
                                </span>
                              </div>
                            ) : null}
                            {ingredient.product.salt ? (
                              <div>
                                <span className="text-gray-500">Sól:</span>
                                <span className="ml-1 font-medium text-gray-900">
                                  {((ingredient.product.salt * ingredient.quantity) / 100).toFixed(1)} g
                                </span>
                              </div>
                            ) : null}
                          </div>

                          {/* Witaminy i minerały */}
                          {(ingredient.product.calcium || ingredient.product.iron || ingredient.product.vitaminC) && (
                            <div>
                              <h6 className="text-xs font-semibold text-gray-600 mb-1">Witaminy i minerały:</h6>
                              <div className="grid grid-cols-3 gap-2 text-xs">
                                {ingredient.product.calcium ? (
                                  <div className="bg-purple-50 rounded px-2 py-1">
                                    <span className="text-gray-500">Wapń:</span>
                                    <span className="ml-1 font-medium text-gray-900">
                                      {((ingredient.product.calcium * ingredient.quantity) / 100).toFixed(1)} mg
                                    </span>
                                  </div>
                                ) : null}
                                {ingredient.product.iron ? (
                                  <div className="bg-orange-50 rounded px-2 py-1">
                                    <span className="text-gray-500">Żelazo:</span>
                                    <span className="ml-1 font-medium text-gray-900">
                                      {((ingredient.product.iron * ingredient.quantity) / 100).toFixed(1)} mg
                                    </span>
                                  </div>
                                ) : null}
                                {ingredient.product.vitaminC ? (
                                  <div className="bg-green-50 rounded px-2 py-1">
                                    <span className="text-gray-500">Wit. C:</span>
                                    <span className="ml-1 font-medium text-gray-900">
                                      {((ingredient.product.vitaminC * ingredient.quantity) / 100).toFixed(1)} mg
                                    </span>
                                  </div>
                                ) : null}
                              </div>
                            </div>
                          )}
                        </div>
                      ) : (
                        <p className="text-xs text-gray-500 italic">Brak informacji o wartościach odżywczych</p>
                      )}
                    </div>
                  )}
                  
                  {/* No product info message */}
                  {!ingredient.product && (
                    <div className="mt-2">
                      <p className="text-xs text-amber-600 italic">
                        Dodaj produkt do bazy, aby zobaczyć wartości odżywcze
                      </p>
                    </div>
                  )}
                </div>

                {!ingredient.productId && (
                  <Link href={`/inventory?add_product=${encodeURIComponent(ingredient.productName)}`}>
                    <Button size="sm" variant="outline" className="gap-2 text-amber-700 border-amber-300 hover:bg-amber-50 whitespace-nowrap">
                      <Plus className="w-4 h-4" />
                      Dodaj do magazynu
                    </Button>
                  </Link>
                )}
              </div>
            </div>
          )
        })}
        </div>
      </div>
    </div>
  )
}
