/**
 * Email utilities for the application.
 * 
 * Uses Resend for email delivery (works on Vercel and other serverless platforms).
 */

import { Resend } from 'resend'

// Lazy initialization of Resend client
let resendClient: Resend | null = null

function getResendClient(): Resend {
  if (!resendClient) {
    const apiKey = process.env.RESEND_API_KEY
    if (!apiKey) {
      console.warn('[Email] RESEND_API_KEY not configured - emails will not be sent')
    }
    resendClient = new Resend(apiKey || '')
  }
  return resendClient
}

/**
 * Format date for display in Polish format.
 */
function formatDatePL(date: Date): string {
  return date.toLocaleString('pl-PL', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/**
 * Format file size for display.
 */
function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

/**
 * Generate backup filename with timestamp.
 */
function generateBackupFileName(date: Date): string {
  const timestamp = date.toISOString()
    .replace(/[:.]/g, '-')
    .replace('T', '-')
    .replace('Z', '')
    .slice(0, 19) // YYYY-MM-DD-HH-mm-ss
  return `backup-${timestamp}.json`
}

export interface SendBackupEmailOptions {
  recipientEmail: string
  jsonData: string
  date?: Date
}

export interface SendBackupEmailResult {
  success: boolean
  error?: string
  messageId?: string
}

/**
 * Send backup data via email.
 * 
 * @param options - Email options including recipient and JSON data
 * @returns Result indicating success or failure
 */
export async function sendBackupByEmail(
  options: SendBackupEmailOptions
): Promise<SendBackupEmailResult> {
  const { recipientEmail, jsonData, date = new Date() } = options
  
  console.log(`[Email] Sending backup to: ${recipientEmail}`)
  
  // Check if Resend API key is configured
  if (!process.env.RESEND_API_KEY) {
    console.error('[Email] RESEND_API_KEY not configured - cannot send email')
    return {
      success: false,
      error: 'RESEND_API_KEY nie jest skonfigurowany',
    }
  }
  
  const resend = getResendClient()
  const fileName = generateBackupFileName(date)
  const fileSize = Buffer.byteLength(jsonData, 'utf-8')
  const dateFormatted = formatDatePL(date)
  const datePart = date.toISOString().split('T')[0]
  
  try {
    const result = await resend.emails.send({
      from: 'Bajkowa Kuchnia <onboarding@resend.dev>',
      to: recipientEmail,
      subject: `Automatyczny backup Bajkowa Kuchnia - ${datePart}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #f97316; margin-bottom: 20px;">🗄️ Automatyczny backup</h2>
          
          <p style="color: #374151; font-size: 16px; line-height: 1.6;">
            Automatyczny tygodniowy backup został wygenerowany.
          </p>
          
          <div style="background-color: #f9fafb; border-radius: 8px; padding: 16px; margin: 20px 0;">
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px 0; color: #6b7280; width: 100px;">Data:</td>
                <td style="padding: 8px 0; color: #111827; font-weight: 500;">${dateFormatted}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #6b7280;">Rozmiar:</td>
                <td style="padding: 8px 0; color: #111827; font-weight: 500;">${formatFileSize(fileSize)}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #6b7280;">Plik:</td>
                <td style="padding: 8px 0; color: #111827; font-weight: 500;">${fileName}</td>
              </tr>
            </table>
          </div>
          
          <p style="color: #374151; font-size: 14px; line-height: 1.6;">
            Plik JSON znajduje się w załączniku. Możesz go użyć do przywrócenia danych w razie potrzeby.
          </p>
          
          <hr style="margin: 24px 0; border: none; border-top: 1px solid #e5e7eb;">
          
          <p style="color: #9ca3af; font-size: 12px;">
            Bajkowa Kuchnia - System zarządzania magazynem<br>
            Ta wiadomość została wygenerowana automatycznie.
          </p>
        </div>
      `,
      attachments: [
        {
          filename: fileName,
          content: Buffer.from(jsonData, 'utf-8'),
        },
      ],
    })
    
    console.log(`[Email] Backup email sent successfully to ${recipientEmail}`)
    
    return {
      success: true,
      messageId: result.data?.id,
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error(`[Email] Failed to send backup email: ${errorMessage}`)
    
    return {
      success: false,
      error: errorMessage,
    }
  }
}

/**
 * Validate email format.
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}
