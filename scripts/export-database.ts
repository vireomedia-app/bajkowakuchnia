
import { prisma } from '../lib/db';
import * as fs from 'fs';

async function exportDatabase() {
  try {
    console.log('Eksportowanie danych...');
    
    const users = await prisma.user.findMany();
    const categories = await prisma.category.findMany();
    const products = await prisma.product.findMany();
    const transactions = await prisma.transaction.findMany();
    const recipes = await prisma.recipe.findMany({
      include: {
        ingredients: true
      }
    });
    const nutritionalStandards = await prisma.nutritionalStandard.findMany();
    const mealPlans = await prisma.mealPlan.findMany({
      include: {
        meals: {
          include: {
            recipes: true
          }
        }
      }
    });

    const data = {
      users,
      categories,
      products,
      transactions,
      recipes,
      nutritionalStandards,
      mealPlans,
      exportDate: new Date().toISOString()
    };

    fs.writeFileSync('/home/ubuntu/database_export.json', JSON.stringify(data, null, 2));
    console.log('✅ Export zakończony pomyślnie!');
    console.log(`📊 Wyeksportowano:`);
    console.log(`- Użytkownicy: ${users.length}`);
    console.log(`- Kategorie: ${categories.length}`);
    console.log(`- Produkty: ${products.length}`);
    console.log(`- Transakcje: ${transactions.length}`);
    console.log(`- Receptury: ${recipes.length}`);
    console.log(`- Normy żywieniowe: ${nutritionalStandards.length}`);
    console.log(`- Jadłospisy: ${mealPlans.length}`);
  } catch (error) {
    console.error('Błąd podczas eksportu:', error);
  } finally {
    await prisma.$disconnect();
  }
}

exportDatabase();
