
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { z } from 'zod'

export const dynamic = "force-dynamic";

const updateSettingsSchema = z.object({
  enabledMeals: z.array(z.enum(['BREAKFAST', 'SECOND_BREAKFAST', 'LUNCH', 'FIRST_SNACK', 'SECOND_SNACK', 'DINNER', 'OTHER']))
})

// GET - pobierz ustawienia
export async function GET(request: NextRequest) {
  try {
    // Znajdź pierwsze (i jedyne) ustawienia, lub utwórz domyślne
    let settings = await prisma.appSettings.findFirst()
    
    if (!settings) {
      // Utwórz domyślne ustawienia
      settings = await prisma.appSettings.create({
        data: {
          enabledMeals: ['BREAKFAST', 'SECOND_BREAKFAST', 'LUNCH', 'FIRST_SNACK', 'DINNER']
        }
      })
    }
    
    return NextResponse.json(settings)
  } catch (error) {
    console.error('Error fetching settings:', error)
    return NextResponse.json(
      { error: 'Błąd podczas pobierania ustawień' },
      { status: 500 }
    )
  }
}

// PATCH - zaktualizuj ustawienia
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    
    // Validate input
    const validatedData = updateSettingsSchema.parse(body)
    
    // Znajdź istniejące ustawienia
    let settings = await prisma.appSettings.findFirst()
    
    if (!settings) {
      // Utwórz nowe ustawienia
      settings = await prisma.appSettings.create({
        data: {
          enabledMeals: validatedData.enabledMeals
        }
      })
    } else {
      // Zaktualizuj istniejące
      settings = await prisma.appSettings.update({
        where: { id: settings.id },
        data: {
          enabledMeals: validatedData.enabledMeals
        }
      })
    }
    
    return NextResponse.json(settings)
  } catch (error) {
    console.error('Error updating settings:', error)
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Nieprawidłowe dane', details: error.errors },
        { status: 400 }
      )
    }
    
    return NextResponse.json(
      { error: 'Błąd podczas aktualizacji ustawień' },
      { status: 500 }
    )
  }
}
