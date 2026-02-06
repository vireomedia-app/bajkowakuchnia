
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { z } from 'zod'

export const dynamic = "force-dynamic";

const customMealSchema = z.object({
  id: z.string(),
  label: z.string(),
  description: z.string()
})

const updateSettingsSchema = z.object({
  includeInCalories: z.array(z.enum(['BREAKFAST', 'SECOND_BREAKFAST', 'LUNCH', 'FIRST_SNACK', 'SECOND_SNACK', 'DINNER', 'OTHER'])).optional(),
  exportForParents: z.array(z.enum(['BREAKFAST', 'SECOND_BREAKFAST', 'LUNCH', 'FIRST_SNACK', 'SECOND_SNACK', 'DINNER', 'OTHER'])).optional(),
  exportForSanepid: z.array(z.enum(['BREAKFAST', 'SECOND_BREAKFAST', 'LUNCH', 'FIRST_SNACK', 'SECOND_SNACK', 'DINNER', 'OTHER'])).optional(),
  customMeals: z.array(customMealSchema).optional(),
  nutritionalGuidelines: z.string().optional(),
  backupEmail: z.string().email('Podaj poprawny adres e-mail').optional()
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
          enabledMeals: ['BREAKFAST', 'SECOND_BREAKFAST', 'LUNCH', 'FIRST_SNACK'] as any,
          includeInCalories: ['BREAKFAST', 'SECOND_BREAKFAST', 'LUNCH', 'FIRST_SNACK'] as any,
          exportForParents: ['BREAKFAST', 'SECOND_BREAKFAST', 'LUNCH', 'FIRST_SNACK'] as any,
          exportForSanepid: ['BREAKFAST', 'SECOND_BREAKFAST', 'LUNCH', 'FIRST_SNACK'] as any,
          customMeals: []
        }
      })
    }
    
    // Parse customMeals if it's a JSON string
    const response = {
      ...settings,
      customMeals: typeof settings.customMeals === 'string' 
        ? JSON.parse(settings.customMeals) 
        : settings.customMeals || []
    }
    
    return NextResponse.json(response)
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
    
    const updateData: any = {}
    
    if (validatedData.includeInCalories !== undefined) {
      updateData.includeInCalories = validatedData.includeInCalories
      // Keep enabledMeals in sync with includeInCalories for backwards compatibility
      updateData.enabledMeals = validatedData.includeInCalories
    }
    
    if (validatedData.exportForParents !== undefined) {
      updateData.exportForParents = validatedData.exportForParents
    }
    
    if (validatedData.exportForSanepid !== undefined) {
      updateData.exportForSanepid = validatedData.exportForSanepid
    }
    
    if (validatedData.customMeals !== undefined) {
      updateData.customMeals = validatedData.customMeals
    }
    
    if (validatedData.nutritionalGuidelines !== undefined) {
      updateData.nutritionalGuidelines = validatedData.nutritionalGuidelines
    }
    
    if (validatedData.backupEmail !== undefined) {
      updateData.backupEmail = validatedData.backupEmail
    }
    
    if (!settings) {
      // Utwórz nowe ustawienia
      settings = await prisma.appSettings.create({
        data: {
          enabledMeals: updateData.enabledMeals || (['BREAKFAST', 'SECOND_BREAKFAST', 'LUNCH', 'FIRST_SNACK'] as any),
          includeInCalories: updateData.includeInCalories || (['BREAKFAST', 'SECOND_BREAKFAST', 'LUNCH', 'FIRST_SNACK'] as any),
          exportForParents: updateData.exportForParents || (['BREAKFAST', 'SECOND_BREAKFAST', 'LUNCH', 'FIRST_SNACK'] as any),
          exportForSanepid: updateData.exportForSanepid || (['BREAKFAST', 'SECOND_BREAKFAST', 'LUNCH', 'FIRST_SNACK'] as any),
          customMeals: updateData.customMeals || []
        }
      })
    } else {
      // Zaktualizuj istniejące
      settings = await prisma.appSettings.update({
        where: { id: settings.id },
        data: updateData
      })
    }
    
    // Parse customMeals for response
    const response = {
      ...settings,
      customMeals: typeof settings.customMeals === 'string' 
        ? JSON.parse(settings.customMeals) 
        : settings.customMeals || []
    }
    
    return NextResponse.json(response)
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
