import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding nutritional standards...');

  // Sprawdź czy już istnieją normy
  const existingStandards = await prisma.nutritionalStandards.findFirst();
  
  if (existingStandards) {
    console.log('Nutritional standards already exist, skipping seed.');
    return;
  }

  // Utwórz domyślne normy żywieniowe
  const standards = await prisma.nutritionalStandards.create({
    data: {
      name: 'Przedszkole 3-6 lat',
      energyMin: 870,
      energyMax: 1062,
      proteinPercentMin: 10,
      proteinPercentMax: 20,
      fatPercentMin: 30,
      fatPercentMax: 40,
      carbohydratesPercentMin: 45,
      carbohydratesPercentMax: 65,
      calcium: 750,
      iron: 7.5,
      vitaminC: 37.5,
    },
  });

  console.log('Created default nutritional standards:', standards);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
