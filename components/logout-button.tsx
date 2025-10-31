
'use client';

import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { LogOut } from 'lucide-react';
import { toast } from 'sonner';

export function LogoutButton() {
  const router = useRouter();

  const handleLogout = async () => {
    try {
      const response = await fetch('/api/auth/logout', {
        method: 'POST',
      });

      if (response.ok) {
        toast.success('Wylogowano pomyślnie');
        router.push('/login');
        router.refresh();
      } else {
        toast.error('Wystąpił błąd podczas wylogowywania');
      }
    } catch (error) {
      console.error('Błąd wylogowania:', error);
      toast.error('Wystąpił błąd podczas wylogowywania');
    }
  };

  return (
    <Button
      onClick={handleLogout}
      variant="outline"
      size="sm"
      className="gap-2"
    >
      <LogOut className="w-4 h-4" />
      Wyloguj
    </Button>
  );
}
