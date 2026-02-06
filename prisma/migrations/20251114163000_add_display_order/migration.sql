
-- AlterTable
ALTER TABLE "meal_plans" ADD COLUMN "display_order" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "meal_plans_display_order_idx" ON "meal_plans"("display_order");
