
import { getProductById } from '@/lib/db-utils'
import { ProductHeader } from '@/components/product-header'
import { TransactionsList } from '@/components/transactions-list'
import { AddTransactionButton } from '@/components/add-transaction-button'
import { BackToListButton } from '@/components/back-to-list-button'
import { notFound } from 'next/navigation'

export const dynamic = "force-dynamic";

interface ProductPageProps {
  params: {
    id: string
  }
}

export default async function ProductPage({ params }: ProductPageProps) {
  const product = await getProductById(params.id)
  
  if (!product) {
    notFound()
  }
  
  return (
    <div className="space-y-8">
      {/* Navigation */}
      <BackToListButton />
      
      {/* Product Header */}
      <ProductHeader product={product} />
      
      {/* Actions */}
      <div className="flex justify-end">
        <AddTransactionButton productId={product.id} />
      </div>
      
      {/* Transactions List */}
      <TransactionsList 
        transactions={product.transactions || []} 
        productId={product.id}
      />
    </div>
  )
}
