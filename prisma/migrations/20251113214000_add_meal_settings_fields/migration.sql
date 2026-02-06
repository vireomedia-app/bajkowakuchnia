
-- AlterTable
ALTER TABLE "app_settings" 
  ADD COLUMN IF NOT EXISTS "includeInCalories" TEXT[] DEFAULT ARRAY['BREAKFAST', 'SECOND_BREAKFAST', 'LUNCH', 'FIRST_SNACK']::TEXT[],
  ADD COLUMN IF NOT EXISTS "exportForParents" TEXT[] DEFAULT ARRAY['BREAKFAST', 'SECOND_BREAKFAST', 'LUNCH', 'FIRST_SNACK']::TEXT[],
  ADD COLUMN IF NOT EXISTS "exportForSanepid" TEXT[] DEFAULT ARRAY['BREAKFAST', 'SECOND_BREAKFAST', 'LUNCH', 'FIRST_SNACK']::TEXT[],
  ADD COLUMN IF NOT EXISTS "customMeals" JSONB DEFAULT '[]';

-- Update existing records to have the new fields with default values
UPDATE "app_settings" 
SET 
  "includeInCalories" = ARRAY['BREAKFAST', 'SECOND_BREAKFAST', 'LUNCH', 'FIRST_SNACK']::TEXT[],
  "exportForParents" = ARRAY['BREAKFAST', 'SECOND_BREAKFAST', 'LUNCH', 'FIRST_SNACK']::TEXT[],
  "exportForSanepid" = ARRAY['BREAKFAST', 'SECOND_BREAKFAST', 'LUNCH', 'FIRST_SNACK']::TEXT[],
  "customMeals" = '[]'::JSONB
WHERE "includeInCalories" IS NULL;
