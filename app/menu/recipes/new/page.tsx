
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { ArrowLeft } from 'lucide-react'
import { RecipeForm } from '@/components/recipe-form'
import { Product } from '@/lib/types'
import { prisma } from '@/lib/db'

export const dynamic = "force-dynamic";

async function getProducts(): Promise<Product[]> {
  try {
    const products = await prisma.product.findMany({
      orderBy: { name: 'asc' },
    });
    
    return products;
  } catch (error) {
    console.error('Error fetching products:', error)
    return []
  }
}

export default async function NewRecipePage() {
  const products = await getProducts()

  return (
    <div className="space-y-8">
      {/* Navigation */}
      <Link href="/menu/recipes">
        <Button variant="ghost" className="gap-2">
          <ArrowLeft className="w-4 h-4" />
          Powrót do listy receptur
        </Button>
      </Link>

      {/* Header */}
      <div className="text-center space-y-4">
        <h1 className="text-4xl md:text-5xl font-bold text-gray-900">Stwórz nową recepturę</h1>
        <p className="text-lg text-gray-600 max-w-2xl mx-auto">
          Dodaj nową recepturę ze składnikami i wartościami odżywczymi
        </p>
      </div>

      {/* Form */}
      <RecipeForm initialProducts={products} />
    </div>
  )
}
