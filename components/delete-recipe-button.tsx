
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
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Trash2 } from 'lucide-react'
import { toast } from 'sonner'

interface DeleteRecipeButtonProps {
  recipeId: string
  recipeName: string
}

export function DeleteRecipeButton({ recipeId, recipeName }: DeleteRecipeButtonProps) {
  const router = useRouter()
  const [isDeleting, setIsDeleting] = useState(false)

  const handleDelete = async () => {
    setIsDeleting(true)
    
    try {
      const response = await fetch(`/api/recipes/${recipeId}`, {
        method: 'DELETE'
      })

      if (!response.ok) {
        throw new Error('Failed to delete recipe')
      }

      toast.success('Receptura została usunięta')
      router.push('/menu/recipes')
      router.refresh()
    } catch (error) {
      toast.error('Błąd podczas usuwania receptury')
      console.error(error)
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="destructive" className="gap-2">
          <Trash2 className="w-4 h-4" />
          Usuń recepturę
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Czy na pewno chcesz usunąć tę recepturę?</AlertDialogTitle>
          <AlertDialogDescription className="space-y-2">
            <p>
              Ta akcja jest nieodwracalna. Receptura <strong>"{recipeName}"</strong> zostanie 
              trwale usunięta z systemu.
            </p>
            <p className="text-amber-600 font-medium">
              ⚠️ Usunięcie receptury wpłynie na wszystkie jadłospisy, w których jest ona wykorzystana.
            </p>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>Anuluj</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={isDeleting}
            className="bg-red-600 hover:bg-red-700"
          >
            {isDeleting ? 'Usuwanie...' : 'Tak, usuń recepturę'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
