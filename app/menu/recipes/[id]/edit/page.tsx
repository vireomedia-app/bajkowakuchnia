
import { RecipeForm } from '@/components/recipe-form'
import { Button } from '@/components/ui/button'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/db'

export const dynamic = "force-dynamic"

async function getRecipe(id: string) {
  try {
    const recipe = await prisma.recipe.findUnique({
      where: { id },
      include: {
        ingredients: {
          include: {
            product: true
          }
        }
      }
    })
    return recipe
  } catch (error) {
    console.error('Error fetching recipe:', error)
    return null
  }
}

async function getProducts() {
  try {
    const products = await prisma.product.findMany({
      orderBy: {
        name: 'asc'
      }
    })
    return products
  } catch (error) {
    console.error('Error fetching products:', error)
    return []
  }
}

export default async function EditRecipePage({ params }: { params: { id: string } }) {
  const [recipe, products] = await Promise.all([
    getRecipe(params.id),
    getProducts()
  ])

  if (!recipe) {
    notFound()
  }

  return (
    <div className="space-y-6">
      {/* Navigation */}
      <Link href={`/menu/recipes/${params.id}`}>
        <Button variant="ghost" className="gap-2">
          <ArrowLeft className="w-4 h-4" />
          Powrót do receptury
        </Button>
      </Link>

      {/* Header */}
      <div className="bg-white rounded-lg shadow-md border border-gray-100 overflow-hidden">
        <div className="bg-gradient-to-r from-orange-600 to-orange-700 px-6 py-8 text-white">
          <h1 className="text-3xl font-bold">Edytuj recepturę</h1>
          <p className="text-orange-100 mt-2">
            Edytujesz: {recipe.name}
          </p>
        </div>
      </div>

      {/* Form */}
      <RecipeForm 
        initialProducts={products}
        initialRecipe={{
          id: recipe.id,
          name: recipe.name,
          description: recipe.description || '',
          servings: recipe.servings,
          categories: recipe.categories,
          ingredients: recipe.ingredients.map(ing => ({
            productId: ing.productId,
            productName: ing.productName,
            quantity: ing.quantity,
            unit: ing.unit
          }))
        }}
        isEditing
      />
    </div>
  )
}
