import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Aktualizacja kategorii receptur...');

  // Pobierz wszystkie receptury
  const recipes = await prisma.recipe.findMany({
    select: {
      id: true,
      name: true,
      categories: true,
    },
  });

  console.log(`Znaleziono ${recipes.length} receptur`);

  // Dla receptur bez kategorii, przypisz domyślne kategorie na podstawie nazwy
  for (const recipe of recipes) {
    if (!recipe.categories || recipe.categories.length === 0) {
      const name = recipe.name.toLowerCase();
      let categories: string[] = [];

      // Prosta heurystyka na podstawie nazwy
      if (name.includes('owsianka') || name.includes('kasza') || name.includes('omlet') || name.includes('jajecznica')) {
        categories = ['BREAKFAST'];
      } else if (name.includes('koktajl') || name.includes('smoothie') || name.includes('kanapka')) {
        categories = ['SECOND_BREAKFAST'];
      } else if (name.includes('zupa') || name.includes('rosół') || name.includes('krupnik')) {
        categories = ['LUNCH'];
      } else if (name.includes('kompot') || name.includes('herbata') || name.includes('sok')) {
        categories = ['FIRST_SNACK'];
      } else if (name.includes('ciastka') || name.includes('jogurt') || name.includes('deser')) {
        categories = ['SECOND_SNACK'];
      } else {
        // Jeśli nie ma trafienia, przypisz do obiadu jako domyślne
        categories = ['LUNCH'];
      }

      await prisma.recipe.update({
        where: { id: recipe.id },
        data: { categories: categories as any },
      });

      console.log(`✓ Zaktualizowano recepturę "${recipe.name}" z kategorią: ${categories.join(', ')}`);
    } else {
      console.log(`- Receptura "${recipe.name}" już ma kategorie: ${recipe.categories.join(', ')}`);
    }
  }

  console.log('Zakończono aktualizację kategorii receptur');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
