import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";

interface CreateTemplateDialogProps {
  children: React.ReactNode;
  onCreateTemplate: (template: {
    name: string;
    type: 'financial' | 'report' | 'legal' | 'communication';
    status: 'active' | 'draft';
    assignedTo: string[];
    description?: string;
  }) => void;
}

const templateTypes = [
  { value: 'financial', label: 'Financial Documents' },
  { value: 'report', label: 'Reports' },
  { value: 'legal', label: 'Legal & Notices' },
  { value: 'communication', label: 'Communications' },
];

const assignmentOptions = [
  'All Landlords',
  'Premium Landlords',
  'Standard Landlords',
  'Trial Landlords',
  'Specific Properties',
];

export const CreateTemplateDialog: React.FC<CreateTemplateDialogProps> = ({ 
  children, 
  onCreateTemplate 
}) => {
  const [open, setOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    type: 'financial' as 'financial' | 'report' | 'legal' | 'communication',
    status: 'draft' as 'active' | 'draft',
    description: '',
    assignedTo: [] as string[],
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.type) return;

    onCreateTemplate({
      ...formData,
      assignedTo: formData.assignedTo.length > 0 ? formData.assignedTo : ['All Landlords'],
    });

    // Reset form
    setFormData({
      name: '',
      type: 'financial' as 'financial' | 'report' | 'legal' | 'communication',
      status: 'draft',
      description: '',
      assignedTo: [],
    });
    setOpen(false);
  };

  const handleAssignmentChange = (option: string, checked: boolean) => {
    if (checked) {
      setFormData(prev => ({
        ...prev,
        assignedTo: [...prev.assignedTo, option]
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        assignedTo: prev.assignedTo.filter(item => item !== option)
      }));
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Create New PDF Template</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Template Name</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Enter template name"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="type">Template Type</Label>
              <Select 
                value={formData.type} 
                onValueChange={(value) => setFormData(prev => ({ ...prev, type: value as 'financial' | 'report' | 'legal' | 'communication' }))}
                required
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select template type" />
                </SelectTrigger>
                <SelectContent>
                  {templateTypes.map(type => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description (Optional)</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Brief description of the template"
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label>Assignment</Label>
              <div className="space-y-2">
                {assignmentOptions.map(option => (
                  <div key={option} className="flex items-center space-x-2">
                    <Checkbox
                      id={option}
                      checked={formData.assignedTo.includes(option)}
                      onCheckedChange={(checked) => handleAssignmentChange(option, checked as boolean)}
                    />
                    <Label htmlFor={option} className="text-sm font-normal">
                      {option}
                    </Label>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="status">Initial Status</Label>
              <Select 
                value={formData.status} 
                onValueChange={(value) => setFormData(prev => ({ ...prev, status: value as 'active' | 'draft' }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit">
              Create Template
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};