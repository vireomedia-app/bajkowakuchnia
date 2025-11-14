import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ArrowLeft, CalendarDays, PlusCircle } from 'lucide-react';
import { prisma } from '@/lib/db';
import MealPlansList from '@/components/meal-plans-list';

export const dynamic = "force-dynamic";

async function getMealPlans() {
  try {
    const mealPlans = await prisma.mealPlan.findMany({
      include: {
        standards: true,
        days: {
          include: {
            meals: {
              include: {
                recipes: {
                  include: {
                    recipe: {
                      include: {
                        ingredients: {
                          include: {
                            product: true,
                          },
                        },
                      },
                    },
                  },
                },
              },
              orderBy: { order: 'asc' },
            },
          },
          orderBy: { dayOfWeek: 'asc' },
        },
      },
      orderBy: [
        { displayOrder: 'asc' },
        { createdAt: 'desc' }
      ],
    });
    
    return mealPlans;
  } catch (error) {
    console.error('Error fetching meal plans:', error);
    return [];
  }
}

export default async function MealPlansPage() {
  const mealPlans = await getMealPlans();

  return (
    <div className="space-y-8">
      {/* Back Button */}
      <Link href="/menu">
        <Button variant="ghost" className="gap-2">
          <ArrowLeft className="w-4 h-4" />
          Powrót do menu jadłospisu
        </Button>
      </Link>

      {/* Header */}
      <div className="text-center space-y-4">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-green-600 to-green-700 text-white mb-4">
          <CalendarDays className="w-8 h-8" />
        </div>
        <h2 className="text-3xl font-bold text-gray-900">
          Jadłospisy tygodniowe
        </h2>
        <p className="text-gray-600 max-w-2xl mx-auto">
          Twórz i zarządzaj tygodniowymi planami żywieniowymi
        </p>
        <div className="pt-4">
          <Link href="/menu/meal-plans/new">
            <Button className="gap-2 bg-green-600 hover:bg-green-700">
              <PlusCircle className="w-4 h-4" />
              Nowy jadłospis
            </Button>
          </Link>
        </div>
      </div>



      {/* Meal Plans List (if any) */}
      <MealPlansList initialPlans={mealPlans} />

      {mealPlans.length === 0 && (
        <div className="text-center py-12">
          <CalendarDays className="w-16 h-16 mx-auto text-gray-400 mb-4" />
          <p className="text-gray-600">Brak jadłospisów w systemie</p>
          <p className="text-sm text-gray-500 mt-2">
            Kliknij przycisk "Nowy jadłospis" aby rozpocząć
          </p>
        </div>
      )}
    </div>
  );
}
