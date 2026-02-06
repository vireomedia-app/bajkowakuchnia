

import { getProducts } from '@/lib/db-utils'
import { InventoryPageClient } from '@/components/inventory-page-client'

export const dynamic = "force-dynamic";

interface InventoryPageProps {
  searchParams: { search?: string; add_product?: string }
}

export default async function InventoryPage({ searchParams }: InventoryPageProps) {
  const allProducts = await getProducts()
  
  // Filter products based on search query
  const searchQuery = searchParams.search?.toLowerCase() || ''
  const products = searchQuery
    ? allProducts.filter(product => 
        product.name.toLowerCase().includes(searchQuery) ||
        product.unit.toLowerCase().includes(searchQuery)
      )
    : allProducts
  
  return (
    <InventoryPageClient 
      products={products || []} 
      searchQuery={searchQuery}
      addProductName={searchParams.add_product}
    />
  )
}

