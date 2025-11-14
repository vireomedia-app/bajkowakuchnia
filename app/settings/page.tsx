
'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { ArrowLeft, Settings as SettingsIcon, Save, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import Link from 'next/link'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

type MealType = 'BREAKFAST' | 'SECOND_BREAKFAST' | 'LUNCH' | 'FIRST_SNACK' | 'SECOND_SNACK' | 'DINNER' | 'OTHER'

interface MealOption {
  type: MealType
  label: string
  description: string
  isCustom?: boolean
}

interface MealSettings {
  includeInCalories: MealType[]
  exportForParents: MealType[]
  exportForSanepid: MealType[]
  customMeals: Array<{
    id: string
    label: string
    description: string
  }>
  nutritionalGuidelines: string
}

const DEFAULT_MEAL_OPTIONS: MealOption[] = [
  { type: 'BREAKFAST', label: 'Śniadanie', description: 'Pierwszy posiłek dnia' },
  { type: 'SECOND_BREAKFAST', label: 'Drugie śniadanie', description: 'Posiłek przedpołudniowy' },
  { type: 'LUNCH', label: 'Obiad', description: 'Główny posiłek dnia' },
  { type: 'FIRST_SNACK', label: 'Podwieczorek I', description: 'Pierwszy posiłek popołudniowy' },
  { type: 'SECOND_SNACK', label: 'Podwieczorek II', description: 'Drugi posiłek popołudniowy' },
]

export default function SettingsPage() {
  const router = useRouter()
  const [settings, setSettings] = useState<MealSettings>({
    includeInCalories: [],
    exportForParents: [],
    exportForSanepid: [],
    customMeals: [],
    nutritionalGuidelines: ''
  })
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [showAddMealDialog, setShowAddMealDialog] = useState(false)
  const [newMealLabel, setNewMealLabel] = useState('')
  const [newMealDescription, setNewMealDescription] = useState('')
  const [showGuidelinesDialog, setShowGuidelinesDialog] = useState(false)
  const [guidelinesText, setGuidelinesText] = useState('')

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
      setSettings({
        includeInCalories: data.includeInCalories || [],
        exportForParents: data.exportForParents || [],
        exportForSanepid: data.exportForSanepid || [],
        customMeals: data.customMeals || [],
        nutritionalGuidelines: data.nutritionalGuidelines || ''
      })
      setGuidelinesText(data.nutritionalGuidelines || '')
    } catch (error) {
      console.error('Error fetching settings:', error)
      toast.error('Błąd podczas pobierania ustawień')
    } finally {
      setIsLoading(false)
    }
  }

  const handleToggleSetting = (mealType: MealType, settingType: keyof Omit<MealSettings, 'customMeals' | 'nutritionalGuidelines'>) => {
    setSettings(prev => {
      const currentArray = prev[settingType] as MealType[]
      if (currentArray.includes(mealType)) {
        return {
          ...prev,
          [settingType]: currentArray.filter(m => m !== mealType)
        }
      } else {
        return {
          ...prev,
          [settingType]: [...currentArray, mealType]
        }
      }
    })
  }

  const handleOpenGuidelinesEditor = () => {
    setGuidelinesText(settings.nutritionalGuidelines)
    setShowGuidelinesDialog(true)
  }

  const handleSaveGuidelines = async () => {
    try {
      // Zapisz wytyczne do state
      const updatedSettings = {
        ...settings,
        nutritionalGuidelines: guidelinesText
      }
      
      // Wyślij do API
      const response = await fetch('/api/settings', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updatedSettings),
      })

      if (!response.ok) {
        throw new Error('Nie udało się zapisać wytycznych')
      }

      // Zaktualizuj lokalny state
      setSettings(updatedSettings)
      setShowGuidelinesDialog(false)
      toast.success('Wytyczne żywieniowe zostały zapisane!')
    } catch (error) {
      console.error('Error saving guidelines:', error)
      toast.error('Błąd podczas zapisywania wytycznych')
    }
  }

  const handleAddCustomMeal = () => {
    if (!newMealLabel.trim()) {
      toast.error('Podaj nazwę posiłku')
      return
    }

    const newMeal = {
      id: `custom_${Date.now()}`,
      label: newMealLabel.trim(),
      description: newMealDescription.trim() || 'Własny posiłek'
    }

    setSettings(prev => ({
      ...prev,
      customMeals: [...prev.customMeals, newMeal]
    }))

    setNewMealLabel('')
    setNewMealDescription('')
    setShowAddMealDialog(false)
    toast.success('Dodano nowy posiłek')
  }

  const handleRemoveCustomMeal = (mealId: string) => {
    setSettings(prev => ({
      ...prev,
      customMeals: prev.customMeals.filter(m => m.id !== mealId)
    }))
    toast.success('Usunięto posiłek')
  }

  const handleSave = async () => {
    setIsSaving(true)
    try {
      const response = await fetch('/api/settings', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(settings),
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

  const allMealOptions: MealOption[] = [
    ...DEFAULT_MEAL_OPTIONS,
    ...settings.customMeals.map(cm => ({
      type: 'OTHER' as MealType,
      label: cm.label,
      description: cm.description,
      isCustom: true
    }))
  ]

  return (
    <div className="max-w-6xl mx-auto space-y-6 p-4">
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
          <h1 className="text-3xl font-bold text-gray-900">Ustawienia globalne</h1>
          <p className="text-gray-600">Konfiguracja aplikacji i jadłospisów</p>
        </div>
      </div>

      {/* Szybkie akcje */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => router.push('/menu/standards')}>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <SettingsIcon className="w-5 h-5 text-purple-600" />
              Edytuj normy żywieniowe
            </CardTitle>
            <CardDescription>
              Zarządzaj normami kalorycznymi i wartościami odżywczymi
            </CardDescription>
          </CardHeader>
        </Card>

        <Card className="hover:shadow-lg transition-shadow cursor-pointer" onClick={handleOpenGuidelinesEditor}>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <SettingsIcon className="w-5 h-5 text-purple-600" />
              Edytuj wytyczne żywieniowe
            </CardTitle>
            <CardDescription>
              Dostosuj tekst wytycznych wyświetlanych przy tworzeniu jadłospisów
            </CardDescription>
          </CardHeader>
        </Card>
      </div>

      {/* Karta ustawień */}
      <Card>
        <CardHeader>
          <CardTitle>Konfiguracja posiłków</CardTitle>
          <CardDescription>
            Wybierz ustawienia dla każdego posiłku. Możesz określić, czy posiłek jest wliczany do kaloryczności,
            eksportowany w jadłospisie dla rodziców oraz w zestawieniu dla sanepidu.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Nagłówki kolumn */}
          <div className="hidden md:grid md:grid-cols-[2fr_1fr_1fr_1fr_auto] gap-4 pb-2 border-b font-semibold text-sm text-gray-600">
            <div>Posiłek</div>
            <div className="text-center">Kaloryczność</div>
            <div className="text-center">Dla rodziców</div>
            <div className="text-center">Dla sanepidu</div>
            <div></div>
          </div>

          {/* Lista posiłków */}
          <div className="space-y-3">
            {allMealOptions.map((meal, index) => {
              const mealId = meal.isCustom ? settings.customMeals[index - DEFAULT_MEAL_OPTIONS.length]?.id : meal.type
              const includeInCal = meal.isCustom ? false : settings.includeInCalories.includes(meal.type)
              const exportParents = meal.isCustom ? false : settings.exportForParents.includes(meal.type)
              const exportSanepid = meal.isCustom ? false : settings.exportForSanepid.includes(meal.type)

              return (
                <div
                  key={meal.isCustom ? mealId : meal.type}
                  className="grid md:grid-cols-[2fr_1fr_1fr_1fr_auto] gap-4 p-4 rounded-lg border-2 border-gray-200 bg-gray-50 items-center"
                >
                  {/* Nazwa posiłku */}
                  <div>
                    <div className="font-semibold text-gray-900 flex items-center gap-2">
                      {meal.label}
                      {meal.isCustom && (
                        <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">Własny</span>
                      )}
                    </div>
                    <p className="text-sm text-gray-600 mt-1">{meal.description}</p>
                  </div>

                  {/* Checkboxy */}
                  {!meal.isCustom && (
                    <>
                      <div className="flex items-center justify-center">
                        <Checkbox
                          id={`${meal.type}_calories`}
                          checked={includeInCal}
                          onCheckedChange={() => handleToggleSetting(meal.type, 'includeInCalories')}
                          disabled={isSaving}
                        />
                        <Label htmlFor={`${meal.type}_calories`} className="sr-only">
                          Wlicz do kaloryczności
                        </Label>
                      </div>

                      <div className="flex items-center justify-center">
                        <Checkbox
                          id={`${meal.type}_parents`}
                          checked={exportParents}
                          onCheckedChange={() => handleToggleSetting(meal.type, 'exportForParents')}
                          disabled={isSaving}
                        />
                        <Label htmlFor={`${meal.type}_parents`} className="sr-only">
                          Eksport dla rodziców
                        </Label>
                      </div>

                      <div className="flex items-center justify-center">
                        <Checkbox
                          id={`${meal.type}_sanepid`}
                          checked={exportSanepid}
                          onCheckedChange={() => handleToggleSetting(meal.type, 'exportForSanepid')}
                          disabled={isSaving}
                        />
                        <Label htmlFor={`${meal.type}_sanepid`} className="sr-only">
                          Eksport dla sanepidu
                        </Label>
                      </div>
                    </>
                  )}

                  {meal.isCustom && (
                    <>
                      <div className="md:col-span-3 text-sm text-gray-500 text-center">
                        Własne posiłki nie są uwzględniane w eksportach
                      </div>
                    </>
                  )}

                  {/* Przycisk usuwania dla własnych posiłków */}
                  <div className="flex justify-end">
                    {meal.isCustom && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveCustomMeal(mealId as string)}
                        disabled={isSaving}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Przycisk dodawania nowego posiłku */}
          <div className="pt-4">
            <Button
              variant="outline"
              onClick={() => setShowAddMealDialog(true)}
              disabled={isSaving}
              className="w-full border-dashed border-2"
            >
              <Plus className="w-4 h-4 mr-2" />
              Dodaj kolejny posiłek
            </Button>
          </div>

          {/* Informacja */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="font-semibold text-blue-900 mb-2">Ważne informacje:</h3>
            <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
              <li>Zmiany wpłyną na wszystkie jadłospisy w systemie</li>
              <li>Własne posiłki można dodawać do jadłospisów, ale nie będą uwzględniane w eksportach</li>
              <li>Ustawienia eksportu będą wykorzystane w przyszłych funkcjach eksportu danych</li>
            </ul>
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
              disabled={isSaving}
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

      {/* Dialog dodawania nowego posiłku */}
      <Dialog open={showAddMealDialog} onOpenChange={setShowAddMealDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Dodaj nowy posiłek</DialogTitle>
            <DialogDescription>
              Wprowadź nazwę i opis nowego posiłku. Własne posiłki będą dostępne w jadłospisach.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="meal-label">Nazwa posiłku *</Label>
              <Input
                id="meal-label"
                value={newMealLabel}
                onChange={(e) => setNewMealLabel(e.target.value)}
                placeholder="np. Drugie śniadanie specjalne"
                maxLength={50}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="meal-description">Opis</Label>
              <Input
                id="meal-description"
                value={newMealDescription}
                onChange={(e) => setNewMealDescription(e.target.value)}
                placeholder="np. Posiłek dla dzieci z dodatkowymi potrzebami"
                maxLength={100}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddMealDialog(false)}>
              Anuluj
            </Button>
            <Button onClick={handleAddCustomMeal} disabled={!newMealLabel.trim()}>
              <Plus className="w-4 h-4 mr-2" />
              Dodaj posiłek
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog edycji wytycznych żywieniowych */}
      <Dialog open={showGuidelinesDialog} onOpenChange={setShowGuidelinesDialog}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edytuj wytyczne żywieniowe</DialogTitle>
            <DialogDescription>
              Dostosuj tekst wytycznych wyświetlanych przy tworzeniu jadłospisów. Wytyczne są formatowane automatycznie - każda nowa linia tworzy osobny akapit.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="guidelines">Treść wytycznych</Label>
              <Textarea
                id="guidelines"
                value={guidelinesText}
                onChange={(e) => setGuidelinesText(e.target.value)}
                placeholder="Wprowadź wytyczne żywieniowe..."
                className="min-h-[400px] font-mono text-sm"
              />
              <p className="text-xs text-gray-500">
                Pierwsze 3-4 zdania będą widoczne domyślnie, reszta po kliknięciu "Rozwiń"
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowGuidelinesDialog(false)}>
              Anuluj
            </Button>
            <Button onClick={handleSaveGuidelines}>
              <Save className="w-4 h-4 mr-2" />
              Zapisz wytyczne
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
