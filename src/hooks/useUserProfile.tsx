import { useState, useEffect } from 'react';
import { useAuth } from './useAuth';
import { supabase } from '@/integrations/supabase/client';

export interface UserProfile {
  id: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  phone: string;
  avatar_url?: string;
  created_at?: string;
  updated_at?: string;
  // These might come from user metadata
  address?: string;
  company_name?: string;
}

export const useUserProfile = () => {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();

  useEffect(() => {
    const fetchProfile = async () => {
      if (!user) {
        setProfile(null);
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        // First try to get from profiles table
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();

        if (profileError && profileError.code !== 'PGRST116') {
          throw profileError;
        }

        // Combine user data with profile data, prioritizing profile data
        const combinedProfile: UserProfile = {
          id: user.id,
          email: profileData?.email || user.email || '',
          first_name: profileData?.first_name || user.user_metadata?.first_name || '',
          last_name: profileData?.last_name || user.user_metadata?.last_name || '',
          phone: profileData?.phone || user.user_metadata?.phone || '+254700000000',
          avatar_url: profileData?.avatar_url || user.user_metadata?.avatar_url || '',
          created_at: profileData?.created_at || user.created_at,
          updated_at: profileData?.updated_at || user.updated_at,
          // These come from user metadata since they're not in profiles table
          address: user.user_metadata?.address || '',
          company_name: user.user_metadata?.company_name || '',
        };

        setProfile(combinedProfile);
      } catch (err) {
        console.error('Error fetching user profile:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch profile');
        
        // Fallback to user metadata if profile fetch fails
        setProfile({
          id: user.id,
          email: user.email || '',
          first_name: user.user_metadata?.first_name || '',
          last_name: user.user_metadata?.last_name || '',
          phone: user.user_metadata?.phone || '+254700000000',
          avatar_url: user.user_metadata?.avatar_url || '',
          created_at: user.created_at,
          updated_at: user.updated_at,
          address: user.user_metadata?.address || '',
          company_name: user.user_metadata?.company_name || '',
        });
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [user]);

  const updateProfile = async (updates: Partial<UserProfile>) => {
    if (!user || !profile) {
      throw new Error('No user or profile data available');
    }

    try {
      // Ensure required fields are included
      const profileUpdate = {
        id: user.id,
        email: profile.email, // Always include current email (required field)
        phone: profile.phone, // Always include current phone (required field)
        ...updates,
      };

      const { data, error } = await supabase
        .from('profiles')
        .upsert(profileUpdate)
        .select()
        .single();

      if (error) throw error;

      setProfile(prev => prev ? { ...prev, ...updates } : null);
      return data;
    } catch (err) {
      console.error('Error updating profile:', err);
      throw err;
    }
  };

  return {
    profile,
    loading,
    error,
    updateProfile,
    refetch: () => {
      if (user) {
        setLoading(true);
        // Re-trigger the effect
        setProfile(null);
      }
    }
  };
};