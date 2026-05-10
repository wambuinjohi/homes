import { supabase } from "@/integrations/supabase/client";
import { BrandingService, BrandingData } from "./brandingService";
import { BrandingFetcher } from "./brandingFetcher";

// Session-level cache for templates and branding
const sessionCache = new Map<string, { data: any; timestamp: number }>();
const CACHE_DURATION = 10 * 60 * 1000; // 10 minutes

export type DocumentType = 'invoice' | 'report' | 'letter' | 'notice' | 'lease' | 'receipt';
export type UserRole = 'Admin' | 'Landlord' | 'Manager' | 'Agent' | 'Tenant';

interface PDFTemplate {
  id: string;
  name: string;
  type: DocumentType;
  content: any;
  version: number;
  is_active: boolean;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

interface TemplateBinding {
  id: string;
  template_id: string;
  document_type: DocumentType;
  role: UserRole;
  landlord_id?: string;
  priority: number;
  is_active: boolean;
}

export class PDFTemplateService {
  /**
   * Get the appropriate PDF template and branding for a specific document type
   * Priority: Landlord-specific template > Global template > Default branding
   */
  static async getTemplateAndBranding(
    documentType: DocumentType,
    userRole: UserRole,
    landlordId?: string
  ): Promise<{
    template?: PDFTemplate;
    branding: BrandingData;
  }> {
    try {
      // Create cache key for this specific request
      const cacheKey = `template-branding-${documentType}-${userRole}-${landlordId || 'global'}`;
      
      // Check session cache first
      const cached = sessionCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
        console.log('Using cached template and branding data');
        return cached.data;
      }
      
      console.time('Template and Branding Fetch');
      
      // First get the branding data
      const branding = await BrandingFetcher.fetchBranding(landlordId);

      // Try to find a suitable template
      const template = await this.findBestTemplate(documentType, userRole, landlordId);

      const result = { template, branding };
      
      // Cache the result
      sessionCache.set(cacheKey, {
        data: result,
        timestamp: Date.now()
      });
      
      console.timeEnd('Template and Branding Fetch');
      
      return result;
    } catch (error) {
      console.warn('Failed to fetch template from database, using fallback branding:', error);
      
      // Fallback to localStorage/default branding
      const branding = BrandingService.loadBranding();
      return { branding };
    }
  }

  /**
   * Find the best matching template based on priority
   */
  private static async findBestTemplate(
    documentType: DocumentType,
    userRole: UserRole,
    landlordId?: string
  ): Promise<PDFTemplate | undefined> {
    try {
      // Build query for template bindings
      let query = supabase
        .from('pdf_template_bindings')
        .select(`
          *,
          pdf_templates!inner (
            id,
            name,
            type,
            content,
            version,
            is_active,
            created_by,
            created_at,
            updated_at
          )
        `)
        .eq('document_type', documentType)
        .eq('role', userRole)
        .eq('is_active', true)
        .eq('pdf_templates.is_active', true)
        .order('priority', { ascending: false }); // Higher priority first

      const { data: bindings, error } = await query;

      if (error) {
        console.warn('Error fetching template bindings:', error);
        return undefined;
      }

      if (!bindings || bindings.length === 0) {
        return undefined;
      }

      // Find the best match: landlord-specific first, then global
      const landlordSpecific = bindings.find(b => b.landlord_id === landlordId);
      const global = bindings.find(b => b.landlord_id === null);

      const bestBinding = landlordSpecific || global;
      
      if (bestBinding && bestBinding.pdf_templates) {
        return bestBinding.pdf_templates as PDFTemplate;
      }

      return undefined;
    } catch (error) {
      console.warn('Error finding template:', error);
      return undefined;
    }
  }

  /**
   * Save branding data to database as a platform-wide or landlord-specific profile
   */
  static async saveBrandingProfile(
    branding: BrandingData,
    scope: 'platform' | 'landlord' = 'platform',
    landlordId?: string
  ): Promise<void> {
    try {
      const profileData = {
        company_name: branding.companyName,
        company_tagline: branding.companyTagline,
        company_address: branding.companyAddress,
        company_phone: branding.companyPhone,
        company_email: branding.companyEmail,
        logo_url: branding.logoUrl,
        colors: {
          primary: branding.primaryColor,
          secondary: branding.secondaryColor
        },
        footer_text: branding.footerText,
        website_url: branding.websiteUrl,
        scope,
        landlord_id: scope === 'landlord' ? landlordId : null,
        is_default: scope === 'platform',
        metadata: {
          reportLayout: branding.reportLayout
        }
      };

      // For platform scope, update existing default or create new
      if (scope === 'platform') {
        const { data: existing } = await supabase
          .from('branding_profiles')
          .select('id')
          .eq('scope', 'platform')
          .eq('is_default', true)
          .maybeSingle();

        if (existing) {
          await supabase
            .from('branding_profiles')
            .update(profileData)
            .eq('id', existing.id);
        } else {
          await supabase
            .from('branding_profiles')
            .insert(profileData);
        }
      } else {
        // For landlord scope, update existing or create new
        const { data: existing } = await supabase
          .from('branding_profiles')
          .select('id')
          .eq('scope', 'landlord')
          .eq('landlord_id', landlordId)
          .maybeSingle();

        if (existing) {
          await supabase
            .from('branding_profiles')
            .update(profileData)
            .eq('id', existing.id);
        } else {
          await supabase
            .from('branding_profiles')
            .insert(profileData);
        }
      }

      // Also save to localStorage for immediate use
      BrandingService.saveBranding(branding);
    } catch (error) {
      console.error('Failed to save branding profile to database:', error);
      throw error;
    }
  }

  /**
   * Create or update a PDF template
   */
  static async saveTemplate(
    name: string,
    type: DocumentType,
    content: any,
    description?: string
  ): Promise<string> {
    try {
      const { data, error } = await supabase
        .from('pdf_templates')
        .insert({
          name,
          type,
          content,
          description,
          version: 1,
          is_active: true
        })
        .select('id')
        .maybeSingle();

      if (error) throw error;

      return data.id;
    } catch (error) {
      console.error('Failed to save PDF template:', error);
      throw error;
    }
  }

  /**
   * Create template bindings for common document types
   */
  static async createDefaultTemplateBindings(
    templateId: string,
    documentType: DocumentType,
    scope: 'platform' | 'landlord' = 'platform',
    landlordId?: string
  ): Promise<void> {
    try {
      const roles: UserRole[] = ['Admin', 'Landlord', 'Manager', 'Agent', 'Tenant'];
      
      const bindings = roles.map((role, index) => ({
        template_id: templateId,
        document_type: documentType,
        role,
        landlord_id: scope === 'landlord' ? landlordId : null,
        priority: 100 - index, // Admin gets highest priority
        is_active: true
      }));

      const { error } = await supabase
        .from('pdf_template_bindings')
        .insert(bindings);

      if (error) throw error;
    } catch (error) {
      console.error('Failed to create template bindings:', error);
      throw error;
    }
  }
}