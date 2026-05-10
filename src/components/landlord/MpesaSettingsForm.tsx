import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Shield, Settings, CreditCard } from "lucide-react";

const mpesaConfigSchema = z.object({
  shortcode_type: z.enum(["paybill", "till_safaricom", "till_kopokopo"]),
  consumer_key: z.string().optional(),
  consumer_secret: z.string().optional(),
  business_shortcode: z.string().optional(),
  passkey: z.string().optional(),
  till_number: z.string().optional(),
  till_provider: z.enum(["safaricom", "kopokopo"]).optional(),
  kopokopo_client_id: z.string().optional(),
  kopokopo_client_secret: z.string().optional(),
  callback_url: z.string().url().optional().or(z.literal("")),
  environment: z.enum(["sandbox", "production"]),
  is_active: z.boolean()
}).refine((data) => {
  // Validate based on shortcode type
  if (data.shortcode_type === 'till_kopokopo') {
    return data.till_number && data.kopokopo_client_id && data.kopokopo_client_secret;
  } else {
    return data.consumer_key && data.consumer_secret && data.business_shortcode && data.passkey;
  }
}, {
  message: "Please fill in all required fields for the selected payment type"
});

type MpesaConfigFormData = z.infer<typeof mpesaConfigSchema>;

interface MpesaSettingsFormProps {
  landlordId?: string;
}

export function MpesaSettingsForm({ landlordId }: MpesaSettingsFormProps) {
  const [loading, setLoading] = useState(false);
  const [configExists, setConfigExists] = useState(false);

  const form = useForm<MpesaConfigFormData>({
    resolver: zodResolver(mpesaConfigSchema),
    defaultValues: {
      shortcode_type: "paybill",
      consumer_key: "",
      consumer_secret: "",
      business_shortcode: "",
      passkey: "",
      till_number: "",
      till_provider: "safaricom",
      kopokopo_client_id: "",
      kopokopo_client_secret: "",
      callback_url: "",
      environment: "sandbox",
      is_active: true
    }
  });

  useEffect(() => {
    fetchMpesaConfig();
  }, [landlordId]);

  const fetchMpesaConfig = async () => {
    try {
      const { data: user } = await supabase.auth.getUser();
      
      // SECURITY: Only fetch non-sensitive metadata, NEVER fetch encrypted credentials
      const { data, error } = await supabase
        .from("landlord_mpesa_configs")
        .select("id, business_shortcode, till_number, shortcode_type, till_provider, kopokopo_client_id, callback_url, environment, is_active")
        .eq("landlord_id", user.user?.id)
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
        throw error;
      }

      if (data) {
        setConfigExists(true);
        // SECURITY: Never populate credential fields from database
        form.reset({
          shortcode_type: (data.shortcode_type || 'paybill') as 'paybill' | 'till_safaricom' | 'till_kopokopo',
          consumer_key: "", // Never fetch credentials
          consumer_secret: "", // Never fetch credentials
          business_shortcode: data.business_shortcode || "",
          passkey: "", // Never fetch credentials
          till_number: data.till_number || "",
          till_provider: (data.till_provider || 'safaricom') as 'safaricom' | 'kopokopo',
          kopokopo_client_id: data.kopokopo_client_id || "",
          kopokopo_client_secret: "", // Never fetch credentials
          callback_url: data.callback_url || "",
          environment: data.environment as "sandbox" | "production",
          is_active: data.is_active
        });
      }
    } catch (error) {
      console.error("Error fetching M-Pesa config:", error);
    }
  };

  const onSubmit = async (data: MpesaConfigFormData) => {
    setLoading(true);
    try {
      // SECURITY: Use edge function to encrypt and save credentials securely
      const { data: result, error } = await supabase.functions.invoke('save-mpesa-credentials', {
        body: {
          shortcode_type: data.shortcode_type,
          consumer_key: data.consumer_key,
          consumer_secret: data.consumer_secret,
          shortcode: data.business_shortcode,
          passkey: data.passkey,
          till_number: data.till_number,
          till_provider: data.till_provider,
          kopokopo_client_id: data.kopokopo_client_id,
          kopokopo_client_secret: data.kopokopo_client_secret,
          callback_url: data.callback_url || null,
          environment: data.environment,
          is_active: data.is_active
        }
      });

      if (error) throw error;
      if (result?.error) throw new Error(result.error);

      // Clear sensitive data from form for security
      form.reset({
        shortcode_type: data.shortcode_type,
        consumer_key: "",
        consumer_secret: "",
        business_shortcode: data.business_shortcode,
        passkey: "",
        till_number: data.till_number,
        till_provider: data.till_provider,
        kopokopo_client_id: data.kopokopo_client_id,
        kopokopo_client_secret: "",
        callback_url: data.callback_url,
        environment: data.environment,
        is_active: data.is_active
      });

      setConfigExists(true);
      toast.success(configExists ? "M-Pesa settings updated securely!" : "M-Pesa settings created securely!");
    } catch (error) {
      console.error("Error saving M-Pesa config:", error);
      toast.error(error instanceof Error ? error.message : "Failed to save M-Pesa settings");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-2xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CreditCard className="h-5 w-5" />
          M-Pesa STK Push Configuration
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Configure your M-Pesa STK Push settings for tenant payments
        </p>
      </CardHeader>
      <CardContent>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          {/* Shortcode Type Selection */}
          <div className="space-y-2">
            <Label htmlFor="shortcode_type">Payment Type *</Label>
            <Select 
              value={form.watch("shortcode_type")} 
              onValueChange={(value: "paybill" | "till_safaricom" | "till_kopokopo") => {
                form.setValue("shortcode_type", value);
                // Set till_provider when selecting till types
                if (value === 'till_safaricom') {
                  form.setValue("till_provider", "safaricom");
                } else if (value === 'till_kopokopo') {
                  form.setValue("till_provider", "kopokopo");
                }
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="paybill">
                  <div className="flex flex-col text-left">
                    <span className="font-medium">Paybill Number</span>
                    <span className="text-xs text-muted-foreground">Best for businesses collecting rent</span>
                  </div>
                </SelectItem>
                <SelectItem value="till_safaricom">
                  <div className="flex flex-col text-left">
                    <span className="font-medium">Till Number - Safaricom Direct</span>
                    <span className="text-xs text-muted-foreground">Direct M-Pesa till from Safaricom</span>
                  </div>
                </SelectItem>
                <SelectItem value="till_kopokopo">
                  <div className="flex flex-col text-left">
                    <span className="font-medium">Till Number - Kopo Kopo</span>
                    <span className="text-xs text-muted-foreground">Kopo Kopo payment gateway</span>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Choose based on your business setup
            </p>
          </div>

          {/* Environment Selection */}
          <div className="space-y-2">
            <Label htmlFor="environment">Environment</Label>
            <Select 
              value={form.watch("environment")} 
              onValueChange={(value: "sandbox" | "production") => 
                form.setValue("environment", value)
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="sandbox">Sandbox (Testing)</SelectItem>
                <SelectItem value="production">Production (Live)</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Use sandbox for testing, production for live payments
            </p>
          </div>

          {/* Conditional Field Rendering */}
          {form.watch("shortcode_type") === 'till_kopokopo' ? (
            // Kopo Kopo Till Number Fields
            <div className="space-y-4 p-4 border rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Shield className="h-4 w-4" />
                <h3 className="font-medium">Kopo Kopo Credentials</h3>
              </div>
              
              {configExists && (
                <div className="bg-amber-50 dark:bg-amber-900/20 p-3 rounded-lg text-sm text-amber-800 dark:text-amber-200 mb-4">
                  <Shield className="h-4 w-4 inline mr-2" />
                  Credentials are encrypted. Re-enter to update.
                </div>
              )}

              <div className="grid grid-cols-1 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="till_number">Till Number *</Label>
                  <Input
                    id="till_number"
                    {...form.register("till_number")}
                    placeholder="e.g., 855087"
                  />
                  <p className="text-xs text-muted-foreground">Your Kopo Kopo till number</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="kopokopo_client_id">Kopo Kopo Client ID *</Label>
                  <Input
                    id="kopokopo_client_id"
                    {...form.register("kopokopo_client_id")}
                    placeholder="Enter your Kopo Kopo Client ID"
                  />
                  <p className="text-xs text-muted-foreground">Get this from your Kopo Kopo dashboard</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="kopokopo_client_secret">
                    Kopo Kopo Client Secret * {configExists && <span className="text-xs text-muted-foreground">(re-enter to update)</span>}
                  </Label>
                  <Input
                    id="kopokopo_client_secret"
                    type="password"
                    {...form.register("kopokopo_client_secret")}
                    placeholder={configExists ? "••••••••••••••••" : "Enter your Kopo Kopo Client Secret"}
                  />
                  <p className="text-xs text-muted-foreground">Encrypted using AES-256-GCM before storage</p>
                </div>
              </div>
            </div>
          ) : (
            // Standard M-Pesa/Till Safaricom Credentials
            <div className="space-y-4 p-4 border rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Shield className="h-4 w-4" />
                <h3 className="font-medium">M-Pesa API Credentials</h3>
              </div>
              
              {configExists && (
                <div className="bg-amber-50 dark:bg-amber-900/20 p-3 rounded-lg text-sm text-amber-800 dark:text-amber-200 mb-4">
                  <Shield className="h-4 w-4 inline mr-2" />
                  Credentials are encrypted and never displayed. Re-enter to update.
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="consumer_key">
                  Consumer Key {configExists && <span className="text-xs text-muted-foreground">(re-enter to update)</span>}
                </Label>
                <Input
                  id="consumer_key"
                  type="password"
                  {...form.register("consumer_key")}
                  placeholder={configExists ? "••••••••••••••••" : "Your M-Pesa consumer key"}
                />
                <p className="text-xs text-muted-foreground">Encrypted using AES-256-GCM</p>
                {form.formState.errors.consumer_key && (
                  <p className="text-xs text-red-500">
                    {form.formState.errors.consumer_key.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="consumer_secret">
                  Consumer Secret {configExists && <span className="text-xs text-muted-foreground">(re-enter to update)</span>}
                </Label>
                <Input
                  id="consumer_secret"
                  type="password"
                  {...form.register("consumer_secret")}
                  placeholder={configExists ? "••••••••••••••••" : "Your M-Pesa consumer secret"}
                />
                <p className="text-xs text-muted-foreground">Never stored in plain text</p>
                {form.formState.errors.consumer_secret && (
                  <p className="text-xs text-red-500">
                    {form.formState.errors.consumer_secret.message}
                  </p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="business_shortcode">
                  {form.watch("shortcode_type") === 'paybill' ? 'Paybill Number' : 'Till Number'} *
                </Label>
                <Input
                  id="business_shortcode"
                  {...form.register("business_shortcode")}
                  placeholder={form.watch("shortcode_type") === 'paybill' ? "e.g., 4155923" : "e.g., 5071852"}
                />
                <p className="text-xs text-muted-foreground">
                  Your {form.watch("shortcode_type") === 'paybill' ? 'paybill' : 'till'} number
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="passkey">
                  Passkey * {configExists && <span className="text-xs text-muted-foreground">(re-enter to update)</span>}
                </Label>
                <Input
                  id="passkey"
                  type="password"
                  {...form.register("passkey")}
                  placeholder={configExists ? "••••••••••••••••••••••••" : "Your M-Pesa passkey"}
                />
                <p className="text-xs text-muted-foreground">Encrypted at rest and in transit</p>
              </div>
            </div>
          </div>
          )}

          {/* Callback URL */}
          <div className="space-y-2">
            <Label htmlFor="callback_url">Callback URL (Optional)</Label>
            <Input
              id="callback_url"
              {...form.register("callback_url")}
              placeholder="https://your-domain.com/mpesa/callback"
            />
            <p className="text-xs text-muted-foreground">
              Leave empty to use the default system callback URL
            </p>
            {form.formState.errors.callback_url && (
              <p className="text-xs text-red-500">
                {form.formState.errors.callback_url.message}
              </p>
            )}
          </div>

          {/* Active Toggle */}
          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div>
              <h3 className="font-medium">Enable M-Pesa Payments</h3>
              <p className="text-sm text-muted-foreground">
                Allow tenants to pay using M-Pesa STK Push
              </p>
            </div>
            <Switch
              checked={form.watch("is_active")}
              onCheckedChange={(checked) => form.setValue("is_active", checked)}
            />
          </div>

          <div className="flex justify-end">
            <Button type="submit" disabled={loading}>
              {loading ? "Saving..." : configExists ? "Update Settings" : "Save Settings"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}