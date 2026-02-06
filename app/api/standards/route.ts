
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

// GET wszystkich norm żywieniowych
export async function GET() {
  try {
    const standards = await prisma.nutritionalStandards.findMany({
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(standards);
  } catch (error) {
    console.error('Error fetching nutritional standards:', error);
    return NextResponse.json(
      { error: 'Błąd podczas pobierania norm żywieniowych' },
      { status: 500 }
    );
  }
}

// POST nowej normy żywieniowej
export async function POST(request: Request) {
  try {
    const data = await request.json();

    const standards = await prisma.nutritionalStandards.create({
      data: {
        name: data.name,
        energyMin: data.energyMin,
        energyMax: data.energyMax,
        proteinPercentMin: data.proteinPercentMin,
        proteinPercentMax: data.proteinPercentMax,
        fatPercentMin: data.fatPercentMin,
        fatPercentMax: data.fatPercentMax,
        carbohydratesPercentMin: data.carbohydratesPercentMin,
        carbohydratesPercentMax: data.carbohydratesPercentMax,
        calcium: data.calcium,
        iron: data.iron,
        vitaminC: data.vitaminC,
      },
    });

    return NextResponse.json(standards);
  } catch (error) {
    console.error('Error creating nutritional standards:', error);
    return NextResponse.json(
      { error: 'Błąd podczas tworzenia norm żywieniowych' },
      { status: 500 }
    );
  }
}
