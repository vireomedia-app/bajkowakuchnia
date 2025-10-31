'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ProductsList } from '@/components/products-list'
import { AddProductModal } from '@/components/add-product-modal'
import { ExportButton } from '@/components/export-button'
import { SearchProducts } from '@/components/search-products'
import { BackupManager } from '@/components/backup-manager'
import { LogoutButton } from '@/components/logout-button'
import { Warehouse, Package, ArrowLeft, Plus } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Product } from '@/lib/types'

interface InventoryPageClientProps {
  products: Product[]
  searchQuery: string
  addProductName?: string
}

export function InventoryPageClient({ products, searchQuery, addProductName }: InventoryPageClientProps) {
  const router = useRouter()
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [initialProductName, setInitialProductName] = useState('')

  // Auto-open modal when add_product parameter is present
  useEffect(() => {
    if (addProductName) {
      setInitialProductName(decodeURIComponent(addProductName))
      setIsAddModalOpen(true)
      
      // Remove the parameter from URL after opening modal
      const url = new URL(window.location.href)
      url.searchParams.delete('add_product')
      window.history.replaceState({}, '', url.toString())
    }
  }, [addProductName])

  const handleCloseModal = () => {
    setIsAddModalOpen(false)
    setInitialProductName('')
  }

  return (
    <div className="space-y-8">
      {/* Back Button and Logout */}
      <div className="flex justify-between items-center">
        <Link href="/">
          <Button variant="ghost" className="gap-2">
            <ArrowLeft className="w-4 h-4" />
            Powrót do menu głównego
          </Button>
        </Link>
        <LogoutButton />
      </div>

      {/* Header Section */}
      <div className="text-center space-y-4">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-blue-600 to-blue-700 text-white mb-4">
          <Warehouse className="w-8 h-8" />
        </div>
        <h2 className="text-3xl font-bold text-gray-900">
          Kartoteka Magazynowa
        </h2>
        <p className="text-gray-600 max-w-2xl mx-auto">
          Kompleksowe narzędzie do śledzenia stanów magazynowych i historii transakcji dla wszystkich produktów w firmie.
        </p>
      </div>

      {/* Actions */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-center">
        <SearchProducts />
        <div className="flex gap-3">
          <Button 
            onClick={() => setIsAddModalOpen(true)} 
            className="gap-2 bg-blue-600 hover:bg-blue-700"
          >
            <Plus className="w-4 h-4" />
            Dodaj nowy produkt
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-lg shadow-md border border-gray-100 p-6 hover:shadow-lg transition-shadow">
          <div className="flex items-center space-x-3">
            <div className="p-3 bg-blue-100 rounded-lg">
              <Package className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">
                {searchQuery ? 'Znaleziono produktów' : 'Łączna liczba produktów'}
              </p>
              <p className="text-2xl font-bold text-gray-900">{products?.length || 0}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow-md border border-gray-100 p-6 hover:shadow-lg transition-shadow">
          <div className="flex items-center space-x-3">
            <div className="p-3 bg-green-100 rounded-lg">
              <Package className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Produkty z dodatnim stanem</p>
              <p className="text-2xl font-bold text-gray-900">
                {products?.filter(p => (p?.currentStock ?? 0) > 0)?.length || 0}
              </p>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow-md border border-gray-100 p-6 hover:shadow-lg transition-shadow">
          <div className="flex items-center space-x-3">
            <div className="p-3 bg-yellow-100 rounded-lg">
              <Package className="w-6 h-6 text-yellow-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Produkty bez stanu</p>
              <p className="text-2xl font-bold text-gray-900">
                {products?.filter(p => (p?.currentStock ?? 0) === 0)?.length || 0}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Products List */}
      <ProductsList products={products || []} />
      
      {/* Bottom Actions */}
      <div className="flex flex-col sm:flex-row gap-3 justify-center items-center pt-4 pb-8">
        <BackupManager />
        <ExportButton />
      </div>

      {/* Add Product Modal */}
      <AddProductModal 
        isOpen={isAddModalOpen} 
        onClose={handleCloseModal}
        initialName={initialProductName}
      />
    </div>
  )
}
