
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import ExcelJS from 'exceljs';
import { calculateDailyNutrition, DAY_OF_WEEK_LABELS, MEAL_TYPE_LABELS } from '@/lib/meal-plan-utils';

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    // Pobierz ustawienia aplikacji
    const appSettings = await prisma.appSettings.findFirst({
      orderBy: { createdAt: 'desc' }
    });

    // Domyślne wartości jeśli nie ma ustawień
    const includeInCalories = appSettings?.includeInCalories || ['BREAKFAST', 'SECOND_BREAKFAST', 'LUNCH', 'FIRST_SNACK'];
    const exportForSanepid = appSettings?.exportForSanepid || ['BREAKFAST', 'SECOND_BREAKFAST', 'LUNCH', 'FIRST_SNACK'];

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
                  orderBy: { order: 'asc' },
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

    // Sprawdź czy jadłospis ma jakiekolwiek dni
    if (!mealPlan.days || mealPlan.days.length === 0) {
      return NextResponse.json(
        { error: 'Jadłospis nie zawiera żadnych dni. Dodaj dni do jadłospisu przed eksportem.' },
        { status: 400 }
      );
    }

    // Utwórz nowy workbook
    const workbook = new ExcelJS.Workbook();
    
    // Arkusz 1: Skrót jadłospisu
    const summarySheet = workbook.addWorksheet('Jadłospis - Skrót');
    
    // Nagłówki tabeli - TYLKO posiłki zaznaczone w exportForSanepid
    const ALL_MEAL_TYPES = ['BREAKFAST', 'SECOND_BREAKFAST', 'LUNCH', 'FIRST_SNACK', 'SECOND_SNACK'];
    const exportedMealTypes = ALL_MEAL_TYPES.filter(mt => exportForSanepid.includes(mt as any));
    
    // Sprawdź czy są jakieś posiłki do eksportu
    if (exportedMealTypes.length === 0) {
      return NextResponse.json(
        { error: 'Brak posiłków zaznaczonych do eksportu dla Sanepidu w ustawieniach' },
        { status: 400 }
      );
    }
    
    // Liczba kolumn: 1 (dzień tygodnia) + liczba posiłków
    const numColumns = exportedMealTypes.length + 1;
    
    // Tytuł - dopasowany do liczby kolumn
    summarySheet.mergeCells(1, 1, 1, numColumns);
    const titleCell = summarySheet.getCell('A1');
    titleCell.value = mealPlan.name;
    titleCell.font = { size: 16, bold: true };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    summarySheet.getRow(1).height = 30;
    
    // Informacje o jadłospisie - usunięto zakres dat z A2
    summarySheet.getCell('C2').value = `Sezon: ${
      mealPlan.season === 'SPRING' ? 'Wiosna' :
      mealPlan.season === 'SUMMER' ? 'Lato' :
      mealPlan.season === 'AUTUMN' ? 'Jesień' :
      mealPlan.season === 'WINTER' ? 'Zima' : '-'
    }`;
    
    // Nagłówki tabeli (wiersz 3 zamiast 5 - usunięto puste wiersze)
    const headerRow = summarySheet.getRow(3);
    const headerValues = ['Dzień tygodnia'];
    exportedMealTypes.forEach(mt => {
      headerValues.push(MEAL_TYPE_LABELS[mt as any] || mt);
    });
    headerRow.values = headerValues;
    headerRow.font = { bold: true };
    headerRow.alignment = { horizontal: 'center', vertical: 'middle' };
    headerRow.height = 25;
    
    // Szerokość kolumn zostanie ustawiona automatycznie po wypełnieniu danych
    
    // Wypełnij dane dla każdego dnia (wiersz 4 zamiast 6)
    let currentRow = 4;
    for (const day of mealPlan.days) {
      const row = summarySheet.getRow(currentRow);
      row.getCell(1).value = DAY_OF_WEEK_LABELS[day.dayOfWeek] || `Dzień ${day.dayOfWeek}`;
      
      // Przygotuj mapowanie indeksów kolumn dla wyeksportowanych posiłków
      const columnMapping: Record<string, number> = {};
      let columnIndex = 2;
      exportedMealTypes.forEach(mt => {
        columnMapping[mt] = columnIndex++;
      });
      
      // Wypełnij TYLKO wyeksportowane typy posiłków
      exportedMealTypes.forEach((mealType) => {
        const meal = day.meals?.find(m => m.mealType === mealType);
        if (meal && meal.recipes && meal.recipes.length > 0) {
          // Zbierz wszystkie alergeny z tego posiłku
          const allAllergens = new Set<number>();
          
          // Buduj rich text dla komórki
          const richTextParts: any[] = [];
          
          meal.recipes.forEach((mr, idx) => {
            const recipe = mr.recipe;
            if (!recipe) return;
            
            // Nazwa receptury
            if (idx > 0) richTextParts.push({ text: '\n' });
            richTextParts.push({ text: recipe.name || 'Brak nazwy', font: { bold: true } });
            richTextParts.push({ text: '\n' });
            richTextParts.push({ text: 'Skład: ' });
            
            // Składniki
            if (recipe.ingredients && recipe.ingredients.length > 0) {
              const ingredientTexts: any[] = [];
              
              recipe.ingredients.forEach((ingredient, ingIdx) => {
                const product = ingredient.product;
                if (!product) return;
                
                // Sprawdź czy produkt ma alergeny
                const hasAllergens = product.allergens && product.allergens.length > 0;
                
                // Dodaj alergeny do zbioru
                if (hasAllergens) {
                  product.allergens.forEach((a: number) => allAllergens.add(a));
                }
                
                // Dodaj przecinek między składnikami
                if (ingIdx > 0) {
                  ingredientTexts.push({ text: ', ' });
                }
                
                // Dodaj nazwę składnika (pogrubiony jeśli ma alergeny)
                ingredientTexts.push({
                  text: product.name,
                  font: hasAllergens ? { bold: true } : {}
                });
              });
              
              richTextParts.push(...ingredientTexts);
            }
          });
          
          // Dodaj listę alergenów na końcu
          if (allAllergens.size > 0) {
            const sortedAllergens = Array.from(allAllergens).sort((a, b) => a - b);
            richTextParts.push({ text: '\n\n' });
            richTextParts.push({ text: 'Alergeny: ', font: { italic: true } });
            richTextParts.push({ text: sortedAllergens.join(', '), font: { italic: true } });
          }
          
          row.getCell(columnMapping[mealType]).value = {
            richText: richTextParts
          };
        } else {
          row.getCell(columnMapping[mealType]).value = '-';
        }
      });
      
      row.alignment = { vertical: 'top', wrapText: true };
      
      // Oblicz wysokość wiersza uwzględniając składniki i alergeny
      let maxLines = 1;
      exportedMealTypes.forEach((mt) => {
        const meal = day.meals?.find(m => m.mealType === mt);
        if (meal && meal.recipes && meal.recipes.length > 0) {
          // Każda receptura ma teraz: nazwę (1 linia) + "Skład:" (1 linia) + składniki (1+ linii) + alergeny (2 linie)
          // Szacujemy ~5 linii na recepturę + dodatkowe linie dla długich list składników
          const ingredientsCount = meal.recipes.reduce((sum, mr) => {
            return sum + (mr.recipe?.ingredients?.length || 0);
          }, 0);
          // Każdy składnik zajmuje około 0.3 linii (przez przecinki)
          const estimatedLines = meal.recipes.length * 5 + Math.ceil(ingredientsCount * 0.3);
          maxLines = Math.max(maxLines, estimatedLines);
        }
      });
      // Ustaw wysokość na podstawie liczby linii - zwiększony współczynnik dla lepszej widoczności
      row.height = Math.max(40, maxLines * 25 + 20);
      
      currentRow++;
    }
    
    // Zastosuj obramowanie do tabeli - TYLKO dla wyeksportowanych kolumn (od wiersza 3)
    const totalColumns = exportedMealTypes.length + 1;
    for (let row = 3; row < currentRow; row++) {
      for (let col = 1; col <= totalColumns; col++) {
        const cell = summarySheet.getRow(row).getCell(col);
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' },
        };
      }
    }
    
    // Auto-dopasowanie szerokości kolumn w arkuszu podsumowania - zmniejszone dla A4
    summarySheet.columns.forEach((column: any, index: number) => {
      let maxLength = 0;
      column.eachCell?.({ includeEmpty: true }, (cell: any) => {
        const cellValue = cell.value ? cell.value.toString() : '';
        const cellLength = cellValue.split('\n').reduce((max: number, line: string) => {
          return Math.max(max, line.length);
        }, 0);
        if (cellLength > maxLength) {
          maxLength = cellLength;
        }
      });
      // Pierwsza kolumna (Dzień tygodnia) - mniejsza szerokość
      if (index === 0) {
        column.width = Math.min(15, Math.max(12, maxLength + 1));
      } else {
        // Kolumny z posiłkami - zmniejszona szerokość dla A4
        // Maksymalna szerokość 25 znaków, minimalna 15
        column.width = Math.min(25, Math.max(15, maxLength * 0.9 + 2));
      }
    });
    
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
    
    // Szerokość kolumn zostanie ustawiona automatycznie po wypełnieniu danych
    
    // Wypełnij wartości odżywcze dla każdego dnia
    let nutritionRow = 10;
    for (const day of mealPlan.days) {
      try {
        // Oblicz wartości odżywcze TYLKO dla posiłków zaznaczonych w includeInCalories
        const nutrition = calculateDailyNutrition(day, includeInCalories as any[]);
        const row = nutritionSheet.getRow(nutritionRow);
        
        row.getCell(1).value = DAY_OF_WEEK_LABELS[day.dayOfWeek] || `Dzień ${day.dayOfWeek}`;
        row.getCell(2).value = Math.round(nutrition.calories || 0);
        row.getCell(3).value = parseFloat((nutrition.protein || 0).toFixed(1));
        
        // Procent białka
        const proteinPercent = nutrition.calories > 0 
          ? (nutrition.protein * 4 / nutrition.calories * 100) 
          : 0;
        row.getCell(4).value = parseFloat(proteinPercent.toFixed(1));
        
        row.getCell(5).value = parseFloat((nutrition.fat || 0).toFixed(1));
        
        // Procent tłuszczu
        const fatPercent = nutrition.calories > 0 
          ? (nutrition.fat * 9 / nutrition.calories * 100) 
          : 0;
        row.getCell(6).value = parseFloat(fatPercent.toFixed(1));
        
        row.getCell(7).value = parseFloat((nutrition.carbohydrates || 0).toFixed(1));
        
        // Procent węglowodanów
        const carbsPercent = nutrition.calories > 0 
          ? (nutrition.carbohydrates * 4 / nutrition.calories * 100) 
          : 0;
        row.getCell(8).value = parseFloat(carbsPercent.toFixed(1));
        
        row.getCell(9).value = parseFloat((nutrition.calcium || 0).toFixed(1));
        row.getCell(10).value = parseFloat((nutrition.iron || 0).toFixed(2));
        row.getCell(11).value = parseFloat((nutrition.vitaminC || 0).toFixed(1));
        
        row.alignment = { horizontal: 'center', vertical: 'middle' };
        
        nutritionRow++;
      } catch (dayError) {
        console.error(`Error calculating nutrition for day ${day.dayOfWeek}:`, dayError);
        // Pomiń ten dzień w przypadku błędu
        continue;
      }
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
    
    // Auto-dopasowanie szerokości kolumn w arkuszu wartości odżywczych
    nutritionSheet.columns.forEach((column: any, index: number) => {
      let maxLength = 0;
      column.eachCell?.({ includeEmpty: true }, (cell: any) => {
        const cellValue = cell.value ? cell.value.toString() : '';
        if (cellValue.length > maxLength) {
          maxLength = cellValue.length;
        }
      });
      // Pierwsza kolumna (Dzień) - większa szerokość
      if (index === 0) {
        column.width = Math.max(15, Math.min(maxLength + 2, 20));
      } else {
        // Kolumny z danymi - szerokość odpowiednia do zawartości
        column.width = Math.max(14, Math.min(maxLength * 1.2 + 3, 25));
      }
    });
    
    // Arkusz 3: Receptury i składniki
    const detailsSheet = workbook.addWorksheet('Szczegóły receptur');
    
    // Tytuł
    detailsSheet.mergeCells('A1:H1');
    const detailsTitleCell = detailsSheet.getCell('A1');
    detailsTitleCell.value = 'Szczegóły receptur - ' + mealPlan.name;
    detailsTitleCell.font = { size: 16, bold: true };
    detailsTitleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    detailsSheet.getRow(1).height = 30;
    
    // Szerokość kolumn zostanie ustawiona automatycznie po wypełnieniu danych
    
    let detailsRow = 3;
    
    // Słownik do przechowywania adresów komórek z liczbą dzieci dla każdego dnia
    const childrenCountCells: { [key: number]: string } = {};
    
    for (const day of mealPlan.days) {
      try {
        // Nagłówek dnia
        const dayRow = detailsSheet.getRow(detailsRow);
        dayRow.getCell(1).value = DAY_OF_WEEK_LABELS[day.dayOfWeek] || `Dzień ${day.dayOfWeek}`;
        dayRow.getCell(1).font = { bold: true, size: 14 };
        dayRow.getCell(1).fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFE0E0E0' },
        };
        detailsSheet.mergeCells(`A${detailsRow}:H${detailsRow}`);
        detailsRow++;
        
        // Wiersz z liczbą dzieci - przesunięty o jedną komórkę w prawo
        const childrenRow = detailsSheet.getRow(detailsRow);
        childrenRow.getCell(2).value = 'Ilość dzieci tego dnia:';
        childrenRow.getCell(2).font = { bold: true };
        childrenRow.getCell(2).alignment = { horizontal: 'right', vertical: 'middle' };
        
        // Komórka do wpisania liczby dzieci (edytowalna) - przesunięta o jedną komórkę w prawo
        const childrenCountCell = childrenRow.getCell(3);
        childrenCountCell.value = '';
        childrenCountCell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFFFFF00' }, // Żółte tło dla wyróżnienia
        };
        childrenCountCell.border = {
          top: { style: 'medium' },
          left: { style: 'medium' },
          bottom: { style: 'medium' },
          right: { style: 'medium' },
        };
        
        // Zapamiętaj adres komórki z liczbą dzieci dla tego dnia
        childrenCountCells[day.dayOfWeek] = `C${detailsRow}`;
        detailsRow++;
        
        // Nagłówki kolumn dla składników
        const headerRow = detailsSheet.getRow(detailsRow);
        headerRow.values = ['', 'Posiłek', 'Receptura', 'Składnik', 'Ilość na porcję', 'Jednostka', 'Liczba dzieci', 'Całkowita ilość'];
        headerRow.font = { bold: true };
        headerRow.alignment = { horizontal: 'center', vertical: 'middle' };
        headerRow.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFF0F0F0' },
        };
        detailsRow++;
        
        // Sprawdź czy są posiłki
        if (!day.meals || day.meals.length === 0) {
          const noMealsRow = detailsSheet.getRow(detailsRow);
          noMealsRow.getCell(2).value = 'Brak posiłków';
          noMealsRow.getCell(2).font = { italic: true };
          detailsRow++;
          detailsRow++; // Pusta linia
          continue;
        }
        
        for (const meal of day.meals) {
          // Pokaż tylko posiłki zaznaczone w exportForSanepid
          if (!exportForSanepid.includes(meal.mealType)) continue;
          
          if (!meal.recipes || meal.recipes.length === 0) continue;
          
          for (const mealRecipe of meal.recipes) {
            const recipe = mealRecipe.recipe;
            if (!recipe) continue;
            
            // Wiersz z nazwą posiłku i receptury
            const recipeRow = detailsSheet.getRow(detailsRow);
            recipeRow.getCell(2).value = MEAL_TYPE_LABELS[meal.mealType] || meal.mealType;
            recipeRow.getCell(3).value = recipe.name || 'Brak nazwy';
            recipeRow.getCell(2).font = { bold: true };
            recipeRow.getCell(3).font = { bold: true };
            detailsRow++;
            
            // Składniki receptury
            if (recipe.ingredients && recipe.ingredients.length > 0) {
              for (const ingredient of recipe.ingredients) {
                const ingredientRow = detailsSheet.getRow(detailsRow);
                ingredientRow.getCell(4).value = ingredient.product?.name || 'Nieznany składnik';
                ingredientRow.getCell(5).value = ingredient.quantity || 0;
                ingredientRow.getCell(6).value = ingredient.unit || '';
                
                // Kolumna G: Liczba dzieci (odniesienie do komórki z liczbą dzieci dla tego dnia)
                const childrenCellRef = childrenCountCells[day.dayOfWeek];
                ingredientRow.getCell(7).value = { formula: `=${childrenCellRef}` };
                ingredientRow.getCell(7).alignment = { horizontal: 'center', vertical: 'middle' };
                
                // Kolumna H: Całkowita ilość (Ilość na porcję * Liczba dzieci)
                ingredientRow.getCell(8).value = { formula: `=E${detailsRow}*G${detailsRow}` };
                ingredientRow.getCell(8).numFmt = '0.##'; // Format liczby - bez miejsc dziesiętnych dla liczb całkowitych
                ingredientRow.getCell(8).alignment = { horizontal: 'right', vertical: 'middle' };
                
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
      } catch (dayError) {
        console.error(`Error processing day ${day.dayOfWeek} details:`, dayError);
        // Kontynuuj z następnym dniem
        detailsRow++;
        continue;
      }
    }
    
    // Zastosuj obramowanie do wszystkich komórek z danymi
    for (let row = 3; row < detailsRow; row++) {
      for (let col = 1; col <= 8; col++) {
        const cell = detailsSheet.getRow(row).getCell(col);
        if (cell.value || cell.formula) {
          cell.border = {
            top: { style: 'thin' },
            left: { style: 'thin' },
            bottom: { style: 'thin' },
            right: { style: 'thin' },
          };
        }
      }
    }
    
    // Auto-dopasowanie szerokości kolumn w arkuszu szczegółów
    detailsSheet.columns.forEach((column: any, index: number) => {
      let maxLength = 0;
      column.eachCell?.({ includeEmpty: true }, (cell: any) => {
        const cellValue = cell.value ? cell.value.toString() : '';
        const cellLength = cellValue.split('\n').reduce((max: number, line: string) => {
          return Math.max(max, line.length);
        }, 0);
        if (cellLength > maxLength) {
          maxLength = cellLength;
        }
      });
      
      // Różne szerokości dla różnych kolumn
      if (index === 0) {
        // Pierwsza kolumna (pusta) - minimalna szerokość
        column.width = 3;
      } else if (index === 1) {
        // Kolumna "Posiłek" - średnia szerokość
        column.width = Math.max(18, Math.min(maxLength * 1.2 + 2, 25));
      } else if (index === 2) {
        // Kolumna "Receptura" - większa szerokość
        column.width = Math.max(25, Math.min(maxLength * 1.2 + 3, 45));
      } else if (index === 3) {
        // Kolumna "Składnik" - większa szerokość
        column.width = Math.max(25, Math.min(maxLength * 1.2 + 3, 45));
      } else {
        // Kolumny "Ilość" i "Jednostka" - mniejsza szerokość
        column.width = Math.max(10, Math.min(maxLength * 1.2 + 2, 15));
      }
    });
    
    // Wygeneruj plik Excel
    const buffer = await workbook.xlsx.writeBuffer();
    
    // Utwórz nazwę pliku z zakresem dat - używamy UTC aby uniknąć przesunięcia
    let fileNameSuffix = '';
    if (mealPlan.startDate && mealPlan.endDate) {
      const startDate = new Date(mealPlan.startDate);
      const endDate = new Date(mealPlan.endDate);
      const startDateStr = `${String(startDate.getUTCDate()).padStart(2, '0')}-${String(startDate.getUTCMonth() + 1).padStart(2, '0')}-${startDate.getUTCFullYear()}`;
      const endDateStr = `${String(endDate.getUTCDate()).padStart(2, '0')}-${String(endDate.getUTCMonth() + 1).padStart(2, '0')}-${endDate.getUTCFullYear()}`;
      fileNameSuffix = `${startDateStr}_${endDateStr}`;
    } else if (mealPlan.weekNumber) {
      fileNameSuffix = `Tydzien_${mealPlan.weekNumber}`;
    }
    
    const fileName = `Jadlospis_${mealPlan.name.replace(/\s+/g, '_')}_${fileNameSuffix}.xlsx`;
    
    // Zwróć plik
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${fileName}"`,
      },
    });
  } catch (error) {
    console.error('Error exporting meal plan:', error);
    
    // Bardziej szczegółowy komunikat błędu
    const errorMessage = error instanceof Error ? error.message : 'Nieznany błąd';
    
    return NextResponse.json(
      { 
        error: 'Błąd podczas eksportowania jadłospisu',
        details: errorMessage
      },
      { status: 500 }
    );
  }
}
