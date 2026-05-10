import { useState, useEffect } from 'react';
import { useAuth } from './useAuth';
import { useUserProfile } from './useUserProfile';
import { supabase } from '@/integrations/supabase/client';
import { 
  getCountryFromPhone, 
  getCountryFromName, 
  getDefaultCountry,
  CountryCode 
} from '@/utils/countryService';

interface UserCountryData {
  primaryCountry: CountryCode;
  detectedFrom: 'properties' | 'phone' | 'default';
  confidence: 'high' | 'medium' | 'low';
  allCountries: CountryCode[];
}

/**
 * Hook to detect and manage user's country preference
 * Priority: User's properties -> Phone number -> Default (KE)
 */
export const useUserCountry = () => {
  const { user } = useAuth();
  const { profile } = useUserProfile();
  const [countryData, setCountryData] = useState<UserCountryData>({
    primaryCountry: getDefaultCountry(),
    detectedFrom: 'default',
    confidence: 'low',
    allCountries: [getDefaultCountry()],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const detectUserCountry = async () => {
      if (!user) {
        setCountryData({
          primaryCountry: getDefaultCountry(),
          detectedFrom: 'default',
          confidence: 'low',
          allCountries: [getDefaultCountry()],
        });
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        // Step 1: Try to get country from user's properties
        const countryFromProperties = await detectCountryFromProperties(user.id);
        
        if (countryFromProperties.countries.length > 0) {
          setCountryData({
            primaryCountry: countryFromProperties.primary,
            detectedFrom: 'properties',
            confidence: 'high',
            allCountries: countryFromProperties.countries,
          });
          setLoading(false);
          return;
        }

        // Step 2: Try to get country from phone number
        if (profile?.phone) {
          const countryFromPhone = getCountryFromPhone(profile.phone);
          if (countryFromPhone) {
            setCountryData({
              primaryCountry: countryFromPhone,
              detectedFrom: 'phone',
              confidence: 'medium',
              allCountries: [countryFromPhone],
            });
            setLoading(false);
            return;
          }
        }

        // Step 3: Fallback to default
        setCountryData({
          primaryCountry: getDefaultCountry(),
          detectedFrom: 'default',
          confidence: 'low',
          allCountries: [getDefaultCountry()],
        });

      } catch (err) {
        console.error('Error detecting user country:', err);
        setError(err instanceof Error ? err.message : 'Failed to detect country');
        
        // Fallback to default on error
        setCountryData({
          primaryCountry: getDefaultCountry(),
          detectedFrom: 'default',
          confidence: 'low',
          allCountries: [getDefaultCountry()],
        });
      } finally {
        setLoading(false);
      }
    };

    detectUserCountry();
  }, [user, profile]);

  return {
    ...countryData,
    loading,
    error,
    // Convenience getters
    isCountryDetected: countryData.detectedFrom !== 'default',
    hasHighConfidence: countryData.confidence === 'high',
    hasMultipleCountries: countryData.allCountries.length > 1,
  };
};

/**
 * Detect country from user's properties
 */
async function detectCountryFromProperties(userId: string): Promise<{
  primary: CountryCode;
  countries: CountryCode[];
}> {
  try {
    const { data: properties, error } = await supabase
      .from('properties')
      .select('country')
      .eq('owner_id', userId);

    if (error) throw error;

    if (!properties || properties.length === 0) {
      return { primary: getDefaultCountry(), countries: [] };
    }

    // Count occurrences of each country
    const countryCount: Record<string, number> = {};
    const detectedCountries: CountryCode[] = [];

    properties.forEach(property => {
      if (property.country) {
        const countryCode = getCountryFromName(property.country);
        if (countryCode) {
          countryCount[countryCode] = (countryCount[countryCode] || 0) + 1;
          if (!detectedCountries.includes(countryCode)) {
            detectedCountries.push(countryCode);
          }
        }
      }
    });

    if (detectedCountries.length === 0) {
      return { primary: getDefaultCountry(), countries: [] };
    }

    // Find the most common country (primary)
    const primaryCountry = Object.entries(countryCount)
      .sort(([, a], [, b]) => b - a)[0][0] as CountryCode;

    return {
      primary: primaryCountry,
      countries: detectedCountries,
    };

  } catch (error) {
    console.error('Error detecting country from properties:', error);
    return { primary: getDefaultCountry(), countries: [] };
  }
}

/**
 * Hook for manual country override (for future use)
 */
export const useCountryPreferences = () => {
  const [manualCountry, setManualCountry] = useState<CountryCode | null>(null);

  const setCountryOverride = (countryCode: CountryCode | null) => {
    setManualCountry(countryCode);
    // In future, this could save to user preferences table
    if (countryCode) {
      localStorage.setItem('user_country_override', countryCode);
    } else {
      localStorage.removeItem('user_country_override');
    }
  };

  // Load saved override on mount
  useEffect(() => {
    const saved = localStorage.getItem('user_country_override');
    if (saved) {
      setManualCountry(saved as CountryCode);
    }
  }, []);

  return {
    manualCountry,
    setCountryOverride,
    clearOverride: () => setCountryOverride(null),
  };
};