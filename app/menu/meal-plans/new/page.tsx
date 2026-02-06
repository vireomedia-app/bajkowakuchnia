
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { MealPlanCreator } from '@/components/meal-plan-creator';
import { prisma } from '@/lib/db';

async function getStandards() {
  try {
    const standards = await prisma.nutritionalStandards.findMany({
      orderBy: { createdAt: 'desc' },
    });
    return standards;
  } catch (error) {
    console.error('Error fetching standards:', error);
    return [];
  }
}

export default async function NewMealPlanPage() {
  const standards = await getStandards();

  return (
    <div className="space-y-8">
      <Link href="/menu/meal-plans">
        <Button variant="ghost" className="gap-2">
          <ArrowLeft className="w-4 h-4" />
          Powrót do jadłospisów
        </Button>
      </Link>

      <div className="text-center space-y-4">
        <h2 className="text-3xl font-bold text-gray-900">
          Nowy jadłospis tygodniowy
        </h2>
        <p className="text-gray-600 max-w-2xl mx-auto">
          Utwórz nowy plan żywieniowy na tydzień
        </p>
      </div>

      <MealPlanCreator standards={standards} />
    </div>
  );
}
