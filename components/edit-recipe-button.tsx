
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
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
import { Edit } from 'lucide-react'

interface EditRecipeButtonProps {
  recipeId: string
}

export function EditRecipeButton({ recipeId }: EditRecipeButtonProps) {
  const router = useRouter()
  const [showWarning, setShowWarning] = useState(false)

  const handleEditClick = () => {
    setShowWarning(true)
  }

  const handleConfirm = () => {
    setShowWarning(false)
    router.push(`/menu/recipes/${recipeId}/edit`)
  }

  return (
    <>
      <Button 
        variant="outline" 
        className="gap-2 border-orange-300 text-orange-700 hover:bg-orange-50"
        onClick={handleEditClick}
      >
        <Edit className="w-4 h-4" />
        Edytuj recepturę
      </Button>

      <AlertDialog open={showWarning} onOpenChange={setShowWarning}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Edycja receptury</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>
                Edycja receptury wpłynie na:
              </p>
              <ul className="list-disc list-inside space-y-1 text-amber-600 font-medium">
                <li>Wszystkie jadłospisy wykorzystujące tę recepturę</li>
                <li>Wartości odżywcze obliczane na podstawie tej receptury</li>
                <li>Wyliczenia kosztów i stanów magazynowych</li>
                <li>Wszystkie eksportowane raporty i zestawienia</li>
              </ul>
              <p className="mt-3">
                Czy na pewno chcesz kontynuować?
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Anuluj</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirm}
              className="bg-orange-600 hover:bg-orange-700"
            >
              Rozumiem, edytuj
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
