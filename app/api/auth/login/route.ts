
import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

export async function POST(request: NextRequest) {
  try {
    const { password } = await request.json();
    
    // Pobierz użytkownika z bazy
    const user = await prisma.user.findFirst();
    
    if (!user) {
      return NextResponse.json(
        { success: false, message: 'Błąd konfiguracji systemu' },
        { status: 500 }
      );
    }
    
    // Sprawdź hasło
    const passwordMatch = await bcrypt.compare(password, user.password);
    
    if (passwordMatch) {
      const response = NextResponse.json({ 
        success: true, 
        message: 'Zalogowano pomyślnie' 
      });
      
      // Ustaw cookie z sesją (ważne przez 7 dni) - zapisz ID użytkownika
      response.cookies.set('auth_session', user.id, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 7, // 7 dni
        path: '/',
      });
      
      return response;
    } else {
      return NextResponse.json(
        { success: false, message: 'Nieprawidłowe hasło' },
        { status: 401 }
      );
    }
  } catch (error) {
    console.error('Błąd logowania:', error);
    return NextResponse.json(
      { success: false, message: 'Wystąpił błąd podczas logowania' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}
