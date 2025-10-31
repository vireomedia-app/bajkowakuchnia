'use client';

import { useState, useMemo } from 'react';
import { DndContext, DragEndEvent, DragOverlay, DragStartEvent, useSensor, useSensors, PointerSensor, useDroppable, useDraggable } from '@dnd-kit/core';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import { CalendarDays, ChefHat, AlertCircle, Download, Search, Plus, Trash2, CheckCircle, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { calculateDailyNutrition, validateDailyNutrition, DAY_OF_WEEK_LABELS, MEAL_TYPE_LABELS } from '@/lib/meal-plan-utils';
import type { MealPlan, Recipe, MealType } from '@/lib/types';
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
  const [mealPlan, setMealPlan] = useState(initialMealPlan);
  const [selectedDay, setSelectedDay] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeRecipe, setActiveRecipe] = useState<DraggableRecipe | null>(null);
  const [isSaving, setIsSaving] = useState(false);

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
  const dailyNutrition = currentDay ? calculateDailyNutrition(currentDay) : null;
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="text-2xl flex items-center gap-2">
                <CalendarDays className="w-6 h-6" />
                {mealPlan.name}
              </CardTitle>
              {mealPlan.description && (
                <CardDescription className="mt-2">{mealPlan.description}</CardDescription>
              )}
              <div className="flex gap-3 mt-3">
                {mealPlan.weekNumber && (
                  <Badge variant="outline">Tydzień {mealPlan.weekNumber}</Badge>
                )}
                {mealPlan.season && (
                  <Badge variant="outline">
                    {mealPlan.season === 'SPRING' ? 'Wiosna' :
                     mealPlan.season === 'SUMMER' ? 'Lato' :
                     mealPlan.season === 'AUTUMN' ? 'Jesień' : 'Zima'}
                  </Badge>
                )}
              </div>
            </div>
            <div className="flex gap-2">
              <Button 
                variant="default" 
                className="gap-2"
                onClick={handleSave}
                disabled={isSaving}
              >
                {isSaving ? 'Zapisywanie...' : 'Zapisz jadłospis'}
              </Button>
              <Button 
                variant="outline" 
                className="gap-2"
                onClick={handleExport}
              >
                <Download className="w-4 h-4" />
                Eksport
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Recipe Library */}
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <ChefHat className="w-5 h-5" />
                Receptury
              </CardTitle>
              <div className="relative mt-2">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  placeholder="Szukaj receptury..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="h-[600px]">
                <div className="p-4 space-y-4">
                  {/* Śniadanie */}
                  {groupedRecipes.BREAKFAST.length > 0 && (
                    <div>
                      <h4 className="text-xs font-semibold text-gray-600 mb-2 px-2 uppercase tracking-wider">
                        Śniadanie
                      </h4>
                      <div className="space-y-2">
                        {groupedRecipes.BREAKFAST.map((recipe) => (
                          <RecipeCard key={recipe.id} recipe={recipe} />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Drugie śniadanie */}
                  {groupedRecipes.SECOND_BREAKFAST.length > 0 && (
                    <div>
                      <h4 className="text-xs font-semibold text-gray-600 mb-2 px-2 uppercase tracking-wider">
                        Drugie śniadanie
                      </h4>
                      <div className="space-y-2">
                        {groupedRecipes.SECOND_BREAKFAST.map((recipe) => (
                          <RecipeCard key={recipe.id} recipe={recipe} />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Obiad */}
                  {groupedRecipes.LUNCH.length > 0 && (
                    <div>
                      <h4 className="text-xs font-semibold text-gray-600 mb-2 px-2 uppercase tracking-wider">
                        Obiad
                      </h4>
                      <div className="space-y-2">
                        {groupedRecipes.LUNCH.map((recipe) => (
                          <RecipeCard key={recipe.id} recipe={recipe} />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Podwieczorek pierwszy */}
                  {groupedRecipes.FIRST_SNACK.length > 0 && (
                    <div>
                      <h4 className="text-xs font-semibold text-gray-600 mb-2 px-2 uppercase tracking-wider">
                        Podwieczorek pierwszy
                      </h4>
                      <div className="space-y-2">
                        {groupedRecipes.FIRST_SNACK.map((recipe) => (
                          <RecipeCard key={recipe.id} recipe={recipe} />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Podwieczorek drugi */}
                  {groupedRecipes.SECOND_SNACK.length > 0 && (
                    <div>
                      <h4 className="text-xs font-semibold text-gray-600 mb-2 px-2 uppercase tracking-wider">
                        Podwieczorek drugi
                      </h4>
                      <div className="space-y-2">
                        {groupedRecipes.SECOND_SNACK.map((recipe) => (
                          <RecipeCard key={recipe.id} recipe={recipe} />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Bez kategorii */}
                  {groupedRecipes.UNCATEGORIZED.length > 0 && (
                    <div>
                      <h4 className="text-xs font-semibold text-gray-600 mb-2 px-2 uppercase tracking-wider">
                        Bez kategorii
                      </h4>
                      <div className="space-y-2">
                        {groupedRecipes.UNCATEGORIZED.map((recipe) => (
                          <RecipeCard key={recipe.id} recipe={recipe} />
                        ))}
                      </div>
                    </div>
                  )}

                  {filteredRecipes.length === 0 && (
                    <div className="text-center py-8 text-gray-500 text-sm">
                      Brak receptur
                    </div>
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>

          {/* Meal Plan Editor */}
          <div className="lg:col-span-3 space-y-6">
            {/* Day Selector - tylko poniedziałek-piątek */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Wybierz dzień tygodnia</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-5 gap-2">
                  {[1, 2, 3, 4, 5].map((day) => (
                    <Button
                      key={day}
                      variant={selectedDay === day ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setSelectedDay(day)}
                      className="text-xs"
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
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    {validation.energy.isValid && validation.proteinPercent.isValid && 
                     validation.fatPercent.isValid && validation.carbohydratesPercent.isValid &&
                     validation.calcium.isValid && validation.iron.isValid && validation.vitaminC.isValid ? (
                      <>
                        <CheckCircle className="w-5 h-5 text-green-600" />
                        <span className="text-green-900">Dzień spełnia wszystkie normy żywieniowe</span>
                      </>
                    ) : (
                      <>
                        <AlertCircle className="w-5 h-5 text-amber-600" />
                        <span className="text-amber-900">Uwaga: niektóre wartości poza normą</span>
                      </>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Makroskładniki */}
                  <div>
                    <h4 className="text-sm font-semibold text-gray-700 mb-2">Makroskładniki</h4>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
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
                    <h4 className="text-sm font-semibold text-gray-700 mb-2">Witaminy i minerały</h4>
                    <div className="grid grid-cols-3 gap-3 text-sm">
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
        "p-3 bg-white border border-gray-200 rounded-lg cursor-move hover:border-blue-500 hover:shadow-md transition-all",
        isDragging && "opacity-50"
      )}
    >
      <div className="font-medium text-sm text-gray-900 mb-2">{recipe.name}</div>
      <div className="text-xs text-gray-500 mb-2">
        {recipe.servings} {recipe.servings === 1 ? 'porcja' : 'porcje'}
      </div>
      
      {nutritionPerServing && (
        <div className="space-y-1.5 pt-2 border-t border-gray-100">
          {/* Kalorie */}
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-600">Energia:</span>
            <span className="font-semibold text-blue-600">{nutritionPerServing.calories} kcal</span>
          </div>
          
          {/* Makroskładniki */}
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-600">Białko:</span>
            <span className="font-medium text-gray-800">{nutritionPerServing.protein} g</span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-600">Tłuszcze:</span>
            <span className="font-medium text-gray-800">{nutritionPerServing.fat} g</span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-600">Węglowodany:</span>
            <span className="font-medium text-gray-800">{nutritionPerServing.carbohydrates} g</span>
          </div>
          
          {/* Witaminy i minerały */}
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-600">Wapń:</span>
            <span className="font-medium text-gray-800">{nutritionPerServing.calcium} mg</span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-600">Żelazo:</span>
            <span className="font-medium text-gray-800">{nutritionPerServing.iron} mg</span>
          </div>
          <div className="flex items-center justify-between text-xs">
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
      "p-2 rounded-lg",
      isValid ? "bg-green-100" : "bg-red-100"
    )}>
      <div className="text-xs text-gray-600">{label}</div>
      <div className={cn(
        "font-bold",
        isValid ? "text-green-900" : "text-red-900"
      )}>
        {value} {unit}
      </div>
      {subtitle && (
        <div className="text-xs text-gray-700 mt-0.5">
          {subtitle}
        </div>
      )}
      <div className="text-xs text-gray-600 mt-1">
        Norma: {min}-{max}
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
      "p-2 rounded-lg",
      isValid ? "bg-green-100" : "bg-red-100"
    )}>
      <div className="text-xs text-gray-600">{label}</div>
      <div className={cn(
        "font-bold",
        isValid ? "text-green-900" : "text-red-900"
      )}>
        {value} {unit}
      </div>
      <div className="text-xs text-gray-600 mt-1">
        Cel: {target} {unit}
      </div>
      <div className="text-xs text-gray-500">
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
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{MEAL_TYPE_LABELS[meal.mealType as MealType]}</CardTitle>
      </CardHeader>
      <CardContent>
        <div
          ref={setNodeRef}
          className={cn(
            "min-h-[100px] p-4 rounded-lg border-2 border-dashed transition-colors",
            isOver ? "border-blue-500 bg-blue-50" : "border-gray-300 bg-gray-50",
            meal.recipes.length === 0 && "flex items-center justify-center"
          )}
        >
          {meal.recipes.length === 0 ? (
            <div className="text-center text-gray-500 text-sm">
              Przeciągnij recepturę tutaj
            </div>
          ) : (
            <div className="space-y-2">
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
        "flex items-start justify-between p-3 bg-white border border-gray-200 rounded-lg hover:shadow-md transition-shadow group cursor-move",
        isDragging && "opacity-50"
      )}
    >
      <div className="flex-1 min-w-0">
        <div className="font-medium text-gray-900 mb-1">
          {mealRecipe.recipe?.name}
        </div>
        <div className="text-xs text-gray-500 mb-2">
          {mealRecipe.servings} {mealRecipe.servings === 1 ? 'porcja' : 'porcje'}
        </div>
        
        {nutritionPerServing && (
          <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs pt-2 border-t border-gray-100">
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
              <span className="text-gray-600">Węglowodany:</span>
              <span className="font-medium text-gray-800">{nutritionPerServing.carbohydrates} g</span>
            </div>
            
            {/* Witaminy i minerały */}
            <div className="flex items-center justify-between">
              <span className="text-gray-600">Wapń:</span>
              <span className="font-medium text-gray-800">{nutritionPerServing.calcium} mg</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-600">Żelazo:</span>
              <span className="font-medium text-gray-800">{nutritionPerServing.iron} mg</span>
            </div>
            <div className="flex items-center justify-between col-span-2">
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
        className="opacity-0 group-hover:opacity-100 transition-opacity ml-2 flex-shrink-0"
      >
        <Trash2 className="w-4 h-4 text-red-600" />
      </Button>
    </div>
  );
}
