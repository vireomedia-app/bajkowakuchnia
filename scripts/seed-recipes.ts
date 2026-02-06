
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const recipes = [
  {
    name: "BOROWIKI W CIEŚCIE",
    description: "Delikatne borowiki w chrupiącym cieście z sosem śmietanowym",
    servings: 1,
    ingredients: [
      { name: "grzyby mrożone", quantity: 0.1, unit: "kg" },
      { name: "ser grana padano/parmezan", quantity: 0.015, unit: "kg" },
      { name: "śmietana", quantity: 0.05, unit: "l" },
      { name: "cebula", quantity: 0.02, unit: "kg" },
      { name: "sałata mix", quantity: 0.002, unit: "kg" },
      { name: "sól", quantity: 0.001, unit: "kg" },
      { name: "pieprz", quantity: 0.001, unit: "kg" },
      { name: "masło", quantity: 0.01, unit: "kg" },
      { name: "mąka", quantity: 0.01, unit: "kg" },
      { name: "vol a vent szt", quantity: 1, unit: "szt" }
    ]
  },
  {
    name: "CARPACCIO Z POLĘDWICY",
    description: "Cienkie plasterki surowej polędwicy z serem i rukolą",
    servings: 1,
    ingredients: [
      { name: "polędwica wołowa", quantity: 0.12, unit: "kg" },
      { name: "ser grana padano/parmezan", quantity: 0.05, unit: "kg" },
      { name: "grzanki czosnkowe szt", quantity: 1, unit: "szt" },
      { name: "sałata ozdobna", quantity: 0.02, unit: "kg" },
      { name: "pieprz", quantity: 0.005, unit: "kg" },
      { name: "oliwa", quantity: 0.01, unit: "l" },
      { name: "cytryna", quantity: 0.02, unit: "kg" }
    ]
  },
  {
    name: "KREWETKI GRILLOWANE",
    description: "Soczyste krewetki z grilla z czosnkiem i ziołami",
    servings: 1,
    ingredients: [
      { name: "grzanki czosnkowe szt", quantity: 1, unit: "szt" },
      { name: "krewetka zakąskowa", quantity: 0.2, unit: "kg" },
      { name: "cebula", quantity: 0.1, unit: "kg" },
      { name: "czosnek św", quantity: 0.04, unit: "kg" },
      { name: "zielenina pietruszka/koper", quantity: 0.002, unit: "kg" },
      { name: "oliwa", quantity: 0.02, unit: "l" },
      { name: "cytryna", quantity: 0.03, unit: "kg" }
    ]
  },
  {
    name: "KURKA NA MAŚLE Z MŁODYM KOPREM",
    description: "Aromatyczne kurki smażone na maśle z świeżym koprem",
    servings: 1,
    ingredients: [
      { name: "grzyby mrożone", quantity: 0.2, unit: "kg" },
      { name: "bagietka", quantity: 0.1, unit: "kg" },
      { name: "cebula", quantity: 0.1, unit: "kg" },
      { name: "czosnek św", quantity: 0.015, unit: "kg" },
      { name: "zielenina pietruszka/koper", quantity: 0.02, unit: "kg" },
      { name: "masło", quantity: 0.03, unit: "kg" }
    ]
  },
  {
    name: "LEŚNE GRZYBY W ŚMIETANIE Z CEBULĄ",
    description: "Mieszanka grzybów leśnych w kremowym sosie śmietanowym",
    servings: 1,
    ingredients: [
      { name: "grzyby mrożone", quantity: 0.1, unit: "kg" },
      { name: "ser grana padano/parmezan", quantity: 0.015, unit: "kg" },
      { name: "śmietana", quantity: 0.06, unit: "l" },
      { name: "cebula", quantity: 0.02, unit: "kg" },
      { name: "zielenina pietruszka/koper", quantity: 0.002, unit: "kg" },
      { name: "sól", quantity: 0.001, unit: "kg" },
      { name: "pieprz", quantity: 0.001, unit: "kg" },
      { name: "masło", quantity: 0.01, unit: "kg" },
      { name: "mąka", quantity: 0.01, unit: "kg" },
      { name: "vol a vent szt", quantity: 1, unit: "szt" }
    ]
  },
  {
    name: "TATAR Z ŁOSOSIA",
    description: "Świeży tatar z łososia z awokado i cytryną",
    servings: 1,
    ingredients: [
      { name: "łosoś świeży", quantity: 0.15, unit: "kg" },
      { name: "awokado", quantity: 0.05, unit: "kg" },
      { name: "cytryna", quantity: 0.02, unit: "kg" },
      { name: "cebula czerwona", quantity: 0.01, unit: "kg" },
      { name: "oliwa", quantity: 0.01, unit: "l" },
      { name: "grzanki czosnkowe szt", quantity: 1, unit: "szt" }
    ]
  },
  {
    name: "ŻEBERKA WIEPRZOWE BBQ",
    description: "Pieczone żeberka w sosie barbecue",
    servings: 1,
    ingredients: [
      { name: "żeberka wieprzowe", quantity: 0.4, unit: "kg" },
      { name: "sos bbq", quantity: 0.08, unit: "l" },
      { name: "cebula", quantity: 0.05, unit: "kg" },
      { name: "czosnek św", quantity: 0.01, unit: "kg" },
      { name: "miód", quantity: 0.02, unit: "kg" },
      { name: "sól", quantity: 0.002, unit: "kg" },
      { name: "pieprz", quantity: 0.002, unit: "kg" }
    ]
  },
  {
    name: "PIEROGI RUSKIE",
    description: "Tradycyjne pierogi z serem i ziemniakami",
    servings: 1,
    ingredients: [
      { name: "pierogi ruskie mrożone", quantity: 0.25, unit: "kg" },
      { name: "cebula", quantity: 0.05, unit: "kg" },
      { name: "masło", quantity: 0.02, unit: "kg" },
      { name: "śmietana", quantity: 0.05, unit: "l" }
    ]
  },
  {
    name: "ROSÓŁ Z KURY",
    description: "Tradycyjny rosół z makaronem",
    servings: 1,
    ingredients: [
      { name: "kurczak cały", quantity: 0.3, unit: "kg" },
      { name: "marchew", quantity: 0.1, unit: "kg" },
      { name: "pietruszka korzeń", quantity: 0.05, unit: "kg" },
      { name: "seler korzeń", quantity: 0.05, unit: "kg" },
      { name: "cebula", quantity: 0.05, unit: "kg" },
      { name: "makaron", quantity: 0.03, unit: "kg" },
      { name: "zielenina pietruszka/koper", quantity: 0.005, unit: "kg" }
    ]
  },
  {
    name: "SCHABOWY Z KAPUSTĄ I ZIEMNIAKAMI",
    description: "Klasyczny kotlet schabowy z zasmażaną kapustą",
    servings: 1,
    ingredients: [
      { name: "schab", quantity: 0.15, unit: "kg" },
      { name: "kapusta kiszona", quantity: 0.15, unit: "kg" },
      { name: "ziemniaki", quantity: 0.2, unit: "kg" },
      { name: "mąka", quantity: 0.03, unit: "kg" },
      { name: "jajko", quantity: 1, unit: "szt" },
      { name: "bułka tarta", quantity: 0.05, unit: "kg" },
      { name: "olej", quantity: 0.05, unit: "l" }
    ]
  }
]

async function seedRecipes() {
  console.log('🌱 Rozpoczynam dodawanie receptur...')
  
  try {
    // Pobierz wszystkie produkty z bazy
    const products = await prisma.product.findMany()
    console.log(`✓ Znaleziono ${products.length} produktów w bazie`)

    let addedCount = 0
    let skippedCount = 0

    for (const recipeData of recipes) {
      // Sprawdź czy receptura już istnieje
      const existing = await prisma.recipe.findFirst({
        where: { name: recipeData.name }
      })

      if (existing) {
        console.log(`⊘ Receptura "${recipeData.name}" już istnieje - pomijam`)
        skippedCount++
        continue
      }

      // Dopasuj składniki do produktów
      const ingredientsData = recipeData.ingredients.map(ing => {
        const product = products.find(p => 
          p.name.toLowerCase() === ing.name.toLowerCase() ||
          p.name.toLowerCase().includes(ing.name.toLowerCase()) ||
          ing.name.toLowerCase().includes(p.name.toLowerCase())
        )

        return {
          productId: product?.id || null,
          productName: ing.name,
          quantity: ing.quantity,
          unit: ing.unit
        }
      })

      // Utwórz recepturę
      await prisma.recipe.create({
        data: {
          name: recipeData.name,
          description: recipeData.description,
          servings: recipeData.servings,
          ingredients: {
            create: ingredientsData
          }
        }
      })

      const linkedCount = ingredientsData.filter(i => i.productId).length
      console.log(`✓ Dodano recepturę "${recipeData.name}" (${linkedCount}/${ingredientsData.length} składników z bazy)`)
      addedCount++
    }

    console.log(`\n✅ Zakończono!`)
    console.log(`   Dodano: ${addedCount} receptur`)
    console.log(`   Pominięto: ${skippedCount} receptur (już istniały)`)

  } catch (error) {
    console.error('❌ Błąd podczas dodawania receptur:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

seedRecipes()
  .catch(console.error)
