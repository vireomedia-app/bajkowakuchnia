
'use client'

import { useState, useTransition } from 'react'
import { Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { useRouter } from 'next/navigation'

export function SearchProducts() {
  const [query, setQuery] = useState('')
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  const handleSearch = (searchQuery: string) => {
    setQuery(searchQuery)
    
    startTransition(() => {
      if (searchQuery) {
        router.push(`/inventory?search=${encodeURIComponent(searchQuery)}`)
      } else {
        router.push('/inventory')
      }
    })
  }

  return (
    <div className="relative flex-1 max-w-md">
      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
        <Search className="h-5 w-5 text-gray-400" />
      </div>
      <Input
        type="text"
        placeholder="Szukaj produktów..."
        value={query}
        onChange={(e) => handleSearch(e.target.value)}
        className="pl-10 pr-4 py-2 w-full border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        disabled={isPending}
      />
      {isPending && (
        <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
        </div>
      )}
    </div>
  )
}
