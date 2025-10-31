import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { Resend } from 'resend';
import crypto from 'crypto';

const prisma = new PrismaClient();
const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();
    
    // Sprawdź czy email pasuje do admina
    const user = await prisma.user.findUnique({
      where: { email }
    });
    
    if (!user) {
      // Nie ujawniamy czy email istnieje w systemie (security best practice)
      return NextResponse.json({
        success: true,
        message: 'Jeśli podany email istnieje w systemie, otrzymasz wiadomość z linkiem do resetowania hasła.'
      });
    }
    
    // Generuj losowy token
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 1); // Token ważny przez 1 godzinę
    
    // Zapisz token w bazie
    await prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        token,
        expiresAt,
      }
    });
    
    // Utwórz link do resetowania
    const resetUrl = `${process.env.NEXT_PUBLIC_BASE_URL}/reset-password?token=${token}`;
    
    // Wyślij email
    await resend.emails.send({
      from: 'Kartoteka Magazynowa <onboarding@resend.dev>',
      to: email,
      subject: 'Reset hasła - Kartoteka Magazynowa',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #7c3aed;">Resetowanie hasła</h2>
          <p>Otrzymaliśmy żądanie zresetowania hasła do Twojego konta w systemie Kartoteka Magazynowa - W Małej Kuchni.</p>
          <p>Kliknij w poniższy link, aby ustawić nowe hasło:</p>
          <a href="${resetUrl}" style="display: inline-block; padding: 12px 24px; background-color: #7c3aed; color: white; text-decoration: none; border-radius: 6px; margin: 16px 0;">
            Zresetuj hasło
          </a>
          <p style="color: #666; font-size: 14px;">Link jest ważny przez 1 godzinę.</p>
          <p style="color: #666; font-size: 14px;">Jeśli nie prosiłeś o reset hasła, zignoruj tę wiadomość.</p>
          <hr style="margin: 32px 0; border: none; border-top: 1px solid #e5e7eb;">
          <p style="color: #999; font-size: 12px;">Kartoteka Magazynowa - W Małej Kuchni</p>
        </div>
      `
    });
    
    return NextResponse.json({
      success: true,
      message: 'Link do resetowania hasła został wysłany na podany adres email.'
    });
    
  } catch (error) {
    console.error('Błąd przy żądaniu resetu hasła:', error);
    return NextResponse.json(
      { success: false, message: 'Wystąpił błąd podczas przetwarzania żądania' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}
