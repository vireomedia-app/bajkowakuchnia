

import { getProducts } from '@/lib/db-utils'
import { InventoryPageClient } from '@/components/inventory-page-client'

export const dynamic = "force-dynamic";

interface InventoryPageProps {
  searchParams: { search?: string; add_product?: string }
}

export default async function InventoryPage({ searchParams }: InventoryPageProps) {
  const allProducts = await getProducts()

   return (
     <InventoryPageClient 
       products={allProducts || []}
       searchQuery=""
       addProductName={searchParams.add_product}
     />
  )
}

