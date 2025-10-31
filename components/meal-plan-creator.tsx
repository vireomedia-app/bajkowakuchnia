
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { CalendarDays, Loader2 } from 'lucide-react';
import type { NutritionalStandards, Season } from '@/lib/types';

interface MealPlanCreatorProps {
  standards: NutritionalStandards[];
}

export function MealPlanCreator({ standards }: MealPlanCreatorProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    weekNumber: '',
    season: '' as Season | '',
    description: '',
    standardsId: standards[0]?.id || '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name.trim()) {
      toast.error('Podaj nazwę jadłospisu');
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch('/api/meal-plans', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: formData.name.trim(),
          weekNumber: formData.weekNumber ? parseInt(formData.weekNumber) : null,
          season: formData.season || null,
          description: formData.description.trim() || null,
          standardsId: formData.standardsId || null,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create meal plan');
      }

      const mealPlan = await response.json();
      toast.success('Jadłospis został utworzony');
      router.push(`/menu/meal-plans/${mealPlan.id}`);
    } catch (error) {
      console.error('Error creating meal plan:', error);
      toast.error('Błąd podczas tworzenia jadłospisu');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CalendarDays className="w-5 h-5" />
          Podstawowe informacje
        </CardTitle>
        <CardDescription>
          Wypełnij dane nowego jadłospisu tygodniowego
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-4">
            <div>
              <Label htmlFor="name">Nazwa jadłospisu *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Np. Tydzień 4 - Wiosna/Lato"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="weekNumber">Numer tygodnia</Label>
                <Input
                  id="weekNumber"
                  type="number"
                  min="1"
                  max="52"
                  value={formData.weekNumber}
                  onChange={(e) => setFormData({ ...formData, weekNumber: e.target.value })}
                  placeholder="1-52"
                />
              </div>

              <div>
                <Label htmlFor="season">Sezon</Label>
                <Select
                  value={formData.season}
                  onValueChange={(value) => setFormData({ ...formData, season: value as Season })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Wybierz sezon" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="SPRING">Wiosna</SelectItem>
                    <SelectItem value="SUMMER">Lato</SelectItem>
                    <SelectItem value="AUTUMN">Jesień</SelectItem>
                    <SelectItem value="WINTER">Zima</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label htmlFor="description">Opis (opcjonalnie)</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Dodatkowe informacje o jadłospisie"
                rows={3}
              />
            </div>

            {standards.length > 0 && (
              <div>
                <Label htmlFor="standards">Normy żywieniowe</Label>
                <Select
                  value={formData.standardsId}
                  onValueChange={(value) => setFormData({ ...formData, standardsId: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Wybierz normy" />
                  </SelectTrigger>
                  <SelectContent>
                    {standards.map((standard) => (
                      <SelectItem key={standard.id} value={standard.id}>
                        {standard.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.back()}
              disabled={isLoading}
            >
              Anuluj
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Utwórz jadłospis
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
