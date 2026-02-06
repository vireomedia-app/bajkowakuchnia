
'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AlertTriangle, Lock } from 'lucide-react';
import { toast } from 'sonner';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface EditStandardsModalProps {
  standard: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function EditStandardsModal({
  standard,
  open,
  onOpenChange,
  onSuccess,
}: EditStandardsModalProps) {
  const [formData, setFormData] = useState({
    name: standard?.name || '',
    energyMin: standard?.energyMin || 870,
    energyMax: standard?.energyMax || 1062,
    proteinPercentMin: standard?.proteinPercentMin || 10,
    proteinPercentMax: standard?.proteinPercentMax || 20,
    fatPercentMin: standard?.fatPercentMin || 30,
    fatPercentMax: standard?.fatPercentMax || 40,
    carbohydratesPercentMin: standard?.carbohydratesPercentMin || 45,
    carbohydratesPercentMax: standard?.carbohydratesPercentMax || 65,
    calcium: standard?.calcium || 750,
    iron: standard?.iron || 7.5,
    vitaminC: standard?.vitaminC || 37.5,
  });

  const [showConfirmation, setShowConfirmation] = useState(false);
  const [confirmationChecked, setConfirmationChecked] = useState(false);
  const [confirmationText, setConfirmationText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleFirstSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Walidacja podstawowa
    if (!formData.name.trim()) {
      toast.error('Nazwa norm jest wymagana');
      return;
    }

    if (parseFloat(formData.energyMin.toString()) >= parseFloat(formData.energyMax.toString())) {
      toast.error('Minimalna energia musi być mniejsza niż maksymalna');
      return;
    }

    // Pokazujemy dialog potwierdzenia
    setShowConfirmation(true);
  };

  const handleFinalSubmit = async () => {
    if (!confirmationChecked) {
      toast.error('Musisz potwierdzić zrozumienie konsekwencji');
      return;
    }

    if (confirmationText !== 'ZMIENIAM NORMY') {
      toast.error('Wpisz dokładnie: ZMIENIAM NORMY');
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch(`/api/standards/${standard.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Nie udało się zaktualizować norm');
      }

      toast.success('Normy żywieniowe zostały zaktualizowane');
      setShowConfirmation(false);
      setConfirmationChecked(false);
      setConfirmationText('');
      onOpenChange(false);
      onSuccess();
    } catch (error: any) {
      toast.error(error.message || 'Wystąpił błąd podczas aktualizacji');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-2xl">
              <Lock className="w-6 h-6 text-orange-600" />
              Edycja norm żywieniowych
            </DialogTitle>
            <DialogDescription>
              Zmiana norm żywieniowych jest operacją krytyczną. Wpływa na wszystkie receptury i jadłospisy w systemie.
            </DialogDescription>
          </DialogHeader>

          <Alert className="border-orange-500 bg-orange-50">
            <AlertTriangle className="h-5 w-5 text-orange-600" />
            <AlertDescription className="text-sm text-orange-900 font-medium">
              UWAGA: Normy żywieniowe powinny być zmieniane wyłącznie w przypadku zmiany przepisów prawnych 
              lub wytycznych żywieniowych. Wprowadź zmiany tylko jeśli masz pewność co do nowych wartości.
            </AlertDescription>
          </Alert>

          <form onSubmit={handleFirstSubmit} className="space-y-6">
            {/* Nazwa */}
            <div className="space-y-2">
              <Label htmlFor="name">Nazwa zestawu norm</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => handleInputChange('name', e.target.value)}
                placeholder="np. Przedszkole 3-6 lat"
                required
              />
            </div>

            {/* Energia */}
            <div className="space-y-3">
              <h4 className="font-semibold text-lg">Energia (kalorie dziennie)</h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="energyMin">Minimum (kcal)</Label>
                  <Input
                    id="energyMin"
                    type="number"
                    step="0.1"
                    value={formData.energyMin}
                    onChange={(e) => handleInputChange('energyMin', e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="energyMax">Maksimum (kcal)</Label>
                  <Input
                    id="energyMax"
                    type="number"
                    step="0.1"
                    value={formData.energyMax}
                    onChange={(e) => handleInputChange('energyMax', e.target.value)}
                    required
                  />
                </div>
              </div>
            </div>

            {/* Makroskładniki */}
            <div className="space-y-3">
              <h4 className="font-semibold text-lg">Procentowy udział makroskładników w energii</h4>
              
              {/* Białko */}
              <div className="space-y-2">
                <Label className="text-base">Białko (%)</Label>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="proteinPercentMin" className="text-sm text-gray-600">Min</Label>
                    <Input
                      id="proteinPercentMin"
                      type="number"
                      step="0.1"
                      value={formData.proteinPercentMin}
                      onChange={(e) => handleInputChange('proteinPercentMin', e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="proteinPercentMax" className="text-sm text-gray-600">Max</Label>
                    <Input
                      id="proteinPercentMax"
                      type="number"
                      step="0.1"
                      value={formData.proteinPercentMax}
                      onChange={(e) => handleInputChange('proteinPercentMax', e.target.value)}
                      required
                    />
                  </div>
                </div>
              </div>

              {/* Tłuszcz */}
              <div className="space-y-2">
                <Label className="text-base">Tłuszcz (%)</Label>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="fatPercentMin" className="text-sm text-gray-600">Min</Label>
                    <Input
                      id="fatPercentMin"
                      type="number"
                      step="0.1"
                      value={formData.fatPercentMin}
                      onChange={(e) => handleInputChange('fatPercentMin', e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="fatPercentMax" className="text-sm text-gray-600">Max</Label>
                    <Input
                      id="fatPercentMax"
                      type="number"
                      step="0.1"
                      value={formData.fatPercentMax}
                      onChange={(e) => handleInputChange('fatPercentMax', e.target.value)}
                      required
                    />
                  </div>
                </div>
              </div>

              {/* Węglowodany */}
              <div className="space-y-2">
                <Label className="text-base">Węglowodany (%)</Label>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="carbohydratesPercentMin" className="text-sm text-gray-600">Min</Label>
                    <Input
                      id="carbohydratesPercentMin"
                      type="number"
                      step="0.1"
                      value={formData.carbohydratesPercentMin}
                      onChange={(e) => handleInputChange('carbohydratesPercentMin', e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="carbohydratesPercentMax" className="text-sm text-gray-600">Max</Label>
                    <Input
                      id="carbohydratesPercentMax"
                      type="number"
                      step="0.1"
                      value={formData.carbohydratesPercentMax}
                      onChange={(e) => handleInputChange('carbohydratesPercentMax', e.target.value)}
                      required
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Mikroskładniki */}
            <div className="space-y-3">
              <h4 className="font-semibold text-lg">Mikroskładniki (wartości docelowe dziennie)</h4>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="calcium">Wapń (mg)</Label>
                  <Input
                    id="calcium"
                    type="number"
                    step="0.1"
                    value={formData.calcium}
                    onChange={(e) => handleInputChange('calcium', e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="iron">Żelazo (mg)</Label>
                  <Input
                    id="iron"
                    type="number"
                    step="0.1"
                    value={formData.iron}
                    onChange={(e) => handleInputChange('iron', e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="vitaminC">Witamina C (mg)</Label>
                  <Input
                    id="vitaminC"
                    type="number"
                    step="0.1"
                    value={formData.vitaminC}
                    onChange={(e) => handleInputChange('vitaminC', e.target.value)}
                    required
                  />
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Anuluj
              </Button>
              <Button type="submit" className="bg-orange-600 hover:bg-orange-700">
                Dalej
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog potwierdzenia */}
      <AlertDialog open={showConfirmation} onOpenChange={setShowConfirmation}>
        <AlertDialogContent className="max-w-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-xl text-red-600">
              <AlertTriangle className="w-6 h-6" />
              POTWIERDZENIE ZMIANY NORM ŻYWIENIOWYCH
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-4 text-base">
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 space-y-3">
                <p className="font-semibold text-red-900">
                  Zmiana norm żywieniowych jest operacją krytyczną!
                </p>
                <ul className="space-y-2 text-sm text-red-800">
                  <li>• Wpłynie na WSZYSTKIE receptury w systemie</li>
                  <li>• Wpłynie na WSZYSTKIE jadłospisy</li>
                  <li>• Zmieni walidację wartości odżywczych we wszystkich modułach</li>
                  <li>• Może spowodować, że wcześniej zaakceptowane jadłospisy przestaną spełniać normy</li>
                </ul>
              </div>

              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <p className="font-semibold text-yellow-900 mb-2">
                  Zmieniaj normy wyłącznie gdy:
                </p>
                <ul className="space-y-1 text-sm text-yellow-800">
                  <li>• Zmieniły się przepisy prawne dotyczące żywienia dzieci</li>
                  <li>• Otrzymałeś nowe wytyczne od właściwych instytucji (np. sanepid, ministerstwo)</li>
                  <li>• Jesteś pewien co do wprowadzanych wartości</li>
                </ul>
              </div>

              <div className="space-y-3 pt-2">
                <div className="flex items-start gap-3">
                  <Checkbox
                    id="confirm-checkbox"
                    checked={confirmationChecked}
                    onCheckedChange={(checked) => setConfirmationChecked(checked as boolean)}
                    className="mt-1"
                  />
                  <label
                    htmlFor="confirm-checkbox"
                    className="text-sm font-medium leading-relaxed cursor-pointer"
                  >
                    Potwierdzam, że rozumiem konsekwencje tej zmiany i zmieniam normy świadomie 
                    w związku ze zmianą przepisów prawnych lub oficjalnych wytycznych żywieniowych.
                  </label>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirmation-text" className="text-sm font-semibold">
                    Aby potwierdzić, wpisz dokładnie: <span className="text-red-600">ZMIENIAM NORMY</span>
                  </Label>
                  <Input
                    id="confirmation-text"
                    value={confirmationText}
                    onChange={(e) => setConfirmationText(e.target.value)}
                    placeholder="Wpisz: ZMIENIAM NORMY"
                    className="font-mono"
                  />
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => {
                setShowConfirmation(false);
                setConfirmationChecked(false);
                setConfirmationText('');
              }}
            >
              Anuluj - nie zmieniaj norm
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleFinalSubmit}
              disabled={!confirmationChecked || confirmationText !== 'ZMIENIAM NORMY' || isSubmitting}
              className="bg-red-600 hover:bg-red-700"
            >
              {isSubmitting ? 'Zapisywanie...' : 'Zatwierdź zmianę norm'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
