
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";

interface DeleteProductButtonProps {
  product: {
    id: string;
    name: string;
  };
}

export function DeleteProductButton({ product }: DeleteProductButtonProps) {
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleDelete = async () => {
    setIsLoading(true);

    try {
      const response = await fetch(`/api/products/${product.id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Nie udało się usunąć produktu");
      }

      toast.success("Produkt został usunięty");
      router.push("/");
      router.refresh();
    } catch (error) {
      toast.error("Błąd podczas usuwania produktu");
      console.error(error);
    } finally {
      setIsLoading(false);
      setOpen(false);
    }
  };

  return (
    <>
      <Button
        onClick={() => setOpen(true)}
        variant="destructive"
        size="sm"
        className="gap-2"
      >
        <Trash2 className="h-4 w-4" />
        Usuń produkt
      </Button>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Czy na pewno chcesz usunąć ten produkt?</AlertDialogTitle>
            <AlertDialogDescription>
              Ta operacja jest nieodwracalna. Produkt <strong>{product.name}</strong> oraz wszystkie jego transakcje zostaną trwale usunięte z systemu.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isLoading}>Anuluj</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isLoading}
              className="bg-red-600 hover:bg-red-700"
            >
              {isLoading ? "Usuwanie..." : "Tak, usuń produkt"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
