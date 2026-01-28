'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Upload, Loader2, CheckCircle2, AlertCircle, ChevronDown, ChevronRight } from 'lucide-react';

interface Product {
  id: string;
  name: string;
  unit: string;
}

interface Ingredient {
  name: string;
  quantity: number;
  unit: string;
  suggestions: Product[];
  matchType: 'suggested' | 'new';
  // Decyzja użytkownika
  action?: 'use_existing' | 'create_new' | 'skip';
  selectedProductId?: string;
  newProductName?: string;
  newProductUnit?: string;
}

interface Recipe {
  name: string;
  category: string;
  categories: string[];
  ingredients: Ingredient[];
  expanded?: boolean;
}

interface AnalysisResult {
  success: boolean;
  recipes: Recipe[];
}

export function RecipeImportWizard() {
  const [isOpen, setIsOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [selectedIngredients, setSelectedIngredients] = useState<Set<string>>(new Set());

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setRecipes([]);
    }
  };

  const handleAnalyze = async () => {
    if (!file) {
      toast.error('Wybierz plik do analizy');
      return;
    }

    setAnalyzing(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/recipes/analyze-pdf', {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Błąd podczas analizy');
      }

      const data: AnalysisResult = await response.json();
      
      // Inicjalizuj domyślne decyzje
      const recipesWithDefaults = data.recipes.map(recipe => ({
        ...recipe,
        expanded: false,
        ingredients: recipe.ingredients.map(ing => ({
          ...ing,
          action: ing.suggestions.length > 0 ? 'use_existing' as const : 'create_new' as const,
          selectedProductId: ing.suggestions[0]?.id,
          newProductName: ing.name,
          newProductUnit: ing.unit
        }))
      }));

      setRecipes(recipesWithDefaults);
      toast.success(`Znaleziono ${data.recipes.length} receptur`);

    } catch (error: any) {
      console.error('Błąd analizy:', error);
      toast.error(error.message || 'Nie udało się przeanalizować pliku');
    } finally {
      setAnalyzing(false);
    }
  };

  const handleImport = async () => {
    setImporting(true);
    try {
      const recipesToImport = recipes.map(recipe => ({
        name: recipe.name,
        categories: recipe.categories || (recipe.category ? [recipe.category] : []),
        ingredients: recipe.ingredients.map(ing => ({
          originalName: ing.name,
          action: ing.action || 'skip',
          productId: ing.selectedProductId,
          newProductData: ing.action === 'create_new' ? {
            name: ing.newProductName || ing.name,
            unit: ing.newProductUnit || ing.unit
          } : undefined,
          quantity: ing.quantity,
          unit: ing.unit
        }))
      }));

      const response = await fetch('/api/recipes/bulk-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipes: recipesToImport })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Błąd podczas importu');
      }

      const data = await response.json();
      
      toast.success(
        `Zaimportowano ${data.results.imported} receptur. Pominięto ${data.results.skipped}.`
      );

      if (data.results.errors.length > 0) {
        toast.warning(`Błędy: ${data.results.errors.join(', ')}`);
      }

      setIsOpen(false);
      setFile(null);
      setRecipes([]);
      setSelectedIngredients(new Set());
      
      // Odśwież stronę po udanym imporcie
      window.location.reload();

    } catch (error: any) {
      console.error('Błąd importu:', error);
      toast.error(error.message || 'Nie udało się zaimportować receptur');
    } finally {
      setImporting(false);
    }
  };

  const toggleRecipe = (recipeIndex: number) => {
    setRecipes(prev => prev.map((r, i) => 
      i === recipeIndex ? { ...r, expanded: !r.expanded } : r
    ));
  };

  const updateIngredientAction = (
    recipeIndex: number,
    ingredientIndex: number,
    action: 'use_existing' | 'create_new' | 'skip'
  ) => {
    setRecipes(prev => prev.map((r, ri) => 
      ri === recipeIndex ? {
        ...r,
        ingredients: r.ingredients.map((ing, ii) => 
          ii === ingredientIndex ? { ...ing, action } : ing
        )
      } : r
    ));
  };

  const updateSelectedProduct = (
    recipeIndex: number,
    ingredientIndex: number,
    productId: string
  ) => {
    setRecipes(prev => prev.map((r, ri) => 
      ri === recipeIndex ? {
        ...r,
        ingredients: r.ingredients.map((ing, ii) => 
          ii === ingredientIndex ? { ...ing, selectedProductId: productId } : ing
        )
      } : r
    ));
  };

  const updateNewProductData = (
    recipeIndex: number,
    ingredientIndex: number,
    field: 'name' | 'unit',
    value: string
  ) => {
    setRecipes(prev => prev.map((r, ri) => 
      ri === recipeIndex ? {
        ...r,
        ingredients: r.ingredients.map((ing, ii) => 
          ii === ingredientIndex ? {
            ...ing,
            [field === 'name' ? 'newProductName' : 'newProductUnit']: value
          } : ing
        )
      } : r
    ));
  };

  const toggleIngredientSelection = (recipeIndex: number, ingredientIndex: number) => {
    const key = `${recipeIndex}-${ingredientIndex}`;
    setSelectedIngredients(prev => {
      const newSet = new Set(prev);
      if (newSet.has(key)) {
        newSet.delete(key);
      } else {
        newSet.add(key);
      }
      return newSet;
    });
  };

  const selectAllIngredients = () => {
    const allKeys = new Set<string>();
    recipes.forEach((recipe, ri) => {
      recipe.ingredients.forEach((_, ii) => {
        allKeys.add(`${ri}-${ii}`);
      });
    });
    setSelectedIngredients(allKeys);
  };

  const deselectAllIngredients = () => {
    setSelectedIngredients(new Set());
  };

  const applyBulkAction = (action: 'use_first' | 'create_new' | 'skip') => {
    if (selectedIngredients.size === 0) {
      toast.warning('Zaznacz składniki, do których chcesz zastosować akcję');
      return;
    }

    setRecipes(prev => prev.map((recipe, ri) => ({
      ...recipe,
      ingredients: recipe.ingredients.map((ing, ii) => {
        const key = `${ri}-${ii}`;
        if (!selectedIngredients.has(key)) return ing;

        if (action === 'use_first' && ing.suggestions.length > 0) {
          return {
            ...ing,
            action: 'use_existing',
            selectedProductId: ing.suggestions[0].id
          };
        } else if (action === 'create_new') {
          return {
            ...ing,
            action: 'create_new'
          };
        } else if (action === 'skip') {
          return {
            ...ing,
            action: 'skip'
          };
        }
        return ing;
      })
    })));

    toast.success(`Zastosowano akcję do ${selectedIngredients.size} składników`);
  };

  return (
    <>
      <Button onClick={() => setIsOpen(true)} className="w-full">
        <Upload className="mr-2 h-4 w-4" />
        Importuj receptury z PDF/DOCX
      </Button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Import receptur z pliku</DialogTitle>
            <DialogDescription>
              Wrzuć plik PDF lub DOCX z recepturami. System automatycznie wyciągnie wszystkie receptury
              i zaproponuje dopasowanie składników do istniejących produktów.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Wybór pliku */}
            <div>
              <Label htmlFor="file-upload">Wybierz plik (PDF lub DOCX)</Label>
              <Input
                id="file-upload"
                type="file"
                accept=".pdf,.docx"
                onChange={handleFileChange}
                className="mt-2"
              />
              {file && (
                <p className="text-sm text-muted-foreground mt-1">
                  Wybrany plik: {file.name}
                </p>
              )}
            </div>

            {/* Przycisk analizy */}
            <Button
              onClick={handleAnalyze}
              disabled={!file || analyzing}
              className="w-full"
            >
              {analyzing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Analizuję plik...
                </>
              ) : (
                'Analizuj plik'
              )}
            </Button>

            {/* Wyniki analizy */}
            {recipes.length > 0 && (
              <div className="space-y-4">
                <div className="flex items-center justify-between bg-muted p-3 rounded-md">
                  <p className="text-sm font-medium">
                    Znaleziono {recipes.length} receptur z{' '}
                    {recipes.reduce((sum, r) => sum + r.ingredients.length, 0)} składnikami
                  </p>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={selectAllIngredients}
                    >
                      Zaznacz wszystkie
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={deselectAllIngredients}
                    >
                      Odznacz wszystkie
                    </Button>
                  </div>
                </div>

                {/* Akcje zbiorcze */}
                {selectedIngredients.size > 0 && (
                  <div className="bg-blue-50 border border-blue-200 p-3 rounded-md">
                    <p className="text-sm font-medium mb-2">
                      Zaznaczono {selectedIngredients.size} składników. Akcje zbiorcze:
                    </p>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => applyBulkAction('use_first')}
                      >
                        Użyj pierwszej sugestii
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => applyBulkAction('create_new')}
                      >
                        Dodaj jako nowe produkty
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => applyBulkAction('skip')}
                      >
                        Pomiń
                      </Button>
                    </div>
                  </div>
                )}

                {/* Lista receptur */}
                <div className="space-y-2">
                  {recipes.map((recipe, recipeIndex) => (
                    <div key={recipeIndex} className="border rounded-md">
                      {/* Nagłówek receptury */}
                      <div
                        className="p-3 bg-muted cursor-pointer flex items-center justify-between"
                        onClick={() => toggleRecipe(recipeIndex)}
                      >
                        <div className="flex items-center gap-2">
                          {recipe.expanded ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                          <span className="font-medium">{recipe.name}</span>
                          <span className="text-sm text-muted-foreground">
                            ({recipe.category}, {recipe.ingredients.length} składników)
                          </span>
                        </div>
                      </div>

                      {/* Składniki */}
                      {recipe.expanded && (
                        <div className="p-3 space-y-3">
                          {recipe.ingredients.map((ingredient, ingredientIndex) => {
                            const isSelected = selectedIngredients.has(
                              `${recipeIndex}-${ingredientIndex}`
                            );

                            return (
                              <div
                                key={ingredientIndex}
                                className={`border rounded p-3 space-y-2 ${
                                  isSelected ? 'bg-blue-50 border-blue-300' : ''
                                }`}
                              >
                                {/* Checkbox i nazwa składnika */}
                                <div className="flex items-start gap-2">
                                  <Checkbox
                                    checked={isSelected}
                                    onCheckedChange={() =>
                                      toggleIngredientSelection(recipeIndex, ingredientIndex)
                                    }
                                    className="mt-1"
                                  />
                                  <div className="flex-1">
                                    <div className="flex items-center gap-2">
                                      <span className="font-medium">{ingredient.name}</span>
                                      <span className="text-sm text-muted-foreground">
                                        {ingredient.quantity} {ingredient.unit}
                                      </span>
                                      {ingredient.suggestions.length === 0 && (
                                        <span className="text-xs bg-orange-100 text-orange-700 px-2 py-1 rounded">
                                          Brak sugestii
                                        </span>
                                      )}
                                    </div>

                                    {/* Akcja */}
                                    <div className="mt-2 space-y-2">
                                      <Select
                                        value={ingredient.action}
                                        onValueChange={(value: any) =>
                                          updateIngredientAction(
                                            recipeIndex,
                                            ingredientIndex,
                                            value
                                          )
                                        }
                                      >
                                        <SelectTrigger className="w-64">
                                          <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="use_existing">
                                            Użyj istniejącego produktu
                                          </SelectItem>
                                          <SelectItem value="create_new">
                                            Dodaj jako nowy produkt
                                          </SelectItem>
                                          <SelectItem value="skip">Pomiń</SelectItem>
                                        </SelectContent>
                                      </Select>

                                      {/* Wybór istniejącego produktu */}
                                      {ingredient.action === 'use_existing' &&
                                        ingredient.suggestions.length > 0 && (
                                          <Select
                                            value={ingredient.selectedProductId}
                                            onValueChange={(value) =>
                                              updateSelectedProduct(
                                                recipeIndex,
                                                ingredientIndex,
                                                value
                                              )
                                            }
                                          >
                                            <SelectTrigger className="w-full">
                                              <SelectValue placeholder="Wybierz produkt" />
                                            </SelectTrigger>
                                            <SelectContent>
                                              {ingredient.suggestions.map((product) => (
                                                <SelectItem
                                                  key={product.id}
                                                  value={product.id}
                                                >
                                                  {product.name} ({product.unit})
                                                </SelectItem>
                                              ))}
                                            </SelectContent>
                                          </Select>
                                        )}

                                      {/* Dane nowego produktu */}
                                      {ingredient.action === 'create_new' && (
                                        <div className="grid grid-cols-2 gap-2">
                                          <div>
                                            <Label className="text-xs">Nazwa produktu</Label>
                                            <Input
                                              value={ingredient.newProductName}
                                              onChange={(e) =>
                                                updateNewProductData(
                                                  recipeIndex,
                                                  ingredientIndex,
                                                  'name',
                                                  e.target.value
                                                )
                                              }
                                              className="mt-1"
                                            />
                                          </div>
                                          <div>
                                            <Label className="text-xs">Jednostka</Label>
                                            <Select
                                              value={ingredient.newProductUnit}
                                              onValueChange={(value) =>
                                                updateNewProductData(
                                                  recipeIndex,
                                                  ingredientIndex,
                                                  'unit',
                                                  value
                                                )
                                              }
                                            >
                                              <SelectTrigger className="mt-1">
                                                <SelectValue />
                                              </SelectTrigger>
                                              <SelectContent>
                                                <SelectItem value="g">g</SelectItem>
                                                <SelectItem value="kg">kg</SelectItem>
                                                <SelectItem value="ml">ml</SelectItem>
                                                <SelectItem value="l">l</SelectItem>
                                                <SelectItem value="szt">szt</SelectItem>
                                              </SelectContent>
                                            </Select>
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* Przycisk importu */}
                <Button
                  onClick={handleImport}
                  disabled={importing}
                  className="w-full"
                  size="lg"
                >
                  {importing ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Importuję receptury...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="mr-2 h-4 w-4" />
                      Importuj {recipes.length} receptur
                    </>
                  )}
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
