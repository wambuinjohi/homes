import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface ContactInfo {
  name: string;
  phone: string;
  email: string;
  role: string;
  isPlatformSupport?: boolean;
}

export function useTenantContacts() {
  const { user } = useAuth();

  const { data: contacts = [], isLoading: loading, error, refetch } = useQuery({
    queryKey: ["tenant-contacts", user?.id],
    queryFn: async (): Promise<ContactInfo[]> => {
      try {
        // Use the dedicated RPC for more reliable contact fetching
        const { data: result, error: rpcError } = await supabase
          .rpc('get_tenant_contacts')
          .maybeSingle();

        if (rpcError) {
          throw rpcError;
        }

        // Extract contacts from the result
        return (result as any)?.contacts || [];
      } catch {
        // Fallback to platform support on any error
        return [{
          name: "Zira Homes Support",
          phone: "+254 757 878 023",
          email: "support@ziratech.com", 
          role: "Platform Support",
          isPlatformSupport: true
        }];
      }
    },
    enabled: !!user,
    staleTime: 1000 * 60 * 10, // 10 minutes
    refetchOnWindowFocus: false,
  });

  return { 
    contacts, 
    loading, 
    error: error?.message || null, 
    refetch 
  };
}