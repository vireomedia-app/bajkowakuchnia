
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function fixDuplicateDateRanges() {
  console.log('🔍 Szukam jadłospisów z duplikowanymi zakresami dat...\n');

  try {
    const mealPlans = await prisma.mealPlan.findMany({
      select: {
        id: true,
        name: true,
        startDate: true,
        endDate: true,
      },
    });

    console.log(`Znaleziono ${mealPlans.length} jadłospisów\n`);

    let fixedCount = 0;

    for (const plan of mealPlans) {
      // Regex do znajdywania duplikowanych zakresów dat
      // Format: " - DD.MM.YYYY-DD.MM.YYYY- DD.MM.YYYY-DD.MM.YYYY" lub podobne
      const dateRangePattern = /( - \d{2}\.\d{2}\.\d{4}-\d{2}\.\d{2}\.\d{4})+/g;
      const matches = plan.name.match(dateRangePattern);

      if (matches && matches.length > 1) {
        // Znaleziono duplikację - usuń wszystkie zakresy dat i zostaw tylko czystą nazwę
        const cleanName = plan.name.replace(dateRangePattern, '');
        
        // Dodaj z powrotem zakres dat na podstawie dat z bazy
        let finalName = cleanName.trim();
        if (plan.startDate && plan.endDate) {
          const startDateStr = plan.startDate.toLocaleDateString('pl-PL');
          const endDateStr = plan.endDate.toLocaleDateString('pl-PL');
          finalName = `${finalName} - ${startDateStr}-${endDateStr}`;
        }

        console.log(`❌ Duplikacja w: "${plan.name}"`);
        console.log(`✅ Poprawiona na: "${finalName}"\n`);

        // Zaktualizuj nazwę w bazie
        await prisma.mealPlan.update({
          where: { id: plan.id },
          data: { name: finalName },
        });

        fixedCount++;
      } else if (matches && matches.length === 1) {
        console.log(`✓ OK: "${plan.name}"`);
      } else {
        // Brak zakresu dat w nazwie - dodaj jeśli daty istnieją
        if (plan.startDate && plan.endDate) {
          const startDateStr = plan.startDate.toLocaleDateString('pl-PL');
          const endDateStr = plan.endDate.toLocaleDateString('pl-PL');
          const finalName = `${plan.name.trim()} - ${startDateStr}-${endDateStr}`;

          console.log(`⚠️  Brak zakresu dat w: "${plan.name}"`);
          console.log(`✅ Dodano zakres: "${finalName}"\n`);

          await prisma.mealPlan.update({
            where: { id: plan.id },
            data: { name: finalName },
          });

          fixedCount++;
        } else {
          console.log(`✓ OK (bez dat): "${plan.name}"`);
        }
      }
    }

    console.log(`\n✨ Zakończono! Naprawiono ${fixedCount} jadłospisów.`);
  } catch (error) {
    console.error('❌ Błąd:', error);
  } finally {
    await prisma.$disconnect();
  }
}

fixDuplicateDateRanges();
