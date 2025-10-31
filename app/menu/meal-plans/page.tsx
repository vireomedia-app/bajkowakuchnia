import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ArrowLeft, CalendarDays, PlusCircle, AlertCircle, Construction } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { prisma } from '@/lib/db';

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
      orderBy: { createdAt: 'desc' },
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
      {mealPlans.length > 0 && (
        <div className="max-w-4xl mx-auto space-y-4">
          <h3 className="text-xl font-semibold text-gray-900">Istniejące jadłospisy</h3>
          <div className="grid gap-4">
            {mealPlans.map((plan: any) => (
              <Link key={plan.id} href={`/menu/meal-plans/${plan.id}`}>
                <Card className="hover:shadow-lg transition-shadow cursor-pointer">
                  <CardHeader>
                    <CardTitle className="text-gray-900">{plan.name}</CardTitle>
                    {plan.description && (
                      <CardDescription>{plan.description}</CardDescription>
                    )}
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-4 text-sm text-gray-600">
                      {plan.weekNumber && (
                        <span className="flex items-center gap-1">
                          <CalendarDays className="w-4 h-4" />
                          Tydzień {plan.weekNumber}
                        </span>
                      )}
                      {plan.season && (
                        <span>
                          Sezon: {plan.season === 'SPRING' ? 'Wiosna' : 
                                 plan.season === 'SUMMER' ? 'Lato' : 
                                 plan.season === 'AUTUMN' ? 'Jesień' : 'Zima'}
                        </span>
                      )}
                      <span>{plan.days?.length || 0} dni</span>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      )}

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
