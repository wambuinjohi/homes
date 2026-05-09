/**
 * Country detection and management utilities
 * Handles phone number parsing, country code mapping, and payment method filtering
 */

// ISO 3166-1 alpha-2 country codes mapping
export const COUNTRY_CODES = {
  // Africa
  'KE': { name: 'Kenya', flag: '🇰🇪', phonePrefix: '+254', currency: 'KES' },
  'NG': { name: 'Nigeria', flag: '🇳🇬', phonePrefix: '+234', currency: 'NGN' },
  'GH': { name: 'Ghana', flag: '🇬🇭', phonePrefix: '+233', currency: 'GHS' },
  'TZ': { name: 'Tanzania', flag: '🇹🇿', phonePrefix: '+255', currency: 'TZS' },
  'UG': { name: 'Uganda', flag: '🇺🇬', phonePrefix: '+256', currency: 'UGX' },
  'ZA': { name: 'South Africa', flag: '🇿🇦', phonePrefix: '+27', currency: 'ZAR' },
  
  // North America
  'US': { name: 'United States', flag: '🇺🇸', phonePrefix: '+1', currency: 'USD' },
  'CA': { name: 'Canada', flag: '🇨🇦', phonePrefix: '+1', currency: 'CAD' },
  
  // Europe
  'GB': { name: 'United Kingdom', flag: '🇬🇧', phonePrefix: '+44', currency: 'GBP' },
  'DE': { name: 'Germany', flag: '🇩🇪', phonePrefix: '+49', currency: 'EUR' },
  'FR': { name: 'France', flag: '🇫🇷', phonePrefix: '+33', currency: 'EUR' },
  
  // Asia
  'IN': { name: 'India', flag: '🇮🇳', phonePrefix: '+91', currency: 'INR' },
  'CN': { name: 'China', flag: '🇨🇳', phonePrefix: '+86', currency: 'CNY' },
} as const;

export type CountryCode = keyof typeof COUNTRY_CODES;

// Phone prefix to country code mapping
const PHONE_PREFIX_TO_COUNTRY: Record<string, CountryCode> = {
  '+254': 'KE', // Kenya
  '+234': 'NG', // Nigeria
  '+233': 'GH', // Ghana
  '+255': 'TZ', // Tanzania
  '+256': 'UG', // Uganda
  '+27': 'ZA',  // South Africa
  '+1': 'US',   // US/Canada (default to US)
  '+44': 'GB',  // UK
  '+49': 'DE',  // Germany
  '+33': 'FR',  // France
  '+91': 'IN',  // India
  '+86': 'CN',  // China
};

// Country name variations to country code mapping
const COUNTRY_NAME_TO_CODE: Record<string, CountryCode> = {
  // Kenya variations
  'kenya': 'KE',
  'republic of kenya': 'KE',
  
  // Nigeria variations
  'nigeria': 'NG',
  'federal republic of nigeria': 'NG',
  
  // Ghana variations
  'ghana': 'GH',
  'republic of ghana': 'GH',
  
  // Tanzania variations
  'tanzania': 'TZ',
  'united republic of tanzania': 'TZ',
  
  // Uganda variations
  'uganda': 'UG',
  'republic of uganda': 'UG',
  
  // South Africa variations
  'south africa': 'ZA',
  'republic of south africa': 'ZA',
  
  // US variations
  'united states': 'US',
  'usa': 'US',
  'america': 'US',
  'united states of america': 'US',
  
  // Other countries
  'canada': 'CA',
  'united kingdom': 'GB',
  'uk': 'GB',
  'britain': 'GB',
  'germany': 'DE',
  'france': 'FR',
  'india': 'IN',
  'china': 'CN',
};

/**
 * Extract country code from phone number
 */
export function getCountryFromPhone(phoneNumber: string): CountryCode | null {
  if (!phoneNumber) return null;
  
  // Clean the phone number
  const cleanPhone = phoneNumber.replace(/\s+/g, '').trim();
  
  // Try to match phone prefix
  for (const [prefix, countryCode] of Object.entries(PHONE_PREFIX_TO_COUNTRY)) {
    if (cleanPhone.startsWith(prefix)) {
      return countryCode;
    }
  }
  
  // Handle cases where phone number might not have + prefix
  if (cleanPhone.startsWith('254')) return 'KE';
  if (cleanPhone.startsWith('234')) return 'NG';
  if (cleanPhone.startsWith('233')) return 'GH';
  if (cleanPhone.startsWith('255')) return 'TZ';
  if (cleanPhone.startsWith('256')) return 'UG';
  
  return null;
}

/**
 * Convert country name to country code
 */
export function getCountryFromName(countryName: string): CountryCode | null {
  if (!countryName) return null;
  
  const cleanName = countryName.toLowerCase().trim();
  return COUNTRY_NAME_TO_CODE[cleanName] || null;
}

/**
 * Get country information by code
 */
export function getCountryInfo(countryCode: CountryCode) {
  return COUNTRY_CODES[countryCode];
}

/**
 * Get all available countries
 */
export function getAllCountries() {
  return Object.entries(COUNTRY_CODES).map(([code, info]) => ({
    code: code as CountryCode,
    ...info,
  }));
}

/**
 * Format phone number with country prefix
 */
export function formatPhoneWithCountry(phone: string, countryCode: CountryCode): string {
  if (!phone) return '';
  
  const countryInfo = COUNTRY_CODES[countryCode];
  if (!countryInfo) return phone;
  
  const cleanPhone = phone.replace(/\D/g, '');
  const prefix = countryInfo.phonePrefix;
  
  // If phone already has the correct prefix, return as is
  if (phone.startsWith(prefix)) return phone;
  
  // Handle country-specific formatting
  switch (countryCode) {
    case 'KE':
      // Remove leading 0 if present, then add +254
      const kenyanNumber = cleanPhone.startsWith('254') ? cleanPhone : 
                          cleanPhone.startsWith('0') ? '254' + cleanPhone.slice(1) :
                          '254' + cleanPhone;
      return '+' + kenyanNumber;
    
    case 'NG':
      // Similar logic for Nigeria
      const nigerianNumber = cleanPhone.startsWith('234') ? cleanPhone :
                            cleanPhone.startsWith('0') ? '234' + cleanPhone.slice(1) :
                            '234' + cleanPhone;
      return '+' + nigerianNumber;
    
    default:
      return prefix + cleanPhone;
  }
}

/**
 * Validate phone number for specific country
 */
export function validatePhoneForCountry(phone: string, countryCode: CountryCode): boolean {
  if (!phone || !countryCode) return false;
  
  const countryInfo = COUNTRY_CODES[countryCode];
  if (!countryInfo) return false;
  
  const cleanPhone = phone.replace(/\s+/g, '');
  
  // Check if phone starts with correct country prefix
  if (!cleanPhone.startsWith(countryInfo.phonePrefix)) return false;
  
  // Country-specific validation
  switch (countryCode) {
    case 'KE':
      // Kenyan numbers: +254XXXXXXXXX (9 digits after 254)
      return /^\+254[0-9]{9}$/.test(cleanPhone);
    
    case 'NG':
      // Nigerian numbers: +234XXXXXXXXXX (10 digits after 234)
      return /^\+234[0-9]{10}$/.test(cleanPhone);
    
    case 'US':
    case 'CA':
      // North American numbers: +1XXXXXXXXXX (10 digits after 1)
      return /^\+1[0-9]{10}$/.test(cleanPhone);
    
    default:
      // Basic validation - at least 7 digits after country code
      const digitsAfterPrefix = cleanPhone.replace(countryInfo.phonePrefix, '');
      return digitsAfterPrefix.length >= 7;
  }
}

/**
 * Get default country (Kenya for now, but configurable)
 */
export function getDefaultCountry(): CountryCode {
  return 'KE';
}

/**
 * Filter payment methods by country
 */
export function filterPaymentMethodsByCountry<T extends { country_code: string }>(
  paymentMethods: T[],
  countryCode: CountryCode
): T[] {
  return paymentMethods.filter(method => method.country_code === countryCode);
}
