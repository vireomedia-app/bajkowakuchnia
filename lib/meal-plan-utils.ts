import type { 
  MealPlan, 
  MealPlanDay, 
  DailyNutrition, 
  NutritionalStandards,
  NutritionalValidation,
  RecipeWithNutrition,
  RecipeIngredient,
  MealType
} from './types';

// Stałe dla wyświetlania
export const MEAL_TYPE_LABELS: Record<MealType, string> = {
  BREAKFAST: 'Śniadanie',
  SECOND_BREAKFAST: 'II Śniadanie',
  LUNCH: 'Obiad',
  FIRST_SNACK: 'Podwieczorek I',
  SECOND_SNACK: 'Podwieczorek II',
  DINNER: 'Kolacja',
  OTHER: 'Inne',
};

export const DAY_OF_WEEK_LABELS: Record<number, string> = {
  1: 'Poniedziałek',
  2: 'Wtorek',
  3: 'Środa',
  4: 'Czwartek',
  5: 'Piątek',
  6: 'Sobota',
  7: 'Niedziela',
};

export const SEASON_LABELS: Record<string, string> = {
  SPRING: 'Wiosna',
  SUMMER: 'Lato',
  AUTUMN: 'Jesień',
  WINTER: 'Zima',
};

// Oblicz wartości odżywcze dla receptury
export function calculateRecipeNutrition(
  ingredients: RecipeIngredient[]
): DailyNutrition {
  const nutrition: DailyNutrition = {
    calories: 0,
    protein: 0,
    fat: 0,
    saturatedFat: 0,
    carbohydrates: 0,
    sugars: 0,
    salt: 0,
    calcium: 0,
    iron: 0,
    vitaminC: 0,
  };

  for (const ingredient of ingredients) {
    if (!ingredient.product) continue;

    // Przelicz gramaturę składnika z jednostki na gramy
    let quantityInGrams = ingredient.quantity;
    if (ingredient.unit === 'kg') {
      quantityInGrams = ingredient.quantity * 1000;
    } else if (ingredient.unit === 'l' || ingredient.unit === 'ml') {
      // Zakładamy, że 1ml = 1g (dla płynów)
      quantityInGrams = ingredient.unit === 'l' 
        ? ingredient.quantity * 1000 
        : ingredient.quantity;
    }
    // Dla jednostek "szt", "opak" nie przeliczamy

    // Wszystkie wartości odżywcze w produkcie są na 100g
    const factor = quantityInGrams / 100;

    nutrition.calories += (ingredient.product.calories || 0) * factor;
    nutrition.protein += (ingredient.product.protein || 0) * factor;
    nutrition.fat += (ingredient.product.fat || 0) * factor;
    nutrition.saturatedFat += (ingredient.product.saturatedFat || 0) * factor;
    nutrition.carbohydrates += (ingredient.product.carbohydrates || 0) * factor;
    nutrition.sugars += (ingredient.product.sugars || 0) * factor;
    nutrition.salt += (ingredient.product.salt || 0) * factor;
    nutrition.calcium += (ingredient.product.calcium || 0) * factor;
    nutrition.iron += (ingredient.product.iron || 0) * factor;
    nutrition.vitaminC += (ingredient.product.vitaminC || 0) * factor;
  }

  return nutrition;
}

// Oblicz wartości odżywcze dla dnia
export function calculateDailyNutrition(day: MealPlanDay): DailyNutrition {
  const nutrition: DailyNutrition = {
    calories: 0,
    protein: 0,
    fat: 0,
    saturatedFat: 0,
    carbohydrates: 0,
    sugars: 0,
    salt: 0,
    calcium: 0,
    iron: 0,
    vitaminC: 0,
  };

  for (const meal of day.meals) {
    for (const mealPlanRecipe of meal.recipes) {
      if (!mealPlanRecipe.recipe?.ingredients) continue;

      const recipeNutrition = calculateRecipeNutrition(
        mealPlanRecipe.recipe.ingredients
      );

      // Pomnóż przez liczbę porcji
      const servings = mealPlanRecipe.servings;

      nutrition.calories += recipeNutrition.calories * servings;
      nutrition.protein += recipeNutrition.protein * servings;
      nutrition.fat += recipeNutrition.fat * servings;
      nutrition.saturatedFat += recipeNutrition.saturatedFat * servings;
      nutrition.carbohydrates += recipeNutrition.carbohydrates * servings;
      nutrition.sugars += recipeNutrition.sugars * servings;
      nutrition.salt += recipeNutrition.salt * servings;
      nutrition.calcium += recipeNutrition.calcium * servings;
      nutrition.iron += recipeNutrition.iron * servings;
      nutrition.vitaminC += recipeNutrition.vitaminC * servings;
    }
  }

  return nutrition;
}

// Waliduj dzienne wartości odżywcze względem norm
export function validateDailyNutrition(
  nutrition: DailyNutrition,
  standards: NutritionalStandards
): NutritionalValidation {
  // Oblicz procentowy udział makroskładników w energii
  // 1g białka = 4 kcal
  // 1g tłuszczu = 9 kcal
  // 1g węglowodanów = 4 kcal
  
  const proteinCalories = nutrition.protein * 4;
  const fatCalories = nutrition.fat * 9;
  const carbohydratesCalories = nutrition.carbohydrates * 4;
  const totalCalories = nutrition.calories || 1; // Unikaj dzielenia przez 0

  const proteinPercent = (proteinCalories / totalCalories) * 100;
  const fatPercent = (fatCalories / totalCalories) * 100;
  const carbohydratesPercent = (carbohydratesCalories / totalCalories) * 100;

  // Tolerancja dla mikroskładników (10%)
  const tolerance = 0.1;

  return {
    energy: {
      value: nutrition.calories,
      min: standards.energyMin,
      max: standards.energyMax,
      isValid: nutrition.calories >= standards.energyMin && 
               nutrition.calories <= standards.energyMax,
    },
    proteinPercent: {
      value: proteinPercent,
      min: standards.proteinPercentMin,
      max: standards.proteinPercentMax,
      isValid: proteinPercent >= standards.proteinPercentMin && 
               proteinPercent <= standards.proteinPercentMax,
    },
    fatPercent: {
      value: fatPercent,
      min: standards.fatPercentMin,
      max: standards.fatPercentMax,
      isValid: fatPercent >= standards.fatPercentMin && 
               fatPercent <= standards.fatPercentMax,
    },
    carbohydratesPercent: {
      value: carbohydratesPercent,
      min: standards.carbohydratesPercentMin,
      max: standards.carbohydratesPercentMax,
      isValid: carbohydratesPercent >= standards.carbohydratesPercentMin && 
               carbohydratesPercent <= standards.carbohydratesPercentMax,
    },
    calcium: {
      value: nutrition.calcium,
      target: standards.calcium,
      isValid: nutrition.calcium >= standards.calcium * (1 - tolerance) && 
               nutrition.calcium <= standards.calcium * (1 + tolerance),
    },
    iron: {
      value: nutrition.iron,
      target: standards.iron,
      isValid: nutrition.iron >= standards.iron * (1 - tolerance) && 
               nutrition.iron <= standards.iron * (1 + tolerance),
    },
    vitaminC: {
      value: nutrition.vitaminC,
      target: standards.vitaminC,
      isValid: nutrition.vitaminC >= standards.vitaminC * (1 - tolerance) && 
               nutrition.vitaminC <= standards.vitaminC * (1 + tolerance),
    },
  };
}

// Sprawdź czy cały tydzień spełnia normy
export function validateWeeklyNutrition(
  mealPlan: MealPlan,
  standards: NutritionalStandards
): Record<number, NutritionalValidation> {
  const validations: Record<number, NutritionalValidation> = {};

  for (const day of mealPlan.days) {
    const dailyNutrition = calculateDailyNutrition(day);
    validations[day.dayOfWeek] = validateDailyNutrition(dailyNutrition, standards);
  }

  return validations;
}
