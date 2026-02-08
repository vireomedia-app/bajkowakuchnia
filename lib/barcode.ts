/**
 * Barcode validation and utility functions.
 * 
 * Validates barcodes against standard formats:
 * - EAN-8: 8 digits
 * - UPC-A: 12 digits
 * - EAN-13: 13 digits
 * - ITF-14: 14 digits
 * 
 * Only numeric strings of valid lengths are accepted.
 */

/** Valid barcode lengths for standard formats */
const VALID_BARCODE_LENGTHS = [8, 12, 13, 14]

/**
 * Check if a string is a valid barcode.
 * - Must be numeric only (no letters or special characters)
 * - Must be 8, 12, 13, or 14 digits long
 * 
 * @param barcode - The barcode string to validate
 * @returns true if valid, false otherwise
 */
export function isValidBarcode(barcode: string): boolean {
  if (!barcode) return false
  
  const trimmed = barcode.trim()
  
  // Must be numeric only
  if (!/^\d+$/.test(trimmed)) return false
  
  // Must be a valid length
  return VALID_BARCODE_LENGTHS.includes(trimmed.length)
}

/**
 * Get a human-readable error message for an invalid barcode.
 * 
 * @param barcode - The invalid barcode
 * @returns Error message in Polish
 */
export function getBarcodeValidationError(barcode: string): string {
  if (!barcode || !barcode.trim()) {
    return 'Kod kreskowy nie może być pusty'
  }
  
  const trimmed = barcode.trim()
  
  if (!/^\d+$/.test(trimmed)) {
    return 'Kod kreskowy może zawierać tylko cyfry'
  }
  
  return `Nieprawidłowa długość kodu (${trimmed.length} cyfr). Prawidłowe długości: 8 (EAN-8), 12 (UPC), 13 (EAN-13), 14 (ITF-14)`
}

/**
 * Generate a unique name for an unknown product.
 * Format: "Nieznany produkt #XXXX" where XXXX is a random 4-digit number.
 * 
 * @returns A unique unknown product name
 */
export function generateUnknownProductName(): string {
  const randomNumber = Math.floor(1000 + Math.random() * 9000)
  return `Nieznany produkt #${randomNumber}`
}
