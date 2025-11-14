
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { NutritionalGuidelines } from '@/components/nutritional-guidelines';
import { toast } from 'sonner';
import { CalendarDays, Loader2, CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';
import { pl } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import type { NutritionalStandards, Season } from '@/lib/types';

interface MealPlanCreatorProps {
  standards: NutritionalStandards[];
}

export function MealPlanCreator({ standards }: MealPlanCreatorProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [guidelines, setGuidelines] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    startDate: undefined as Date | undefined,
    endDate: undefined as Date | undefined,
    season: '' as Season | '',
    description: '',
    standardsId: standards[0]?.id || '',
  });

  useEffect(() => {
    // Fetch nutritional guidelines from settings
    const fetchGuidelines = async () => {
      try {
        const response = await fetch('/api/settings');
        if (response.ok) {
          const data = await response.json();
          setGuidelines(data.nutritionalGuidelines || '');
        }
      } catch (error) {
        console.error('Error fetching guidelines:', error);
      }
    };
    fetchGuidelines();
  }, []);

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
          startDate: formData.startDate ? formData.startDate.toISOString() : null,
          endDate: formData.endDate ? formData.endDate.toISOString() : null,
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
    <div className="space-y-6 max-w-2xl mx-auto">
      {/* Wytyczne żywieniowe */}
      {guidelines && <NutritionalGuidelines guidelines={guidelines} />}
      
      <Card>
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

            <div className="space-y-4">
              <div>
                <Label>Zakres dat</Label>
                <div className="grid grid-cols-2 gap-4 mt-2">
                  <div>
                    <Label htmlFor="startDate" className="text-sm text-muted-foreground">Data rozpoczęcia</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          id="startDate"
                          variant="outline"
                          className={cn(
                            "w-full justify-start text-left font-normal",
                            !formData.startDate && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {formData.startDate ? format(formData.startDate, "PPP", { locale: pl }) : "Wybierz datę"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={formData.startDate}
                          onSelect={(date) => setFormData({ ...formData, startDate: date })}
                          locale={pl}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                  <div>
                    <Label htmlFor="endDate" className="text-sm text-muted-foreground">Data zakończenia</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          id="endDate"
                          variant="outline"
                          className={cn(
                            "w-full justify-start text-left font-normal",
                            !formData.endDate && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {formData.endDate ? format(formData.endDate, "PPP", { locale: pl }) : "Wybierz datę"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={formData.endDate}
                          onSelect={(date) => setFormData({ ...formData, endDate: date })}
                          locale={pl}
                          disabled={(date) => formData.startDate ? date < formData.startDate : false}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>
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
    </div>
  );
}
