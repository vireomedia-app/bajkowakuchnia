
import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

export async function POST(request: NextRequest) {
  try {
    const { token, newPassword } = await request.json();
    
    if (!token || !newPassword) {
      return NextResponse.json(
        { success: false, message: 'Brak wymaganych danych' },
        { status: 400 }
      );
    }
    
    // Znajdź token w bazie
    const resetToken = await prisma.passwordResetToken.findUnique({
      where: { token },
      include: { user: true }
    });
    
    if (!resetToken) {
      return NextResponse.json(
        { success: false, message: 'Nieprawidłowy lub nieistniejący token' },
        { status: 400 }
      );
    }
    
    // Sprawdź czy token nie wygasł
    if (new Date() > resetToken.expiresAt) {
      return NextResponse.json(
        { success: false, message: 'Token wygasł. Poproś o nowy link do resetowania hasła.' },
        { status: 400 }
      );
    }
    
    // Sprawdź czy token nie został już użyty
    if (resetToken.used) {
      return NextResponse.json(
        { success: false, message: 'Ten token został już użyty' },
        { status: 400 }
      );
    }
    
    // Zahashuj nowe hasło
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    
    // Zaktualizuj hasło użytkownika
    await prisma.user.update({
      where: { id: resetToken.userId },
      data: { password: hashedPassword }
    });
    
    // Oznacz token jako użyty
    await prisma.passwordResetToken.update({
      where: { id: resetToken.id },
      data: { used: true }
    });
    
    return NextResponse.json({
      success: true,
      message: 'Hasło zostało zmienione pomyślnie'
    });
    
  } catch (error) {
    console.error('Błąd resetowania hasła:', error);
    return NextResponse.json(
      { success: false, message: 'Wystąpił błąd podczas zmiany hasła' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}
