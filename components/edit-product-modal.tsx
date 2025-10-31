
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { ALLERGENS } from "@/lib/allergens";
import { toast } from "sonner";

interface EditProductModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
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

const UNITS = [
  { value: "kg", label: "kg" },
  { value: "szt", label: "szt" },
  { value: "l", label: "l" },
  { value: "opak", label: "opak" },
  { value: "g", label: "g" },
  { value: "ml", label: "ml" },
  { value: "inne", label: "inne" },
];

export function EditProductModal({ open, onOpenChange, product }: EditProductModalProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: product.name,
    unit: product.unit,
    manufacturer: product.manufacturer || "",
    calories: product.calories?.toString() || "",
    salt: product.salt?.toString() || "",
    protein: product.protein?.toString() || "",
    fat: product.fat?.toString() || "",
    saturatedFat: product.saturatedFat?.toString() || "",
    carbohydrates: product.carbohydrates?.toString() || "",
    sugars: product.sugars?.toString() || "",
    calcium: product.calcium?.toString() || "",
    iron: product.iron?.toString() || "",
    vitaminC: product.vitaminC?.toString() || "",
    allergens: product.allergens || [],
  });

  // Update form data when product changes
  useEffect(() => {
    setFormData({
      name: product.name,
      unit: product.unit,
      manufacturer: product.manufacturer || "",
      calories: product.calories?.toString() || "",
      salt: product.salt?.toString() || "",
      protein: product.protein?.toString() || "",
      fat: product.fat?.toString() || "",
      saturatedFat: product.saturatedFat?.toString() || "",
      carbohydrates: product.carbohydrates?.toString() || "",
      sugars: product.sugars?.toString() || "",
      calcium: product.calcium?.toString() || "",
      iron: product.iron?.toString() || "",
      vitaminC: product.vitaminC?.toString() || "",
      allergens: product.allergens || [],
    });
  }, [product]);

  const handleAllergenToggle = (allergenId: number) => {
    setFormData(prev => {
      const allergens = prev.allergens.includes(allergenId)
        ? prev.allergens.filter(id => id !== allergenId)
        : [...prev.allergens, allergenId]
      return { ...prev, allergens }
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      // Convert string values to numbers or null
      const submitData = {
        name: formData.name,
        unit: formData.unit,
        manufacturer: formData.manufacturer || null,
        calories: formData.calories ? parseFloat(formData.calories) : null,
        salt: formData.salt ? parseFloat(formData.salt) : null,
        protein: formData.protein ? parseFloat(formData.protein) : null,
        fat: formData.fat ? parseFloat(formData.fat) : null,
        saturatedFat: formData.saturatedFat ? parseFloat(formData.saturatedFat) : null,
        carbohydrates: formData.carbohydrates ? parseFloat(formData.carbohydrates) : null,
        sugars: formData.sugars ? parseFloat(formData.sugars) : null,
        calcium: formData.calcium ? parseFloat(formData.calcium) : null,
        iron: formData.iron ? parseFloat(formData.iron) : null,
        vitaminC: formData.vitaminC ? parseFloat(formData.vitaminC) : null,
        allergens: formData.allergens,
      };

      const response = await fetch(`/api/products/${product.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(submitData),
      });

      if (!response.ok) {
        throw new Error("Nie udało się zaktualizować produktu");
      }

      toast.success("Produkt został zaktualizowany");
      onOpenChange(false);
      router.refresh();
    } catch (error) {
      toast.error("Błąd podczas aktualizacji produktu");
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>Edytuj produkt</DialogTitle>
          <DialogDescription>
            Zmień nazwę, jednostkę miary lub wartości odżywcze produktu.
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="max-h-[60vh] pr-4">
          <form onSubmit={handleSubmit} id="edit-product-form">
            <div className="grid gap-6 py-4">
              {/* Basic Info */}
              <div className="space-y-4">
                <h3 className="font-semibold text-sm text-gray-700">Podstawowe informacje</h3>
                
                <div className="grid gap-2">
                  <Label htmlFor="name">Nazwa produktu *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                    placeholder="Np. Mąka pszenna"
                    required
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="unit">Jednostka miary *</Label>
                  <Select
                    value={formData.unit}
                    onValueChange={(value) =>
                      setFormData({ ...formData, unit: value })
                    }
                    required
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Wybierz jednostkę" />
                    </SelectTrigger>
                    <SelectContent>
                      {UNITS.map((unit) => (
                        <SelectItem key={unit.value} value={unit.value}>
                          {unit.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="manufacturer">Nazwa producenta</Label>
                  <Input
                    id="manufacturer"
                    value={formData.manufacturer}
                    onChange={(e) =>
                      setFormData({ ...formData, manufacturer: e.target.value })
                    }
                    placeholder="Np. Młyny Polskie"
                  />
                </div>
              </div>

              {/* Nutritional Values */}
              <div className="space-y-4">
                <h3 className="font-semibold text-sm text-gray-700">
                  Wartości odżywcze (na 100{formData.unit === 'ml' || formData.unit === 'l' ? ' ml' : ' g'})
                </h3>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="calories">Kalorie (kcal)</Label>
                    <Input
                      id="calories"
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.calories}
                      onChange={(e) =>
                        setFormData({ ...formData, calories: e.target.value })
                      }
                      placeholder="0"
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="salt">Sól (g)</Label>
                    <Input
                      id="salt"
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.salt}
                      onChange={(e) =>
                        setFormData({ ...formData, salt: e.target.value })
                      }
                      placeholder="0"
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="protein">Białko (g)</Label>
                    <Input
                      id="protein"
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.protein}
                      onChange={(e) =>
                        setFormData({ ...formData, protein: e.target.value })
                      }
                      placeholder="0"
                    />
                  </div>

                  <div className="grid gap-2 col-span-2">
                    <Label htmlFor="fat">Tłuszcz (g)</Label>
                    <Input
                      id="fat"
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.fat}
                      onChange={(e) =>
                        setFormData({ ...formData, fat: e.target.value })
                      }
                      placeholder="0"
                    />
                  </div>

                  <div className="grid gap-2 col-span-2 pl-4">
                    <Label htmlFor="saturatedFat" className="text-sm text-muted-foreground">
                      w tym kwasy tłuszczowe nasycone (g)
                    </Label>
                    <Input
                      id="saturatedFat"
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.saturatedFat}
                      onChange={(e) =>
                        setFormData({ ...formData, saturatedFat: e.target.value })
                      }
                      placeholder="0"
                    />
                  </div>

                  <div className="grid gap-2 col-span-2">
                    <Label htmlFor="carbohydrates">Węglowodany (g)</Label>
                    <Input
                      id="carbohydrates"
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.carbohydrates}
                      onChange={(e) =>
                        setFormData({ ...formData, carbohydrates: e.target.value })
                      }
                      placeholder="0"
                    />
                  </div>

                  <div className="grid gap-2 col-span-2 pl-4">
                    <Label htmlFor="sugars" className="text-sm text-muted-foreground">
                      w tym cukry (g)
                    </Label>
                    <Input
                      id="sugars"
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.sugars}
                      onChange={(e) =>
                        setFormData({ ...formData, sugars: e.target.value })
                      }
                      placeholder="0"
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="calcium">Wapń (mg)</Label>
                    <Input
                      id="calcium"
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.calcium}
                      onChange={(e) =>
                        setFormData({ ...formData, calcium: e.target.value })
                      }
                      placeholder="0"
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="iron">Żelazo (mg)</Label>
                    <Input
                      id="iron"
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.iron}
                      onChange={(e) =>
                        setFormData({ ...formData, iron: e.target.value })
                      }
                      placeholder="0"
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="vitaminC">Witamina C (mg)</Label>
                    <Input
                      id="vitaminC"
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.vitaminC}
                      onChange={(e) =>
                        setFormData({ ...formData, vitaminC: e.target.value })
                      }
                      placeholder="0"
                    />
                  </div>
                </div>
              </div>

              {/* Allergens */}
              <div className="space-y-4">
                <h3 className="font-semibold text-sm text-gray-700">Alergeny</h3>
                <p className="text-xs text-gray-500 mb-3">
                  Wybierz alergeny, które występują w tym produkcie (pole opcjonalne)
                </p>
                
                <div className="grid grid-cols-1 gap-3 max-h-[200px] overflow-y-auto border rounded-md p-3">
                  {ALLERGENS.map((allergen) => (
                    <div key={allergen.id} className="flex items-start space-x-3">
                      <Checkbox
                        id={`allergen-${allergen.id}`}
                        checked={formData.allergens.includes(allergen.id)}
                        onCheckedChange={() => handleAllergenToggle(allergen.id)}
                        disabled={isLoading}
                      />
                      <div className="flex-1">
                        <Label
                          htmlFor={`allergen-${allergen.id}`}
                          className="text-sm font-medium leading-none cursor-pointer"
                        >
                          A:{allergen.id} - {allergen.name}
                        </Label>
                        <p className="text-xs text-gray-500 mt-1">
                          {allergen.description}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
                
                {formData.allergens.length > 0 && (
                  <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
                    <p className="text-sm font-medium text-blue-900">
                      Wybrane alergeny: {formData.allergens.sort((a, b) => a - b).map(id => `A:${id}`).join(', ')}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </form>
        </ScrollArea>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
          >
            Anuluj
          </Button>
          <Button type="submit" form="edit-product-form" disabled={isLoading}>
            {isLoading ? "Zapisywanie..." : "Zapisz zmiany"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
