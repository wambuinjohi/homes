export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.4"
  }
  public: {
    Tables: {
      api_rate_limits: {
        Row: {
          created_at: string
          endpoint: string
          id: string
          identifier: string
          request_count: number
          window_start: string
        }
        Insert: {
          created_at?: string
          endpoint: string
          id?: string
          identifier: string
          request_count?: number
          window_start?: string
        }
        Update: {
          created_at?: string
          endpoint?: string
          id?: string
          identifier?: string
          request_count?: number
          window_start?: string
        }
        Relationships: []
      }
      approved_payment_methods: {
        Row: {
          configuration: Json | null
          country_code: string
          created_at: string
          id: string
          is_active: boolean | null
          payment_method_type: string
          provider_name: string
          updated_at: string
        }
        Insert: {
          configuration?: Json | null
          country_code: string
          created_at?: string
          id?: string
          is_active?: boolean | null
          payment_method_type: string
          provider_name: string
          updated_at?: string
        }
        Update: {
          configuration?: Json | null
          country_code?: string
          created_at?: string
          id?: string
          is_active?: boolean | null
          payment_method_type?: string
          provider_name?: string
          updated_at?: string
        }
        Relationships: []
      }
      bank_callbacks: {
        Row: {
          amount: number
          bank_code: string
          bank_reference: string | null
          callback_type: string
          created_at: string | null
          currency: string | null
          customer_mobile: string | null
          customer_name: string | null
          customer_reference: string | null
          headers: Json | null
          id: string
          invoice_id: string | null
          ip_address: unknown
          landlord_id: string | null
          order_amount: number | null
          order_currency: string | null
          payment_id: string | null
          payment_mode: string | null
          processed: boolean | null
          processed_at: string | null
          processing_notes: string | null
          raw_payload: Json
          retry_count: number | null
          service_charge: number | null
          status: string
          transaction_date: string | null
          transaction_reference: string
          updated_at: string | null
        }
        Insert: {
          amount: number
          bank_code: string
          bank_reference?: string | null
          callback_type: string
          created_at?: string | null
          currency?: string | null
          customer_mobile?: string | null
          customer_name?: string | null
          customer_reference?: string | null
          headers?: Json | null
          id?: string
          invoice_id?: string | null
          ip_address?: unknown
          landlord_id?: string | null
          order_amount?: number | null
          order_currency?: string | null
          payment_id?: string | null
          payment_mode?: string | null
          processed?: boolean | null
          processed_at?: string | null
          processing_notes?: string | null
          raw_payload: Json
          retry_count?: number | null
          service_charge?: number | null
          status: string
          transaction_date?: string | null
          transaction_reference: string
          updated_at?: string | null
        }
        Update: {
          amount?: number
          bank_code?: string
          bank_reference?: string | null
          callback_type?: string
          created_at?: string | null
          currency?: string | null
          customer_mobile?: string | null
          customer_name?: string | null
          customer_reference?: string | null
          headers?: Json | null
          id?: string
          invoice_id?: string | null
          ip_address?: unknown
          landlord_id?: string | null
          order_amount?: number | null
          order_currency?: string | null
          payment_id?: string | null
          payment_mode?: string | null
          processed?: boolean | null
          processed_at?: string | null
          processing_notes?: string | null
          raw_payload?: Json
          retry_count?: number | null
          service_charge?: number | null
          status?: string
          transaction_date?: string | null
          transaction_reference?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bank_callbacks_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_callbacks_landlord_id_fkey"
            columns: ["landlord_id"]
            isOneToOne: false
            referencedRelation: "orphaned_users_monitor"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_callbacks_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
        ]
      }
      bank_providers: {
        Row: {
          api_base_url_production: string | null
          api_base_url_sandbox: string | null
          api_gateway_name: string | null
          bank_code: string
          bank_name: string
          country_code: string | null
          created_at: string | null
          display_order: number | null
          documentation_url: string | null
          id: string
          is_active: boolean | null
          logo_url: string | null
          paybill_number: string | null
          required_credentials: Json | null
          supported_features: Json | null
          updated_at: string | null
        }
        Insert: {
          api_base_url_production?: string | null
          api_base_url_sandbox?: string | null
          api_gateway_name?: string | null
          bank_code: string
          bank_name: string
          country_code?: string | null
          created_at?: string | null
          display_order?: number | null
          documentation_url?: string | null
          id?: string
          is_active?: boolean | null
          logo_url?: string | null
          paybill_number?: string | null
          required_credentials?: Json | null
          supported_features?: Json | null
          updated_at?: string | null
        }
        Update: {
          api_base_url_production?: string | null
          api_base_url_sandbox?: string | null
          api_gateway_name?: string | null
          bank_code?: string
          bank_name?: string
          country_code?: string | null
          created_at?: string | null
          display_order?: number | null
          documentation_url?: string | null
          id?: string
          is_active?: boolean | null
          logo_url?: string | null
          paybill_number?: string | null
          required_credentials?: Json | null
          supported_features?: Json | null
          updated_at?: string | null
        }
        Relationships: []
      }
      billing_plan_audit: {
        Row: {
          action: string
          billing_plan_id: string
          changed_by: string
          changes: Json | null
          created_at: string
          id: string
          new_values: Json | null
          old_values: Json | null
        }
        Insert: {
          action: string
          billing_plan_id: string
          changed_by: string
          changes?: Json | null
          created_at?: string
          id?: string
          new_values?: Json | null
          old_values?: Json | null
        }
        Update: {
          action?: string
          billing_plan_id?: string
          changed_by?: string
          changes?: Json | null
          created_at?: string
          id?: string
          new_values?: Json | null
          old_values?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "billing_plan_audit_billing_plan_id_fkey"
            columns: ["billing_plan_id"]
            isOneToOne: false
            referencedRelation: "billing_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_plan_audit_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "orphaned_users_monitor"
            referencedColumns: ["id"]
          },
        ]
      }
      billing_plan_features: {
        Row: {
          billing_plan_id: string | null
          created_at: string | null
          custom_limit: number | null
          feature_key: string | null
          id: string
          is_enabled: boolean | null
        }
        Insert: {
          billing_plan_id?: string | null
          created_at?: string | null
          custom_limit?: number | null
          feature_key?: string | null
          id?: string
          is_enabled?: boolean | null
        }
        Update: {
          billing_plan_id?: string | null
          created_at?: string | null
          custom_limit?: number | null
          feature_key?: string | null
          id?: string
          is_enabled?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "billing_plan_features_billing_plan_id_fkey"
            columns: ["billing_plan_id"]
            isOneToOne: false
            referencedRelation: "billing_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_plan_features_feature_key_fkey"
            columns: ["feature_key"]
            isOneToOne: false
            referencedRelation: "plan_features"
            referencedColumns: ["feature_key"]
          },
        ]
      }
      billing_plans: {
        Row: {
          billing_cycle: string
          billing_model: string | null
          competitive_note: string | null
          contact_link: string | null
          created_at: string
          currency: string | null
          description: string | null
          display_order: number | null
          features: Json | null
          fixed_amount_per_unit: number | null
          id: string
          is_active: boolean | null
          is_custom: boolean | null
          is_popular: boolean | null
          max_properties: number | null
          max_units: number | null
          max_units_display: string | null
          min_units: number | null
          name: string
          percentage_rate: number | null
          plan_category: string | null
          price: number
          sms_credits_included: number | null
          tier_pricing: Json | null
          updated_at: string
          yearly_discount_percent: number | null
        }
        Insert: {
          billing_cycle: string
          billing_model?: string | null
          competitive_note?: string | null
          contact_link?: string | null
          created_at?: string
          currency?: string | null
          description?: string | null
          display_order?: number | null
          features?: Json | null
          fixed_amount_per_unit?: number | null
          id?: string
          is_active?: boolean | null
          is_custom?: boolean | null
          is_popular?: boolean | null
          max_properties?: number | null
          max_units?: number | null
          max_units_display?: string | null
          min_units?: number | null
          name: string
          percentage_rate?: number | null
          plan_category?: string | null
          price: number
          sms_credits_included?: number | null
          tier_pricing?: Json | null
          updated_at?: string
          yearly_discount_percent?: number | null
        }
        Update: {
          billing_cycle?: string
          billing_model?: string | null
          competitive_note?: string | null
          contact_link?: string | null
          created_at?: string
          currency?: string | null
          description?: string | null
          display_order?: number | null
          features?: Json | null
          fixed_amount_per_unit?: number | null
          id?: string
          is_active?: boolean | null
          is_custom?: boolean | null
          is_popular?: boolean | null
          max_properties?: number | null
          max_units?: number | null
          max_units_display?: string | null
          min_units?: number | null
          name?: string
          percentage_rate?: number | null
          plan_category?: string | null
          price?: number
          sms_credits_included?: number | null
          tier_pricing?: Json | null
          updated_at?: string
          yearly_discount_percent?: number | null
        }
        Relationships: []
      }
      billing_settings: {
        Row: {
          created_at: string | null
          description: string | null
          setting_key: string
          setting_value: Json
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          setting_key: string
          setting_value: Json
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          setting_key?: string
          setting_value?: Json
          updated_at?: string | null
        }
        Relationships: []
      }
      blocks: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          property_id: string
          total_units: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          property_id: string
          total_units?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          property_id?: string
          total_units?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "blocks_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      branding_profiles: {
        Row: {
          colors: Json | null
          company_address: string | null
          company_email: string | null
          company_name: string
          company_phone: string | null
          company_tagline: string | null
          created_at: string
          footer_text: string | null
          id: string
          is_default: boolean
          landlord_id: string | null
          logo_url: string | null
          metadata: Json | null
          scope: string
          updated_at: string
          website_url: string | null
        }
        Insert: {
          colors?: Json | null
          company_address?: string | null
          company_email?: string | null
          company_name: string
          company_phone?: string | null
          company_tagline?: string | null
          created_at?: string
          footer_text?: string | null
          id?: string
          is_default?: boolean
          landlord_id?: string | null
          logo_url?: string | null
          metadata?: Json | null
          scope: string
          updated_at?: string
          website_url?: string | null
        }
        Update: {
          colors?: Json | null
          company_address?: string | null
          company_email?: string | null
          company_name?: string
          company_phone?: string | null
          company_tagline?: string | null
          created_at?: string
          footer_text?: string | null
          id?: string
          is_default?: boolean
          landlord_id?: string | null
          logo_url?: string | null
          metadata?: Json | null
          scope?: string
          updated_at?: string
          website_url?: string | null
        }
        Relationships: []
      }
      bulk_upload_logs: {
        Row: {
          created_at: string
          failed_records: number
          file_name: string
          id: string
          operation_type: string
          processing_time_ms: number
          successful_records: number
          total_records: number
          updated_at: string
          uploaded_by: string
          validation_errors: Json | null
        }
        Insert: {
          created_at?: string
          failed_records?: number
          file_name: string
          id?: string
          operation_type: string
          processing_time_ms?: number
          successful_records?: number
          total_records?: number
          updated_at?: string
          uploaded_by: string
          validation_errors?: Json | null
        }
        Update: {
          created_at?: string
          failed_records?: number
          file_name?: string
          id?: string
          operation_type?: string
          processing_time_ms?: number
          successful_records?: number
          total_records?: number
          updated_at?: string
          uploaded_by?: string
          validation_errors?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "bulk_upload_logs_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      communication_preferences: {
        Row: {
          created_at: string
          description: string | null
          email_enabled: boolean
          id: string
          setting_name: string
          sms_enabled: boolean
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          email_enabled?: boolean
          id?: string
          setting_name: string
          sms_enabled?: boolean
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          email_enabled?: boolean
          id?: string
          setting_name?: string
          sms_enabled?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      credit_applications: {
        Row: {
          amount: number
          applied_at: string | null
          applied_by: string | null
          credit_id: string
          id: string
          invoice_id: string
          notes: string | null
        }
        Insert: {
          amount: number
          applied_at?: string | null
          applied_by?: string | null
          credit_id: string
          id?: string
          invoice_id: string
          notes?: string | null
        }
        Update: {
          amount?: number
          applied_at?: string | null
          applied_by?: string | null
          credit_id?: string
          id?: string
          invoice_id?: string
          notes?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "credit_applications_credit_id_fkey"
            columns: ["credit_id"]
            isOneToOne: false
            referencedRelation: "tenant_credits"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_applications_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      data_access_logs: {
        Row: {
          access_type: string
          accessed_at: string
          accessed_by: string
          accessed_record_id: string | null
          accessed_table: string
          id: string
          ip_address: unknown
          user_agent: string | null
        }
        Insert: {
          access_type: string
          accessed_at?: string
          accessed_by: string
          accessed_record_id?: string | null
          accessed_table: string
          id?: string
          ip_address?: unknown
          user_agent?: string | null
        }
        Update: {
          access_type?: string
          accessed_at?: string
          accessed_by?: string
          accessed_record_id?: string | null
          accessed_table?: string
          id?: string
          ip_address?: unknown
          user_agent?: string | null
        }
        Relationships: []
      }
      email_logs: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          metadata: Json | null
          provider: string | null
          recipient_email: string
          recipient_name: string | null
          sent_at: string | null
          status: string
          subject: string
          template_type: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          metadata?: Json | null
          provider?: string | null
          recipient_email: string
          recipient_name?: string | null
          sent_at?: string | null
          status?: string
          subject: string
          template_type?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          metadata?: Json | null
          provider?: string | null
          recipient_email?: string
          recipient_name?: string | null
          sent_at?: string | null
          status?: string
          subject?: string
          template_type?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      email_templates: {
        Row: {
          category: string
          content: string
          created_at: string
          enabled: boolean
          id: string
          landlord_id: string | null
          name: string
          subject: string
          updated_at: string
          variables: string[]
        }
        Insert: {
          category?: string
          content: string
          created_at?: string
          enabled?: boolean
          id?: string
          landlord_id?: string | null
          name: string
          subject: string
          updated_at?: string
          variables?: string[]
        }
        Update: {
          category?: string
          content?: string
          created_at?: string
          enabled?: boolean
          id?: string
          landlord_id?: string | null
          name?: string
          subject?: string
          updated_at?: string
          variables?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "email_templates_landlord_id_fkey"
            columns: ["landlord_id"]
            isOneToOne: false
            referencedRelation: "orphaned_users_monitor"
            referencedColumns: ["id"]
          },
        ]
      }
      expenses: {
        Row: {
          amount: number
          category: string
          created_at: string
          created_by: string | null
          description: string
          expense_date: string
          expense_type: string
          id: string
          is_recurring: boolean | null
          meter_reading_id: string | null
          property_id: string
          receipt_url: string | null
          recurrence_period: string | null
          tenant_id: string | null
          unit_id: string | null
          updated_at: string
          vendor_name: string | null
        }
        Insert: {
          amount: number
          category: string
          created_at?: string
          created_by?: string | null
          description: string
          expense_date: string
          expense_type?: string
          id?: string
          is_recurring?: boolean | null
          meter_reading_id?: string | null
          property_id: string
          receipt_url?: string | null
          recurrence_period?: string | null
          tenant_id?: string | null
          unit_id?: string | null
          updated_at?: string
          vendor_name?: string | null
        }
        Update: {
          amount?: number
          category?: string
          created_at?: string
          created_by?: string | null
          description?: string
          expense_date?: string
          expense_type?: string
          id?: string
          is_recurring?: boolean | null
          meter_reading_id?: string | null
          property_id?: string
          receipt_url?: string | null
          recurrence_period?: string | null
          tenant_id?: string | null
          unit_id?: string | null
          updated_at?: string
          vendor_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "expenses_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "orphaned_users_monitor"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_expenses_meter_reading_id"
            columns: ["meter_reading_id"]
            isOneToOne: false
            referencedRelation: "meter_readings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_expenses_property_id"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_expenses_tenant_id"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant_safe_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_expenses_tenant_id"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_expenses_unit_id"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      feature_tours: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          priority: number
          steps: Json
          target_page: string
          title: string
          tour_name: string
          updated_at: string
          user_roles: string[]
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          priority?: number
          steps?: Json
          target_page: string
          title: string
          tour_name: string
          updated_at?: string
          user_roles?: string[]
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          priority?: number
          steps?: Json
          target_page?: string
          title?: string
          tour_name?: string
          updated_at?: string
          user_roles?: string[]
        }
        Relationships: []
      }
      impersonation_sessions: {
        Row: {
          admin_user_id: string
          created_at: string
          ended_at: string | null
          id: string
          impersonated_user_id: string
          ip_address: unknown
          is_active: boolean
          session_token: string
          started_at: string
          updated_at: string
          user_agent: string | null
        }
        Insert: {
          admin_user_id: string
          created_at?: string
          ended_at?: string | null
          id?: string
          impersonated_user_id: string
          ip_address?: unknown
          is_active?: boolean
          session_token: string
          started_at?: string
          updated_at?: string
          user_agent?: string | null
        }
        Update: {
          admin_user_id?: string
          created_at?: string
          ended_at?: string | null
          id?: string
          impersonated_user_id?: string
          ip_address?: unknown
          is_active?: boolean
          session_token?: string
          started_at?: string
          updated_at?: string
          user_agent?: string | null
        }
        Relationships: []
      }
      invoice_overdue_reminders: {
        Row: {
          created_at: string
          id: string
          invoice_id: string
          phone_number: string | null
          reminder_type: string
          sent_at: string
          sms_status: string | null
          tenant_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          invoice_id: string
          phone_number?: string | null
          reminder_type: string
          sent_at?: string
          sms_status?: string | null
          tenant_id: string
        }
        Update: {
          created_at?: string
          id?: string
          invoice_id?: string
          phone_number?: string | null
          reminder_type?: string
          sent_at?: string
          sms_status?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoice_overdue_reminders_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          amount: number
          created_at: string
          description: string | null
          due_date: string
          id: string
          invoice_date: string
          invoice_number: string
          lease_id: string
          status: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          amount: number
          created_at?: string
          description?: string | null
          due_date: string
          id?: string
          invoice_date: string
          invoice_number?: string
          lease_id: string
          status?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          description?: string | null
          due_date?: string
          id?: string
          invoice_date?: string
          invoice_number?: string
          lease_id?: string
          status?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_invoices_lease_id"
            columns: ["lease_id"]
            isOneToOne: false
            referencedRelation: "leases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_invoices_tenant_id"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant_safe_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_invoices_tenant_id"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_lease_id_fkey"
            columns: ["lease_id"]
            isOneToOne: false
            referencedRelation: "leases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant_safe_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      jenga_ipn_callbacks: {
        Row: {
          additional_info: string | null
          amount: number
          bank_account: string | null
          bank_reference: string | null
          bill_number: string | null
          callback_type: string
          created_at: string | null
          currency: string | null
          customer_mobile: string | null
          customer_name: string | null
          customer_reference: string | null
          id: string
          invoice_id: string | null
          ip_address: unknown
          landlord_id: string | null
          order_amount: number | null
          order_currency: string | null
          payment_mode: string | null
          processed: boolean | null
          processed_at: string | null
          raw_data: Json
          remarks: string | null
          served_by: string | null
          service_charge: number | null
          status: string
          transaction_date: string | null
          transaction_reference: string
          transaction_type: string | null
          updated_at: string | null
        }
        Insert: {
          additional_info?: string | null
          amount: number
          bank_account?: string | null
          bank_reference?: string | null
          bill_number?: string | null
          callback_type: string
          created_at?: string | null
          currency?: string | null
          customer_mobile?: string | null
          customer_name?: string | null
          customer_reference?: string | null
          id?: string
          invoice_id?: string | null
          ip_address?: unknown
          landlord_id?: string | null
          order_amount?: number | null
          order_currency?: string | null
          payment_mode?: string | null
          processed?: boolean | null
          processed_at?: string | null
          raw_data: Json
          remarks?: string | null
          served_by?: string | null
          service_charge?: number | null
          status: string
          transaction_date?: string | null
          transaction_reference: string
          transaction_type?: string | null
          updated_at?: string | null
        }
        Update: {
          additional_info?: string | null
          amount?: number
          bank_account?: string | null
          bank_reference?: string | null
          bill_number?: string | null
          callback_type?: string
          created_at?: string | null
          currency?: string | null
          customer_mobile?: string | null
          customer_name?: string | null
          customer_reference?: string | null
          id?: string
          invoice_id?: string | null
          ip_address?: unknown
          landlord_id?: string | null
          order_amount?: number | null
          order_currency?: string | null
          payment_mode?: string | null
          processed?: boolean | null
          processed_at?: string | null
          raw_data?: Json
          remarks?: string | null
          served_by?: string | null
          service_charge?: number | null
          status?: string
          transaction_date?: string | null
          transaction_reference?: string
          transaction_type?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "jenga_ipn_callbacks_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jenga_ipn_callbacks_landlord_id_fkey"
            columns: ["landlord_id"]
            isOneToOne: false
            referencedRelation: "orphaned_users_monitor"
            referencedColumns: ["id"]
          },
        ]
      }
      knowledge_base_articles: {
        Row: {
          author_id: string | null
          category: string
          content: string
          created_at: string
          id: string
          is_published: boolean | null
          published_at: string | null
          tags: string[] | null
          target_user_types: string[] | null
          title: string
          updated_at: string
          view_count: number | null
        }
        Insert: {
          author_id?: string | null
          category: string
          content: string
          created_at?: string
          id?: string
          is_published?: boolean | null
          published_at?: string | null
          tags?: string[] | null
          target_user_types?: string[] | null
          title: string
          updated_at?: string
          view_count?: number | null
        }
        Update: {
          author_id?: string | null
          category?: string
          content?: string
          created_at?: string
          id?: string
          is_published?: boolean | null
          published_at?: string | null
          tags?: string[] | null
          target_user_types?: string[] | null
          title?: string
          updated_at?: string
          view_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "knowledge_base_articles_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "orphaned_users_monitor"
            referencedColumns: ["id"]
          },
        ]
      }
      kopokopo_processed_callbacks: {
        Row: {
          amount: number | null
          id: string
          incoming_payment_id: string | null
          invoice_id: string | null
          kopo_reference: string
          phone_number: string | null
          processed_at: string | null
        }
        Insert: {
          amount?: number | null
          id?: string
          incoming_payment_id?: string | null
          invoice_id?: string | null
          kopo_reference: string
          phone_number?: string | null
          processed_at?: string | null
        }
        Update: {
          amount?: number | null
          id?: string
          incoming_payment_id?: string | null
          invoice_id?: string | null
          kopo_reference?: string
          phone_number?: string | null
          processed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "kopokopo_processed_callbacks_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      landlord_bank_configs: {
        Row: {
          access_token_encrypted: string | null
          account_number: string | null
          api_key_encrypted: string | null
          bank_code: string
          consumer_secret_encrypted: string | null
          created_at: string | null
          credentials_verified: boolean | null
          environment: string | null
          extended_config: Json | null
          id: string
          ipn_password_encrypted: string | null
          ipn_url: string | null
          ipn_username: string | null
          is_active: boolean | null
          landlord_id: string
          last_verified_at: string | null
          merchant_code: string | null
          paybill_number: string | null
          updated_at: string | null
          verification_method: string | null
          webhook_secret_encrypted: string | null
        }
        Insert: {
          access_token_encrypted?: string | null
          account_number?: string | null
          api_key_encrypted?: string | null
          bank_code: string
          consumer_secret_encrypted?: string | null
          created_at?: string | null
          credentials_verified?: boolean | null
          environment?: string | null
          extended_config?: Json | null
          id?: string
          ipn_password_encrypted?: string | null
          ipn_url?: string | null
          ipn_username?: string | null
          is_active?: boolean | null
          landlord_id: string
          last_verified_at?: string | null
          merchant_code?: string | null
          paybill_number?: string | null
          updated_at?: string | null
          verification_method?: string | null
          webhook_secret_encrypted?: string | null
        }
        Update: {
          access_token_encrypted?: string | null
          account_number?: string | null
          api_key_encrypted?: string | null
          bank_code?: string
          consumer_secret_encrypted?: string | null
          created_at?: string | null
          credentials_verified?: boolean | null
          environment?: string | null
          extended_config?: Json | null
          id?: string
          ipn_password_encrypted?: string | null
          ipn_url?: string | null
          ipn_username?: string | null
          is_active?: boolean | null
          landlord_id?: string
          last_verified_at?: string | null
          merchant_code?: string | null
          paybill_number?: string | null
          updated_at?: string | null
          verification_method?: string | null
          webhook_secret_encrypted?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "landlord_bank_configs_landlord_id_fkey"
            columns: ["landlord_id"]
            isOneToOne: false
            referencedRelation: "orphaned_users_monitor"
            referencedColumns: ["id"]
          },
        ]
      }
      landlord_jenga_configs: {
        Row: {
          api_key_encrypted: string | null
          consumer_secret_encrypted: string | null
          created_at: string | null
          credentials_verified: boolean | null
          environment: string
          id: string
          ipn_password_encrypted: string | null
          ipn_url: string | null
          ipn_username: string | null
          is_active: boolean | null
          landlord_id: string
          last_verified_at: string | null
          merchant_code: string
          paybill_number: string
          updated_at: string | null
        }
        Insert: {
          api_key_encrypted?: string | null
          consumer_secret_encrypted?: string | null
          created_at?: string | null
          credentials_verified?: boolean | null
          environment?: string
          id?: string
          ipn_password_encrypted?: string | null
          ipn_url?: string | null
          ipn_username?: string | null
          is_active?: boolean | null
          landlord_id: string
          last_verified_at?: string | null
          merchant_code: string
          paybill_number?: string
          updated_at?: string | null
        }
        Update: {
          api_key_encrypted?: string | null
          consumer_secret_encrypted?: string | null
          created_at?: string | null
          credentials_verified?: boolean | null
          environment?: string
          id?: string
          ipn_password_encrypted?: string | null
          ipn_url?: string | null
          ipn_username?: string | null
          is_active?: boolean | null
          landlord_id?: string
          last_verified_at?: string | null
          merchant_code?: string
          paybill_number?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "landlord_jenga_configs_landlord_id_fkey"
            columns: ["landlord_id"]
            isOneToOne: true
            referencedRelation: "orphaned_users_monitor"
            referencedColumns: ["id"]
          },
        ]
      }
      landlord_mpesa_configs: {
        Row: {
          business_shortcode: string
          callback_url: string | null
          consumer_key_encrypted: string | null
          consumer_secret_encrypted: string | null
          created_at: string
          credentials_verified: boolean | null
          environment: string
          id: string
          is_active: boolean
          kopokopo_api_key_encrypted: string | null
          kopokopo_client_id: string | null
          kopokopo_client_secret_encrypted: string | null
          kopokopo_merchant_id: string | null
          landlord_id: string
          last_verified_at: string | null
          passkey_encrypted: string | null
          paybill_number: string | null
          phone_number: string | null
          shortcode_type: string | null
          till_number: string | null
          till_provider: string | null
          updated_at: string
        }
        Insert: {
          business_shortcode: string
          callback_url?: string | null
          consumer_key_encrypted?: string | null
          consumer_secret_encrypted?: string | null
          created_at?: string
          credentials_verified?: boolean | null
          environment?: string
          id?: string
          is_active?: boolean
          kopokopo_api_key_encrypted?: string | null
          kopokopo_client_id?: string | null
          kopokopo_client_secret_encrypted?: string | null
          kopokopo_merchant_id?: string | null
          landlord_id: string
          last_verified_at?: string | null
          passkey_encrypted?: string | null
          paybill_number?: string | null
          phone_number?: string | null
          shortcode_type?: string | null
          till_number?: string | null
          till_provider?: string | null
          updated_at?: string
        }
        Update: {
          business_shortcode?: string
          callback_url?: string | null
          consumer_key_encrypted?: string | null
          consumer_secret_encrypted?: string | null
          created_at?: string
          credentials_verified?: boolean | null
          environment?: string
          id?: string
          is_active?: boolean
          kopokopo_api_key_encrypted?: string | null
          kopokopo_client_id?: string | null
          kopokopo_client_secret_encrypted?: string | null
          kopokopo_merchant_id?: string | null
          landlord_id?: string
          last_verified_at?: string | null
          passkey_encrypted?: string | null
          paybill_number?: string | null
          phone_number?: string | null
          shortcode_type?: string | null
          till_number?: string | null
          till_provider?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      landlord_payment_preferences: {
        Row: {
          auto_payment_enabled: boolean | null
          bank_account_details: Json | null
          created_at: string
          id: string
          landlord_id: string
          mpesa_config_preference: string | null
          mpesa_phone_number: string | null
          payment_instructions: string | null
          payment_reminders_enabled: boolean | null
          preferred_payment_method: string
          updated_at: string
        }
        Insert: {
          auto_payment_enabled?: boolean | null
          bank_account_details?: Json | null
          created_at?: string
          id?: string
          landlord_id: string
          mpesa_config_preference?: string | null
          mpesa_phone_number?: string | null
          payment_instructions?: string | null
          payment_reminders_enabled?: boolean | null
          preferred_payment_method?: string
          updated_at?: string
        }
        Update: {
          auto_payment_enabled?: boolean | null
          bank_account_details?: Json | null
          created_at?: string
          id?: string
          landlord_id?: string
          mpesa_config_preference?: string | null
          mpesa_phone_number?: string | null
          payment_instructions?: string | null
          payment_reminders_enabled?: boolean | null
          preferred_payment_method?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "landlord_payment_preferences_landlord_id_fkey"
            columns: ["landlord_id"]
            isOneToOne: true
            referencedRelation: "orphaned_users_monitor"
            referencedColumns: ["id"]
          },
        ]
      }
      landlord_subscriptions: {
        Row: {
          account_type: string | null
          auto_renewal: boolean | null
          billing_plan_id: string | null
          created_at: string
          id: string
          landlord_id: string
          last_billing_date: string | null
          next_billing_date: string | null
          onboarding_completed: boolean | null
          sms_credits_balance: number | null
          status: string
          subscription_start_date: string | null
          trial_end_date: string | null
          trial_start_date: string | null
          trial_usage_data: Json | null
          updated_at: string
        }
        Insert: {
          account_type?: string | null
          auto_renewal?: boolean | null
          billing_plan_id?: string | null
          created_at?: string
          id?: string
          landlord_id: string
          last_billing_date?: string | null
          next_billing_date?: string | null
          onboarding_completed?: boolean | null
          sms_credits_balance?: number | null
          status?: string
          subscription_start_date?: string | null
          trial_end_date?: string | null
          trial_start_date?: string | null
          trial_usage_data?: Json | null
          updated_at?: string
        }
        Update: {
          account_type?: string | null
          auto_renewal?: boolean | null
          billing_plan_id?: string | null
          created_at?: string
          id?: string
          landlord_id?: string
          last_billing_date?: string | null
          next_billing_date?: string | null
          onboarding_completed?: boolean | null
          sms_credits_balance?: number | null
          status?: string
          subscription_start_date?: string | null
          trial_end_date?: string | null
          trial_start_date?: string | null
          trial_usage_data?: Json | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "landlord_subscriptions_billing_plan_id_fkey"
            columns: ["billing_plan_id"]
            isOneToOne: false
            referencedRelation: "billing_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      leases: {
        Row: {
          created_at: string
          id: string
          lease_end_date: string
          lease_start_date: string
          lease_terms: string | null
          monthly_rent: number
          security_deposit: number | null
          status: string
          tenant_id: string
          unit_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          lease_end_date: string
          lease_start_date: string
          lease_terms?: string | null
          monthly_rent: number
          security_deposit?: number | null
          status?: string
          tenant_id: string
          unit_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          lease_end_date?: string
          lease_start_date?: string
          lease_terms?: string | null
          monthly_rent?: number
          security_deposit?: number | null
          status?: string
          tenant_id?: string
          unit_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_leases_tenant_id"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant_safe_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_leases_tenant_id"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_leases_unit_id"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leases_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant_safe_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leases_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leases_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      maintenance_action_logs: {
        Row: {
          action_type: string
          created_at: string | null
          details: Json | null
          id: string
          maintenance_request_id: string
          new_value: string | null
          old_value: string | null
          user_id: string
        }
        Insert: {
          action_type: string
          created_at?: string | null
          details?: Json | null
          id?: string
          maintenance_request_id: string
          new_value?: string | null
          old_value?: string | null
          user_id: string
        }
        Update: {
          action_type?: string
          created_at?: string | null
          details?: Json | null
          id?: string
          maintenance_request_id?: string
          new_value?: string | null
          old_value?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "maintenance_action_logs_maintenance_request_id_fkey"
            columns: ["maintenance_request_id"]
            isOneToOne: false
            referencedRelation: "maintenance_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      maintenance_notes: {
        Row: {
          created_at: string | null
          id: string
          is_internal: boolean | null
          maintenance_request_id: string
          note: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_internal?: boolean | null
          maintenance_request_id: string
          note: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          is_internal?: boolean | null
          maintenance_request_id?: string
          note?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "maintenance_notes_maintenance_request_id_fkey"
            columns: ["maintenance_request_id"]
            isOneToOne: false
            referencedRelation: "maintenance_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      maintenance_requests: {
        Row: {
          assigned_to: string | null
          category: string
          completed_date: string | null
          cost: number | null
          created_at: string
          description: string
          id: string
          images: string[] | null
          internal_notes: string | null
          landlord_images: string[] | null
          last_status_change: string | null
          last_updated_by: string | null
          notes: string | null
          priority: string
          property_id: string
          scheduled_date: string | null
          status: string
          submitted_date: string
          tenant_id: string
          title: string
          unit_id: string | null
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          category: string
          completed_date?: string | null
          cost?: number | null
          created_at?: string
          description: string
          id?: string
          images?: string[] | null
          internal_notes?: string | null
          landlord_images?: string[] | null
          last_status_change?: string | null
          last_updated_by?: string | null
          notes?: string | null
          priority?: string
          property_id: string
          scheduled_date?: string | null
          status?: string
          submitted_date?: string
          tenant_id: string
          title: string
          unit_id?: string | null
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          category?: string
          completed_date?: string | null
          cost?: number | null
          created_at?: string
          description?: string
          id?: string
          images?: string[] | null
          internal_notes?: string | null
          landlord_images?: string[] | null
          last_status_change?: string | null
          last_updated_by?: string | null
          notes?: string | null
          priority?: string
          property_id?: string
          scheduled_date?: string | null
          status?: string
          submitted_date?: string
          tenant_id?: string
          title?: string
          unit_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      message_templates: {
        Row: {
          category: string
          content: string
          created_at: string
          enabled: boolean
          id: string
          landlord_id: string | null
          name: string
          subject: string | null
          type: string
          updated_at: string
          variables: string[]
        }
        Insert: {
          category?: string
          content: string
          created_at?: string
          enabled?: boolean
          id?: string
          landlord_id?: string | null
          name: string
          subject?: string | null
          type: string
          updated_at?: string
          variables?: string[]
        }
        Update: {
          category?: string
          content?: string
          created_at?: string
          enabled?: boolean
          id?: string
          landlord_id?: string | null
          name?: string
          subject?: string | null
          type?: string
          updated_at?: string
          variables?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "message_templates_landlord_id_fkey"
            columns: ["landlord_id"]
            isOneToOne: false
            referencedRelation: "orphaned_users_monitor"
            referencedColumns: ["id"]
          },
        ]
      }
      meter_readings: {
        Row: {
          created_at: string
          created_by: string | null
          current_reading: number
          id: string
          meter_type: string
          notes: string | null
          previous_reading: number
          rate_per_unit: number
          reading_date: string
          total_cost: number | null
          unit_id: string
          units_consumed: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          current_reading: number
          id?: string
          meter_type: string
          notes?: string | null
          previous_reading?: number
          rate_per_unit?: number
          reading_date: string
          total_cost?: number | null
          unit_id: string
          units_consumed?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          current_reading?: number
          id?: string
          meter_type?: string
          notes?: string | null
          previous_reading?: number
          rate_per_unit?: number
          reading_date?: string
          total_cost?: number | null
          unit_id?: string
          units_consumed?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      mpesa_credentials: {
        Row: {
          consumer_key: string
          consumer_key_encrypted: string | null
          consumer_secret: string
          consumer_secret_encrypted: string | null
          created_at: string | null
          id: string
          is_sandbox: boolean | null
          landlord_id: string | null
          passkey: string
          passkey_encrypted: string | null
          shortcode: string
          updated_at: string | null
        }
        Insert: {
          consumer_key: string
          consumer_key_encrypted?: string | null
          consumer_secret: string
          consumer_secret_encrypted?: string | null
          created_at?: string | null
          id?: string
          is_sandbox?: boolean | null
          landlord_id?: string | null
          passkey: string
          passkey_encrypted?: string | null
          shortcode: string
          updated_at?: string | null
        }
        Update: {
          consumer_key?: string
          consumer_key_encrypted?: string | null
          consumer_secret?: string
          consumer_secret_encrypted?: string | null
          created_at?: string | null
          id?: string
          is_sandbox?: boolean | null
          landlord_id?: string | null
          passkey?: string
          passkey_encrypted?: string | null
          shortcode?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      mpesa_stk_requests: {
        Row: {
          account_reference: string | null
          amount: number
          checkout_request_id: string | null
          created_at: string | null
          id: string
          invoice_id: string | null
          landlord_id: string | null
          merchant_request_id: string
          payment_type: string | null
          phone_number: string
          provider: string | null
          response_code: string | null
          response_description: string | null
          status: string
          transaction_desc: string | null
          updated_at: string | null
        }
        Insert: {
          account_reference?: string | null
          amount: number
          checkout_request_id?: string | null
          created_at?: string | null
          id?: string
          invoice_id?: string | null
          landlord_id?: string | null
          merchant_request_id: string
          payment_type?: string | null
          phone_number: string
          provider?: string | null
          response_code?: string | null
          response_description?: string | null
          status?: string
          transaction_desc?: string | null
          updated_at?: string | null
        }
        Update: {
          account_reference?: string | null
          amount?: number
          checkout_request_id?: string | null
          created_at?: string | null
          id?: string
          invoice_id?: string | null
          landlord_id?: string | null
          merchant_request_id?: string
          payment_type?: string | null
          phone_number?: string
          provider?: string | null
          response_code?: string | null
          response_description?: string | null
          status?: string
          transaction_desc?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      mpesa_transactions: {
        Row: {
          amount: number
          authorized_by: string | null
          checkout_request_id: string
          created_at: string
          id: string
          initiated_by: string | null
          invoice_id: string | null
          merchant_request_id: string | null
          metadata: Json | null
          mpesa_receipt_number: string | null
          payment_type: string | null
          phone_number: string
          phone_number_encrypted: string | null
          provider: string | null
          result_code: number | null
          result_desc: string | null
          status: string
          updated_at: string
        }
        Insert: {
          amount: number
          authorized_by?: string | null
          checkout_request_id: string
          created_at?: string
          id?: string
          initiated_by?: string | null
          invoice_id?: string | null
          merchant_request_id?: string | null
          metadata?: Json | null
          mpesa_receipt_number?: string | null
          payment_type?: string | null
          phone_number: string
          phone_number_encrypted?: string | null
          provider?: string | null
          result_code?: number | null
          result_desc?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          authorized_by?: string | null
          checkout_request_id?: string
          created_at?: string
          id?: string
          initiated_by?: string | null
          invoice_id?: string | null
          merchant_request_id?: string | null
          metadata?: Json | null
          mpesa_receipt_number?: string | null
          payment_type?: string | null
          phone_number?: string
          phone_number_encrypted?: string | null
          provider?: string | null
          result_code?: number | null
          result_desc?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "mpesa_transactions_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_logs: {
        Row: {
          created_at: string | null
          error_message: string | null
          id: string
          maintenance_request_id: string | null
          message: string | null
          notification_type: string
          sent_at: string | null
          status: string
          subject: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          error_message?: string | null
          id?: string
          maintenance_request_id?: string | null
          message?: string | null
          notification_type: string
          sent_at?: string | null
          status: string
          subject?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          error_message?: string | null
          id?: string
          maintenance_request_id?: string | null
          message?: string | null
          notification_type?: string
          sent_at?: string | null
          status?: string
          subject?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_logs_maintenance_request_id_fkey"
            columns: ["maintenance_request_id"]
            isOneToOne: false
            referencedRelation: "maintenance_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_preferences: {
        Row: {
          created_at: string | null
          email_enabled: boolean | null
          id: string
          portal_enabled: boolean | null
          sms_enabled: boolean | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          email_enabled?: boolean | null
          id?: string
          portal_enabled?: boolean | null
          sms_enabled?: boolean | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          email_enabled?: boolean | null
          id?: string
          portal_enabled?: boolean | null
          sms_enabled?: boolean | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          message: string
          read: boolean | null
          related_id: string | null
          related_type: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          message: string
          read?: boolean | null
          related_id?: string | null
          related_type?: string | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string
          read?: boolean | null
          related_id?: string | null
          related_type?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "orphaned_users_monitor"
            referencedColumns: ["id"]
          },
        ]
      }
      onboarding_steps: {
        Row: {
          component_name: string
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          is_required: boolean
          step_name: string
          step_order: number
          title: string
          updated_at: string
          user_roles: string[]
        }
        Insert: {
          component_name: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          is_required?: boolean
          step_name: string
          step_order: number
          title: string
          updated_at?: string
          user_roles?: string[]
        }
        Update: {
          component_name?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          is_required?: boolean
          step_name?: string
          step_order?: number
          title?: string
          updated_at?: string
          user_roles?: string[]
        }
        Relationships: []
      }
      partner_logos: {
        Row: {
          company_name: string
          created_at: string | null
          created_by: string | null
          display_order: number | null
          id: string
          is_active: boolean | null
          logo_url: string
          updated_at: string | null
          website_url: string | null
        }
        Insert: {
          company_name: string
          created_at?: string | null
          created_by?: string | null
          display_order?: number | null
          id?: string
          is_active?: boolean | null
          logo_url: string
          updated_at?: string | null
          website_url?: string | null
        }
        Update: {
          company_name?: string
          created_at?: string | null
          created_by?: string | null
          display_order?: number | null
          id?: string
          is_active?: boolean | null
          logo_url?: string
          updated_at?: string | null
          website_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "partner_logos_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_allocations: {
        Row: {
          allocated_at: string
          amount: number
          created_at: string
          id: string
          invoice_id: string
          payment_id: string
          updated_at: string
        }
        Insert: {
          allocated_at?: string
          amount: number
          created_at?: string
          id?: string
          invoice_id: string
          payment_id: string
          updated_at?: string
        }
        Update: {
          allocated_at?: string
          amount?: number
          created_at?: string
          id?: string
          invoice_id?: string
          payment_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_allocations_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_allocations_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_transactions: {
        Row: {
          amount: number
          created_at: string
          currency: string
          gateway_response: Json | null
          id: string
          invoice_id: string | null
          landlord_id: string
          payment_method: string
          processed_at: string | null
          status: string
          transaction_id: string | null
        }
        Insert: {
          amount: number
          created_at?: string
          currency?: string
          gateway_response?: Json | null
          id?: string
          invoice_id?: string | null
          landlord_id: string
          payment_method: string
          processed_at?: string | null
          status: string
          transaction_id?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          currency?: string
          gateway_response?: Json | null
          id?: string
          invoice_id?: string | null
          landlord_id?: string
          payment_method?: string
          processed_at?: string | null
          status?: string
          transaction_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_transactions_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          created_at: string
          id: string
          invoice_id: string | null
          invoice_number: string | null
          lease_id: string
          notes: string | null
          payment_date: string
          payment_method: string | null
          payment_reference: string | null
          payment_type: string
          status: string
          tenant_id: string
          transaction_id: string | null
          updated_at: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          invoice_id?: string | null
          invoice_number?: string | null
          lease_id: string
          notes?: string | null
          payment_date: string
          payment_method?: string | null
          payment_reference?: string | null
          payment_type: string
          status?: string
          tenant_id: string
          transaction_id?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          invoice_id?: string | null
          invoice_number?: string | null
          lease_id?: string
          notes?: string | null
          payment_date?: string
          payment_method?: string | null
          payment_reference?: string | null
          payment_type?: string
          status?: string
          tenant_id?: string
          transaction_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_payments_invoice_id"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_payments_lease_id"
            columns: ["lease_id"]
            isOneToOne: false
            referencedRelation: "leases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_payments_tenant_id"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant_safe_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_payments_tenant_id"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_lease_id_fkey"
            columns: ["lease_id"]
            isOneToOne: false
            referencedRelation: "leases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant_safe_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      pdf_template_bindings: {
        Row: {
          created_at: string
          document_type: string
          id: string
          is_active: boolean
          landlord_id: string | null
          priority: number
          role: string
          template_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          document_type: string
          id?: string
          is_active?: boolean
          landlord_id?: string | null
          priority?: number
          role: string
          template_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          document_type?: string
          id?: string
          is_active?: boolean
          landlord_id?: string | null
          priority?: number
          role?: string
          template_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pdf_template_bindings_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "pdf_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      pdf_templates: {
        Row: {
          content: Json
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_active: boolean
          name: string
          type: string
          updated_at: string
          version: number
        }
        Insert: {
          content: Json
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          type: string
          updated_at?: string
          version?: number
        }
        Update: {
          content?: Json
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          type?: string
          updated_at?: string
          version?: number
        }
        Relationships: []
      }
      permissions: {
        Row: {
          category: string
          created_at: string
          description: string | null
          id: string
          name: string
        }
        Insert: {
          category: string
          created_at?: string
          description?: string | null
          id?: string
          name: string
        }
        Update: {
          category?: string
          created_at?: string
          description?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      plan_features: {
        Row: {
          category: string
          created_at: string | null
          description: string | null
          display_name: string
          feature_key: string
          icon_name: string | null
          id: string
          is_active: boolean | null
          menu_item_title: string | null
          sort_order: number | null
          updated_at: string | null
        }
        Insert: {
          category: string
          created_at?: string | null
          description?: string | null
          display_name: string
          feature_key: string
          icon_name?: string | null
          id?: string
          is_active?: boolean | null
          menu_item_title?: string | null
          sort_order?: number | null
          updated_at?: string | null
        }
        Update: {
          category?: string
          created_at?: string | null
          description?: string | null
          display_name?: string
          feature_key?: string
          icon_name?: string | null
          id?: string
          is_active?: boolean | null
          menu_item_title?: string | null
          sort_order?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string
          first_name: string | null
          id: string
          last_name: string | null
          phone: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email: string
          first_name?: string | null
          id: string
          last_name?: string | null
          phone: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string
          first_name?: string | null
          id?: string
          last_name?: string | null
          phone?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_id_fkey"
            columns: ["id"]
            isOneToOne: true
            referencedRelation: "orphaned_users_monitor"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles_backup: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          email: string | null
          first_name: string | null
          id: string | null
          last_name: string | null
          phone: string | null
          updated_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          email?: string | null
          first_name?: string | null
          id?: string | null
          last_name?: string | null
          phone?: string | null
          updated_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          email?: string | null
          first_name?: string | null
          id?: string | null
          last_name?: string | null
          phone?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      properties: {
        Row: {
          address: string
          amenities: string[] | null
          city: string
          country: string
          created_at: string
          description: string | null
          id: string
          manager_id: string | null
          name: string
          owner_id: string | null
          property_type: string
          state: string
          total_units: number | null
          updated_at: string
          zip_code: string
        }
        Insert: {
          address: string
          amenities?: string[] | null
          city: string
          country?: string
          created_at?: string
          description?: string | null
          id?: string
          manager_id?: string | null
          name: string
          owner_id?: string | null
          property_type: string
          state: string
          total_units?: number | null
          updated_at?: string
          zip_code: string
        }
        Update: {
          address?: string
          amenities?: string[] | null
          city?: string
          country?: string
          created_at?: string
          description?: string | null
          id?: string
          manager_id?: string | null
          name?: string
          owner_id?: string | null
          property_type?: string
          state?: string
          total_units?: number | null
          updated_at?: string
          zip_code?: string
        }
        Relationships: [
          {
            foreignKeyName: "properties_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "orphaned_users_monitor"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "properties_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "orphaned_users_monitor"
            referencedColumns: ["id"]
          },
        ]
      }
      report_runs: {
        Row: {
          execution_time_ms: number | null
          file_size_bytes: number | null
          filters: Json | null
          generated_at: string
          id: string
          metadata: Json | null
          report_type: string
          status: string
          user_id: string
        }
        Insert: {
          execution_time_ms?: number | null
          file_size_bytes?: number | null
          filters?: Json | null
          generated_at?: string
          id?: string
          metadata?: Json | null
          report_type: string
          status?: string
          user_id: string
        }
        Update: {
          execution_time_ms?: number | null
          file_size_bytes?: number | null
          filters?: Json | null
          generated_at?: string
          id?: string
          metadata?: Json | null
          report_type?: string
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      role_change_logs: {
        Row: {
          changed_by: string
          created_at: string | null
          id: string
          metadata: Json | null
          new_role: Database["public"]["Enums"]["app_role"] | null
          old_role: Database["public"]["Enums"]["app_role"] | null
          reason: string | null
          user_id: string
        }
        Insert: {
          changed_by: string
          created_at?: string | null
          id?: string
          metadata?: Json | null
          new_role?: Database["public"]["Enums"]["app_role"] | null
          old_role?: Database["public"]["Enums"]["app_role"] | null
          reason?: string | null
          user_id: string
        }
        Update: {
          changed_by?: string
          created_at?: string | null
          id?: string
          metadata?: Json | null
          new_role?: Database["public"]["Enums"]["app_role"] | null
          old_role?: Database["public"]["Enums"]["app_role"] | null
          reason?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "role_change_logs_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "role_change_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      role_permissions: {
        Row: {
          created_at: string
          id: string
          permission_id: string
          role: Database["public"]["Enums"]["app_role"]
        }
        Insert: {
          created_at?: string
          id?: string
          permission_id: string
          role: Database["public"]["Enums"]["app_role"]
        }
        Update: {
          created_at?: string
          id?: string
          permission_id?: string
          role?: Database["public"]["Enums"]["app_role"]
        }
        Relationships: [
          {
            foreignKeyName: "role_permissions_permission_id_fkey"
            columns: ["permission_id"]
            isOneToOne: false
            referencedRelation: "permissions"
            referencedColumns: ["id"]
          },
        ]
      }
      security_config_status: {
        Row: {
          config_item: string
          details: Json | null
          id: string
          last_checked: string | null
          status: string
        }
        Insert: {
          config_item: string
          details?: Json | null
          id?: string
          last_checked?: string | null
          status: string
        }
        Update: {
          config_item?: string
          details?: Json | null
          id?: string
          last_checked?: string | null
          status?: string
        }
        Relationships: []
      }
      security_event_rate_limits: {
        Row: {
          created_at: string | null
          event_count: number | null
          id: string
          ip_address: unknown
          window_start: string | null
        }
        Insert: {
          created_at?: string | null
          event_count?: number | null
          id?: string
          ip_address: unknown
          window_start?: string | null
        }
        Update: {
          created_at?: string | null
          event_count?: number | null
          id?: string
          ip_address?: unknown
          window_start?: string | null
        }
        Relationships: []
      }
      security_events: {
        Row: {
          created_at: string | null
          details: Json | null
          event_type: string
          id: string
          ip_address: unknown
          severity: string
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          details?: Json | null
          event_type: string
          id?: string
          ip_address?: unknown
          severity?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          details?: Json | null
          event_type?: string
          id?: string
          ip_address?: unknown
          severity?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      self_hosted_instances: {
        Row: {
          created_at: string
          domain: string | null
          id: string
          landlord_id: string
          last_seen_at: string | null
          metadata: Json
          name: string
          status: string
          updated_at: string
          write_key_hash: string
        }
        Insert: {
          created_at?: string
          domain?: string | null
          id?: string
          landlord_id: string
          last_seen_at?: string | null
          metadata?: Json
          name: string
          status?: string
          updated_at?: string
          write_key_hash: string
        }
        Update: {
          created_at?: string
          domain?: string | null
          id?: string
          landlord_id?: string
          last_seen_at?: string | null
          metadata?: Json
          name?: string
          status?: string
          updated_at?: string
          write_key_hash?: string
        }
        Relationships: []
      }
      service_charge_invoices: {
        Row: {
          billing_period_end: string
          billing_period_start: string
          created_at: string
          currency: string
          due_date: string
          id: string
          invoice_number: string
          landlord_id: string
          mpesa_checkout_request_id: string | null
          mpesa_receipt_number: string | null
          notes: string | null
          other_charges: number
          payment_date: string | null
          payment_method: string | null
          payment_phone_number: string | null
          payment_reference: string | null
          rent_collected: number
          service_charge_amount: number
          service_charge_rate: number | null
          sms_charges: number
          status: string
          total_amount: number
          updated_at: string
        }
        Insert: {
          billing_period_end: string
          billing_period_start: string
          created_at?: string
          currency?: string
          due_date: string
          id?: string
          invoice_number: string
          landlord_id: string
          mpesa_checkout_request_id?: string | null
          mpesa_receipt_number?: string | null
          notes?: string | null
          other_charges?: number
          payment_date?: string | null
          payment_method?: string | null
          payment_phone_number?: string | null
          payment_reference?: string | null
          rent_collected?: number
          service_charge_amount?: number
          service_charge_rate?: number | null
          sms_charges?: number
          status?: string
          total_amount?: number
          updated_at?: string
        }
        Update: {
          billing_period_end?: string
          billing_period_start?: string
          created_at?: string
          currency?: string
          due_date?: string
          id?: string
          invoice_number?: string
          landlord_id?: string
          mpesa_checkout_request_id?: string | null
          mpesa_receipt_number?: string | null
          notes?: string | null
          other_charges?: number
          payment_date?: string | null
          payment_method?: string | null
          payment_phone_number?: string | null
          payment_reference?: string | null
          rent_collected?: number
          service_charge_amount?: number
          service_charge_rate?: number | null
          sms_charges?: number
          status?: string
          total_amount?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_charge_invoices_landlord_id_fkey"
            columns: ["landlord_id"]
            isOneToOne: false
            referencedRelation: "orphaned_users_monitor"
            referencedColumns: ["id"]
          },
        ]
      }
      service_providers: {
        Row: {
          created_at: string | null
          email: string | null
          id: string
          is_active: boolean | null
          name: string
          phone: string | null
          specialties: string[] | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          email?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          phone?: string | null
          specialties?: string[] | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          phone?: string | null
          specialties?: string[] | null
          updated_at?: string | null
        }
        Relationships: []
      }
      sms_automation_settings: {
        Row: {
          audience_type: string | null
          automation_key: string
          created_at: string | null
          enabled: boolean | null
          id: string
          landlord_id: string | null
          template: string | null
          timing_days_before: number | null
          updated_at: string | null
        }
        Insert: {
          audience_type?: string | null
          automation_key: string
          created_at?: string | null
          enabled?: boolean | null
          id?: string
          landlord_id?: string | null
          template?: string | null
          timing_days_before?: number | null
          updated_at?: string | null
        }
        Update: {
          audience_type?: string | null
          automation_key?: string
          created_at?: string | null
          enabled?: boolean | null
          id?: string
          landlord_id?: string | null
          template?: string | null
          timing_days_before?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sms_automation_settings_landlord_id_fkey"
            columns: ["landlord_id"]
            isOneToOne: false
            referencedRelation: "orphaned_users_monitor"
            referencedColumns: ["id"]
          },
        ]
      }
      sms_bundles: {
        Row: {
          created_at: string
          currency: string
          description: string | null
          id: string
          is_active: boolean | null
          name: string
          price: number
          sms_count: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          currency?: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          price: number
          sms_count: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          currency?: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          price?: number
          sms_count?: number
          updated_at?: string
        }
        Relationships: []
      }
      sms_campaigns: {
        Row: {
          actual_cost: number | null
          created_at: string
          created_by: string | null
          estimated_cost: number | null
          failed_sends: number | null
          filter_criteria: Json | null
          id: string
          message: string
          metadata: Json | null
          name: string
          sent_at: string | null
          status: string
          successful_sends: number | null
          template_id: string | null
          total_recipients: number | null
        }
        Insert: {
          actual_cost?: number | null
          created_at?: string
          created_by?: string | null
          estimated_cost?: number | null
          failed_sends?: number | null
          filter_criteria?: Json | null
          id?: string
          message: string
          metadata?: Json | null
          name: string
          sent_at?: string | null
          status?: string
          successful_sends?: number | null
          template_id?: string | null
          total_recipients?: number | null
        }
        Update: {
          actual_cost?: number | null
          created_at?: string
          created_by?: string | null
          estimated_cost?: number | null
          failed_sends?: number | null
          filter_criteria?: Json | null
          id?: string
          message?: string
          metadata?: Json | null
          name?: string
          sent_at?: string | null
          status?: string
          successful_sends?: number | null
          template_id?: string | null
          total_recipients?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "sms_campaigns_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "orphaned_users_monitor"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sms_campaigns_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "sms_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      sms_credit_transactions: {
        Row: {
          balance_after: number
          created_at: string
          created_by: string | null
          credits_change: number
          description: string | null
          id: string
          landlord_id: string
          metadata: Json | null
          reference_id: string | null
          reference_type: string | null
          transaction_type: string
        }
        Insert: {
          balance_after: number
          created_at?: string
          created_by?: string | null
          credits_change: number
          description?: string | null
          id?: string
          landlord_id: string
          metadata?: Json | null
          reference_id?: string | null
          reference_type?: string | null
          transaction_type: string
        }
        Update: {
          balance_after?: number
          created_at?: string
          created_by?: string | null
          credits_change?: number
          description?: string | null
          id?: string
          landlord_id?: string
          metadata?: Json | null
          reference_id?: string | null
          reference_type?: string | null
          transaction_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "sms_credit_transactions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "orphaned_users_monitor"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sms_credit_transactions_landlord_id_fkey"
            columns: ["landlord_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      sms_logs: {
        Row: {
          created_at: string | null
          created_by: string | null
          delivered_at: string | null
          error_message: string | null
          failed_at: string | null
          id: string
          landlord_id: string | null
          last_retry_at: string | null
          message_content: string
          message_type: string | null
          phone_number: string
          phone_number_formatted: string
          provider_name: string | null
          provider_response: Json | null
          retry_count: number | null
          sent_at: string | null
          status: string
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          delivered_at?: string | null
          error_message?: string | null
          failed_at?: string | null
          id?: string
          landlord_id?: string | null
          last_retry_at?: string | null
          message_content: string
          message_type?: string | null
          phone_number: string
          phone_number_formatted: string
          provider_name?: string | null
          provider_response?: Json | null
          retry_count?: number | null
          sent_at?: string | null
          status?: string
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          delivered_at?: string | null
          error_message?: string | null
          failed_at?: string | null
          id?: string
          landlord_id?: string | null
          last_retry_at?: string | null
          message_content?: string
          message_type?: string | null
          phone_number?: string
          phone_number_formatted?: string
          provider_name?: string | null
          provider_response?: Json | null
          retry_count?: number | null
          sent_at?: string | null
          status?: string
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sms_logs_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "orphaned_users_monitor"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sms_logs_landlord_id_fkey"
            columns: ["landlord_id"]
            isOneToOne: false
            referencedRelation: "orphaned_users_monitor"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sms_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "orphaned_users_monitor"
            referencedColumns: ["id"]
          },
        ]
      }
      sms_providers: {
        Row: {
          authorization_token: string | null
          base_url: string | null
          config_data: Json | null
          created_at: string
          id: string
          is_active: boolean | null
          is_default: boolean | null
          provider_name: string
          sender_id: string | null
          sender_type: string | null
          unique_identifier: string | null
          updated_at: string
          username: string | null
        }
        Insert: {
          authorization_token?: string | null
          base_url?: string | null
          config_data?: Json | null
          created_at?: string
          id?: string
          is_active?: boolean | null
          is_default?: boolean | null
          provider_name: string
          sender_id?: string | null
          sender_type?: string | null
          unique_identifier?: string | null
          updated_at?: string
          username?: string | null
        }
        Update: {
          authorization_token?: string | null
          base_url?: string | null
          config_data?: Json | null
          created_at?: string
          id?: string
          is_active?: boolean | null
          is_default?: boolean | null
          provider_name?: string
          sender_id?: string | null
          sender_type?: string | null
          unique_identifier?: string | null
          updated_at?: string
          username?: string | null
        }
        Relationships: []
      }
      sms_templates: {
        Row: {
          category: string
          content: string
          created_at: string
          enabled: boolean
          id: string
          is_default: boolean | null
          landlord_id: string | null
          name: string
          updated_at: string
          variables: string[] | null
        }
        Insert: {
          category: string
          content: string
          created_at?: string
          enabled?: boolean
          id?: string
          is_default?: boolean | null
          landlord_id?: string | null
          name: string
          updated_at?: string
          variables?: string[] | null
        }
        Update: {
          category?: string
          content?: string
          created_at?: string
          enabled?: boolean
          id?: string
          is_default?: boolean | null
          landlord_id?: string | null
          name?: string
          updated_at?: string
          variables?: string[] | null
        }
        Relationships: []
      }
      sms_usage: {
        Row: {
          cost: number
          created_at: string
          id: string
          landlord_id: string
          message_content: string | null
          message_content_encrypted: string | null
          recipient_phone: string
          recipient_phone_encrypted: string | null
          recipient_phone_token: string | null
          sent_at: string | null
          status: string
        }
        Insert: {
          cost: number
          created_at?: string
          id?: string
          landlord_id: string
          message_content?: string | null
          message_content_encrypted?: string | null
          recipient_phone: string
          recipient_phone_encrypted?: string | null
          recipient_phone_token?: string | null
          sent_at?: string | null
          status: string
        }
        Update: {
          cost?: number
          created_at?: string
          id?: string
          landlord_id?: string
          message_content?: string | null
          message_content_encrypted?: string | null
          recipient_phone?: string
          recipient_phone_encrypted?: string | null
          recipient_phone_token?: string | null
          sent_at?: string | null
          status?: string
        }
        Relationships: []
      }
      sms_usage_logs: {
        Row: {
          cost: number | null
          delivery_status: string | null
          error_message: string | null
          id: string
          landlord_id: string | null
          message_content: string
          metadata: Json | null
          provider_name: string
          recipient_phone: string
          sent_at: string | null
          status: string
        }
        Insert: {
          cost?: number | null
          delivery_status?: string | null
          error_message?: string | null
          id?: string
          landlord_id?: string | null
          message_content: string
          metadata?: Json | null
          provider_name: string
          recipient_phone: string
          sent_at?: string | null
          status: string
        }
        Update: {
          cost?: number | null
          delivery_status?: string | null
          error_message?: string | null
          id?: string
          landlord_id?: string | null
          message_content?: string
          metadata?: Json | null
          provider_name?: string
          recipient_phone?: string
          sent_at?: string | null
          status?: string
        }
        Relationships: []
      }
      sub_users: {
        Row: {
          created_at: string
          id: string
          landlord_id: string
          permissions: Json
          status: string
          title: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          landlord_id: string
          permissions?: Json
          status?: string
          title?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          landlord_id?: string
          permissions?: Json
          status?: string
          title?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      support_messages: {
        Row: {
          created_at: string
          id: string
          is_staff_reply: boolean
          message: string
          ticket_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_staff_reply?: boolean
          message: string
          ticket_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_staff_reply?: boolean
          message?: string
          ticket_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_messages_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "support_tickets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_messages_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      support_tickets: {
        Row: {
          assigned_to: string | null
          category: string
          created_at: string
          description: string
          id: string
          priority: string
          resolution_notes: string | null
          status: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          assigned_to?: string | null
          category: string
          created_at?: string
          description: string
          id?: string
          priority?: string
          resolution_notes?: string | null
          status?: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          assigned_to?: string | null
          category?: string
          created_at?: string
          description?: string
          id?: string
          priority?: string
          resolution_notes?: string | null
          status?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_tickets_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_tickets_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      system_health_logs: {
        Row: {
          created_at: string | null
          error_count: number | null
          id: string
          metadata: Json | null
          response_time_ms: number | null
          service: string
          status: string
        }
        Insert: {
          created_at?: string | null
          error_count?: number | null
          id?: string
          metadata?: Json | null
          response_time_ms?: number | null
          service: string
          status: string
        }
        Update: {
          created_at?: string | null
          error_count?: number | null
          id?: string
          metadata?: Json | null
          response_time_ms?: number | null
          service?: string
          status?: string
        }
        Relationships: []
      }
      system_logs: {
        Row: {
          created_at: string
          details: Json | null
          id: string
          message: string
          service: string
          type: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          details?: Json | null
          id?: string
          message: string
          service: string
          type: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          details?: Json | null
          id?: string
          message?: string
          service?: string
          type?: string
          user_id?: string | null
        }
        Relationships: []
      }
      telemetry_errors: {
        Row: {
          context: Json
          created_at: string
          fingerprint: string | null
          id: string
          instance_id: string
          message: string
          severity: string
          stack: string | null
          url: string | null
          user_id_hash: string | null
        }
        Insert: {
          context?: Json
          created_at?: string
          fingerprint?: string | null
          id?: string
          instance_id: string
          message: string
          severity?: string
          stack?: string | null
          url?: string | null
          user_id_hash?: string | null
        }
        Update: {
          context?: Json
          created_at?: string
          fingerprint?: string | null
          id?: string
          instance_id?: string
          message?: string
          severity?: string
          stack?: string | null
          url?: string | null
          user_id_hash?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "telemetry_errors_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "self_hosted_instances"
            referencedColumns: ["id"]
          },
        ]
      }
      telemetry_events: {
        Row: {
          created_at: string
          dedupe_key: string | null
          event_type: string
          id: string
          instance_id: string
          occurred_at: string
          payload: Json
          severity: string | null
        }
        Insert: {
          created_at?: string
          dedupe_key?: string | null
          event_type: string
          id?: string
          instance_id: string
          occurred_at?: string
          payload?: Json
          severity?: string | null
        }
        Update: {
          created_at?: string
          dedupe_key?: string | null
          event_type?: string
          id?: string
          instance_id?: string
          occurred_at?: string
          payload?: Json
          severity?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "telemetry_events_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "self_hosted_instances"
            referencedColumns: ["id"]
          },
        ]
      }
      telemetry_heartbeats: {
        Row: {
          app_version: string | null
          created_at: string
          environment: string | null
          id: string
          instance_id: string
          metrics: Json
          online_users: number | null
          reported_at: string
        }
        Insert: {
          app_version?: string | null
          created_at?: string
          environment?: string | null
          id?: string
          instance_id: string
          metrics?: Json
          online_users?: number | null
          reported_at?: string
        }
        Update: {
          app_version?: string | null
          created_at?: string
          environment?: string | null
          id?: string
          instance_id?: string
          metrics?: Json
          online_users?: number | null
          reported_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "telemetry_heartbeats_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "self_hosted_instances"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_announcements: {
        Row: {
          announcement_type: string
          created_at: string
          created_by: string | null
          expires_at: string | null
          id: string
          is_urgent: boolean | null
          message: string
          property_id: string | null
          title: string
        }
        Insert: {
          announcement_type?: string
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          is_urgent?: boolean | null
          message: string
          property_id?: string | null
          title: string
        }
        Update: {
          announcement_type?: string
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          is_urgent?: boolean | null
          message?: string
          property_id?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_announcements_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_credits: {
        Row: {
          amount: number
          balance: number
          created_at: string | null
          description: string | null
          id: string
          landlord_id: string
          source_payment_id: string | null
          source_type: string
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          amount: number
          balance: number
          created_at?: string | null
          description?: string | null
          id?: string
          landlord_id: string
          source_payment_id?: string | null
          source_type?: string
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          amount?: number
          balance?: number
          created_at?: string | null
          description?: string | null
          id?: string
          landlord_id?: string
          source_payment_id?: string | null
          source_type?: string
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tenant_credits_source_payment_id_fkey"
            columns: ["source_payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tenant_credits_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant_safe_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tenant_credits_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenants: {
        Row: {
          created_at: string
          date_of_birth: string | null
          email: string
          email_encrypted: string | null
          email_token: string | null
          emergency_contact_name: string | null
          emergency_contact_name_plain: string | null
          emergency_contact_phone: string | null
          emergency_contact_phone_encrypted: string | null
          emergency_contact_phone_plain: string | null
          emergency_contact_relationship: string | null
          employer_contact: string | null
          employer_name: string | null
          employment_status: string | null
          first_name: string
          id: string
          last_name: string
          monthly_income: number | null
          national_id: string | null
          national_id_encrypted: string | null
          national_id_plain: string | null
          phone: string | null
          phone_encrypted: string | null
          phone_plain: string | null
          phone_token: string | null
          previous_address: string | null
          previous_landlord_contact: string | null
          previous_landlord_name: string | null
          profession: string | null
          property_id: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          date_of_birth?: string | null
          email: string
          email_encrypted?: string | null
          email_token?: string | null
          emergency_contact_name?: string | null
          emergency_contact_name_plain?: string | null
          emergency_contact_phone?: string | null
          emergency_contact_phone_encrypted?: string | null
          emergency_contact_phone_plain?: string | null
          emergency_contact_relationship?: string | null
          employer_contact?: string | null
          employer_name?: string | null
          employment_status?: string | null
          first_name: string
          id?: string
          last_name: string
          monthly_income?: number | null
          national_id?: string | null
          national_id_encrypted?: string | null
          national_id_plain?: string | null
          phone?: string | null
          phone_encrypted?: string | null
          phone_plain?: string | null
          phone_token?: string | null
          previous_address?: string | null
          previous_landlord_contact?: string | null
          previous_landlord_name?: string | null
          profession?: string | null
          property_id?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          date_of_birth?: string | null
          email?: string
          email_encrypted?: string | null
          email_token?: string | null
          emergency_contact_name?: string | null
          emergency_contact_name_plain?: string | null
          emergency_contact_phone?: string | null
          emergency_contact_phone_encrypted?: string | null
          emergency_contact_phone_plain?: string | null
          emergency_contact_relationship?: string | null
          employer_contact?: string | null
          employer_name?: string | null
          employment_status?: string | null
          first_name?: string
          id?: string
          last_name?: string
          monthly_income?: number | null
          national_id?: string | null
          national_id_encrypted?: string | null
          national_id_plain?: string | null
          phone?: string | null
          phone_encrypted?: string | null
          phone_plain?: string | null
          phone_token?: string | null
          previous_address?: string | null
          previous_landlord_contact?: string | null
          previous_landlord_name?: string | null
          profession?: string | null
          property_id?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tenants_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tenants_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "orphaned_users_monitor"
            referencedColumns: ["id"]
          },
        ]
      }
      translations: {
        Row: {
          created_at: string | null
          id: string
          input_hash: string
          original_text: string | null
          source: string
          target: string
          translated_text: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          input_hash: string
          original_text?: string | null
          source: string
          target: string
          translated_text?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          input_hash?: string
          original_text?: string | null
          source?: string
          target?: string
          translated_text?: string | null
        }
        Relationships: []
      }
      trial_notification_templates: {
        Row: {
          created_at: string | null
          days_before_expiry: number
          email_content: string
          html_content: string
          id: string
          is_active: boolean | null
          subject: string
          template_name: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          days_before_expiry: number
          email_content: string
          html_content: string
          id?: string
          is_active?: boolean | null
          subject: string
          template_name: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          days_before_expiry?: number
          email_content?: string
          html_content?: string
          id?: string
          is_active?: boolean | null
          subject?: string
          template_name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      unit_type_preferences: {
        Row: {
          created_at: string
          id: string
          is_enabled: boolean
          landlord_id: string
          unit_type_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_enabled?: boolean
          landlord_id: string
          unit_type_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_enabled?: boolean
          landlord_id?: string
          unit_type_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      unit_types: {
        Row: {
          category: string
          created_at: string
          features: string[] | null
          id: string
          is_active: boolean
          is_system: boolean
          landlord_id: string | null
          name: string
          updated_at: string
        }
        Insert: {
          category?: string
          created_at?: string
          features?: string[] | null
          id?: string
          is_active?: boolean
          is_system?: boolean
          landlord_id?: string | null
          name: string
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          features?: string[] | null
          id?: string
          is_active?: boolean
          is_system?: boolean
          landlord_id?: string | null
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      units: {
        Row: {
          amenities: string[] | null
          bathrooms: number | null
          bedrooms: number | null
          block_id: string | null
          created_at: string
          description: string | null
          garbage_deposit: number | null
          id: string
          property_id: string
          rent_amount: number
          security_deposit: number | null
          square_feet: number | null
          status: string
          unit_number: string
          unit_type: string
          updated_at: string
        }
        Insert: {
          amenities?: string[] | null
          bathrooms?: number | null
          bedrooms?: number | null
          block_id?: string | null
          created_at?: string
          description?: string | null
          garbage_deposit?: number | null
          id?: string
          property_id: string
          rent_amount: number
          security_deposit?: number | null
          square_feet?: number | null
          status?: string
          unit_number: string
          unit_type: string
          updated_at?: string
        }
        Update: {
          amenities?: string[] | null
          bathrooms?: number | null
          bedrooms?: number | null
          block_id?: string | null
          created_at?: string
          description?: string | null
          garbage_deposit?: number | null
          id?: string
          property_id?: string
          rent_amount?: number
          security_deposit?: number | null
          square_feet?: number | null
          status?: string
          unit_number?: string
          unit_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_units_property_id"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "units_block_id_fkey"
            columns: ["block_id"]
            isOneToOne: false
            referencedRelation: "blocks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "units_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      user_activity_logs: {
        Row: {
          action: string
          details: Json | null
          entity_id: string | null
          entity_type: string | null
          id: string
          ip_address: unknown
          performed_at: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          action: string
          details?: Json | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          ip_address?: unknown
          performed_at?: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          action?: string
          details?: Json | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          ip_address?: unknown
          performed_at?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_audit_logs: {
        Row: {
          action: string
          created_at: string
          details: Json | null
          entity_id: string | null
          entity_type: string | null
          id: string
          ip_address: unknown
          performed_by: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          ip_address?: unknown
          performed_by: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          ip_address?: unknown
          performed_by?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_getting_started_progress: {
        Row: {
          completed_at: string | null
          created_at: string
          dismissed_at: string | null
          id: string
          status: string
          step_name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          dismissed_at?: string | null
          id?: string
          status?: string
          step_name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          dismissed_at?: string | null
          id?: string
          status?: string
          step_name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_getting_started_progress_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "orphaned_users_monitor"
            referencedColumns: ["id"]
          },
        ]
      }
      user_onboarding_progress: {
        Row: {
          completed_at: string | null
          created_at: string
          data: Json | null
          id: string
          started_at: string | null
          status: string
          step_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          data?: Json | null
          id?: string
          started_at?: string | null
          status?: string
          step_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          data?: Json | null
          id?: string
          started_at?: string | null
          status?: string
          step_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_onboarding_progress_step_id_fkey"
            columns: ["step_id"]
            isOneToOne: false
            referencedRelation: "onboarding_steps"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          metadata: Json | null
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          metadata?: Json | null
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          metadata?: Json | null
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "orphaned_users_monitor"
            referencedColumns: ["id"]
          },
        ]
      }
      user_sessions: {
        Row: {
          created_at: string
          device_info: Json | null
          id: string
          ip_address: unknown
          is_active: boolean | null
          location: string | null
          login_time: string
          logout_time: string | null
          session_token: string | null
          updated_at: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          device_info?: Json | null
          id?: string
          ip_address?: unknown
          is_active?: boolean | null
          location?: string | null
          login_time?: string
          logout_time?: string | null
          session_token?: string | null
          updated_at?: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          device_info?: Json | null
          id?: string
          ip_address?: unknown
          is_active?: boolean | null
          location?: string | null
          login_time?: string
          logout_time?: string | null
          session_token?: string | null
          updated_at?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_status: {
        Row: {
          changed_at: string
          changed_by: string | null
          created_at: string
          id: string
          reason: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          changed_at?: string
          changed_by?: string | null
          created_at?: string
          id?: string
          reason?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          changed_at?: string
          changed_by?: string | null
          created_at?: string
          id?: string
          reason?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_tour_progress: {
        Row: {
          completed_at: string | null
          created_at: string | null
          id: string
          last_step_index: number | null
          started_at: string | null
          status: string
          tour_name: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string | null
          id?: string
          last_step_index?: number | null
          started_at?: string | null
          status?: string
          tour_name: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string | null
          id?: string
          last_step_index?: number | null
          started_at?: string | null
          status?: string
          tour_name?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_tour_progress_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "orphaned_users_monitor"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      admin_sub_user_view: {
        Row: {
          created_at: string | null
          landlord_email: string | null
          landlord_first_name: string | null
          landlord_id: string | null
          landlord_last_name: string | null
          permissions: Json | null
          status: string | null
          sub_user_email: string | null
          sub_user_first_name: string | null
          sub_user_last_name: string | null
          sub_user_record_id: string | null
          title: string | null
          user_id: string | null
        }
        Relationships: []
      }
      orphaned_users_monitor: {
        Row: {
          created_at: string | null
          email: string | null
          first_name: string | null
          id: string | null
          last_name: string | null
          status: string | null
        }
        Relationships: []
      }
      tenant_safe_view: {
        Row: {
          created_at: string | null
          email: string | null
          employer_name: string | null
          employment_status: string | null
          first_name: string | null
          id: string | null
          last_name: string | null
          national_id: string | null
          phone: string | null
          previous_address: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          email?: never
          employer_name?: string | null
          employment_status?: string | null
          first_name?: string | null
          id?: string | null
          last_name?: string | null
          national_id?: never
          phone?: never
          previous_address?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          email?: never
          employer_name?: string | null
          employment_status?: string | null
          first_name?: string | null
          id?: string | null
          last_name?: string | null
          national_id?: never
          phone?: never
          previous_address?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tenants_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "orphaned_users_monitor"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      activate_user: {
        Args: { _performed_by?: string; _user_id: string }
        Returns: Json
      }
      admin_list_profiles_with_roles: {
        Args: { p_limit?: number; p_offset?: number }
        Returns: Json
      }
      apply_credit_to_invoice: {
        Args: {
          p_amount: number
          p_applied_by?: string
          p_credit_id: string
          p_invoice_id: string
        }
        Returns: Json
      }
      attach_lease_and_occupy_unit: {
        Args: {
          p_lease_end_date: string
          p_lease_start_date: string
          p_lease_terms?: string
          p_monthly_rent: number
          p_security_deposit?: number
          p_tenant_id: string
          p_unit_id: string
        }
        Returns: Json
      }
      audit_security_exposure: { Args: never; Returns: string }
      backfill_trial_periods: {
        Args: {
          _cutoff: string
          _dry_run?: boolean
          _include_active?: boolean
          _post_cutoff_days: number
          _pre_cutoff_days: number
        }
        Returns: Json
      }
      can_access_tenant_as_landlord: {
        Args: { _tenant_id: string; _user_id: string }
        Returns: boolean
      }
      can_assign_role: {
        Args: {
          _assigner_id: string
          _target_role: Database["public"]["Enums"]["app_role"]
        }
        Returns: boolean
      }
      can_remove_role: {
        Args: {
          _remover_id: string
          _target_role: Database["public"]["Enums"]["app_role"]
          _target_user_id: string
        }
        Returns: boolean
      }
      can_subuser_view_tenant: {
        Args: { _tenant_id: string; _user_id: string }
        Returns: boolean
      }
      can_user_manage_tenant: {
        Args: { _tenant_id: string; _user_id: string }
        Returns: boolean
      }
      check_plan_feature_access: {
        Args: { _current_count?: number; _feature: string; _user_id: string }
        Returns: Json
      }
      check_rate_limit: {
        Args: {
          _endpoint: string
          _identifier: string
          _max_requests?: number
          _window_minutes?: number
        }
        Returns: Json
      }
      check_role_conflict: {
        Args: {
          _new_role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      cleanup_old_security_events: { Args: never; Returns: undefined }
      cleanup_rate_limits: { Args: never; Returns: undefined }
      create_landlord_mpesa_config: {
        Args: {
          p_business_shortcode: string
          p_callback_url?: string
          p_consumer_key: string
          p_consumer_secret: string
          p_environment?: string
          p_is_active?: boolean
          p_passkey: string
        }
        Returns: string
      }
      create_or_attach_tenant_lease: {
        Args: {
          p_allow_attach?: boolean
          p_email: string
          p_emergency_contact_name?: string
          p_emergency_contact_phone?: string
          p_employer_name?: string
          p_employment_status?: string
          p_existing_tenant_id?: string
          p_first_name: string
          p_last_name: string
          p_lease_end_date?: string
          p_lease_start_date?: string
          p_monthly_income?: number
          p_monthly_rent?: number
          p_national_id?: string
          p_phone?: string
          p_previous_address?: string
          p_profession?: string
          p_property_id?: string
          p_security_deposit?: number
          p_unit_id?: string
        }
        Returns: Json
      }
      create_search_token: {
        Args: { data: string; salt?: string }
        Returns: string
      }
      create_service_charge_invoice: {
        Args: {
          p_billing_period_end: string
          p_billing_period_start: string
          p_landlord_id: string
          p_other_charges?: number
          p_rent_collected?: number
          p_sms_charges?: number
        }
        Returns: Json
      }
      create_tenant_and_optional_lease: {
        Args: {
          p_date_of_birth?: string
          p_email: string
          p_emergency_contact_name?: string
          p_emergency_contact_phone?: string
          p_emergency_contact_relationship?: string
          p_employer_contact?: string
          p_employer_name?: string
          p_employment_status?: string
          p_first_name: string
          p_last_name: string
          p_lease_end_date?: string
          p_lease_start_date?: string
          p_lease_terms?: string
          p_monthly_rent?: number
          p_national_id?: string
          p_phone: string
          p_previous_address?: string
          p_previous_landlord_contact?: string
          p_previous_landlord_name?: string
          p_security_deposit?: number
          p_unit_id?: string
        }
        Returns: Json
      }
      create_tenant_with_encryption: {
        Args: {
          p1: string
          p10: string
          p11: string
          p12: string
          p13: string
          p14: string
          p2: string
          p3: string
          p4: string
          p5: string
          p6: string
          p7: string
          p8: string
          p9: number
        }
        Returns: string
      }
      create_user_safe: {
        Args: {
          p_email: string
          p_first_name: string
          p_last_name: string
          p_phone: string
          p_role: Database["public"]["Enums"]["app_role"]
        }
        Returns: Json
      }
      create_user_with_role: {
        Args: {
          p_email: string
          p_first_name: string
          p_last_name: string
          p_phone: string
          p_role: Database["public"]["Enums"]["app_role"]
        }
        Returns: Json
      }
      decrypt_iv: {
        Args: { alg: string; ciphertext: string; iv: string; key: string }
        Returns: string
      }
      decrypt_pii: {
        Args: { encrypted_data: string; key: string }
        Returns: string
      }
      decrypt_sensitive_data: {
        Args: { encrypted_data: string; key_name?: string }
        Returns: string
      }
      encrypt_iv: {
        Args: { alg: string; data: string; iv: string; key: string }
        Returns: string
      }
      encrypt_pii:
        | { Args: { data: string }; Returns: string }
        | { Args: { data: string; key: string }; Returns: string }
      encrypt_sensitive_data: {
        Args: { data: string; key_name?: string }
        Returns: string
      }
      find_user_by_email: {
        Args: { _email: string }
        Returns: {
          first_name: string
          has_profile: boolean
          last_name: string
          phone: string
          user_id: string
        }[]
      }
      generate_invoice_number: { Args: never; Returns: string }
      generate_monthly_invoices_for_landlord: {
        Args: {
          p_dry_run?: boolean
          p_invoice_month?: string
          p_landlord_id: string
        }
        Returns: Json
      }
      generate_monthly_service_invoices: { Args: never; Returns: Json }
      generate_service_invoice_number: { Args: never; Returns: string }
      get_cash_flow_report: {
        Args: { p_end_date?: string; p_start_date?: string }
        Returns: Json
      }
      get_data_integrity_report: { Args: never; Returns: Json }
      get_executive_summary_report:
        | {
            Args: { p_end_date?: string; p_start_date?: string }
            Returns: Json
          }
        | {
            Args: {
              p_end_date?: string
              p_include_tenant_scope?: boolean
              p_start_date?: string
            }
            Returns: Json
          }
      get_expense_summary_report: {
        Args: { p_end_date?: string; p_start_date?: string }
        Returns: Json
      }
      get_feature_usage: {
        Args: { p_feature_name: string; p_user_id: string }
        Returns: number
      }
      get_financial_summary_report:
        | {
            Args: { p_end_date?: string; p_start_date?: string }
            Returns: Json
          }
        | {
            Args: {
              p_end_date?: string
              p_property_id?: string
              p_start_date?: string
            }
            Returns: Json
          }
      get_invoice_overview: {
        Args: {
          p_limit?: number
          p_offset?: number
          p_search?: string
          p_status?: string
        }
        Returns: {
          amount: number
          amount_paid_allocated: number
          amount_paid_direct: number
          amount_paid_total: number
          computed_status: string
          created_at: string
          description: string
          due_date: string
          email: string
          first_name: string
          id: string
          invoice_date: string
          invoice_number: string
          last_name: string
          lease_id: string
          outstanding_amount: number
          phone: string
          property_id: string
          property_manager_id: string
          property_name: string
          property_owner_id: string
          status: string
          tenant_id: string
          unit_number: string
          updated_at: string
        }[]
      }
      get_landlord_dashboard_data: {
        Args: { _user_id?: string }
        Returns: Json
      }
      get_landlord_rent_total: {
        Args: { p_landlord_id: string; p_start_date: string }
        Returns: number
      }
      get_landlord_tenants_summary: {
        Args: {
          p_employment_filter?: string
          p_limit?: number
          p_offset?: number
          p_property_filter?: string
          p_search?: string
          p_user_id?: string
        }
        Returns: Json
      }
      get_lease_expiry_report: {
        Args: { p_end_date?: string; p_start_date?: string }
        Returns: Json
      }
      get_lease_expiry_report_kpis: {
        Args: { p_end_date?: string; p_start_date?: string }
        Returns: {
          end_date: string
          expiring_leases: number
          start_date: string
        }[]
      }
      get_lease_expiry_report_rows: {
        Args: { p_end_date?: string; p_start_date?: string }
        Returns: {
          days_until_end: number
          id: string
          lease_end_date: string
          lease_start_date: string
          property_id: string
          property_name: string
          status: string
          tenant_id: string
          tenant_name: string
          unit_id: string
          unit_number: string
        }[]
      }
      get_market_rent_report:
        | { Args: never; Returns: Json }
        | {
            Args: { p_end_date?: string; p_start_date?: string }
            Returns: Json
          }
      get_mpesa_credentials_safe: {
        Args: { _landlord_id?: string }
        Returns: {
          created_at: string
          has_consumer_key: string
          has_consumer_secret: string
          has_passkey: string
          id: string
          is_sandbox: boolean
          landlord_id: string
          shortcode: string
          updated_at: string
        }[]
      }
      get_my_sub_user_permissions: { Args: never; Returns: Json }
      get_occupancy_report: {
        Args: { p_end_date?: string; p_start_date?: string }
        Returns: Json
      }
      get_pl_underlying_expenses: {
        Args: { p_end_date: string; p_start_date: string }
        Returns: Json
      }
      get_pl_underlying_revenue: {
        Args: { p_end_date: string; p_start_date: string }
        Returns: Json
      }
      get_plan_features: {
        Args: { plan_id: string }
        Returns: {
          category: string
          custom_limit: number
          description: string
          display_name: string
          feature_key: string
          icon_name: string
          is_enabled: boolean
        }[]
      }
      get_platform_market_rent: {
        Args: { p_end_date?: string; p_start_date?: string }
        Returns: Json
      }
      get_profit_loss_report: {
        Args: { p_end_date?: string; p_start_date?: string }
        Returns: Json
      }
      get_property_performance_report: {
        Args: { p_end_date?: string; p_start_date?: string }
        Returns: Json
      }
      get_rent_collection_report: {
        Args: { p_end_date: string; p_start_date: string }
        Returns: Json
      }
      get_revenue_vs_expenses_report: {
        Args: { p_end_date?: string; p_start_date?: string }
        Returns: Json
      }
      get_security_dashboard_stats: { Args: never; Returns: Json }
      get_sms_usage_for_admin: {
        Args: never
        Returns: {
          cost: number
          created_at: string
          id: string
          landlord_id: string
          message_content: string
          recipient_phone: string
          sent_at: string
          status: string
        }[]
      }
      get_sub_user_landlord: { Args: { _user_id: string }; Returns: string }
      get_sub_user_permissions: {
        Args: { _permission: string; _user_id: string }
        Returns: boolean
      }
      get_tenant_contacts: { Args: { p_user_id?: string }; Returns: Json }
      get_tenant_credit_balance: {
        Args: { p_tenant_id: string }
        Returns: number
      }
      get_tenant_leases: { Args: { p_user_id?: string }; Returns: Json }
      get_tenant_maintenance_data: {
        Args: { p_limit?: number; p_user_id?: string }
        Returns: Json
      }
      get_tenant_payments_data: {
        Args: { p_limit?: number; p_user_id?: string }
        Returns: Json
      }
      get_tenant_profile_data: { Args: { p_user_id?: string }; Returns: Json }
      get_tenant_property_ids: {
        Args: { _tenant_id: string }
        Returns: string[]
      }
      get_tenant_unit_ids: { Args: { _user_id: string }; Returns: string[] }
      get_tour_status: {
        Args: { p_tour_name: string; p_user_id: string }
        Returns: string
      }
      get_transaction_status: {
        Args: { p_checkout_request_id: string }
        Returns: string
      }
      get_user_audit_history: {
        Args: { p_limit?: number; p_offset?: number; p_user_id: string }
        Returns: {
          action: string
          details: Json
          entity_id: string
          entity_type: string
          ip_address: unknown
          log_id: string
          performed_at: string
          user_agent: string
        }[]
      }
      get_user_permissions: {
        Args: { _user_id?: string }
        Returns: {
          permission_name: string
        }[]
      }
      get_user_profile_safe: {
        Args: { _user_id: string }
        Returns: {
          created_at: string
          email: string
          first_name: string
          id: string
          last_name: string
          phone: string
          updated_at: string
        }[]
      }
      get_user_tenant_ids: { Args: { _user_id: string }; Returns: string[] }
      has_permission: {
        Args: { _permission: string; _user_id: string }
        Returns: boolean
      }
      has_role:
        | {
            Args: {
              _role: Database["public"]["Enums"]["app_role"]
              _user_id?: string
            }
            Returns: boolean
          }
        | {
            Args: {
              _role: Database["public"]["Enums"]["app_role"]
              _user_id: string
            }
            Returns: boolean
          }
      has_role_safe: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      has_role_self_text: { Args: { _role: string }; Returns: boolean }
      has_role_text: {
        Args: { _role: string; _user_id: string }
        Returns: boolean
      }
      insert_sms_usage_secure: {
        Args: {
          p_cost: number
          p_landlord_id: string
          p_message_content: string
          p_recipient_phone: string
          p_status: string
        }
        Returns: string
      }
      is_admin: { Args: { _user_id?: string }; Returns: boolean }
      is_lease_managed_by_user: {
        Args: { p_lease_id: string }
        Returns: boolean
      }
      is_lease_owned_by_tenant_user: {
        Args: { _lease_id: string; _user_id: string }
        Returns: boolean
      }
      is_sub_user_of_landlord: {
        Args: { _landlord_id: string; _user_id: string }
        Returns: boolean
      }
      is_user_tenant: { Args: { _user_id: string }; Returns: boolean }
      log_maintenance_action: {
        Args: {
          _action_type: string
          _details?: Json
          _maintenance_request_id: string
          _new_value?: string
          _old_value?: string
          _user_id: string
        }
        Returns: undefined
      }
      log_security_event:
        | {
            Args: {
              _details?: Json
              _event_type: string
              _ip_address?: unknown
              _user_id?: string
            }
            Returns: undefined
          }
        | {
            Args: {
              _details?: Json
              _event_type: string
              _ip_address?: string
              _severity?: string
              _user_id?: string
            }
            Returns: undefined
          }
        | {
            Args: {
              p_details?: Json
              p_event_type: string
              p_ip_address?: unknown
              p_severity?: string
              p_user_id?: string
            }
            Returns: string
          }
      log_sensitive_data_access: {
        Args: { _operation: string; _record_id?: string; _table_name: string }
        Returns: undefined
      }
      log_system_event: {
        Args: {
          _details?: Json
          _message: string
          _service: string
          _type: string
          _user_id?: string
        }
        Returns: undefined
      }
      log_system_health: {
        Args: {
          _error_count?: number
          _metadata?: Json
          _response_time_ms?: number
          _service: string
          _status: string
        }
        Returns: undefined
      }
      log_trial_status_change: {
        Args: {
          _landlord_id: string
          _metadata?: Json
          _new_status: string
          _old_status: string
          _reason?: string
        }
        Returns: undefined
      }
      log_user_activity: {
        Args: {
          _action: string
          _details?: Json
          _entity_id?: string
          _entity_type?: string
          _ip_address?: unknown
          _user_agent?: string
          _user_id: string
        }
        Returns: undefined
      }
      log_user_audit: {
        Args: {
          _action: string
          _details?: Json
          _entity_id: string
          _entity_type: string
          _ip_address?: unknown
          _performed_by?: string
          _user_agent?: string
          _user_id: string
        }
        Returns: undefined
      }
      lookup_tenant_in_portfolio: {
        Args: { p_email?: string; p_national_id?: string; p_phone?: string }
        Returns: Json
      }
      map_feature_to_permission: { Args: { _feature: string }; Returns: string }
      mask_sensitive_data: {
        Args: { data: string; visible_chars?: number }
        Returns: string
      }
      reconcile_unallocated_payments_for_tenant: {
        Args: { p_tenant_id: string }
        Returns: Json
      }
      run_security_audit: { Args: never; Returns: Json }
      soft_delete_user: {
        Args: { _performed_by?: string; _reason?: string; _user_id: string }
        Returns: Json
      }
      suspend_user: {
        Args: { _performed_by?: string; _reason?: string; _user_id: string }
        Returns: Json
      }
      sync_unit_status: { Args: { p_unit_id: string }; Returns: undefined }
      tenant_belongs_to_user: {
        Args: { _tenant_id: string; _user_id: string }
        Returns: boolean
      }
      tenant_belongs_to_user_safe: {
        Args: { _tenant_id: string; _user_id: string }
        Returns: boolean
      }
      tenant_has_lease_on_property: {
        Args: { _property_id: string; _user_id: string }
        Returns: boolean
      }
      unit_belongs_to_tenant_user: {
        Args: { _unit_id: string; _user_id: string }
        Returns: boolean
      }
      upsert_feature_discovery: {
        Args: {
          p_feature_name: string
          p_first_used_at?: string
          p_usage_count?: number
          p_user_id: string
        }
        Returns: undefined
      }
      user_can_access_lease: {
        Args: { _lease_id: string; _user_id: string }
        Returns: boolean
      }
      user_can_access_property: {
        Args: { _property_id: string; _user_id: string }
        Returns: boolean
      }
      user_owns_property: {
        Args: { _property_id: string; _user_id: string }
        Returns: boolean
      }
      validate_role_eligibility: {
        Args: {
          p_role: Database["public"]["Enums"]["app_role"]
          p_user_id: string
        }
        Returns: boolean
      }
      validate_strong_password: { Args: { password: string }; Returns: boolean }
      verify_mpesa_signature: {
        Args: { _body: string; _consumer_secret: string; _signature: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role:
        | "Admin"
        | "Landlord"
        | "Manager"
        | "Agent"
        | "Tenant"
        | "System"
        | "SubUser"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: [
        "Admin",
        "Landlord",
        "Manager",
        "Agent",
        "Tenant",
        "System",
        "SubUser",
      ],
    },
  },
} as const
