
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { RotateCcw } from "lucide-react";
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

export function RestoreBackupButton() {
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleRestore = async () => {
    setIsLoading(true);

    try {
      const response = await fetch("/api/restore", {
        method: "POST",
      });

      if (!response.ok) {
        throw new Error("Nie udało się przywrócić danych");
      }

      toast.success("Dane zostały przywrócone do stanu początkowego");
      router.refresh();
    } catch (error) {
      toast.error("Błąd podczas przywracania danych");
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
        variant="outline"
        size="sm"
        className="gap-2"
      >
        <RotateCcw className="h-4 w-4" />
        Przywróć dane początkowe
      </Button>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Przywrócić dane początkowe?</AlertDialogTitle>
            <AlertDialogDescription>
              Ta operacja usunie wszystkie obecne produkty i transakcje, a następnie wczyta przykładowe dane z systemu. 
              <strong className="block mt-2">Ta operacja jest nieodwracalna!</strong>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isLoading}>Anuluj</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRestore}
              disabled={isLoading}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {isLoading ? "Przywracanie..." : "Tak, przywróć dane"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
