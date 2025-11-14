
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import ExcelJS from 'exceljs';
import { DAY_OF_WEEK_LABELS, MEAL_TYPE_LABELS } from '@/lib/meal-plan-utils';

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
    const exportForParents = appSettings?.exportForParents || ['BREAKFAST', 'SECOND_BREAKFAST', 'LUNCH', 'FIRST_SNACK'];

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
    
    // Arkusz: Jadłospis dla rodziców
    const summarySheet = workbook.addWorksheet('Jadłospis dla rodziców');
    
    // Liczba kolumn: 1 (dzień tygodnia) + liczba posiłków
    const numColumns = exportForParents.length + 1;
    
    // Tytuł - dopasowany do liczby kolumn
    summarySheet.mergeCells(1, 1, 1, numColumns);
    const titleCell = summarySheet.getCell('A1');
    titleCell.value = `${mealPlan.name} - Jadłospis dla rodziców`;
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
    const headers = ['Dzień tygodnia'];
    
    // Mapa typów posiłków do etykiet
    const mealTypeMap: Record<string, string> = {
      'BREAKFAST': 'Śniadanie',
      'SECOND_BREAKFAST': 'II śniadanie',
      'LUNCH': 'Obiad',
      'FIRST_SNACK': 'Podwieczorek',
      'SECOND_SNACK': 'II podwieczorek',
      'DINNER': 'Kolacja',
      'OTHER': 'Inne',
    };
    
    exportForParents.forEach((mealType: string) => {
      headers.push(mealTypeMap[mealType] || mealType);
    });
    
    headerRow.values = headers;
    headerRow.font = { bold: true };
    headerRow.alignment = { horizontal: 'center', vertical: 'middle' };
    headerRow.height = 25;
    
    // Szerokość kolumn zostanie ustawiona automatycznie po wypełnieniu danych
    
    // Wypełnij dane dla każdego dnia (wiersz 4 zamiast 6)
    let currentRow = 4;
    for (const day of mealPlan.days) {
      const row = summarySheet.getRow(currentRow);
      row.getCell(1).value = DAY_OF_WEEK_LABELS[day.dayOfWeek] || `Dzień ${day.dayOfWeek}`;
      
      // Dla każdego typu posiłku w exportForParents
      exportForParents.forEach((mealType: string, index: number) => {
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
            
            // Składniki
            if (recipe.ingredients && recipe.ingredients.length > 0) {
              const ingredientTexts: any[] = [];
              
              recipe.ingredients.forEach((ingredient: any, ingIdx: number) => {
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
          
          row.getCell(index + 2).value = {
            richText: richTextParts
          };
        } else {
          row.getCell(index + 2).value = '-';
        }
      });
      
      row.alignment = { vertical: 'top', wrapText: true };
      
      // Oblicz wysokość wiersza uwzględniając składniki i alergeny
      let maxLines = 1;
      exportForParents.forEach((mealType: string) => {
        const meal = day.meals?.find(m => m.mealType === mealType);
        if (meal && meal.recipes && meal.recipes.length > 0) {
          // Każda receptura ma teraz: nazwę (1 linia) + składniki (1+ linii) + alergeny (2 linie)
          // Szacujemy ~4 linie na recepturę
          const estimatedLines = meal.recipes.length * 4;
          maxLines = Math.max(maxLines, estimatedLines);
        }
      });
      // Ustaw wysokość na podstawie liczby linii (około 18 pikseli na linię + padding)
      row.height = Math.max(30, maxLines * 18 + 10);
      
      currentRow++;
    }
    
    // Zastosuj obramowanie do tabeli (od wiersza 3)
    for (let row = 3; row < currentRow; row++) {
      for (let col = 1; col <= numColumns; col++) {
        const cell = summarySheet.getRow(row).getCell(col);
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' },
        };
      }
    }
    
    // Auto-dopasowanie szerokości kolumn - zmniejszone dla lepszego druku na A4
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
    
    // Wygeneruj plik Excel
    const buffer = await workbook.xlsx.writeBuffer();
    
    // Utwórz nazwę pliku
    const fileName = `Jadlospis_dla_rodzicow_${mealPlan.name.replace(/\s+/g, '_')}_${
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
    console.error('Error exporting meal plan for parents:', error);
    
    // Bardziej szczegółowy komunikat błędu
    const errorMessage = error instanceof Error ? error.message : 'Nieznany błąd';
    
    return NextResponse.json(
      { 
        error: 'Błąd podczas eksportowania jadłospisu dla rodziców',
        details: errorMessage
      },
      { status: 500 }
    );
  }
}
