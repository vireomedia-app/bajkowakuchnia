
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import ExcelJS from 'exceljs';
import { calculateDailyNutrition, DAY_OF_WEEK_LABELS, MEAL_TYPE_LABELS } from '@/lib/meal-plan-utils';

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    // Pobierz jadłospis z pełnymi danymi
    const mealPlan = await prisma.mealPlan.findUnique({
      where: { id: params.id },
      include: {
        standards: true,
        days: {
          include: {
            meals: {
              include: {
                recipes: {
                  include: {
                    recipe: {
                      include: {
                        ingredients: {
                          include: {
                            product: true,
                          },
                        },
                      },
                    },
                  },
                },
              },
              orderBy: { order: 'asc' },
            },
          },
          orderBy: { dayOfWeek: 'asc' },
        },
      },
    });

    if (!mealPlan) {
      return NextResponse.json(
        { error: 'Jadłospis nie został znaleziony' },
        { status: 404 }
      );
    }

    // Utwórz nowy workbook
    const workbook = new ExcelJS.Workbook();
    
    // Arkusz 1: Skrót jadłospisu
    const summarySheet = workbook.addWorksheet('Jadłospis - Skrót');
    
    // Tytuł
    summarySheet.mergeCells('A1:F1');
    const titleCell = summarySheet.getCell('A1');
    titleCell.value = mealPlan.name;
    titleCell.font = { size: 16, bold: true };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    summarySheet.getRow(1).height = 30;
    
    // Informacje o jadłospisie
    summarySheet.getCell('A2').value = `Tydzień: ${mealPlan.weekNumber || '-'}`;
    summarySheet.getCell('C2').value = `Sezon: ${
      mealPlan.season === 'SPRING' ? 'Wiosna' :
      mealPlan.season === 'SUMMER' ? 'Lato' :
      mealPlan.season === 'AUTUMN' ? 'Jesień' :
      mealPlan.season === 'WINTER' ? 'Zima' : '-'
    }`;
    
    if (mealPlan.description) {
      summarySheet.getCell('A3').value = `Opis: ${mealPlan.description}`;
      summarySheet.mergeCells('A3:F3');
    }
    
    // Nagłówki tabeli
    const headerRow = summarySheet.getRow(5);
    headerRow.values = ['Dzień tygodnia', 'Śniadanie', 'II śniadanie', 'Obiad', 'Podwieczorek', 'II podwieczorek'];
    headerRow.font = { bold: true };
    headerRow.alignment = { horizontal: 'center', vertical: 'middle' };
    headerRow.height = 25;
    
    // Ustaw szerokość kolumn
    summarySheet.getColumn(1).width = 20;
    for (let i = 2; i <= 6; i++) {
      summarySheet.getColumn(i).width = 25;
    }
    
    // Wypełnij dane dla każdego dnia
    let currentRow = 6;
    for (const day of mealPlan.days) {
      const row = summarySheet.getRow(currentRow);
      row.getCell(1).value = DAY_OF_WEEK_LABELS[day.dayOfWeek];
      
      // Dla każdego typu posiłku
      const mealTypes = ['BREAKFAST', 'SECOND_BREAKFAST', 'LUNCH', 'FIRST_SNACK', 'SECOND_SNACK'];
      mealTypes.forEach((mealType, index) => {
        const meal = day.meals.find(m => m.mealType === mealType);
        if (meal && meal.recipes.length > 0) {
          const recipeNames = meal.recipes
            .map(mr => mr.recipe?.name || 'Brak nazwy')
            .join('\n');
          row.getCell(index + 2).value = recipeNames;
        } else {
          row.getCell(index + 2).value = '-';
        }
      });
      
      row.alignment = { vertical: 'top', wrapText: true };
      row.height = Math.max(40, Math.min(...mealTypes.map((mt, idx) => {
        const meal = day.meals.find(m => m.mealType === mt);
        return meal?.recipes?.length || 0;
      })) * 15 + 10);
      
      currentRow++;
    }
    
    // Zastosuj obramowanie do tabeli
    for (let row = 5; row < currentRow; row++) {
      for (let col = 1; col <= 6; col++) {
        const cell = summarySheet.getRow(row).getCell(col);
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' },
        };
      }
    }
    
    // Arkusz 2: Wartości odżywcze
    const nutritionSheet = workbook.addWorksheet('Wartości odżywcze');
    
    // Tytuł
    nutritionSheet.mergeCells('A1:I1');
    const nutritionTitleCell = nutritionSheet.getCell('A1');
    nutritionTitleCell.value = 'Wartości odżywcze - ' + mealPlan.name;
    nutritionTitleCell.font = { size: 16, bold: true };
    nutritionTitleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    nutritionSheet.getRow(1).height = 30;
    
    // Normy żywieniowe (jeśli są dostępne)
    if (mealPlan.standards) {
      nutritionSheet.getCell('A3').value = 'Normy żywieniowe:';
      nutritionSheet.getCell('A3').font = { bold: true };
      
      nutritionSheet.getCell('A4').value = 'Energia:';
      nutritionSheet.getCell('B4').value = `${mealPlan.standards.energyMin}-${mealPlan.standards.energyMax} kcal`;
      
      nutritionSheet.getCell('A5').value = 'Białko:';
      nutritionSheet.getCell('B5').value = `${mealPlan.standards.proteinPercentMin}-${mealPlan.standards.proteinPercentMax}%`;
      
      nutritionSheet.getCell('A6').value = 'Tłuszcz:';
      nutritionSheet.getCell('B6').value = `${mealPlan.standards.fatPercentMin}-${mealPlan.standards.fatPercentMax}%`;
      
      nutritionSheet.getCell('A7').value = 'Węglowodany:';
      nutritionSheet.getCell('B7').value = `${mealPlan.standards.carbohydratesPercentMin}-${mealPlan.standards.carbohydratesPercentMax}%`;
      
      nutritionSheet.getCell('D4').value = 'Wapń:';
      nutritionSheet.getCell('E4').value = `${mealPlan.standards.calcium} mg`;
      
      nutritionSheet.getCell('D5').value = 'Żelazo:';
      nutritionSheet.getCell('E5').value = `${mealPlan.standards.iron} mg`;
      
      nutritionSheet.getCell('D6').value = 'Witamina C:';
      nutritionSheet.getCell('E6').value = `${mealPlan.standards.vitaminC} mg`;
    }
    
    // Nagłówki tabeli wartości odżywczych
    const nutritionHeaderRow = nutritionSheet.getRow(9);
    nutritionHeaderRow.values = [
      'Dzień',
      'Energia (kcal)',
      'Białko (g)',
      'Białko (%)',
      'Tłuszcz (g)',
      'Tłuszcz (%)',
      'Węglowodany (g)',
      'Węgl. (%)',
      'Wapń (mg)',
      'Żelazo (mg)',
      'Wit. C (mg)',
    ];
    nutritionHeaderRow.font = { bold: true };
    nutritionHeaderRow.alignment = { horizontal: 'center', vertical: 'middle' };
    
    // Ustaw szerokość kolumn
    for (let i = 1; i <= 11; i++) {
      nutritionSheet.getColumn(i).width = 14;
    }
    
    // Wypełnij wartości odżywcze dla każdego dnia
    let nutritionRow = 10;
    for (const day of mealPlan.days) {
      const nutrition = calculateDailyNutrition(day);
      const row = nutritionSheet.getRow(nutritionRow);
      
      row.getCell(1).value = DAY_OF_WEEK_LABELS[day.dayOfWeek];
      row.getCell(2).value = Math.round(nutrition.calories);
      row.getCell(3).value = parseFloat(nutrition.protein.toFixed(1));
      
      // Procent białka
      const proteinPercent = nutrition.calories > 0 
        ? (nutrition.protein * 4 / nutrition.calories * 100) 
        : 0;
      row.getCell(4).value = parseFloat(proteinPercent.toFixed(1));
      
      row.getCell(5).value = parseFloat(nutrition.fat.toFixed(1));
      
      // Procent tłuszczu
      const fatPercent = nutrition.calories > 0 
        ? (nutrition.fat * 9 / nutrition.calories * 100) 
        : 0;
      row.getCell(6).value = parseFloat(fatPercent.toFixed(1));
      
      row.getCell(7).value = parseFloat(nutrition.carbohydrates.toFixed(1));
      
      // Procent węglowodanów
      const carbsPercent = nutrition.calories > 0 
        ? (nutrition.carbohydrates * 4 / nutrition.calories * 100) 
        : 0;
      row.getCell(8).value = parseFloat(carbsPercent.toFixed(1));
      
      row.getCell(9).value = parseFloat(nutrition.calcium.toFixed(1));
      row.getCell(10).value = parseFloat(nutrition.iron.toFixed(2));
      row.getCell(11).value = parseFloat(nutrition.vitaminC.toFixed(1));
      
      row.alignment = { horizontal: 'center', vertical: 'middle' };
      
      nutritionRow++;
    }
    
    // Zastosuj obramowanie
    for (let row = 9; row < nutritionRow; row++) {
      for (let col = 1; col <= 11; col++) {
        const cell = nutritionSheet.getRow(row).getCell(col);
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' },
        };
      }
    }
    
    // Arkusz 3: Receptury i składniki
    const detailsSheet = workbook.addWorksheet('Szczegóły receptur');
    
    // Tytuł
    detailsSheet.mergeCells('A1:F1');
    const detailsTitleCell = detailsSheet.getCell('A1');
    detailsTitleCell.value = 'Szczegóły receptur - ' + mealPlan.name;
    detailsTitleCell.font = { size: 16, bold: true };
    detailsTitleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    detailsSheet.getRow(1).height = 30;
    
    // Ustaw szerokość kolumn
    detailsSheet.getColumn(1).width = 20; // Dzień
    detailsSheet.getColumn(2).width = 25; // Posiłek
    detailsSheet.getColumn(3).width = 30; // Receptura
    detailsSheet.getColumn(4).width = 30; // Składnik
    detailsSheet.getColumn(5).width = 15; // Ilość
    detailsSheet.getColumn(6).width = 12; // Jednostka
    
    let detailsRow = 3;
    
    for (const day of mealPlan.days) {
      // Nagłówek dnia
      const dayRow = detailsSheet.getRow(detailsRow);
      dayRow.getCell(1).value = DAY_OF_WEEK_LABELS[day.dayOfWeek];
      dayRow.getCell(1).font = { bold: true, size: 14 };
      dayRow.getCell(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE0E0E0' },
      };
      detailsSheet.mergeCells(`A${detailsRow}:F${detailsRow}`);
      detailsRow++;
      
      // Nagłówki kolumn dla składników
      const headerRow = detailsSheet.getRow(detailsRow);
      headerRow.values = ['', 'Posiłek', 'Receptura', 'Składnik', 'Ilość', 'Jednostka'];
      headerRow.font = { bold: true };
      headerRow.alignment = { horizontal: 'center', vertical: 'middle' };
      headerRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFF0F0F0' },
      };
      detailsRow++;
      
      for (const meal of day.meals) {
        if (meal.recipes.length === 0) continue;
        
        for (const mealRecipe of meal.recipes) {
          const recipe = mealRecipe.recipe;
          if (!recipe) continue;
          
          // Wiersz z nazwą posiłku i receptury
          const recipeRow = detailsSheet.getRow(detailsRow);
          recipeRow.getCell(2).value = MEAL_TYPE_LABELS[meal.mealType];
          recipeRow.getCell(3).value = recipe.name;
          recipeRow.getCell(2).font = { bold: true };
          recipeRow.getCell(3).font = { bold: true };
          detailsRow++;
          
          // Składniki receptury
          if (recipe.ingredients && recipe.ingredients.length > 0) {
            for (const ingredient of recipe.ingredients) {
              const ingredientRow = detailsSheet.getRow(detailsRow);
              ingredientRow.getCell(4).value = ingredient.product?.name || 'Nieznany składnik';
              ingredientRow.getCell(5).value = ingredient.quantity;
              ingredientRow.getCell(6).value = ingredient.unit;
              detailsRow++;
            }
          } else {
            const noIngredientsRow = detailsSheet.getRow(detailsRow);
            noIngredientsRow.getCell(4).value = 'Brak składników';
            noIngredientsRow.getCell(4).font = { italic: true };
            detailsRow++;
          }
          
          // Pusta linia między recepturami
          detailsRow++;
        }
      }
      
      // Pusta linia między dniami
      detailsRow++;
    }
    
    // Zastosuj obramowanie do wszystkich komórek z danymi
    for (let row = 3; row < detailsRow; row++) {
      for (let col = 1; col <= 6; col++) {
        const cell = detailsSheet.getRow(row).getCell(col);
        if (cell.value) {
          cell.border = {
            top: { style: 'thin' },
            left: { style: 'thin' },
            bottom: { style: 'thin' },
            right: { style: 'thin' },
          };
        }
      }
    }
    
    // Wygeneruj plik Excel
    const buffer = await workbook.xlsx.writeBuffer();
    
    // Utwórz nazwę pliku
    const fileName = `Jadlospis_${mealPlan.name.replace(/\s+/g, '_')}_${
      mealPlan.weekNumber ? `Tydzien_${mealPlan.weekNumber}` : ''
    }.xlsx`;
    
    // Zwróć plik
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${fileName}"`,
      },
    });
  } catch (error) {
    console.error('Error exporting meal plan:', error);
    return NextResponse.json(
      { error: 'Błąd podczas eksportowania jadłospisu' },
      { status: 500 }
    );
  }
}
