import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { MealType } from '@prisma/client';

interface IngredientDecision {
  originalName: string;
  action: 'use_existing' | 'create_new' | 'skip';
  productId?: string;
  newProductData?: {
    name: string;
    unit: string;
  };
  quantity: number;
  unit: string;
}

interface RecipeImportData {
  name: string;
  categories: MealType[];
  ingredients: IngredientDecision[];
}

export async function POST(request: NextRequest) {
  try {
    const { recipes } = await request.json() as { recipes: RecipeImportData[] };

    if (!recipes || recipes.length === 0) {
      return NextResponse.json(
        { error: 'Brak receptur do zaimportowania' },
        { status: 400 }
      );
    }

    const results = {
      imported: 0,
      skipped: 0,
      errors: [] as string[]
    };

    for (const recipe of recipes) {
      try {
        // Sprawdź czy receptura już istnieje
        const existingRecipe = await prisma.recipe.findFirst({
          where: { name: recipe.name }
        });

        if (existingRecipe) {
          results.skipped++;
          continue;
        }

        // Przygotuj składniki
        const ingredientsData: Array<{
          productId: string | null;
          productName: string;
          quantity: number;
          unit: string;
        }> = [];
        
        for (const ingredient of recipe.ingredients) {
          if (ingredient.action === 'skip') continue;

          let productId = ingredient.productId;
          let productName = ingredient.originalName;

          // Jeśli trzeba utworzyć nowy produkt
          if (ingredient.action === 'create_new' && ingredient.newProductData) {
            const newProduct = await prisma.product.create({
              data: {
                name: ingredient.newProductData.name,
                unit: ingredient.newProductData.unit,
                currentStock: 0
              }
            });
            productId = newProduct.id;
            productName = newProduct.name;
          }

          ingredientsData.push({
            productId: productId || null,
            productName: productName,
            quantity: ingredient.quantity,
            unit: ingredient.unit
          });
        }

        // Utwórz recepturę
        await prisma.recipe.create({
          data: {
            name: recipe.name,
            categories: recipe.categories,
            ingredients: {
              create: ingredientsData
            }
          }
        });

        results.imported++;

      } catch (error: any) {
        console.error(`Błąd podczas importu receptury "${recipe.name}":`, error);
        results.errors.push(`${recipe.name}: ${error.message}`);
      }
    }

    return NextResponse.json({
      success: true,
      results
    });

  } catch (error: any) {
    console.error('Błąd podczas importu masowego:', error);
    return NextResponse.json(
      { error: error.message || 'Błąd podczas importu' },
      { status: 500 }
    );
  }
}
