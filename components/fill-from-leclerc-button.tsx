'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { Download, Loader2, Barcode } from 'lucide-react'
import { toast } from 'sonner'

interface FillFromLeclercButtonProps {
  productId: string
  productBarcode?: string | null
  className?: string
}

export function FillFromLeclercButton({ 
  productId, 
  productBarcode,
  className = '' 
}: FillFromLeclercButtonProps) {
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()

  // Show disabled button with tooltip if product has no barcode
  const hasNoBarcode = !productBarcode || productBarcode.trim() === ''

  const fetchNutrition = async () => {
    setIsLoading(true)
    
    const toastId = toast.loading('Pobieranie danych o wartościach odżywczych...')
    
    try {
      const response = await fetch(`/api/products/${productId}/fill-missing-from-leclerc`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      })
      
      const data = await response.json()
      
      if (!response.ok) {
        throw new Error(data.error || 'Wystąpił błąd')
      }
      
      // Show success message with details
      if (data.filledFields && data.filledFields.length > 0) {
        const fieldNames: Record<string, string> = {
          calories: 'kalorie',
          protein: 'białko',
          fat: 'tłuszcz',
          saturatedFat: 'kw. nasycone',
          carbohydrates: 'węglowodany',
          sugars: 'cukry',
          salt: 'sól',
          fiber: 'błonnik',
          calcium: 'wapń',
          iron: 'żelazo',
          vitaminC: 'wit. C',
        }
        
        const filledFieldsText = data.filledFields
          .map((f: string) => fieldNames[f] || f)
          .join(', ')
        
        // Include source info in message
        const sourceText = data.sourceInfo?.length > 0 
          ? ` (źródła: ${data.sourceInfo.join(', ')})` 
          : ''
        
        toast.success(
          `Zaktualizowano: ${filledFieldsText}${sourceText}`,
          { id: toastId, duration: 5000 }
        )
      } else {
        const sourceText = data.sourceInfo?.length > 0 
          ? ` (źródła: ${data.sourceInfo.join(', ')})` 
          : ''
        toast.success(
          `Dane aktualne${sourceText}`,
          { id: toastId }
        )
      }
      
      // Refresh the page to show updated data
      router.refresh()
      
    } catch (error) {
      console.error('Error fetching nutrition:', error)
      toast.error(
        error instanceof Error ? error.message : 'Błąd podczas pobierania danych',
        { id: toastId }
      )
    } finally {
      setIsLoading(false)
    }
  }

  // If no barcode, show disabled button with tooltip
  if (hasNoBarcode) {
    return (
      <TooltipProvider delayDuration={300}>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className={`inline-block ${className}`}>
              <Button
                variant="outline"
                size="sm"
                disabled
                className="flex items-center space-x-2 opacity-50 cursor-not-allowed"
              >
                <Barcode className="w-4 h-4" />
                <span className="hidden sm:inline">Pobierz dane odżywcze</span>
                <span className="sm:hidden">Pobierz dane</span>
              </Button>
            </span>
          </TooltipTrigger>
          <TooltipContent>
            <p>Aby skorzystać z tej funkcji, najpierw uzupełnij kod kreskowy produktu.</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )
  }

  return (
    <Button
      variant="outline"
      size="sm"
      disabled={isLoading}
      onClick={fetchNutrition}
      className={`flex items-center space-x-2 ${className}`}
    >
      {isLoading ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : (
        <Download className="w-4 h-4" />
      )}
      <span className="hidden sm:inline">Pobierz dane odżywcze</span>
      <span className="sm:hidden">Pobierz dane</span>
    </Button>
  )
}
