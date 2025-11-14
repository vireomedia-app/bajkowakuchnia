'use client';

import { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { DndContext, DragEndEvent, DragOverlay, DragStartEvent, useSensor, useSensors, PointerSensor, useDroppable, useDraggable } from '@dnd-kit/core';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { NutritionalGuidelines } from '@/components/nutritional-guidelines';
import { CalendarDays, ChefHat, AlertCircle, Download, Search, Plus, Trash2, CheckCircle, XCircle, Edit, CalendarIcon } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { pl } from 'date-fns/locale';
import { calculateDailyNutrition, validateDailyNutrition, DAY_OF_WEEK_LABELS, MEAL_TYPE_LABELS } from '@/lib/meal-plan-utils';
import type { MealPlan, Recipe, MealType, Season } from '@/lib/types';
import { cn } from '@/lib/utils';

interface MealPlanEditorProps {
  mealPlan: any;
  availableRecipes: any[];
}

interface DraggableRecipe {
  recipe: any;
  fromMealId?: string;
  mealPlanRecipeId?: string;
}

export function MealPlanEditor({ mealPlan: initialMealPlan, availableRecipes }: MealPlanEditorProps) {
  const router = useRouter();
  const [mealPlan, setMealPlan] = useState(initialMealPlan);
  const [selectedDay, setSelectedDay] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeRecipe, setActiveRecipe] = useState<DraggableRecipe | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [appSettings, setAppSettings] = useState<any>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editFormData, setEditFormData] = useState({
    name: initialMealPlan.name,
    startDate: initialMealPlan.startDate ? new Date(initialMealPlan.startDate) : undefined as Date | undefined,
    endDate: initialMealPlan.endDate ? new Date(initialMealPlan.endDate) : undefined as Date | undefined,
    season: initialMealPlan.season as Season | '',
    description: initialMealPlan.description || '',
  });

  // Pobierz ustawienia aplikacji
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const response = await fetch('/api/settings');
        if (response.ok) {
          const data = await response.json();
          setAppSettings(data);
        }
      } catch (error) {
        console.error('Error fetching settings:', error);
      }
    };
    fetchSettings();
  }, []);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const filteredRecipes = useMemo(() => {
    if (!searchQuery.trim()) return availableRecipes;
    const query = searchQuery.toLowerCase();
    return availableRecipes.filter(recipe =>
      recipe.name.toLowerCase().includes(query)
    );
  }, [searchQuery, availableRecipes]);

  // Group recipes by categories
  const groupedRecipes = useMemo(() => {
    const groups: Record<string, any[]> = {
      'BREAKFAST': [],
      'SECOND_BREAKFAST': [],
      'LUNCH': [],
      'FIRST_SNACK': [],
      'SECOND_SNACK': [],
      'UNCATEGORIZED': []
    };

    filteredRecipes.forEach(recipe => {
      if (recipe.categories && recipe.categories.length > 0) {
        recipe.categories.forEach((category: string) => {
          if (groups[category]) {
            // Avoid duplicates
            if (!groups[category].find((r: any) => r.id === recipe.id)) {
              groups[category].push(recipe);
            }
          }
        });
      } else {
        groups['UNCATEGORIZED'].push(recipe);
      }
    });

    return groups;
  }, [filteredRecipes]);

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const data = active.data.current as DraggableRecipe;
    setActiveRecipe(data);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveRecipe(null);

    if (!over) return;

    const draggedData = active.data.current as DraggableRecipe;
    const targetMealId = over.id as string;

    // If dragging from the same meal, ignore
    if (draggedData.fromMealId === targetMealId) return;

    try {
      // Add recipe to meal
      const response = await fetch(
        `/api/meal-plans/${mealPlan.id}/meals/${targetMealId}/recipes`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            recipeId: draggedData.recipe.id,
            servings: 1,
          }),
        }
      );

      if (!response.ok) {
        throw new Error('Failed to add recipe to meal');
      }

      const newRecipe = await response.json();

      // Update local state
      setMealPlan((prev: any) => {
        const updatedDays = prev.days.map((day: any) => ({
          ...day,
          meals: day.meals.map((meal: any) => {
            // Add recipe to target meal
            if (meal.id === targetMealId) {
              return {
                ...meal,
                recipes: [...meal.recipes, newRecipe],
              };
            }
            // Remove recipe from source meal if dragged from another meal
            if (draggedData.fromMealId && meal.id === draggedData.fromMealId) {
              return {
                ...meal,
                recipes: meal.recipes.filter(
                  (r: any) => r.id !== draggedData.mealPlanRecipeId
                ),
              };
            }
            return meal;
          }),
        }));

        return { ...prev, days: updatedDays };
      });

      // If dragged from another meal, remove it from source
      if (draggedData.fromMealId && draggedData.mealPlanRecipeId) {
        await fetch(
          `/api/meal-plans/${mealPlan.id}/meals/${draggedData.fromMealId}/recipes/${draggedData.mealPlanRecipeId}`,
          { method: 'DELETE' }
        );
      }

      toast.success('Receptura została dodana');
    } catch (error) {
      console.error('Error adding recipe:', error);
      toast.error('Błąd podczas dodawania receptury');
    }
  };

  const handleRemoveRecipe = async (mealId: string, recipeId: string) => {
    try {
      const response = await fetch(
        `/api/meal-plans/${mealPlan.id}/meals/${mealId}/recipes/${recipeId}`,
        { method: 'DELETE' }
      );

      if (!response.ok) {
        throw new Error('Failed to remove recipe');
      }

      // Update local state
      setMealPlan((prev: any) => {
        const updatedDays = prev.days.map((day: any) => ({
          ...day,
          meals: day.meals.map((meal: any) => {
            if (meal.id === mealId) {
              return {
                ...meal,
                recipes: meal.recipes.filter((r: any) => r.id !== recipeId),
              };
            }
            return meal;
          }),
        }));

        return { ...prev, days: updatedDays };
      });

      toast.success('Receptura została usunięta');
    } catch (error) {
      console.error('Error removing recipe:', error);
      toast.error('Błąd podczas usuwania receptury');
    }
  };

  const currentDay = mealPlan.days.find((day: any) => day.dayOfWeek === selectedDay);
  
  // Pobierz listę posiłków do uwzględnienia w obliczeniach (domyślnie wszystkie podstawowe)
  const includeInCalories = appSettings?.includeInCalories || ['BREAKFAST', 'SECOND_BREAKFAST', 'LUNCH', 'FIRST_SNACK'];
  
  // Oblicz wartości odżywcze TYLKO dla posiłków zaznaczonych w includeInCalories
  const dailyNutrition = currentDay ? calculateDailyNutrition(currentDay, includeInCalories) : null;
  const validation = currentDay && mealPlan.standards && dailyNutrition
    ? validateDailyNutrition(dailyNutrition, mealPlan.standards)
    : null;

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const response = await fetch(`/api/meal-plans/${mealPlan.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: mealPlan.name,
          weekNumber: mealPlan.weekNumber,
          startDate: mealPlan.startDate,
          endDate: mealPlan.endDate,
          season: mealPlan.season,
          description: mealPlan.description,
          standardsId: mealPlan.standardsId,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to save meal plan');
      }

      toast.success('Jadłospis został zapisany');
    } catch (error) {
      console.error('Error saving meal plan:', error);
      toast.error('Błąd podczas zapisywania jadłospisu');
    } finally {
      setIsSaving(false);
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!editFormData.name.trim()) {
      toast.error('Podaj nazwę jadłospisu');
      return;
    }

    try {
      const response = await fetch(`/api/meal-plans/${mealPlan.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: editFormData.name.trim(),
          startDate: editFormData.startDate ? editFormData.startDate.toISOString() : null,
          endDate: editFormData.endDate ? editFormData.endDate.toISOString() : null,
          season: editFormData.season || null,
          description: editFormData.description.trim() || null,
          standardsId: mealPlan.standardsId,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to update meal plan');
      }

      const updatedMealPlan = await response.json();
      setMealPlan(updatedMealPlan);
      setEditFormData({
        name: updatedMealPlan.name,
        startDate: updatedMealPlan.startDate ? new Date(updatedMealPlan.startDate) : undefined,
        endDate: updatedMealPlan.endDate ? new Date(updatedMealPlan.endDate) : undefined,
        season: updatedMealPlan.season || '',
        description: updatedMealPlan.description || '',
      });
      setIsEditDialogOpen(false);
      toast.success('Podstawowe informacje zostały zaktualizowane');
      router.refresh();
    } catch (error) {
      console.error('Error updating meal plan:', error);
      toast.error('Błąd podczas aktualizacji jadłospisu');
    }
  };

  const handleExport = async () => {
    try {
      toast.info('Eksportuję jadłospis...');
      
      const response = await fetch(`/api/meal-plans/${mealPlan.id}/export`);
      
      if (!response.ok) {
        throw new Error('Failed to export meal plan');
      }
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Jadlospis_${mealPlan.name.replace(/\s+/g, '_')}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      
      toast.success('Jadłospis został wyeksportowany');
    } catch (error) {
      console.error('Error exporting meal plan:', error);
      toast.error('Błąd podczas eksportowania jadłospisu');
    }
  };

  const handleExportForParents = async () => {
    try {
      toast.info('Eksportuję jadłospis dla rodziców...');
      
      const response = await fetch(`/api/meal-plans/${mealPlan.id}/export-for-parents`);
      
      if (!response.ok) {
        throw new Error('Failed to export meal plan for parents');
      }
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Jadlospis_dla_rodzicow_${mealPlan.name.replace(/\s+/g, '_')}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      
      toast.success('Jadłospis dla rodziców został wyeksportowany');
    } catch (error) {
      console.error('Error exporting meal plan for parents:', error);
      toast.error('Błąd podczas eksportowania jadłospisu dla rodziców');
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      const response = await fetch(`/api/meal-plans/${mealPlan.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete meal plan');
      }

      toast.success('Jadłospis został usunięty');
      router.push('/menu/meal-plans');
    } catch (error) {
      console.error('Error deleting meal plan:', error);
      toast.error('Błąd podczas usuwania jadłospisu');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Wytyczne żywieniowe */}
      {appSettings?.nutritionalGuidelines && (
        <NutritionalGuidelines guidelines={appSettings.nutritionalGuidelines} />
      )}
      
      {/* Header */}
      <Card>
        <CardHeader className="p-4 lg:p-6">
          <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-3 lg:gap-0">
            <div className="flex-1 min-w-0">
              <CardTitle className="text-lg lg:text-2xl flex items-center gap-2">
                <CalendarDays className="w-5 h-5 lg:w-6 lg:h-6 flex-shrink-0" />
                <span className="truncate">{mealPlan.name}</span>
              </CardTitle>
              {mealPlan.description && (
                <CardDescription className="mt-2 text-sm">{mealPlan.description}</CardDescription>
              )}
              <div className="flex gap-2 lg:gap-3 mt-2 lg:mt-3 flex-wrap">
                {(mealPlan.startDate && mealPlan.endDate) && (
                  <Badge variant="outline" className="text-xs">
                    {new Date(mealPlan.startDate).toLocaleDateString('pl-PL')} - {new Date(mealPlan.endDate).toLocaleDateString('pl-PL')}
                  </Badge>
                )}
                {mealPlan.season && (
                  <Badge variant="outline" className="text-xs">
                    {mealPlan.season === 'SPRING' ? 'Wiosna' :
                     mealPlan.season === 'SUMMER' ? 'Lato' :
                     mealPlan.season === 'AUTUMN' ? 'Jesień' : 'Zima'}
                  </Badge>
                )}
              </div>
            </div>
            <div className="flex gap-2 flex-wrap lg:flex-nowrap lg:ml-4">
              <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
                <DialogTrigger asChild>
                  <Button 
                    variant="outline" 
                    className="gap-1 lg:gap-2 text-xs lg:text-sm h-8 lg:h-10 px-2 lg:px-4"
                  >
                    <Edit className="w-3 h-3 lg:w-4 lg:h-4" />
                    <span className="hidden sm:inline">Edytuj</span>
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                  <form onSubmit={handleEditSubmit}>
                    <DialogHeader>
                      <DialogTitle>Edytuj podstawowe informacje</DialogTitle>
                      <DialogDescription>
                        Zmień nazwę, zakres dat, sezon lub opis jadłospisu
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div>
                        <Label htmlFor="edit-name">Nazwa jadłospisu *</Label>
                        <Input
                          id="edit-name"
                          value={editFormData.name}
                          onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                          placeholder="Np. Tydzień 4 - Wiosna/Lato"
                          required
                        />
                      </div>

                      <div>
                        <Label>Zakres dat</Label>
                        <div className="grid grid-cols-2 gap-4 mt-2">
                          <div>
                            <Label htmlFor="edit-startDate" className="text-sm text-muted-foreground">Data rozpoczęcia</Label>
                            <Popover>
                              <PopoverTrigger asChild>
                                <Button
                                  id="edit-startDate"
                                  type="button"
                                  variant="outline"
                                  className={cn(
                                    "w-full justify-start text-left font-normal",
                                    !editFormData.startDate && "text-muted-foreground"
                                  )}
                                >
                                  <CalendarIcon className="mr-2 h-4 w-4" />
                                  {editFormData.startDate ? format(editFormData.startDate, "PPP", { locale: pl }) : "Wybierz datę"}
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent className="w-auto p-0" align="start">
                                <Calendar
                                  mode="single"
                                  selected={editFormData.startDate}
                                  onSelect={(date) => setEditFormData({ ...editFormData, startDate: date })}
                                  locale={pl}
                                  initialFocus
                                />
                              </PopoverContent>
                            </Popover>
                          </div>
                          <div>
                            <Label htmlFor="edit-endDate" className="text-sm text-muted-foreground">Data zakończenia</Label>
                            <Popover>
                              <PopoverTrigger asChild>
                                <Button
                                  id="edit-endDate"
                                  type="button"
                                  variant="outline"
                                  className={cn(
                                    "w-full justify-start text-left font-normal",
                                    !editFormData.endDate && "text-muted-foreground"
                                  )}
                                >
                                  <CalendarIcon className="mr-2 h-4 w-4" />
                                  {editFormData.endDate ? format(editFormData.endDate, "PPP", { locale: pl }) : "Wybierz datę"}
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent className="w-auto p-0" align="start">
                                <Calendar
                                  mode="single"
                                  selected={editFormData.endDate}
                                  onSelect={(date) => setEditFormData({ ...editFormData, endDate: date })}
                                  locale={pl}
                                  disabled={(date) => editFormData.startDate ? date < editFormData.startDate : false}
                                  initialFocus
                                />
                              </PopoverContent>
                            </Popover>
                          </div>
                        </div>
                      </div>

                      <div>
                        <Label htmlFor="edit-season">Sezon</Label>
                        <Select
                          value={editFormData.season}
                          onValueChange={(value) => setEditFormData({ ...editFormData, season: value as Season })}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Wybierz sezon" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="SPRING">Wiosna</SelectItem>
                            <SelectItem value="SUMMER">Lato</SelectItem>
                            <SelectItem value="AUTUMN">Jesień</SelectItem>
                            <SelectItem value="WINTER">Zima</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div>
                        <Label htmlFor="edit-description">Opis (opcjonalnie)</Label>
                        <Textarea
                          id="edit-description"
                          value={editFormData.description}
                          onChange={(e) => setEditFormData({ ...editFormData, description: e.target.value })}
                          placeholder="Dodatkowe informacje o jadłospisie"
                          rows={3}
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button type="button" variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                        Anuluj
                      </Button>
                      <Button type="submit">
                        Zapisz zmiany
                      </Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
              <Button 
                variant="default" 
                className="gap-1 lg:gap-2 text-xs lg:text-sm h-8 lg:h-10 px-2 lg:px-4"
                onClick={handleSave}
                disabled={isSaving}
              >
                {isSaving ? 'Zapisywanie...' : 'Zapisz'}
              </Button>
              <Button 
                variant="outline" 
                className="gap-1 lg:gap-2 text-xs lg:text-sm h-8 lg:h-10 px-2 lg:px-4"
                onClick={handleExport}
              >
                <Download className="w-3 h-3 lg:w-4 lg:h-4" />
                <span className="hidden sm:inline">Eksport</span>
              </Button>
              <Button 
                variant="outline" 
                className="gap-1 lg:gap-2 text-xs lg:text-sm h-8 lg:h-10 px-2 lg:px-4"
                onClick={handleExportForParents}
              >
                <Download className="w-3 h-3 lg:w-4 lg:h-4" />
                <span className="hidden sm:inline">Dla rodziców</span>
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button 
                    variant="destructive" 
                    className="gap-1 lg:gap-2 text-xs lg:text-sm h-8 lg:h-10 px-2 lg:px-4"
                    disabled={isDeleting}
                  >
                    <Trash2 className="w-3 h-3 lg:w-4 lg:h-4" />
                    <span className="hidden sm:inline">Usuń</span>
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Czy na pewno chcesz usunąć ten jadłospis?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Ta operacja jest nieodwracalna. Jadłospis &quot;{mealPlan.name}&quot; oraz wszystkie
                      powiązane posiłki i receptury zostaną trwale usunięte.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Anuluj</AlertDialogCancel>
                    <AlertDialogAction 
                      onClick={handleDelete}
                      className="bg-red-600 hover:bg-red-700"
                    >
                      {isDeleting ? 'Usuwanie...' : 'Usuń jadłospis'}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        </CardHeader>
      </Card>

      <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div className="flex gap-2 lg:gap-6">
          {/* Recipe Library - Zawsze widoczna, 50% na mobile, 25% na desktop */}
          <Card className="w-1/2 lg:w-1/4 sticky top-6 self-start flex-shrink-0">
            <CardHeader className="p-3 lg:p-6">
              <CardTitle className="flex items-center gap-2 text-sm lg:text-lg">
                <ChefHat className="w-4 h-4 lg:w-5 lg:h-5" />
                <span className="hidden sm:inline">Receptury</span>
              </CardTitle>
              <div className="relative mt-2">
                <Search className="absolute left-2 lg:left-3 top-1/2 transform -translate-y-1/2 w-3 h-3 lg:w-4 lg:h-4 text-gray-400" />
                <Input
                  placeholder="Szukaj..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-7 lg:pl-9 text-xs lg:text-sm h-8 lg:h-10"
                />
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="h-[calc(100vh-160px)] lg:h-[calc(100vh-220px)]">
                <div className="p-2 lg:p-4 space-y-2 lg:space-y-4">
                  {/* Śniadanie */}
                  {groupedRecipes.BREAKFAST.length > 0 && (
                    <div>
                      <h4 className="text-[10px] lg:text-xs font-semibold text-gray-600 mb-1 lg:mb-2 px-1 lg:px-2 uppercase tracking-wider">
                        Śniadanie
                      </h4>
                      <div className="space-y-1 lg:space-y-2">
                        {groupedRecipes.BREAKFAST.map((recipe) => (
                          <RecipeCard key={recipe.id} recipe={recipe} />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Drugie śniadanie */}
                  {groupedRecipes.SECOND_BREAKFAST.length > 0 && (
                    <div>
                      <h4 className="text-[10px] lg:text-xs font-semibold text-gray-600 mb-1 lg:mb-2 px-1 lg:px-2 uppercase tracking-wider">
                        Drugie śniadanie
                      </h4>
                      <div className="space-y-1 lg:space-y-2">
                        {groupedRecipes.SECOND_BREAKFAST.map((recipe) => (
                          <RecipeCard key={recipe.id} recipe={recipe} />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Obiad */}
                  {groupedRecipes.LUNCH.length > 0 && (
                    <div>
                      <h4 className="text-[10px] lg:text-xs font-semibold text-gray-600 mb-1 lg:mb-2 px-1 lg:px-2 uppercase tracking-wider">
                        Obiad
                      </h4>
                      <div className="space-y-1 lg:space-y-2">
                        {groupedRecipes.LUNCH.map((recipe) => (
                          <RecipeCard key={recipe.id} recipe={recipe} />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Podwieczorek pierwszy */}
                  {groupedRecipes.FIRST_SNACK.length > 0 && (
                    <div>
                      <h4 className="text-[10px] lg:text-xs font-semibold text-gray-600 mb-1 lg:mb-2 px-1 lg:px-2 uppercase tracking-wider">
                        Podwieczorek I
                      </h4>
                      <div className="space-y-1 lg:space-y-2">
                        {groupedRecipes.FIRST_SNACK.map((recipe) => (
                          <RecipeCard key={recipe.id} recipe={recipe} />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Podwieczorek drugi */}
                  {groupedRecipes.SECOND_SNACK.length > 0 && (
                    <div>
                      <h4 className="text-[10px] lg:text-xs font-semibold text-gray-600 mb-1 lg:mb-2 px-1 lg:px-2 uppercase tracking-wider">
                        Podwieczorek II
                      </h4>
                      <div className="space-y-1 lg:space-y-2">
                        {groupedRecipes.SECOND_SNACK.map((recipe) => (
                          <RecipeCard key={recipe.id} recipe={recipe} />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Bez kategorii */}
                  {groupedRecipes.UNCATEGORIZED.length > 0 && (
                    <div>
                      <h4 className="text-[10px] lg:text-xs font-semibold text-gray-600 mb-1 lg:mb-2 px-1 lg:px-2 uppercase tracking-wider">
                        Bez kategorii
                      </h4>
                      <div className="space-y-1 lg:space-y-2">
                        {groupedRecipes.UNCATEGORIZED.map((recipe) => (
                          <RecipeCard key={recipe.id} recipe={recipe} />
                        ))}
                      </div>
                    </div>
                  )}

                  {filteredRecipes.length === 0 && (
                    <div className="text-center py-4 lg:py-8 text-gray-500 text-[10px] lg:text-sm">
                      Brak receptur
                    </div>
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>

          {/* Meal Plan Editor - 50% na mobile, 75% na desktop */}
          <div className="w-1/2 lg:w-3/4 space-y-3 lg:space-y-6 flex-shrink-0">
            {/* Day Selector - tylko poniedziałek-piątek */}
            <Card>
              <CardHeader className="p-3 lg:pb-3 lg:p-6">
                <CardTitle className="text-sm lg:text-lg">Wybierz dzień</CardTitle>
              </CardHeader>
              <CardContent className="p-3 lg:p-6 pt-0">
                <div className="grid grid-cols-5 gap-1 lg:gap-2">
                  {[1, 2, 3, 4, 5].map((day) => (
                    <Button
                      key={day}
                      variant={selectedDay === day ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setSelectedDay(day)}
                      className="text-[10px] lg:text-xs h-8 lg:h-9 px-1 lg:px-3"
                    >
                      {DAY_OF_WEEK_LABELS[day]}
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Validation Card */}
            {validation && mealPlan.standards && dailyNutrition && (
              <Card className={cn(
                "border-2",
                validation.energy.isValid && validation.proteinPercent.isValid && 
                validation.fatPercent.isValid && validation.carbohydratesPercent.isValid &&
                validation.calcium.isValid && validation.iron.isValid && validation.vitaminC.isValid
                  ? "border-green-500 bg-green-50"
                  : "border-amber-500 bg-amber-50"
              )}>
                <CardHeader className="p-3 lg:pb-3 lg:p-6">
                  <CardTitle className="text-xs lg:text-base flex items-center gap-1 lg:gap-2">
                    {validation.energy.isValid && validation.proteinPercent.isValid && 
                     validation.fatPercent.isValid && validation.carbohydratesPercent.isValid &&
                     validation.calcium.isValid && validation.iron.isValid && validation.vitaminC.isValid ? (
                      <>
                        <CheckCircle className="w-4 h-4 lg:w-5 lg:h-5 text-green-600 flex-shrink-0" />
                        <span className="text-green-900">Dzień spełnia normy</span>
                      </>
                    ) : (
                      <>
                        <AlertCircle className="w-4 h-4 lg:w-5 lg:h-5 text-amber-600 flex-shrink-0" />
                        <span className="text-amber-900">Uwaga: wartości poza normą</span>
                      </>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 lg:space-y-4 p-3 lg:p-6 pt-0">
                  {/* Makroskładniki */}
                  <div>
                    <h4 className="text-[10px] lg:text-sm font-semibold text-gray-700 mb-1 lg:mb-2">Makroskładniki</h4>
                    <div className="grid grid-cols-2 gap-1 lg:gap-3 text-sm">
                      <ValidationItem
                        label="Energia"
                        value={Math.round(validation.energy.value)}
                        unit="kcal"
                        min={validation.energy.min}
                        max={validation.energy.max}
                        isValid={validation.energy.isValid}
                      />
                      <ValidationItem
                        label="Białko"
                        value={validation.proteinPercent.value.toFixed(1)}
                        unit="%"
                        min={validation.proteinPercent.min}
                        max={validation.proteinPercent.max}
                        isValid={validation.proteinPercent.isValid}
                        subtitle={`${dailyNutrition.protein.toFixed(1)}g`}
                      />
                      <ValidationItem
                        label="Tłuszcz"
                        value={validation.fatPercent.value.toFixed(1)}
                        unit="%"
                        min={validation.fatPercent.min}
                        max={validation.fatPercent.max}
                        isValid={validation.fatPercent.isValid}
                        subtitle={`${dailyNutrition.fat.toFixed(1)}g`}
                      />
                      <ValidationItem
                        label="Węglowodany"
                        value={validation.carbohydratesPercent.value.toFixed(1)}
                        unit="%"
                        min={validation.carbohydratesPercent.min}
                        max={validation.carbohydratesPercent.max}
                        isValid={validation.carbohydratesPercent.isValid}
                        subtitle={`${dailyNutrition.carbohydrates.toFixed(1)}g`}
                      />
                    </div>
                  </div>

                  {/* Witaminy i minerały */}
                  <div>
                    <h4 className="text-[10px] lg:text-sm font-semibold text-gray-700 mb-1 lg:mb-2">Witaminy i minerały</h4>
                    <div className="grid grid-cols-3 gap-1 lg:gap-3 text-sm">
                      <ValidationItemMineral
                        label="Wapń"
                        value={validation.calcium.value.toFixed(1)}
                        unit="mg"
                        target={validation.calcium.target}
                        isValid={validation.calcium.isValid}
                      />
                      <ValidationItemMineral
                        label="Żelazo"
                        value={validation.iron.value.toFixed(1)}
                        unit="mg"
                        target={validation.iron.target}
                        isValid={validation.iron.isValid}
                      />
                      <ValidationItemMineral
                        label="Witamina C"
                        value={validation.vitaminC.value.toFixed(1)}
                        unit="mg"
                        target={validation.vitaminC.target}
                        isValid={validation.vitaminC.isValid}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Meals */}
            {currentDay && (
              <div className="space-y-4">
                {currentDay.meals.map((meal: any) => (
                  <MealSlot
                    key={meal.id}
                    meal={meal}
                    onRemoveRecipe={handleRemoveRecipe}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        <DragOverlay>
          {activeRecipe ? (
            <div className="p-3 bg-white border-2 border-blue-500 rounded-lg shadow-lg">
              <div className="font-medium text-sm">{activeRecipe.recipe.name}</div>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}

function RecipeCard({ recipe }: { recipe: any }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `recipe-${recipe.id}`,
    data: { recipe },
  });

  // Oblicz wartości na 1 porcję
  const servings = recipe.servings > 0 ? recipe.servings : 1;
  const nutritionPerServing = recipe.nutrition ? {
    calories: Math.round(recipe.nutrition.calories / servings),
    protein: (recipe.nutrition.protein / servings).toFixed(1),
    fat: (recipe.nutrition.fat / servings).toFixed(1),
    carbohydrates: (recipe.nutrition.carbohydrates / servings).toFixed(1),
    calcium: (recipe.nutrition.calcium / servings).toFixed(1),
    iron: (recipe.nutrition.iron / servings).toFixed(2),
    vitaminC: (recipe.nutrition.vitaminC / servings).toFixed(1),
  } : null;

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={cn(
        "p-2 lg:p-3 bg-white border border-gray-200 rounded-lg cursor-move hover:border-blue-500 hover:shadow-md transition-all",
        isDragging && "opacity-50"
      )}
    >
      <div className="font-medium text-[10px] lg:text-sm text-gray-900 mb-1 lg:mb-2 leading-tight">{recipe.name}</div>
      <div className="text-[9px] lg:text-xs text-gray-500 mb-1 lg:mb-2">
        {recipe.servings} {recipe.servings === 1 ? 'porcja' : 'porcje'}
      </div>
      
      {nutritionPerServing && (
        <div className="space-y-0.5 lg:space-y-1.5 pt-1 lg:pt-2 border-t border-gray-100">
          {/* Kalorie */}
          <div className="flex items-center justify-between text-[9px] lg:text-xs">
            <span className="text-gray-600">Energia:</span>
            <span className="font-semibold text-blue-600">{nutritionPerServing.calories} kcal</span>
          </div>
          
          {/* Makroskładniki */}
          <div className="flex items-center justify-between text-[9px] lg:text-xs">
            <span className="text-gray-600">Białko:</span>
            <span className="font-medium text-gray-800">{nutritionPerServing.protein} g</span>
          </div>
          <div className="flex items-center justify-between text-[9px] lg:text-xs">
            <span className="text-gray-600">Tłuszcze:</span>
            <span className="font-medium text-gray-800">{nutritionPerServing.fat} g</span>
          </div>
          <div className="flex items-center justify-between text-[9px] lg:text-xs">
            <span className="text-gray-600">Węglow.:</span>
            <span className="font-medium text-gray-800">{nutritionPerServing.carbohydrates} g</span>
          </div>
          
          {/* Witaminy i minerały */}
          <div className="flex items-center justify-between text-[9px] lg:text-xs">
            <span className="text-gray-600">Wapń:</span>
            <span className="font-medium text-gray-800">{nutritionPerServing.calcium} mg</span>
          </div>
          <div className="flex items-center justify-between text-[9px] lg:text-xs">
            <span className="text-gray-600">Żelazo:</span>
            <span className="font-medium text-gray-800">{nutritionPerServing.iron} mg</span>
          </div>
          <div className="flex items-center justify-between text-[9px] lg:text-xs">
            <span className="text-gray-600">Wit. C:</span>
            <span className="font-medium text-gray-800">{nutritionPerServing.vitaminC} mg</span>
          </div>
        </div>
      )}
    </div>
  );
}

function ValidationItem({ label, value, unit, min, max, isValid, subtitle }: any) {
  return (
    <div className={cn(
      "p-1.5 lg:p-2 rounded-lg",
      isValid ? "bg-green-100" : "bg-red-100"
    )}>
      <div className="text-[9px] lg:text-xs text-gray-600">{label}</div>
      <div className={cn(
        "font-bold text-[10px] lg:text-sm",
        isValid ? "text-green-900" : "text-red-900"
      )}>
        {value} {unit}
      </div>
      {subtitle && (
        <div className="text-[9px] lg:text-xs text-gray-700 mt-0.5">
          {subtitle}
        </div>
      )}
      <div className="text-[8px] lg:text-xs text-gray-600 mt-0.5 lg:mt-1">
        {min}-{max}
      </div>
    </div>
  );
}

function ValidationItemMineral({ label, value, unit, target, isValid }: any) {
  const tolerance = 0.1;
  const min = (target * (1 - tolerance)).toFixed(1);
  const max = (target * (1 + tolerance)).toFixed(1);
  
  return (
    <div className={cn(
      "p-1.5 lg:p-2 rounded-lg",
      isValid ? "bg-green-100" : "bg-red-100"
    )}>
      <div className="text-[9px] lg:text-xs text-gray-600">{label}</div>
      <div className={cn(
        "font-bold text-[10px] lg:text-sm",
        isValid ? "text-green-900" : "text-red-900"
      )}>
        {value} {unit}
      </div>
      <div className="text-[8px] lg:text-xs text-gray-600 mt-0.5 lg:mt-1">
        Cel: {target}
      </div>
      <div className="text-[8px] lg:text-xs text-gray-500 hidden lg:block">
        ({min}-{max})
      </div>
    </div>
  );
}

function MealSlot({ meal, onRemoveRecipe }: any) {
  const { setNodeRef, isOver } = useDroppable({
    id: meal.id,
  });

  return (
    <Card>
      <CardHeader className="p-2 lg:pb-3 lg:p-6">
        <CardTitle className="text-xs lg:text-base">{MEAL_TYPE_LABELS[meal.mealType as MealType]}</CardTitle>
      </CardHeader>
      <CardContent className="p-2 lg:p-6 pt-0">
        <div
          ref={setNodeRef}
          className={cn(
            "min-h-[60px] lg:min-h-[100px] p-2 lg:p-4 rounded-lg border-2 border-dashed transition-colors",
            isOver ? "border-blue-500 bg-blue-50" : "border-gray-300 bg-gray-50",
            meal.recipes.length === 0 && "flex items-center justify-center"
          )}
        >
          {meal.recipes.length === 0 ? (
            <div className="text-center text-gray-500 text-[10px] lg:text-sm">
              Przeciągnij recepturę
            </div>
          ) : (
            <div className="space-y-1 lg:space-y-2">
              {meal.recipes.map((mealRecipe: any) => (
                <MealRecipeCard
                  key={mealRecipe.id}
                  mealRecipe={mealRecipe}
                  mealId={meal.id}
                  onRemoveRecipe={onRemoveRecipe}
                />
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function MealRecipeCard({ mealRecipe, mealId, onRemoveRecipe }: any) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `meal-recipe-${mealRecipe.id}`,
    data: {
      recipe: mealRecipe.recipe,
      fromMealId: mealId,
      mealPlanRecipeId: mealRecipe.id,
    },
  });

  // Oblicz wartości na 1 porcję
  const servings = mealRecipe.recipe?.servings > 0 ? mealRecipe.recipe.servings : 1;
  const nutritionPerServing = mealRecipe.recipe?.nutrition ? {
    calories: Math.round(mealRecipe.recipe.nutrition.calories / servings),
    protein: (mealRecipe.recipe.nutrition.protein / servings).toFixed(1),
    fat: (mealRecipe.recipe.nutrition.fat / servings).toFixed(1),
    carbohydrates: (mealRecipe.recipe.nutrition.carbohydrates / servings).toFixed(1),
    calcium: (mealRecipe.recipe.nutrition.calcium / servings).toFixed(1),
    iron: (mealRecipe.recipe.nutrition.iron / servings).toFixed(2),
    vitaminC: (mealRecipe.recipe.nutrition.vitaminC / servings).toFixed(1),
  } : null;

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={cn(
        "flex items-start justify-between p-2 lg:p-3 bg-white border border-gray-200 rounded-lg hover:shadow-md transition-shadow group cursor-move",
        isDragging && "opacity-50"
      )}
    >
      <div className="flex-1 min-w-0">
        <div className="font-medium text-[10px] lg:text-sm text-gray-900 mb-0.5 lg:mb-1 leading-tight">
          {mealRecipe.recipe?.name}
        </div>
        <div className="text-[9px] lg:text-xs text-gray-500 mb-1 lg:mb-2">
          {mealRecipe.servings} {mealRecipe.servings === 1 ? 'porcja' : 'porcje'}
        </div>
        
        {nutritionPerServing && (
          <div className="grid grid-cols-2 gap-x-2 lg:gap-x-3 gap-y-0.5 lg:gap-y-1 text-[9px] lg:text-xs pt-1 lg:pt-2 border-t border-gray-100">
            {/* Kalorie */}
            <div className="flex items-center justify-between col-span-2">
              <span className="text-gray-600">Energia:</span>
              <span className="font-semibold text-blue-600">{nutritionPerServing.calories} kcal</span>
            </div>
            
            {/* Makroskładniki */}
            <div className="flex items-center justify-between">
              <span className="text-gray-600">Białko:</span>
              <span className="font-medium text-gray-800">{nutritionPerServing.protein} g</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-600">Tłuszcze:</span>
              <span className="font-medium text-gray-800">{nutritionPerServing.fat} g</span>
            </div>
            <div className="flex items-center justify-between col-span-2">
              <span className="text-gray-600">Węglow.:</span>
              <span className="font-medium text-gray-800">{nutritionPerServing.carbohydrates} g</span>
            </div>
            
            {/* Witaminy i minerały - ukryte na mobile dla oszczędności miejsca */}
            <div className="hidden lg:flex items-center justify-between">
              <span className="text-gray-600">Wapń:</span>
              <span className="font-medium text-gray-800">{nutritionPerServing.calcium} mg</span>
            </div>
            <div className="hidden lg:flex items-center justify-between">
              <span className="text-gray-600">Żelazo:</span>
              <span className="font-medium text-gray-800">{nutritionPerServing.iron} mg</span>
            </div>
            <div className="hidden lg:flex items-center justify-between col-span-2">
              <span className="text-gray-600">Wit. C:</span>
              <span className="font-medium text-gray-800">{nutritionPerServing.vitaminC} mg</span>
            </div>
          </div>
        )}
      </div>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => onRemoveRecipe(mealId, mealRecipe.id)}
        className="opacity-0 group-hover:opacity-100 lg:opacity-100 transition-opacity ml-1 lg:ml-2 flex-shrink-0 h-6 w-6 lg:h-8 lg:w-8 p-0"
      >
        <Trash2 className="w-3 h-3 lg:w-4 lg:h-4 text-red-600" />
      </Button>
    </div>
  );
}
