
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
    
    // Informacje o jadłospisie
    let dateRangeInfo = '';
    if (mealPlan.startDate && mealPlan.endDate) {
      // Użyj lokalnej daty bez konwersji timezone
      const startDate = new Date(mealPlan.startDate);
      const endDate = new Date(mealPlan.endDate);
      const startDateStr = `${String(startDate.getUTCDate()).padStart(2, '0')}.${String(startDate.getUTCMonth() + 1).padStart(2, '0')}.${startDate.getUTCFullYear()}`;
      const endDateStr = `${String(endDate.getUTCDate()).padStart(2, '0')}.${String(endDate.getUTCMonth() + 1).padStart(2, '0')}.${endDate.getUTCFullYear()}`;
      dateRangeInfo = `Zakres dat: ${startDateStr}-${endDateStr}`;
    } else if (mealPlan.weekNumber) {
      dateRangeInfo = `Tydzień: ${mealPlan.weekNumber}`;
    } else {
      dateRangeInfo = 'Zakres dat: -';
    }
    
    summarySheet.getCell('A2').value = dateRangeInfo;
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
          const recipeNames = meal.recipes
            .map(mr => mr.recipe?.name || 'Brak nazwy')
            .filter(name => name) // Usuń puste nazwy
            .join('\n');
          row.getCell(index + 2).value = recipeNames || '-';
        } else {
          row.getCell(index + 2).value = '-';
        }
      });
      
      row.alignment = { vertical: 'top', wrapText: true };
      
      // Oblicz wysokość wiersza na podstawie liczby receptur
      let maxRecipes = 0;
      exportForParents.forEach((mealType: string) => {
        const meal = day.meals?.find(m => m.mealType === mealType);
        const recipesCount = meal?.recipes?.length || 0;
        if (recipesCount > maxRecipes) maxRecipes = recipesCount;
      });
      row.height = Math.max(40, maxRecipes * 15 + 10);
      
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
    
    // Auto-dopasowanie szerokości kolumn
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
        column.width = Math.max(15, maxLength + 2);
      } else {
        // Kolumny z posiłkami - szerokość dopasowana do zawartości
        column.width = Math.max(20, maxLength * 1.1 + 3);
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
