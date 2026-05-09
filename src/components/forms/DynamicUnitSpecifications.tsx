import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { getUnitSpecificationFields, isCommercialUnit } from '@/utils/unitSpecifications';

interface DynamicUnitSpecificationsProps {
  unitType: string;
  values: Record<string, any>;
  onChange: (field: string, value: any) => void;
  errors?: Record<string, any>;
}

export function DynamicUnitSpecifications({ unitType, values, onChange, errors }: DynamicUnitSpecificationsProps) {
  const category = isCommercialUnit(unitType) ? 'commercial' : 'residential';
  const fields = getUnitSpecificationFields(category);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {fields.map((field) => (
        <div key={field.key}>
          <Label htmlFor={field.key}>
            {field.label}
            {field.required && <span className="text-destructive ml-1">*</span>}
          </Label>
          <Input
            id={field.key}
            type={field.type}
            value={values[field.key] || ''}
            onChange={(e) => onChange(field.key, field.type === 'number' ? Number(e.target.value) : e.target.value)}
            placeholder={field.placeholder}
            className={errors?.[field.key] ? 'border-destructive' : ''}
          />
          {errors?.[field.key] && (
            <p className="text-sm text-destructive mt-1">{errors[field.key].message}</p>
          )}
        </div>
      ))}
    </div>
  );
}