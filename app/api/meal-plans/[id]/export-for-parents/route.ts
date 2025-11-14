
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
    
    // Tytuł
    const numColumns = exportForParents.length + 1; // +1 dla kolumny z dniem tygodnia
    summarySheet.mergeCells(1, 1, 1, numColumns);
    const titleCell = summarySheet.getCell('A1');
    titleCell.value = `${mealPlan.name} - Jadłospis dla rodziców`;
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
      summarySheet.mergeCells(1, 3, numColumns, 3);
    }
    
    // Nagłówki tabeli - tylko posiłki z exportForParents
    const headerRow = summarySheet.getRow(5);
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
    
    // Ustaw szerokość kolumn
    summarySheet.getColumn(1).width = 20;
    for (let i = 2; i <= numColumns; i++) {
      summarySheet.getColumn(i).width = 25;
    }
    
    // Wypełnij dane dla każdego dnia
    let currentRow = 6;
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
    
    // Zastosuj obramowanie do tabeli
    for (let row = 5; row < currentRow; row++) {
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
