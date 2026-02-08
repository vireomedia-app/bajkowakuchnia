
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
import { AlertCircle } from "lucide-react";
import { toast } from "sonner";

interface EditProductModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: {
    id: string;
    name: string;
    unit: string;
    packagingType?: string | null;
    barcode?: string | null;
    packageWeight?: number | null;
    packageUnit?: string | null;
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

// Main unit options - weight, volume, or pieces
const UNITS = [
  { value: "kg", label: "kg (kilogramy)" },
  { value: "g", label: "g (gramy)" },
  { value: "l", label: "l (litry)" },
  { value: "ml", label: "ml (mililitry)" },
  { value: "szt", label: "szt (sztuki)" },
];

// Package weight/volume unit options (same as main units)
const PACKAGE_UNIT_OPTIONS = [
  { value: "g", label: "g" },
  { value: "kg", label: "kg" },
  { value: "ml", label: "ml" },
  { value: "l", label: "l" },
  { value: "szt", label: "szt" },
];

// Packaging type options - simplified to 2 options
const PACKAGING_TYPE_OPTIONS = [
  { value: "bulk", label: "Luzem / na wagę", description: "Np. marchew, mąka z worka, mleko z baniaka, bułki liczone pojedynczo" },
  { value: "packaged", label: "W opakowaniach", description: "Np. makaron 500g, mleko 1l, ser 200g, jajka w kartonie 10 szt" },
];

// Helper to determine packaging type from existing product
function getPackagingType(product: EditProductModalProps['product']): 'bulk' | 'packaged' {
  // If packagingType is explicitly set, use it
  if (product.packagingType === 'packaged' || product.packagingType === 'bulk') {
    return product.packagingType;
  }
  // For legacy "pieces" type, convert to "bulk" (unit will be 'szt')
  // Otherwise, infer from packageWeight (if set, it's packaged)
  return product.packageWeight ? 'packaged' : 'bulk';
}

// Helper to get compatible package unit based on main unit
function getCompatiblePackageUnit(unit: string, currentPackageUnit: string | null | undefined): string {
  const isMainWeight = unit === 'kg' || unit === 'g';
  const isMainVolume = unit === 'ml' || unit === 'l';
  const isCurrentWeight = currentPackageUnit === 'kg' || currentPackageUnit === 'g';
  const isCurrentVolume = currentPackageUnit === 'ml' || currentPackageUnit === 'l';
  
  // If current package unit is compatible, keep it
  if (currentPackageUnit) {
    if ((isMainWeight && isCurrentWeight) || (isMainVolume && isCurrentVolume) || (unit === 'szt' && currentPackageUnit === 'szt')) {
      return currentPackageUnit;
    }
  }
  
  // Otherwise, return default for the type
  if (isMainWeight) return 'g';
  if (isMainVolume) return 'ml';
  return 'szt';
}

export function EditProductModal({ open, onOpenChange, product }: EditProductModalProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: product.name,
    unit: product.unit,
    packagingType: getPackagingType(product) as 'bulk' | 'packaged',
    barcode: product.barcode || "",
    packageWeight: product.packageWeight?.toString() || "",
    packageUnit: getCompatiblePackageUnit(product.unit, product.packageUnit),
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
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Update form data when product changes
  useEffect(() => {
    setFormData({
      name: product.name,
      unit: product.unit,
      packagingType: getPackagingType(product) as 'bulk' | 'packaged',
      barcode: product.barcode || "",
      packageWeight: product.packageWeight?.toString() || "",
      packageUnit: getCompatiblePackageUnit(product.unit, product.packageUnit),
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
    setErrors({});
  }, [product]);

  const originalBarcode = product.barcode || "";

  const handleAllergenToggle = (allergenId: number) => {
    setFormData(prev => {
      const allergens = prev.allergens.includes(allergenId)
        ? prev.allergens.filter(id => id !== allergenId)
        : [...prev.allergens, allergenId]
      return { ...prev, allergens }
    })
  }

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    
    if (!formData.name?.trim()) {
      newErrors.name = 'Nazwa produktu jest wymagana';
    }
    
    // Unit is required for bulk products (for packaged, unit comes from packageUnit)
    if (formData.packagingType === 'bulk' && !formData.unit) {
      newErrors.unit = 'Jednostka miary jest wymagana';
    }
    
    // Package weight is required when packagingType is 'packaged'
    if (formData.packagingType === 'packaged') {
      const pkgWeight = parseFloat(formData.packageWeight);
      if (!formData.packageWeight || isNaN(pkgWeight) || pkgWeight <= 0) {
        newErrors.packageWeight = 'Waga/objętość opakowania jest wymagana dla produktów w opakowaniach';
      }
      if (!formData.packageUnit) {
        newErrors.packageUnit = 'Jednostka opakowania jest wymagana';
      }
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }
    
    setIsLoading(true);

    try {
      const isPackaged = formData.packagingType === 'packaged';
      // Convert string values to numbers or null
      const submitData = {
        name: formData.name,
        // For packaged products, unit is derived from packageUnit
        unit: isPackaged ? formData.packageUnit : formData.unit,
        packagingType: formData.packagingType,
        barcode: formData.barcode || null,
        packageWeight: isPackaged && formData.packageWeight ? parseFloat(formData.packageWeight) : null,
        packageUnit: isPackaged && formData.packageWeight ? formData.packageUnit : null,
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

      // Show a gentle warning if barcode has been changed manually
      if (originalBarcode && formData.barcode.trim() !== originalBarcode) {
        toast.warning("Zmieniasz kod kreskowy produktu. Upewnij się, że nowy kod jest poprawny i unikalny.");
      }

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
                    placeholder=""
                    required
                  />
                </div>

                {/* Packaging Type Selection */}
                <div className="grid gap-2">
                  <Label>Typ produktu *</Label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {PACKAGING_TYPE_OPTIONS.map((option) => (
                      <div
                        key={option.value}
                        onClick={() => !isLoading && setFormData({ ...formData, packagingType: option.value as 'bulk' | 'packaged' })}
                        className={`
                          relative flex flex-col p-3 rounded-lg border-2 cursor-pointer transition-all
                          ${formData.packagingType === option.value 
                            ? 'border-blue-500 bg-blue-50' 
                            : 'border-gray-200 hover:border-gray-300 bg-white'}
                          ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}
                        `}
                      >
                        <div className="flex items-center gap-2">
                          <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0
                            ${formData.packagingType === option.value ? 'border-blue-500' : 'border-gray-300'}
                          `}>
                            {formData.packagingType === option.value && (
                              <div className="w-2 h-2 rounded-full bg-blue-500" />
                            )}
                          </div>
                          <span className="font-medium text-sm">{option.label}</span>
                        </div>
                        <p className="text-xs text-gray-500 mt-1 ml-6">{option.description}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Unit selection - only for bulk products */}
                {formData.packagingType === 'bulk' && (
                  <div className="grid gap-2">
                    <Label htmlFor="unit">Jednostka miary *</Label>
                    <Select
                      value={formData.unit}
                      onValueChange={(value) => setFormData({ ...formData, unit: value })}
                      disabled={isLoading}
                      required
                    >
                      <SelectTrigger className={errors.unit ? 'border-red-300' : ''}>
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
                    {errors.unit && (
                      <p className="text-sm text-red-600 flex items-center space-x-1">
                        <AlertCircle className="w-4 h-4" />
                        <span>{errors.unit}</span>
                      </p>
                    )}
                  </div>
                )}

                {/* Package Weight - only shown for packaged products */}
                {formData.packagingType === 'packaged' && (
                  <div className="grid gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                    <Label htmlFor="packageWeight">Waga/Objętość jednego opakowania *</Label>
                    <div className="flex gap-2">
                      <Input
                        id="packageWeight"
                        type="number"
                        step="0.00001"
                        min="0"
                        value={formData.packageWeight}
                        onChange={(e) =>
                          setFormData({ ...formData, packageWeight: e.target.value })
                        }
                        placeholder=""
                        disabled={isLoading}
                        className={`flex-1 bg-white ${errors.packageWeight ? 'border-red-300' : ''}`}
                        required
                      />
                      <Select
                        value={formData.packageUnit}
                        onValueChange={(value) =>
                          setFormData({ ...formData, packageUnit: value, unit: value })
                        }
                        disabled={isLoading}
                      >
                        <SelectTrigger className="w-20 bg-white">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {PACKAGE_UNIT_OPTIONS.map((unit) => (
                            <SelectItem key={unit.value} value={unit.value}>
                              {unit.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    {errors.packageWeight && (
                      <p className="text-sm text-red-600 flex items-center space-x-1">
                        <AlertCircle className="w-4 h-4" />
                        <span>{errors.packageWeight}</span>
                      </p>
                    )}
                    <p className="text-xs text-gray-600">
                      Np. jeśli kupujesz makaron w opakowaniach 500g, wpisz "500" i wybierz "g".
                      <br />
                      Przy przyjęciu 10 opakowań system automatycznie przeliczy ilość.
                    </p>
                  </div>
                )}

                <div className="grid gap-2">
                  <Label htmlFor="barcode">Kod kreskowy</Label>
                  <Input
                    id="barcode"
                    value={formData.barcode}
                    onChange={(e) =>
                      setFormData({ ...formData, barcode: e.target.value })
                    }
                    placeholder=""
                  />
                  <p className="text-xs text-gray-500">
                    Możesz dodać lub edytować kod kreskowy ręcznie
                  </p>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="manufacturer">Nazwa producenta</Label>
                  <Input
                    id="manufacturer"
                    value={formData.manufacturer}
                    onChange={(e) =>
                      setFormData({ ...formData, manufacturer: e.target.value })
                    }
                    placeholder=""
                  />
                </div>
              </div>

              {/* Nutritional Values */}
              <div className="space-y-4">
                <h3 className="font-semibold text-sm text-gray-700">
                  Wartości odżywcze (na {(() => {
                    const effectiveUnit = formData.packagingType === 'packaged' ? formData.packageUnit : formData.unit;
                    if (effectiveUnit === 'szt') return 'sztukę';
                    if (effectiveUnit === 'ml' || effectiveUnit === 'l') return '100 ml';
                    return '100 g';
                  })()})
                </h3>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="calories">Kalorie (kcal)</Label>
                    <Input
                      id="calories"
                      type="number"
                      step="0.00001"
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
                      step="0.00001"
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
                      step="0.00001"
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
                      step="0.00001"
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
                      step="0.00001"
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
                      step="0.00001"
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
                      step="0.00001"
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
                      step="0.00001"
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
                      step="0.00001"
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
                      step="0.00001"
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
