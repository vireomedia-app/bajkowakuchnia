
-- CreateTable
CREATE TABLE "app_settings" (
    "id" TEXT NOT NULL,
    "enabledMeals" "MealType"[] DEFAULT ARRAY['BREAKFAST', 'SECOND_BREAKFAST', 'LUNCH', 'FIRST_SNACK', 'DINNER']::"MealType"[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "app_settings_pkey" PRIMARY KEY ("id")
);
