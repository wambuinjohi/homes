import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

interface PartnerLogo {
  id: string;
  company_name: string;
  logo_url: string;
  website_url: string | null;
  display_order: number;
}

export function PartnerLogosSection() {
  const [logos, setLogos] = useState<PartnerLogo[]>([]);
  const [showSection, setShowSection] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Check if section is enabled
        const { data: settingData } = await supabase
          .from("billing_settings")
          .select("setting_value")
          .eq("setting_key", "show_partner_logos")
          .single();

        const isEnabled = settingData?.setting_value === "true" || settingData?.setting_value === true;
        setShowSection(isEnabled);

        if (isEnabled) {
          // Fetch active logos
          const { data: logosData } = await supabase
            .from("partner_logos")
            .select("id, company_name, logo_url, website_url, display_order")
            .eq("is_active", true)
            .order("display_order", { ascending: true });

          setLogos(logosData || []);
        }
      } catch (error) {
        console.error("Error fetching partner logos:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // Don't render if loading, disabled, or no logos
  if (loading || !showSection || logos.length === 0) {
    return null;
  }

  return (
    <div className="mt-16 text-center">
      <p className="text-sm text-muted-foreground mb-6">
        Trusted by leading property management companies
      </p>
      <div className="flex flex-wrap justify-center items-center gap-8">
        {logos.map((logo) => (
          <a
            key={logo.id}
            href={logo.website_url || "#"}
            target={logo.website_url ? "_blank" : undefined}
            rel={logo.website_url ? "noopener noreferrer" : undefined}
            className="h-12 px-4 flex items-center justify-center grayscale hover:grayscale-0 transition-all duration-300 opacity-60 hover:opacity-100"
            title={logo.company_name}
          >
            <img
              src={logo.logo_url}
              alt={logo.company_name}
              className="max-h-full max-w-[120px] object-contain"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = "none";
              }}
            />
          </a>
        ))}
      </div>
    </div>
  );
}
