import 'dotenv/config';
import { PrismaClient, MealType } from '@prisma/client';

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
      let categories: MealType[] = [];

      // Prosta heurystyka na podstawie nazwy
      if (name.includes('owsianka') || name.includes('kasza') || name.includes('omlet') || name.includes('jajecznica')) {
        categories = [MealType.BREAKFAST];
      } else if (name.includes('koktajl') || name.includes('smoothie') || name.includes('kanapka')) {
        categories = [MealType.SECOND_BREAKFAST];
      } else if (name.includes('zupa') || name.includes('rosół') || name.includes('krupnik')) {
        categories = [MealType.LUNCH];
      } else if (name.includes('kompot') || name.includes('herbata') || name.includes('sok')) {
        categories = [MealType.FIRST_SNACK];
      } else if (name.includes('ciastka') || name.includes('jogurt') || name.includes('deser')) {
        categories = [MealType.SECOND_SNACK];
      } else {
        // Jeśli nie ma trafienia, przypisz do obiadu jako domyślne
        categories = [MealType.LUNCH];
      }

      await prisma.recipe.update({
        where: { id: recipe.id },
        data: { categories },
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
