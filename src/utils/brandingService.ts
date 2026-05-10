export interface BrandingData {
  companyName: string;
  companyTagline: string;
  companyAddress: string;
  companyPhone: string;
  companyEmail: string;
  logoUrl?: string;
  primaryColor: string;
  secondaryColor: string;
  footerText: string;
  websiteUrl?: string;
    // Report layout preferences
  reportLayout?: {
    chartDimensions: 'ultra-compact' | 'compact' | 'standard' | 'large';
    kpiStyle: 'cards' | 'minimal' | 'detailed';
    sectionSpacing: 'tight' | 'normal' | 'spacious';
    showGridlines: boolean;
    accentColor?: string;
    layoutDensity?: 'compact' | 'standard' | 'spacious';
    contentFlow?: 'traditional' | 'optimized' | 'dense';
    maxKpisPerRow?: number;
    chartSpacing?: 'minimal' | 'normal' | 'generous';
  };
}

export class BrandingService {
  private static readonly STORAGE_KEY = 'pdf-branding-data';
  private static readonly LEGACY_KEY = 'brandingPreferences';

  /**
   * Load branding data from localStorage with migration and fallback support
   */
  static loadBranding(): BrandingData {
    // Try to load from unified key first
    const savedBranding = localStorage.getItem(this.STORAGE_KEY);
    if (savedBranding) {
      try {
        const parsed = JSON.parse(savedBranding);
        return this.validateAndNormalizeBranding(parsed);
      } catch (error) {
        console.warn('Failed to parse saved branding data:', error);
      }
    }

    // Try legacy key for migration
    const legacyBranding = localStorage.getItem(this.LEGACY_KEY);
    if (legacyBranding) {
      try {
        const parsed = JSON.parse(legacyBranding);
        const normalized = this.validateAndNormalizeBranding(parsed);
        
        // Migrate to new key
        this.saveBranding(normalized);
        localStorage.removeItem(this.LEGACY_KEY);
        
        return normalized;
      } catch (error) {
        console.warn('Failed to migrate legacy branding data:', error);
      }
    }

    // Return default branding
    return this.getDefaultBranding();
  }

  /**
   * Save branding data to localStorage
   */
  static saveBranding(branding: BrandingData): void {
    try {
      const normalized = this.validateAndNormalizeBranding(branding);
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(normalized));
    } catch (error) {
      console.error('Failed to save branding data:', error);
      throw error;
    }
  }

  /**
   * Get default branding configuration
   */
  static getDefaultBranding(): BrandingData {
    return {
      companyName: 'Zira Technologies',
      companyTagline: 'Professional Property Management Solutions',
      companyAddress: 'P.O. Box 1234, Nairobi, Kenya',
      companyPhone: '+254 757 878 023',
      companyEmail: 'info@ziratechnologies.com',
      logoUrl: '/src/assets/zira-logo.png',
      primaryColor: '#1B365D', // Zira Navy Blue
      secondaryColor: '#F36F21', // Zira Orange
      footerText: 'Powered by Zira Technologies - Transforming Property Management',
      websiteUrl: 'www.ziratechnologies.com',
      reportLayout: {
        chartDimensions: 'ultra-compact',
        kpiStyle: 'cards',
        sectionSpacing: 'tight',
        showGridlines: false,
        accentColor: '#F36F21',
        layoutDensity: 'compact',
        contentFlow: 'optimized',
        maxKpisPerRow: 5,
        chartSpacing: 'minimal'
      }
    };
  }

  /**
   * Validate and normalize branding data to ensure all required fields are present
   */
  private static validateAndNormalizeBranding(branding: Partial<BrandingData>): BrandingData {
    const defaults = this.getDefaultBranding();
    
    return {
      companyName: branding.companyName || defaults.companyName,
      companyTagline: branding.companyTagline || defaults.companyTagline,
      companyAddress: branding.companyAddress || defaults.companyAddress,
      companyPhone: branding.companyPhone || defaults.companyPhone,
      companyEmail: branding.companyEmail || defaults.companyEmail,
      logoUrl: branding.logoUrl || defaults.logoUrl,
      primaryColor: this.validateColor(branding.primaryColor) || defaults.primaryColor,
      secondaryColor: this.validateColor(branding.secondaryColor) || defaults.secondaryColor,
      footerText: branding.footerText || defaults.footerText,
      reportLayout: branding.reportLayout || defaults.reportLayout,
      websiteUrl: branding.websiteUrl || defaults.websiteUrl
    };
  }

  /**
   * Validate color format (hex color)
   */
  private static validateColor(color?: string): string | null {
    if (!color) return null;
    
    const hexColorRegex = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;
    return hexColorRegex.test(color) ? color : null;
  }

  /**
   * Reset branding to defaults
   */
  static resetToDefaults(): BrandingData {
    const defaults = this.getDefaultBranding();
    this.saveBranding(defaults);
    return defaults;
  }

  /**
   * Check if branding data exists in storage
   */
  static hasSavedBranding(): boolean {
    return !!localStorage.getItem(this.STORAGE_KEY) || !!localStorage.getItem(this.LEGACY_KEY);
  }

  /**
   * Get footer preview lines as they will appear in PDF
   */
  static getFooterPreview(branding: BrandingData): string[] {
    return [
      `${branding.companyName} | ${branding.companyPhone} | ${branding.companyEmail}`,
      `${branding.companyAddress} | ${branding.websiteUrl || ''}`,
      branding.footerText
    ];
  }
}