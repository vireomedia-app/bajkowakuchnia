
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Settings, AlertCircle, Edit } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { EditStandardsModal } from '@/components/edit-standards-modal';
import { useRouter } from 'next/navigation';

interface StandardsPageClientProps {
  initialStandard: any;
}

export function StandardsPageClient({ initialStandard }: StandardsPageClientProps) {
  const [standard, setStandard] = useState(initialStandard);
  const [showEditModal, setShowEditModal] = useState(false);
  const router = useRouter();

  const handleSuccess = () => {
    router.refresh();
  };

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
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-purple-600 to-purple-700 text-white mb-4">
          <Settings className="w-8 h-8" />
        </div>
        <h2 className="text-3xl font-bold text-gray-900">
          Normy żywieniowe
        </h2>
        <p className="text-gray-600 max-w-2xl mx-auto">
          Zarządzaj normami wartości odżywczych dla różnych grup wiekowych
        </p>
      </div>

      {!standard && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Nie znaleziono norm żywieniowych. System powinien zawierać domyślne normy.
          </AlertDescription>
        </Alert>
      )}

      {standard && (
        <Card className="max-w-4xl mx-auto">
          <CardHeader>
            <div className="flex items-start justify-between">
              <div>
                <CardTitle className="text-2xl">{standard.name}</CardTitle>
                <CardDescription>
                  Aktualne normy żywieniowe obowiązujące w systemie
                </CardDescription>
              </div>
              <Button
                onClick={() => setShowEditModal(true)}
                variant="outline"
                className="gap-2 border-orange-500 text-orange-600 hover:bg-orange-50"
              >
                <Edit className="w-4 h-4" />
                Edytuj normy
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Energia */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <h4 className="font-semibold text-gray-900">Energia (kalorie)</h4>
                <div className="space-y-1">
                  <p className="text-sm text-gray-600">
                    Minimum: <span className="font-medium text-gray-900">{standard.energyMin} kcal</span>
                  </p>
                  <p className="text-sm text-gray-600">
                    Maksimum: <span className="font-medium text-gray-900">{standard.energyMax} kcal</span>
                  </p>
                </div>
              </div>
            </div>

            {/* Makroskładniki */}
            <div>
              <h4 className="font-semibold text-gray-900 mb-3">Procentowy udział makroskładników w energii</h4>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-1">
                  <p className="text-sm font-medium text-gray-700">Białko</p>
                  <p className="text-sm text-gray-600">
                    {standard.proteinPercentMin}-{standard.proteinPercentMax}%
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium text-gray-700">Tłuszcz</p>
                  <p className="text-sm text-gray-600">
                    {standard.fatPercentMin}-{standard.fatPercentMax}%
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium text-gray-700">Węglowodany</p>
                  <p className="text-sm text-gray-600">
                    {standard.carbohydratesPercentMin}-{standard.carbohydratesPercentMax}%
                  </p>
                </div>
              </div>
            </div>

            {/* Mikroskładniki */}
            <div>
              <h4 className="font-semibold text-gray-900 mb-3">Mikroskładniki (wartości docelowe)</h4>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-1">
                  <p className="text-sm font-medium text-gray-700">Wapń</p>
                  <p className="text-sm text-gray-600">{standard.calcium} mg</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium text-gray-700">Żelazo</p>
                  <p className="text-sm text-gray-600">{standard.iron} mg</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium text-gray-700">Witamina C</p>
                  <p className="text-sm text-gray-600">{standard.vitaminC} mg</p>
                </div>
              </div>
            </div>

            <Alert className="border-orange-500 bg-orange-50">
              <AlertCircle className="h-4 w-4 text-orange-600" />
              <AlertDescription className="text-orange-900">
                <strong>Uwaga:</strong> Te normy są używane do walidacji jadłospisów. System informuje, 
                czy jadłospis spełnia wymagania żywieniowe. Zmieniaj normy wyłącznie w przypadku 
                zmiany przepisów prawnych lub oficjalnych wytycznych żywieniowych.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      )}

      {standard && (
        <EditStandardsModal
          standard={standard}
          open={showEditModal}
          onOpenChange={setShowEditModal}
          onSuccess={handleSuccess}
        />
      )}
    </div>
  );
}
