
'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { ArrowLeft, Settings as SettingsIcon, Save } from 'lucide-react'
import { toast } from 'sonner'
import Link from 'next/link'

type MealType = 'BREAKFAST' | 'SECOND_BREAKFAST' | 'LUNCH' | 'FIRST_SNACK' | 'SECOND_SNACK' | 'DINNER' | 'OTHER'

interface MealOption {
  type: MealType
  label: string
  description: string
}

const MEAL_OPTIONS: MealOption[] = [
  { type: 'BREAKFAST', label: 'Śniadanie', description: 'Pierwszy posiłek dnia' },
  { type: 'SECOND_BREAKFAST', label: 'Drugie śniadanie', description: 'Posiłek przedpołudniowy' },
  { type: 'LUNCH', label: 'Obiad', description: 'Główny posiłek dnia' },
  { type: 'FIRST_SNACK', label: 'Podwieczorek I', description: 'Pierwszy posiłek popołudniowy' },
  { type: 'SECOND_SNACK', label: 'Podwieczorek II', description: 'Drugi posiłek popołudniowy' },
  { type: 'DINNER', label: 'Kolacja', description: 'Ostatni posiłek dnia' },
]

export default function SettingsPage() {
  const router = useRouter()
  const [enabledMeals, setEnabledMeals] = useState<MealType[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    fetchSettings()
  }, [])

  const fetchSettings = async () => {
    try {
      const response = await fetch('/api/settings')
      if (!response.ok) {
        throw new Error('Nie udało się pobrać ustawień')
      }
      const data = await response.json()
      setEnabledMeals(data.enabledMeals || [])
    } catch (error) {
      console.error('Error fetching settings:', error)
      toast.error('Błąd podczas pobierania ustawień')
    } finally {
      setIsLoading(false)
    }
  }

  const handleToggleMeal = (mealType: MealType) => {
    setEnabledMeals(prev => {
      if (prev.includes(mealType)) {
        return prev.filter(m => m !== mealType)
      } else {
        return [...prev, mealType]
      }
    })
  }

  const handleSave = async () => {
    if (enabledMeals.length === 0) {
      toast.error('Musisz wybrać przynajmniej jeden posiłek')
      return
    }

    setIsSaving(true)
    try {
      const response = await fetch('/api/settings', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          enabledMeals
        }),
      })

      if (!response.ok) {
        throw new Error('Nie udało się zapisać ustawień')
      }

      toast.success('Ustawienia zostały zapisane pomyślnie!')
      router.push('/')
    } catch (error) {
      console.error('Error saving settings:', error)
      toast.error('Błąd podczas zapisywania ustawień')
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Nawigacja */}
      <div className="flex items-center space-x-4">
        <Link href="/">
          <Button variant="outline" size="sm">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Powrót
          </Button>
        </Link>
      </div>

      {/* Nagłówek */}
      <div className="flex items-center space-x-3">
        <div className="w-12 h-12 bg-gradient-to-br from-purple-600 to-purple-700 rounded-xl flex items-center justify-center">
          <SettingsIcon className="w-6 h-6 text-white" />
        </div>
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Ustawienia główne</h1>
          <p className="text-gray-600">Konfiguracja posiłków w jadłospisie</p>
        </div>
      </div>

      {/* Karta ustawień */}
      <Card>
        <CardHeader>
          <CardTitle>Posiłki wliczane do kaloryczności</CardTitle>
          <CardDescription>
            Wybierz, które posiłki mają być uwzględniane w obliczeniach kaloryczności i wartości odżywczych.
            Zmiany będą miały wpływ na wszystkie jadłospisy (przeszłe i przyszłe).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Lista posiłków */}
          <div className="space-y-4">
            {MEAL_OPTIONS.map((meal) => {
              const isEnabled = enabledMeals.includes(meal.type)
              return (
                <div
                  key={meal.type}
                  className={`flex items-start space-x-3 p-4 rounded-lg border-2 transition-all ${
                    isEnabled
                      ? 'border-green-300 bg-green-50'
                      : 'border-red-300 bg-red-50'
                  }`}
                >
                  <Checkbox
                    id={meal.type}
                    checked={isEnabled}
                    onCheckedChange={() => handleToggleMeal(meal.type)}
                    disabled={isSaving}
                  />
                  <div className="flex-1">
                    <Label
                      htmlFor={meal.type}
                      className="text-base font-semibold cursor-pointer"
                    >
                      {meal.label}
                    </Label>
                    <p className="text-sm text-gray-600 mt-1">{meal.description}</p>
                    <p className={`text-xs mt-2 font-medium ${isEnabled ? 'text-green-700' : 'text-red-700'}`}>
                      {isEnabled ? '✓ Wliczany do kaloryczności' : '✗ NIE wliczany do kaloryczności'}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Informacja */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="font-semibold text-blue-900 mb-2">Ważne informacje:</h3>
            <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
              <li>Zmiany wpłyną na wszystkie jadłospisy w systemie</li>
              <li>Posiłki odznaczone będą oznaczone kolorem czerwonym w jadłospisie</li>
              <li>Wartości odżywcze będą przeliczane tylko dla zaznaczonych posiłków</li>
              <li>Musisz wybrać przynajmniej jeden posiłek</li>
            </ul>
          </div>

          {/* Podsumowanie */}
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <p className="text-sm text-gray-700">
              <strong>Wybrane posiłki ({enabledMeals.length}):</strong>{' '}
              {enabledMeals.length > 0
                ? MEAL_OPTIONS
                    .filter(m => enabledMeals.includes(m.type))
                    .map(m => m.label)
                    .join(', ')
                : 'Brak wybranych posiłków'}
            </p>
          </div>

          {/* Przyciski akcji */}
          <div className="flex space-x-3 pt-4">
            <Button
              variant="outline"
              onClick={() => router.push('/')}
              disabled={isSaving}
              className="flex-1"
            >
              Anuluj
            </Button>
            <Button
              onClick={handleSave}
              disabled={isSaving || enabledMeals.length === 0}
              className="flex-1 bg-purple-600 hover:bg-purple-700"
            >
              {isSaving ? (
                <div className="flex items-center space-x-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  <span>Zapisywanie...</span>
                </div>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Zapisz ustawienia
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
