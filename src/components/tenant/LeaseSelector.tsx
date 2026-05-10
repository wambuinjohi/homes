import React from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Building2, MapPin, Home, Calendar } from "lucide-react";
import { TenantLease } from "@/hooks/useTenantLeases";

interface LeaseSelectorProps {
  leases: TenantLease[];
  selectedLeaseId: string | null;
  onLeaseSelect: (leaseId: string) => void;
  showAsCards?: boolean;
}

export function LeaseSelector({ leases, selectedLeaseId, onLeaseSelect, showAsCards = false }: LeaseSelectorProps) {
  if (leases.length <= 1) {
    return null;
  }

  const selectedLease = leases.find(lease => lease.id === selectedLeaseId) || leases[0];

  if (showAsCards) {
    return (
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Your Properties</h3>
        <div className="grid gap-4 md:grid-cols-2">
          {leases.map((lease) => (
            <Card 
              key={lease.id} 
              className={`cursor-pointer transition-all ${
                selectedLeaseId === lease.id 
                  ? 'ring-2 ring-primary bg-primary/5' 
                  : 'hover:shadow-md'
              }`}
              onClick={() => onLeaseSelect(lease.id)}
            >
              <CardContent className="p-4">
                <div className="space-y-3">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <h4 className="font-medium flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-muted-foreground" />
                        {lease.property_name}
                      </h4>
                      <p className="text-sm text-muted-foreground flex items-center gap-1">
                        <Home className="h-3 w-3" />
                        Unit {lease.unit_number}
                      </p>
                    </div>
                    <Badge variant={lease.status === 'active' ? 'default' : 'secondary'}>
                      {lease.status || 'Active'}
                    </Badge>
                  </div>
                  
                  <div className="text-sm text-muted-foreground">
                    <div className="flex items-center gap-1 mb-1">
                      <MapPin className="h-3 w-3" />
                      {lease.address}, {lease.city}
                    </div>
                    <div className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      Until {new Date(lease.lease_end_date).toLocaleDateString()}
                    </div>
                  </div>
                  
                  <div className="pt-2 border-t">
                    <p className="font-medium text-lg">
                      KES {lease.monthly_rent?.toLocaleString()}
                      <span className="text-sm text-muted-foreground font-normal">/month</span>
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium">Select Property/Unit</label>
      <Select value={selectedLeaseId || ''} onValueChange={onLeaseSelect}>
        <SelectTrigger className="w-full">
          <SelectValue>
            {selectedLease && (
              <div className="flex items-center gap-2 text-left">
                <Building2 className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <span className="truncate">
                  {selectedLease.property_name} - Unit {selectedLease.unit_number}
                </span>
                <Badge variant="outline" className="ml-auto">
                  KES {selectedLease.monthly_rent?.toLocaleString()}
                </Badge>
              </div>
            )}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {leases.map((lease) => (
            <SelectItem key={lease.id} value={lease.id}>
              <div className="flex items-center justify-between w-full">
                <div>
                  <div className="font-medium">{lease.property_name}</div>
                  <div className="text-xs text-muted-foreground">
                    Unit {lease.unit_number} • {lease.city}
                  </div>
                </div>
                <div className="ml-4 text-right">
                  <div className="font-medium">KES {lease.monthly_rent?.toLocaleString()}</div>
                  <Badge variant={lease.status === 'active' ? 'default' : 'secondary'} className="text-xs">
                    {lease.status || 'Active'}
                  </Badge>
                </div>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}