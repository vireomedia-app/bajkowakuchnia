'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { Download, ChevronDown, Loader2, RefreshCw, AlertTriangle, Barcode } from 'lucide-react'
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
  const [showForceConfirm, setShowForceConfirm] = useState(false)
  const router = useRouter()

  // Show disabled button with tooltip if product has no barcode
  const hasNoBarcode = !productBarcode || productBarcode.trim() === ''

  const fillFromLeclerc = async (force: boolean = false) => {
    setIsLoading(true)
    
    const toastId = toast.loading(
      force 
        ? 'Nadpisywanie danych z Leclerc...' 
        : 'Pobieranie brakujących danych z Leclerc...'
    )
    
    try {
      const response = await fetch(`/api/products/${productId}/fill-missing-from-leclerc`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ force }),
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
          `Uzupełniono: ${filledFieldsText}${sourceText}`,
          { id: toastId, duration: 5000 }
        )
      } else {
        toast.info(
          data.message || 'Brak nowych danych do uzupełnienia',
          { id: toastId }
        )
      }
      
      // Refresh the page to show updated data
      router.refresh()
      
    } catch (error) {
      console.error('Error filling from Leclerc:', error)
      toast.error(
        error instanceof Error ? error.message : 'Błąd podczas pobierania danych z Leclerc',
        { id: toastId }
      )
    } finally {
      setIsLoading(false)
    }
  }

  const handleFillMissing = () => {
    fillFromLeclerc(false)
  }

  const handleForceOverwrite = () => {
    setShowForceConfirm(true)
  }

  const confirmForceOverwrite = () => {
    setShowForceConfirm(false)
    fillFromLeclerc(true)
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
                <span className="hidden sm:inline">Uzupełnij z Leclerc</span>
                <span className="sm:hidden">Leclerc</span>
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
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            disabled={isLoading}
            className={`flex items-center space-x-2 ${className}`}
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Download className="w-4 h-4" />
            )}
            <span className="hidden sm:inline">Uzupełnij z Leclerc</span>
            <span className="sm:hidden">Leclerc</span>
            <ChevronDown className="w-3 h-3 ml-1" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={handleFillMissing} disabled={isLoading}>
            <Download className="w-4 h-4 mr-2" />
            Uzupełnij brakujące dane
          </DropdownMenuItem>
          <DropdownMenuItem 
            onClick={handleForceOverwrite} 
            disabled={isLoading}
            className="text-orange-600 focus:text-orange-600"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Nadpisz wszystkie dane
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={showForceConfirm} onOpenChange={setShowForceConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center space-x-2">
              <AlertTriangle className="w-5 h-5 text-orange-600" />
              <span>Nadpisać dane z Leclerc?</span>
            </AlertDialogTitle>
            <AlertDialogDescription>
              Ta operacja nadpisze <strong>wszystkie</strong> istniejące wartości odżywcze 
              danymi pobranymi z Leclerc.pl. Obecne wartości zostaną utracone.
              <br /><br />
              Czy na pewno chcesz kontynuować?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Anuluj</AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmForceOverwrite}
              className="bg-orange-600 hover:bg-orange-700"
            >
              Tak, nadpisz dane
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
