import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export const useUserActivity = () => {
  const { user } = useAuth();

  const logActivity = useCallback(async (
    action: string,
    entityType?: string,
    entityId?: string,
    details?: any
  ) => {
    if (!user) return;

    try {
      // Get client info for more detailed logging
      const userAgent = navigator.userAgent;
      
      await supabase.rpc('log_user_activity', {
        _user_id: user.id,
        _action: action,
        _entity_type: entityType || null,
        _entity_id: entityId || null,
        _details: details ? JSON.stringify(details) : null,
        _user_agent: userAgent
      });
    } catch (error) {
      console.error('Error logging user activity:', error);
    }
  }, [user]);

  return { logActivity };
};