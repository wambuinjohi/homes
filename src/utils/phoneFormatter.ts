/**
 * Phone number formatting utilities for Kenyan numbers
 * Handles various input formats and standardizes to E.164 format (254...)
 */

export interface PhoneFormatResult {
  formatted: string; // E.164 format (254722241745)
  original: string;
  isValid: boolean;
  error?: string;
}

/**
 * Format phone number to E.164 format (254...)
 * 
 * Handles various input formats:
 * - 0722241745 -> 254722241745
 * - +254722241745 -> 254722241745
 * - 254722241745 -> 254722241745
 * - 722241745 -> 254722241745
 * 
 * @param phone - The phone number to format
 * @param countryCode - Default country code (default: 254 for Kenya)
 * @returns PhoneFormatResult with formatted number and validation status
 */
export function formatPhoneNumber(
  phone: string | null | undefined,
  countryCode: string = '254'
): PhoneFormatResult {
  const original = phone || '';
  
  if (!phone) {
    return {
      formatted: '',
      original,
      isValid: false,
      error: 'Phone number is required'
    };
  }

  // Remove all non-numeric characters
  let cleaned = phone.replace(/\D/g, '');

  // Handle different input formats
  if (cleaned.startsWith(countryCode)) {
    // Already has country code: 254722241745
    cleaned = cleaned;
  } else if (cleaned.startsWith('0')) {
    // Remove leading 0 and add country code: 0722241745 -> 254722241745
    cleaned = countryCode + cleaned.substring(1);
  } else if (cleaned.length === 9) {
    // Missing leading 0 and country code: 722241745 -> 254722241745
    cleaned = countryCode + cleaned;
  } else if (cleaned.length === 10 && !cleaned.startsWith('0')) {
    // Has 10 digits but doesn't start with 0: might be international without +
    // Assume it needs country code prepended
    cleaned = countryCode + cleaned;
  }

  // Validate length (should be 12 digits for Kenyan numbers: 254 + 9 digits)
  const expectedLength = countryCode.length + 9;
  if (cleaned.length !== expectedLength) {
    return {
      formatted: cleaned,
      original,
      isValid: false,
      error: `Invalid phone number length. Expected ${expectedLength} digits, got ${cleaned.length}`
    };
  }

  // Validate format (254 followed by 7/1/0)
  const kenyanMobilePattern = /^254[710]\d{8}$/;
  if (!kenyanMobilePattern.test(cleaned)) {
    return {
      formatted: cleaned,
      original,
      isValid: false,
      error: 'Invalid Kenyan mobile number format. Must start with 254 followed by 7, 1, or 0'
    };
  }

  return {
    formatted: cleaned,
    original,
    isValid: true
  };
}

/**
 * Batch format multiple phone numbers
 * @param phones - Array of phone numbers to format
 * @param countryCode - Default country code
 * @returns Array of PhoneFormatResult
 */
export function formatPhoneNumbers(
  phones: string[],
  countryCode: string = '254'
): PhoneFormatResult[] {
  return phones.map(phone => formatPhoneNumber(phone, countryCode));
}

/**
 * Format phone number for display (with country code prefix)
 * @param phone - The phone number to format
 * @returns Formatted phone number for display (+254 722 241 745)
 */
export function formatPhoneForDisplay(phone: string): string {
  const result = formatPhoneNumber(phone);
  
  if (!result.isValid) {
    return phone;
  }

  // Format as +254 722 241 745
  const cleaned = result.formatted;
  return `+${cleaned.slice(0, 3)} ${cleaned.slice(3, 6)} ${cleaned.slice(6, 9)} ${cleaned.slice(9)}`;
}

/**
 * Validate if a phone number is valid Kenyan mobile number
 * @param phone - The phone number to validate
 * @returns true if valid, false otherwise
 */
export function isValidKenyanPhone(phone: string): boolean {
  const result = formatPhoneNumber(phone);
  return result.isValid;
}

/**
 * Extract country code from formatted phone number
 * @param phone - Formatted phone number
 * @returns Country code or null
 */
export function extractCountryCode(phone: string): string | null {
  const cleaned = phone.replace(/\D/g, '');
  
  // Check for common country codes
  if (cleaned.startsWith('254')) return '254'; // Kenya
  if (cleaned.startsWith('255')) return '255'; // Tanzania
  if (cleaned.startsWith('256')) return '256'; // Uganda
  if (cleaned.startsWith('234')) return '234'; // Nigeria
  if (cleaned.startsWith('233')) return '233'; // Ghana
  
  return null;
}
