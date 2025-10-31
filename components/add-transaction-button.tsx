
'use client'

import { useState } from 'react'
import { Edit3 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { AddTransactionModal } from './add-transaction-modal'

interface AddTransactionButtonProps {
  productId: string
}

export function AddTransactionButton({ productId }: AddTransactionButtonProps) {
  const [isModalOpen, setIsModalOpen] = useState(false)

  return (
    <>
      <Button
        onClick={() => setIsModalOpen(true)}
        className="bg-green-600 hover:bg-green-700 text-white px-6 py-2.5 rounded-lg font-medium shadow-md hover:shadow-lg transition-all duration-200"
      >
        <Edit3 className="w-5 h-5 mr-2" />
        Dodaj transakcję
      </Button>
      
      <AddTransactionModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)}
        productId={productId}
      />
    </>
  )
}
