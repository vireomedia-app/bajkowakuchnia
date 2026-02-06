
'use client'

import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import Link from 'next/link'

export function BackToListButton() {
  return (
    <Link href="/inventory">
      <Button 
        variant="outline" 
        className="border-gray-300 hover:bg-gray-50 shadow-sm hover:shadow-md transition-all duration-200"
      >
        <ArrowLeft className="w-4 h-4 mr-2" />
        Powrót do listy
      </Button>
    </Link>
  )
}
