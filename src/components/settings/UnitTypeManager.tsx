import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Edit, Trash2, Settings } from 'lucide-react';
import { useUnitTypes, UnitType } from '@/hooks/useUnitTypes';

interface UnitTypeFormData {
  name: string;
  category: 'Residential' | 'Commercial' | 'Mixed';
  features: string;
}

export function UnitTypeManager() {
  const { unitTypes, loading, createUnitType, updateUnitType, deleteUnitType, toggleUnitTypePreference } = useUnitTypes();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingUnitType, setEditingUnitType] = useState<UnitType | null>(null);
  
  const { register, handleSubmit, reset, setValue, watch } = useForm<UnitTypeFormData>();

  if (loading) {
    return <div>Loading unit types...</div>;
  }

  const customTypes = unitTypes.filter(ut => !ut.is_system);
  const systemTypes = unitTypes.filter(ut => ut.is_system);

  const onSubmit = async (data: UnitTypeFormData) => {
    try {
      const unitTypeData = {
        ...data,
        features: data.features.split(',').map(f => f.trim()).filter(f => f)
      };

      if (editingUnitType) {
        await updateUnitType(editingUnitType.id, unitTypeData);
      } else {
        await createUnitType(unitTypeData);
      }
      
      setIsDialogOpen(false);
      reset();
      setEditingUnitType(null);
    } catch (error) {
      console.error('Error saving unit type:', error);
    }
  };

  const handleEdit = (unitType: UnitType) => {
    setEditingUnitType(unitType);
    setValue('name', unitType.name);
    setValue('category', unitType.category);
    setValue('features', unitType.features.join(', '));
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this unit type?')) {
      await deleteUnitType(id);
    }
  };

  const handleAddNew = () => {
    setEditingUnitType(null);
    reset();
    setIsDialogOpen(true);
  };

  const handleTogglePreference = async (unitTypeId: string, isEnabled: boolean) => {
    await toggleUnitTypePreference(unitTypeId, isEnabled);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings className="h-5 w-5" />
          Unit Type Management
        </CardTitle>
        <CardDescription>
          Manage your property unit types and enable/disable them for use
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-semibold">Available Unit Types</h3>
          <Button onClick={handleAddNew} className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Add Custom Type
          </Button>
        </div>

        {/* System Unit Types with Toggle */}
        <div>
          <h4 className="text-md font-medium mb-3">System Unit Types</h4>
          <div className="grid gap-3">
            {systemTypes.map((unitType) => (
              <div key={unitType.id} className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center gap-3">
                  <Switch
                    checked={unitType.isEnabled ?? true}
                    onCheckedChange={(checked) => handleTogglePreference(unitType.id, checked)}
                  />
                  <div>
                    <span className="font-medium">{unitType.name}</span>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="secondary">{unitType.category}</Badge>
                      <Badge variant="outline">System</Badge>
                      {!(unitType.isEnabled ?? true) && (
                        <Badge variant="destructive">Disabled</Badge>
                      )}
                    </div>
                  </div>
                </div>
                <div className="text-sm text-muted-foreground">
                  {unitType.features.length > 0 && (
                    <span>Features: {unitType.features.join(', ')}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Custom Unit Types */}
        {customTypes.length > 0 && (
          <div>
            <h4 className="text-md font-medium mb-3">Custom Unit Types</h4>
            <div className="grid gap-3">
              {customTypes.map((unitType) => (
                <div key={unitType.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <Switch
                      checked={unitType.isEnabled ?? true}
                      onCheckedChange={(checked) => handleTogglePreference(unitType.id, checked)}
                    />
                    <div>
                      <span className="font-medium">{unitType.name}</span>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="secondary">{unitType.category}</Badge>
                        <Badge variant="outline">Custom</Badge>
                        {!(unitType.isEnabled ?? true) && (
                          <Badge variant="destructive">Disabled</Badge>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="text-sm text-muted-foreground mr-4">
                      {unitType.features.length > 0 && (
                        <span>Features: {unitType.features.join(', ')}</span>
                      )}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEdit(unitType)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDelete(unitType.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Add/Edit Dialog */}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingUnitType ? 'Edit Unit Type' : 'Add Custom Unit Type'}
              </DialogTitle>
              <DialogDescription>
                {editingUnitType ? 'Update the unit type details' : 'Create a new custom unit type for your properties'}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div>
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  {...register('name', { required: true })}
                  placeholder="e.g., Studio, Loft, Penthouse"
                />
              </div>
              <div>
                <Label htmlFor="category">Category</Label>
                <Select
                  value={watch('category')}
                  onValueChange={(value) => setValue('category', value as any)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Residential">Residential</SelectItem>
                    <SelectItem value="Commercial">Commercial</SelectItem>
                    <SelectItem value="Mixed">Mixed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="features">Features (comma-separated)</Label>
                <Textarea
                  id="features"
                  {...register('features')}
                  placeholder="e.g., balcony, parking, storage"
                  rows={3}
                />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit">
                  {editingUnitType ? 'Update' : 'Create'} Unit Type
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}