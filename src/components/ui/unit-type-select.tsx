import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useUnitTypes } from '@/hooks/useUnitTypes';
import { Badge } from '@/components/ui/badge';

interface UnitTypeSelectProps {
  value?: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  propertyType?: string;
}

export function UnitTypeSelect({ value, onValueChange, placeholder = "Select unit type", propertyType }: UnitTypeSelectProps) {
  const { unitTypes, loading } = useUnitTypes();

  // Only show enabled unit types for selection (enabledOnly = true for selects)
  const enabledUnitTypes = unitTypes.filter(ut => ut.isEnabled !== false);

  // Group unit types by category for better organization
  const groupedTypes = enabledUnitTypes.reduce((acc, unitType) => {
    if (!acc[unitType.category]) {
      acc[unitType.category] = [];
    }
    acc[unitType.category].push(unitType);
    return acc;
  }, {} as Record<string, typeof enabledUnitTypes>);

  if (loading) {
    return (
      <Select disabled>
        <SelectTrigger>
          <SelectValue placeholder="Loading unit types..." />
        </SelectTrigger>
      </Select>
    );
  }

  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {Object.entries(groupedTypes).map(([category, types]) => (
          <div key={category}>
            <div className="px-2 py-1.5 text-sm font-semibold text-muted-foreground">
              {category}
            </div>
            {types.map((unitType) => (
              <SelectItem key={unitType.id} value={unitType.name}>
                <div className="flex items-center justify-between w-full">
                  <span>{unitType.name}</span>
                  {!unitType.is_system && (
                    <Badge variant="outline" className="ml-2 text-xs">
                      Custom
                    </Badge>
                  )}
                </div>
              </SelectItem>
            ))}
          </div>
        ))}
      </SelectContent>
    </Select>
  );
}