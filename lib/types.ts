
export interface Product {
  id: string
  name: string
  unit: string
  currentStock: number
  
  // Wartości odżywcze (na 100g)
  manufacturer?: string | null
  calories?: number | null
  salt?: number | null
  protein?: number | null
  fat?: number | null
  saturatedFat?: number | null
  carbohydrates?: number | null
  sugars?: number | null
  calcium?: number | null
  iron?: number | null
  vitaminC?: number | null
  
  // Alergeny (numery od 1 do 14)
  allergens?: number[]
  
  createdAt: Date
  updatedAt: Date
}

export interface Transaction {
  id: string
  productId: string
  date: Date
  document: string
  type: 'INCOME' | 'OUTCOME'
  quantity: number
  balance: number
  createdAt: Date
  product?: Product
}

export interface ProductWithTransactions extends Product {
  transactions: Transaction[]
}

export const UNITS = [
  'kg',
  'g',
  'szt',
  'l',
  'ml',
  'opak',
  'inne'
] as const

export type Unit = typeof UNITS[number]

export interface AddProductData {
  name: string
  unit: Unit
  initialStock: number
}

export interface AddTransactionData {
  date: Date
  document: string
  type: 'INCOME' | 'OUTCOME'
  quantity: number
}

// Recipe types
export interface RecipeIngredient {
  id: string
  recipeId: string
  productId: string | null
  productName: string
  quantity: number
  unit: string
  product?: Product | null
}

export interface Recipe {
  id: string
  name: string
  description: string | null
  servings: number
  mealType?: MealType | null // Stare pole, zachowane dla kompatybilności
  categories?: MealType[] // Nowe pole - kategorie
  createdAt: Date
  updatedAt: Date
  ingredients: RecipeIngredient[]
}

export interface RecipeWithNutrition extends Recipe {
  nutrition: {
    calories: number
    protein: number
    fat: number
    saturatedFat: number
    carbohydrates: number
    sugars: number
    salt: number
    calcium: number
    iron: number
    vitaminC: number
  }
}

// Meal Plan types
export type MealType = 
  | 'BREAKFAST'           // Śniadanie
  | 'SECOND_BREAKFAST'    // Drugie śniadanie
  | 'LUNCH'               // Obiad
  | 'FIRST_SNACK'         // Podwieczorek I
  | 'SECOND_SNACK'        // Podwieczorek II
  | 'DINNER'              // Kolacja
  | 'OTHER'               // Inne

export type Season = 
  | 'SPRING'  // Wiosna
  | 'SUMMER'  // Lato
  | 'AUTUMN'  // Jesień
  | 'WINTER'  // Zima

export interface NutritionalStandards {
  id: string
  name: string
  
  // Energia (kalorie)
  energyMin: number
  energyMax: number
  
  // Procentowy udział makroskładników w energii
  proteinPercentMin: number
  proteinPercentMax: number
  fatPercentMin: number
  fatPercentMax: number
  carbohydratesPercentMin: number
  carbohydratesPercentMax: number
  
  // Mikroskładniki (wartości docelowe)
  calcium: number
  iron: number
  vitaminC: number
  
  createdAt: Date
  updatedAt: Date
}

export interface MealPlanRecipe {
  id: string
  mealPlanMealId: string
  recipeId: string
  servings: number
  order: number
  createdAt: Date
  recipe?: Recipe
}

export interface MealPlanMeal {
  id: string
  mealPlanDayId: string
  mealType: MealType
  order: number
  createdAt: Date
  updatedAt: Date
  recipes: MealPlanRecipe[]
}

export interface MealPlanDay {
  id: string
  mealPlanId: string
  dayOfWeek: number // 1-7 (Poniedziałek-Niedziela)
  date?: Date | null
  createdAt: Date
  updatedAt: Date
  meals: MealPlanMeal[]
}

export interface MealPlan {
  id: string
  name: string
  weekNumber?: number | null
  season?: Season | null
  description?: string | null
  standardsId?: string | null
  createdAt: Date
  updatedAt: Date
  days: MealPlanDay[]
  standards?: NutritionalStandards | null
}

export interface DailyNutrition {
  calories: number
  protein: number
  fat: number
  saturatedFat: number
  carbohydrates: number
  sugars: number
  salt: number
  calcium: number
  iron: number
  vitaminC: number
}

export interface NutritionalValidation {
  energy: { value: number; min: number; max: number; isValid: boolean }
  proteinPercent: { value: number; min: number; max: number; isValid: boolean }
  fatPercent: { value: number; min: number; max: number; isValid: boolean }
  carbohydratesPercent: { value: number; min: number; max: number; isValid: boolean }
  calcium: { value: number; target: number; isValid: boolean }
  iron: { value: number; target: number; isValid: boolean }
  vitaminC: { value: number; target: number; isValid: boolean }
}
