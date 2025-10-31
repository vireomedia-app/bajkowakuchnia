
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Lock, Eye, EyeOff, Mail } from 'lucide-react';

export default function LoginPage() {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showResetDialog, setShowResetDialog] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [isResetting, setIsResetting] = useState(false);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ password }),
      });

      const data = await response.json();

      if (data.success) {
        toast.success('Zalogowano pomyślnie!');
        // Wymuś pełne przeładowanie strony aby middleware mógł odczytać cookie
        window.location.href = '/';
      } else {
        toast.error(data.message || 'Nieprawidłowe hasło');
      }
    } catch (error) {
      console.error('Błąd logowania:', error);
      toast.error('Wystąpił błąd podczas logowania');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPasswordRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsResetting(true);

    try {
      const response = await fetch('/api/auth/request-reset', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: resetEmail }),
      });

      const data = await response.json();

      if (data.success) {
        toast.success('Link do resetowania hasła został wysłany na podany adres email');
        setShowResetDialog(false);
        setResetEmail('');
      } else {
        toast.error(data.message || 'Nie udało się wysłać emaila');
      }
    } catch (error) {
      console.error('Błąd resetowania hasła:', error);
      toast.error('Wystąpił błąd podczas resetowania hasła');
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-violet-50 via-purple-50 to-fuchsia-50 p-4">
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader className="space-y-1 text-center">
          <div className="mx-auto w-12 h-12 bg-violet-600 rounded-full flex items-center justify-center mb-4">
            <Lock className="w-6 h-6 text-white" />
          </div>
          <CardTitle className="text-2xl font-bold">
            Kartoteka Magazynowa
          </CardTitle>
          <CardDescription>
            W Małej Kuchni - Zaloguj się aby kontynuować
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleLogin}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password">Hasło</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Wprowadź hasło"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShowResetDialog(true)}
              className="text-sm text-violet-600 hover:text-violet-800 hover:underline"
            >
              Zapomniałem hasła
            </button>
          </CardContent>
          <CardFooter>
            <Button
              type="submit"
              className="w-full bg-violet-600 hover:bg-violet-700"
              disabled={isLoading}
            >
              {isLoading ? 'Logowanie...' : 'Zaloguj się'}
            </Button>
          </CardFooter>
        </form>
      </Card>

      {/* Dialog resetowania hasła */}
      <Dialog open={showResetDialog} onOpenChange={setShowResetDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="w-5 h-5 text-violet-600" />
              Resetowanie hasła
            </DialogTitle>
            <DialogDescription>
              Wprowadź swój adres email, a wyślemy Ci link do resetowania hasła.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleResetPasswordRequest}>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="reset-email">Adres email</Label>
                <Input
                  id="reset-email"
                  type="email"
                  placeholder="twoj@email.pl"
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                  required
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShowResetDialog(false);
                  setResetEmail('');
                }}
                disabled={isResetting}
              >
                Anuluj
              </Button>
              <Button
                type="submit"
                className="bg-violet-600 hover:bg-violet-700"
                disabled={isResetting}
              >
                {isResetting ? 'Wysyłanie...' : 'Wyślij link'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
