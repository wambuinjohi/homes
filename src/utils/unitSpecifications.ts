// Utility functions for handling different unit type specifications

export type UnitSpecificationField = {
  key: string;
  label: string;
  type: 'number' | 'text' | 'select';
  required?: boolean;
  options?: string[];
  placeholder?: string;
};

export const getUnitSpecificationFields = (category: string): UnitSpecificationField[] => {
  switch (category.toLowerCase()) {
    case 'residential':
      return [
        { key: 'bedrooms', label: 'Bedrooms', type: 'number', required: true, placeholder: 'e.g., 2' },
        { key: 'bathrooms', label: 'Bathrooms', type: 'number', required: true, placeholder: 'e.g., 1' },
        { key: 'square_feet', label: 'Square Feet', type: 'number', placeholder: 'e.g., 1200' },
        { key: 'parking_spaces', label: 'Parking Spaces', type: 'number', placeholder: 'e.g., 1' },
      ];
    case 'commercial':
      return [
        { key: 'floor_area', label: 'Floor Area (sq ft)', type: 'number', required: true, placeholder: 'e.g., 2500' },
        { key: 'office_spaces', label: 'Office Spaces', type: 'number', placeholder: 'e.g., 4' },
        { key: 'conference_rooms', label: 'Conference Rooms', type: 'number', placeholder: 'e.g., 2' },
        { key: 'parking_spaces', label: 'Parking Spaces', type: 'number', placeholder: 'e.g., 10' },
        { key: 'loading_docks', label: 'Loading Docks', type: 'number', placeholder: 'e.g., 1' },
      ];
    case 'mixed':
      return [
        { key: 'total_area', label: 'Total Area (sq ft)', type: 'number', required: true, placeholder: 'e.g., 3000' },
        { key: 'residential_units', label: 'Residential Units', type: 'number', placeholder: 'e.g., 2' },
        { key: 'commercial_units', label: 'Commercial Units', type: 'number', placeholder: 'e.g., 1' },
        { key: 'parking_spaces', label: 'Parking Spaces', type: 'number', placeholder: 'e.g., 5' },
      ];
    default:
      return [
        { key: 'bedrooms', label: 'Bedrooms', type: 'number', required: true, placeholder: 'e.g., 2' },
        { key: 'bathrooms', label: 'Bathrooms', type: 'number', required: true, placeholder: 'e.g., 1' },
        { key: 'square_feet', label: 'Square Feet', type: 'number', placeholder: 'e.g., 1200' },
      ];
  }
};

export const isCommercialUnit = (unitTypeName: string): boolean => {
  const commercialTypes = ['office', 'shop', 'retail', 'warehouse', 'industrial', 'commercial'];
  return commercialTypes.some(type => unitTypeName.toLowerCase().includes(type));
};

export const getUnitCategoryFromType = (unitTypeName: string): 'Residential' | 'Commercial' | 'Mixed' => {
  if (isCommercialUnit(unitTypeName)) {
    return 'Commercial';
  }
  
  const mixedTypes = ['mixed', 'mixed-use'];
  if (mixedTypes.some(type => unitTypeName.toLowerCase().includes(type))) {
    return 'Mixed';
  }
  
  return 'Residential';
};