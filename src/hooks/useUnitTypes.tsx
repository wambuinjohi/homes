
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface UnitType {
  id: string;
  name: string;
  category: 'Residential' | 'Commercial' | 'Mixed';
  features: string[];
  is_system: boolean;
  landlord_id?: string;
  isEnabled?: boolean; // For preferences
}

// Type for the database response
type DatabaseUnitType = {
  id: string;
  name: string;
  category: string;
  features: string[];
  is_system: boolean;
  landlord_id: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

// Helper function to convert database response to our interface
const mapDatabaseToUnitType = (dbUnitType: DatabaseUnitType): UnitType => ({
  id: dbUnitType.id,
  name: dbUnitType.name,
  category: dbUnitType.category as 'Residential' | 'Commercial' | 'Mixed',
  features: dbUnitType.features,
  is_system: dbUnitType.is_system,
  landlord_id: dbUnitType.landlord_id || undefined,
});

export const useUnitTypes = () => {
  const [unitTypes, setUnitTypes] = useState<UnitType[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchUnitTypes = async (enabledOnly: boolean = false) => {
    try {
      setLoading(true);
      
      // First, fetch all unit types
      const { data: unitTypesData, error: unitTypesError } = await supabase
        .from('unit_types')
        .select('*')
        .eq('is_active', true)
        .order('is_system', { ascending: false })
        .order('name');

      if (unitTypesError) throw unitTypesError;

      // Then, fetch user preferences for unit types
      const { data: user } = await supabase.auth.getUser();
      const { data: preferencesData, error: preferencesError } = await supabase
        .from('unit_type_preferences')
        .select('unit_type_id, is_enabled')
        .eq('landlord_id', user?.user?.id || '');

      if (preferencesError) {
        console.warn('Error fetching preferences (using defaults):', preferencesError);
      }

      // Create a map of preferences for quick lookup
      const preferencesMap = new Map();
      (preferencesData || []).forEach(pref => {
        preferencesMap.set(pref.unit_type_id, pref.is_enabled);
      });

      // Combine unit types with preferences
      let mappedData = (unitTypesData || []).map((item: any) => {
        const unitType = mapDatabaseToUnitType(item);
        return {
          ...unitType,
          isEnabled: preferencesMap.get(item.id) ?? true, // Default to enabled if no preference
        };
      });

      // Filter to only enabled types if requested
      if (enabledOnly) {
        mappedData = mappedData.filter((ut: any) => ut.isEnabled);
      }

      setUnitTypes(mappedData);
    } catch (error) {
      console.error('Error fetching unit types:', error);
      toast({
        title: "Error",
        description: "Failed to fetch unit types",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const createUnitType = async (unitType: Omit<UnitType, 'id' | 'is_system' | 'landlord_id'>) => {
    try {
      const { data, error } = await supabase
        .from('unit_types')
        .insert([{
          ...unitType,
          is_system: false
        }])
        .select()
        .single();

      if (error) throw error;

      const mappedData = mapDatabaseToUnitType(data);
      setUnitTypes(prev => [...prev, mappedData]);
      toast({
        title: "Success",
        description: "Unit type created successfully",
      });
      return mappedData;
    } catch (error) {
      console.error('Error creating unit type:', error);
      toast({
        title: "Error",
        description: "Failed to create unit type",
        variant: "destructive",
      });
      throw error;
    }
  };

  const updateUnitType = async (id: string, updates: Partial<UnitType>) => {
    try {
      const { data, error } = await supabase
        .from('unit_types')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      const mappedData = mapDatabaseToUnitType(data);
      setUnitTypes(prev => prev.map(ut => ut.id === id ? mappedData : ut));
      toast({
        title: "Success",
        description: "Unit type updated successfully",
      });
      return mappedData;
    } catch (error) {
      console.error('Error updating unit type:', error);
      toast({
        title: "Error",
        description: "Failed to update unit type",
        variant: "destructive",
      });
      throw error;
    }
  };

  const deleteUnitType = async (id: string) => {
    try {
      const { error } = await supabase
        .from('unit_types')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setUnitTypes(prev => prev.filter(ut => ut.id !== id));
      toast({
        title: "Success",
        description: "Unit type deleted successfully",
      });
    } catch (error) {
      console.error('Error deleting unit type:', error);
      toast({
        title: "Error",
        description: "Failed to delete unit type",
        variant: "destructive",
      });
      throw error;
    }
  };

  useEffect(() => {
    fetchUnitTypes();
  }, []);

  const toggleUnitTypePreference = async (unitTypeId: string, isEnabled: boolean) => {
    try {
      const { error } = await supabase
        .from('unit_type_preferences')
        .upsert({
          landlord_id: (await supabase.auth.getUser()).data.user?.id,
          unit_type_id: unitTypeId,
          is_enabled: isEnabled,
        }, {
          onConflict: 'landlord_id,unit_type_id'
        });

      if (error) throw error;

      // Update local state
      setUnitTypes(prev => prev.map(ut => 
        ut.id === unitTypeId ? { ...ut, isEnabled } : ut
      ));

      toast({
        title: "Success",
        description: `Unit type ${isEnabled ? 'enabled' : 'disabled'} successfully`,
      });
    } catch (error) {
      console.error('Error toggling unit type preference:', error);
      toast({
        title: "Error",
        description: "Failed to update unit type preference",
        variant: "destructive",
      });
    }
  };

  return {
    unitTypes,
    loading,
    createUnitType,
    updateUnitType,
    deleteUnitType,
    toggleUnitTypePreference,
    refetch: fetchUnitTypes,
  };
};
