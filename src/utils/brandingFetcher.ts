import { supabase } from "@/integrations/supabase/client";
import { BrandingService, BrandingData } from "./brandingService";

// Session-level branding cache
const brandingCache = new Map<string, { data: BrandingData; timestamp: number }>();
const CACHE_DURATION = 15 * 60 * 1000; // 15 minutes for branding

export interface DBBrandingProfile {
  company_name: string;
  company_tagline: string | null;
  company_address: string | null;
  company_phone: string | null;
  company_email: string | null;
  logo_url: string | null;
  colors: any | null;
  footer_text: string | null;
  website_url: string | null;
  scope: string;
  is_default: boolean;
}

export class BrandingFetcher {
  /**
   * Fetch branding data with proper hierarchy:
   * 1. Database platform-wide branding (scope='platform', is_default=true)
   * 2. Database landlord-specific branding (scope='landlord')
   * 3. localStorage branding
   * 4. Default branding
   */
  static async fetchBranding(landlordId?: string): Promise<BrandingData> {
    try {
      const cacheKey = landlordId ? `landlord-${landlordId}` : 'platform';
      
      // Check cache first for significant performance improvement
      const cached = brandingCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
        return cached.data;
      }
      
      // First try to get platform-wide default branding
      let { data: platformBranding } = await supabase
        .from('branding_profiles')
        .select('*')
        .eq('scope', 'platform')
        .eq('is_default', true)
        .maybeSingle();

      // If landlordId provided, try to get landlord-specific branding
      let landlordBranding = null;
      if (landlordId) {
        const { data } = await supabase
          .from('branding_profiles')
          .select('*')
          .eq('scope', 'landlord')
          .eq('landlord_id', landlordId)
          .maybeSingle();
        landlordBranding = data;
      }

      // Use landlord branding if available, otherwise platform branding
      const dbBranding = landlordBranding || platformBranding;

      if (dbBranding) {
        const result = this.convertDBToBrandingData(dbBranding);
        brandingCache.set(cacheKey, { data: result, timestamp: Date.now() });
        return result;
      }

      // Fallback to localStorage or default
      const result = BrandingService.loadBranding();
      brandingCache.set('platform', { data: result, timestamp: Date.now() });
      return result;
    } catch (error) {
      console.warn('Failed to fetch branding from database, using localStorage/defaults:', error);
      return BrandingService.loadBranding();
    }
  }

  /**
   * Convert database branding profile to BrandingData format
   */
  private static convertDBToBrandingData(dbBranding: DBBrandingProfile): BrandingData {
    const defaults = BrandingService.getDefaultBranding();
    
    // Extract colors from JSON field
    const colors = dbBranding.colors || {};
    
    // Handle logo URLs - preserve data URLs and use valid fallback
    let logoUrl = dbBranding.logo_url || defaults.logoUrl;
    if (!logoUrl) {
      logoUrl = '/src/assets/zira-logo.png'; // Valid fallback path
    }
    
    return {
      companyName: dbBranding.company_name || defaults.companyName,
      companyTagline: dbBranding.company_tagline || defaults.companyTagline,
      companyAddress: dbBranding.company_address || defaults.companyAddress,
      companyPhone: dbBranding.company_phone || defaults.companyPhone,
      companyEmail: dbBranding.company_email || defaults.companyEmail,
      logoUrl: logoUrl,
      primaryColor: colors.primary || defaults.primaryColor,
      secondaryColor: colors.secondary || defaults.secondaryColor,
      footerText: dbBranding.footer_text || defaults.footerText,
      websiteUrl: dbBranding.website_url || defaults.websiteUrl,
      reportLayout: defaults.reportLayout // Use default for now
    };
  }
}