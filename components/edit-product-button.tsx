
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Pencil } from "lucide-react";
import { EditProductModal } from "./edit-product-modal";

interface EditProductButtonProps {
  product: {
    id: string;
    name: string;
    unit: string;
    manufacturer?: string | null;
    calories?: number | null;
    salt?: number | null;
    protein?: number | null;
    fat?: number | null;
    saturatedFat?: number | null;
    carbohydrates?: number | null;
    sugars?: number | null;
    calcium?: number | null;
    iron?: number | null;
    vitaminC?: number | null;
    allergens?: number[];
  };
}

export function EditProductButton({ product }: EditProductButtonProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        onClick={() => setOpen(true)}
        variant="secondary"
        size="sm"
        className="gap-2 bg-white hover:bg-gray-100 text-blue-900 border border-blue-200"
      >
        <Pencil className="h-4 w-4" />
        Edytuj produkt
      </Button>
      <EditProductModal
        open={open}
        onOpenChange={setOpen}
        product={product}
      />
    </>
  );
}
