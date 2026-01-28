import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import mammoth from 'mammoth';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'Brak pliku' }, { status: 400 });
    }

    let fileContent = '';
    const fileName = file.name.toLowerCase();

    // Przetwarzanie różnych typów plików
    if (fileName.endsWith('.pdf')) {
      // PDF - base64 encode i wyślij do LLM API
      const base64Buffer = await file.arrayBuffer();
      const base64String = Buffer.from(base64Buffer).toString('base64');

      const response = await fetch('https://apps.abacus.ai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.ABACUSAI_API_KEY}`
        },
        body: JSON.stringify({
          model: 'gpt-4.1-mini',
          messages: [{
            role: 'user',
            content: [{
              type: 'file',
              file: {
                filename: file.name,
                file_data: `data:application/pdf;base64,${base64String}`
              }
            }, {
              type: 'text',
              text: `Przeanalizuj ten dokument i wyciągnij WSZYSTKIE receptury/przepisy kulinarne, które tam są.

Dla każdej receptury podaj:
- Nazwę receptury
- Kategorię/kategorie (BREAKFAST, FIRST_SNACK, LUNCH, SECOND_SNACK, SUPPER)
- Listę składników z dokładnymi nazwami i ilościami

Zwróć odpowiedź w formacie JSON:
{
  "recipes": [
    {
      "name": "Nazwa receptury",
      "category": "LUNCH",
      "categories": ["LUNCH"],
      "ingredients": [
        {
          "name": "dokładna nazwa składnika",
          "quantity": 100,
          "unit": "g"
        }
      ]
    }
  ]
}

Ważne:
- Wyciągnij WSZYSTKIE receptury z dokumentu, nie tylko kilka pierwszych
- Nazwy składników powinny być w mianowniku liczby pojedynczej (np. "Mleko", "Jajko", "Mąka")
- Jednostki to: g, kg, ml, l, szt
- Kategorie: BREAKFAST (śniadanie), FIRST_SNACK (pierwsze drugie śniadanie), LUNCH (obiad), SECOND_SNACK (podwieczorek), SUPPER (kolacja)
- Pole "categories" powinno być tablicą z co najmniej jedną kategorią

Odpowiedz tylko czystym JSONem, bez bloków kodu ani markdown.`
            }]
          }],
          response_format: { type: 'json_object' },
          max_tokens: 8000
        }),
      });

      if (!response.ok) {
        throw new Error('Błąd podczas analizy PDF przez LLM API');
      }

      const data = await response.json();
      fileContent = data.choices[0].message.content;

    } else if (fileName.endsWith('.docx')) {
      // DOCX - użyj mammoth
      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const result = await mammoth.extractRawText({ buffer });
      const extractedText = result.value;

      // Wyślij tekst do LLM API
      const response = await fetch('https://apps.abacus.ai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.ABACUSAI_API_KEY}`
        },
        body: JSON.stringify({
          model: 'gpt-4.1-mini',
          messages: [{
            role: 'user',
            content: `Przeanalizuj ten dokument i wyciągnij WSZYSTKIE receptury/przepisy kulinarne:

${extractedText}

Dla każdej receptury podaj:
- Nazwę receptury
- Kategorię/kategorie (BREAKFAST, FIRST_SNACK, LUNCH, SECOND_SNACK, SUPPER)
- Listę składników z dokładnymi nazwami i ilościami

Zwróć odpowiedź w formacie JSON:
{
  "recipes": [
    {
      "name": "Nazwa receptury",
      "category": "LUNCH",
      "categories": ["LUNCH"],
      "ingredients": [
        {
          "name": "dokładna nazwa składnika",
          "quantity": 100,
          "unit": "g"
        }
      ]
    }
  ]
}

Ważne:
- Wyciągnij WSZYSTKIE receptury z dokumentu, nie tylko kilka pierwszych
- Nazwy składników powinny być w mianowniku liczby pojedynczej (np. "Mleko", "Jajko", "Mąka")
- Jednostki to: g, kg, ml, l, szt
- Kategorie: BREAKFAST (śniadanie), FIRST_SNACK (pierwsze drugie śniadanie), LUNCH (obiad), SECOND_SNACK (podwieczorek), SUPPER (kolacja)
- Pole "categories" powinno być tablicą z co najmniej jedną kategorią

Odpowiedz tylko czystym JSONem, bez bloków kodu ani markdown.`
          }],
          response_format: { type: 'json_object' },
          max_tokens: 8000
        }),
      });

      if (!response.ok) {
        throw new Error('Błąd podczas analizy DOCX przez LLM API');
      }

      const data = await response.json();
      fileContent = data.choices[0].message.content;

    } else if (fileName.endsWith('.doc')) {
      return NextResponse.json(
        { error: 'Format .doc nie jest obsługiwany. Użyj .docx lub .pdf' },
        { status: 400 }
      );
    } else {
      return NextResponse.json(
        { error: 'Nieobsługiwany format pliku. Użyj PDF lub DOCX' },
        { status: 400 }
      );
    }

    // Parse JSON response
    let parsedData;
    try {
      parsedData = JSON.parse(fileContent);
    } catch (e) {
      console.error('Błąd parsowania JSON:', fileContent);
      return NextResponse.json(
        { error: 'Błąd parsowania odpowiedzi LLM' },
        { status: 500 }
      );
    }

    // Pobierz wszystkie produkty z bazy
    const allProducts = await prisma.product.findMany({
      select: {
        id: true,
        name: true,
        unit: true
      }
    });

    // Dla każdego składnika znajdź sugestie dopasowania
    const recipesWithSuggestions = parsedData.recipes.map((recipe: any) => {
      const ingredientsWithSuggestions = recipe.ingredients.map((ingredient: any) => {
        // Szukaj podobnych produktów (case-insensitive, częściowe dopasowanie)
        const suggestions = allProducts.filter(product => {
          const ingredientName = ingredient.name.toLowerCase().trim();
          const productName = product.name.toLowerCase().trim();
          
          // Dokładne dopasowanie
          if (productName === ingredientName) return true;
          
          // Jeden zawiera drugi
          if (productName.includes(ingredientName) || ingredientName.includes(productName)) return true;
          
          // Podobieństwo słów
          const ingredientWords = ingredientName.split(' ');
          const productWords = productName.split(' ');
          const commonWords = ingredientWords.filter(word => 
            productWords.some(pw => pw.includes(word) || word.includes(pw))
          );
          
          return commonWords.length > 0;
        });

        return {
          ...ingredient,
          suggestions: suggestions.slice(0, 5), // Maksymalnie 5 sugestii
          matchType: suggestions.length > 0 ? 'suggested' : 'new'
        };
      });

      return {
        ...recipe,
        ingredients: ingredientsWithSuggestions
      };
    });

    return NextResponse.json({
      success: true,
      recipes: recipesWithSuggestions
    });

  } catch (error: any) {
    console.error('Błąd podczas analizy pliku:', error);
    return NextResponse.json(
      { error: error.message || 'Błąd podczas analizy pliku' },
      { status: 500 }
    );
  }
}
