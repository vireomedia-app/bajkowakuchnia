
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

// PUT - Aktualizacja norm żywieniowych (chronione przez middleware)
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const data = await request.json();
    
    // Walidacja danych
    const requiredFields = [
      'name',
      'energyMin',
      'energyMax',
      'proteinPercentMin',
      'proteinPercentMax',
      'fatPercentMin',
      'fatPercentMax',
      'carbohydratesPercentMin',
      'carbohydratesPercentMax',
      'calcium',
      'iron',
      'vitaminC',
    ];

    for (const field of requiredFields) {
      if (data[field] === undefined || data[field] === null) {
        return NextResponse.json(
          { error: `Pole ${field} jest wymagane` },
          { status: 400 }
        );
      }
    }

    // Walidacja zakresów
    if (data.energyMin >= data.energyMax) {
      return NextResponse.json(
        { error: 'Minimalna energia musi być mniejsza niż maksymalna' },
        { status: 400 }
      );
    }

    if (
      data.proteinPercentMin >= data.proteinPercentMax ||
      data.fatPercentMin >= data.fatPercentMax ||
      data.carbohydratesPercentMin >= data.carbohydratesPercentMax
    ) {
      return NextResponse.json(
        { error: 'Wartości minimalne muszą być mniejsze niż maksymalne' },
        { status: 400 }
      );
    }

    // Aktualizacja norm
    const updatedStandard = await prisma.nutritionalStandards.update({
      where: { id: params.id },
      data: {
        name: data.name,
        energyMin: parseFloat(data.energyMin),
        energyMax: parseFloat(data.energyMax),
        proteinPercentMin: parseFloat(data.proteinPercentMin),
        proteinPercentMax: parseFloat(data.proteinPercentMax),
        fatPercentMin: parseFloat(data.fatPercentMin),
        fatPercentMax: parseFloat(data.fatPercentMax),
        carbohydratesPercentMin: parseFloat(data.carbohydratesPercentMin),
        carbohydratesPercentMax: parseFloat(data.carbohydratesPercentMax),
        calcium: parseFloat(data.calcium),
        iron: parseFloat(data.iron),
        vitaminC: parseFloat(data.vitaminC),
      },
    });

    return NextResponse.json(updatedStandard);
  } catch (error) {
    console.error('Error updating standards:', error);
    return NextResponse.json(
      { error: 'Failed to update standards' },
      { status: 500 }
    );
  }
}
