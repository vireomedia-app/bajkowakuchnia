
import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET() {
  try {
    // Pobierz wszystkie meal plany
    const mealPlans = await prisma.mealPlan.findMany();
    
    let count = 0;
    
    for (const plan of mealPlans) {
      // Wzorzec do wykrywania duplikacji dat: "- DD.MM.YYYY-DD.MM.YYYY- DD.MM.YYYY-DD.MM.YYYY"
      const datePattern = / - \d{2}\.\d{2}\.\d{4}-\d{2}\.\d{2}\.\d{4}/g;
      const matches = plan.name.match(datePattern);
      
      // Jeśli są duplikaty (więcej niż jedno dopasowanie)
      if (matches && matches.length > 1) {
        // Usuń wszystkie daty i dodaj tylko pierwszą
        const cleanName = plan.name.replace(datePattern, '').trim();
        const firstDate = matches[0];
        const newName = `${cleanName}${firstDate}`;
        
        await prisma.mealPlan.update({
          where: { id: plan.id },
          data: { name: newName }
        });
        
        count++;
      }
    }
    
    return NextResponse.json({ 
      message: `Poprawiono ${count} meal planów`,
      count 
    });
  } catch (error) {
    console.error('Błąd podczas czyszczenia duplikatów:', error);
    return NextResponse.json({ error: 'Błąd serwera' }, { status: 500 });
  }
}
