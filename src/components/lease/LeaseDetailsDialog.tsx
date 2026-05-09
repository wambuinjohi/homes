import React, { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { formatAmount } from "@/utils/currency";

interface LeaseDetailsDialogProps {
  leaseId: string;
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function LeaseDetailsDialog({ leaseId, trigger, open, onOpenChange }: LeaseDetailsDialogProps) {
  const [isOpen, setIsOpen] = useState<boolean>(!!open);
  const [loading, setLoading] = useState(false);
  const [lease, setLease] = useState<any | null>(null);

  useEffect(() => {
    setIsOpen(!!open);
  }, [open]);

  useEffect(() => {
    if (!isOpen) return;
    fetchLease();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, leaseId]);

  const fetchLease = async () => {
    if (!leaseId) return;
    setLoading(true);
    try {
      // Attempt generic relationship select (works if FKs are present regardless of constraint names)
      const { data, error } = await (supabase as any)
        .from("leases")
        .select(`
          *,
          tenants:tenants(*),
          units:units(*, properties:properties(*))
        `)
        .eq("id", leaseId)
        .single();

      if (error) throw error;
      setLease(data);
    } catch (err) {
      // Fallback: fetch pieces separately to avoid dependency on FK names or PostgREST relationship mapping
      try {
        const { data: leaseRow, error: leaseErr } = await (supabase as any)
          .from('leases')
          .select('*')
          .eq('id', leaseId)
          .single();
        if (leaseErr) throw leaseErr;

        let tenant: any = null;
        if (leaseRow?.tenant_id) {
          const { data: t, error: tErr } = await (supabase as any)
            .from('tenants')
            .select('id, first_name, last_name, email, phone')
            .eq('id', leaseRow.tenant_id)
            .maybeSingle();
          if (!tErr) tenant = t;
        }

        let unit: any = null;
        if (leaseRow?.unit_id) {
          const { data: u, error: uErr } = await (supabase as any)
            .from('units')
            .select('id, unit_number, property_id')
            .eq('id', leaseRow.unit_id)
            .maybeSingle();
          if (!uErr) unit = u;
        }

        let property: any = null;
        if (unit?.property_id) {
          const { data: p, error: pErr } = await (supabase as any)
            .from('properties')
            .select('id, name, owner_id')
            .eq('id', unit.property_id)
            .maybeSingle();
          if (!pErr) property = p;
        }

        setLease({
          ...leaseRow,
          tenants: tenant,
          units: unit ? { ...unit, properties: property } : null,
        });
      } catch (fallbackErr) {
        console.error('Failed to fetch lease details (fallback):', (fallbackErr as any)?.message || JSON.stringify(fallbackErr));
        setLease(null);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleOpenChange = (val: boolean) => {
    setIsOpen(val);
    onOpenChange?.(val);
  };

  const tenantName = lease?.tenants ? `${lease.tenants.first_name || ''} ${lease.tenants.last_name || ''}`.trim() : 'Unknown Tenant';
  const propertyName = lease?.units?.properties?.name || 'Unknown Property';
  const unitNumber = lease?.units?.unit_number || 'N/A';

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {trigger || <Button size="sm">View Details</Button>}
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between gap-4">
            <div>
              Lease Details
            </div>
            {lease && (
              <Badge variant={lease.status === 'active' ? 'secondary' : 'default'}>
                {lease.status || 'Unknown'}
              </Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {loading && <div className="text-sm text-muted-foreground">Loading...</div>}

          {!loading && !lease && (
            <div className="text-sm text-muted-foreground">Unable to load lease details.</div>
          )}

          {!loading && lease && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <div className="text-xs text-muted-foreground">Tenant</div>
                <div className="font-medium">{tenantName}</div>
                <div className="text-sm text-muted-foreground">{lease.tenants?.email || 'No email'}</div>
                <div className="text-sm text-muted-foreground">{lease.tenants?.phone || 'No phone'}</div>
              </div>

              <div className="space-y-2">
                <div className="text-xs text-muted-foreground">Property & Unit</div>
                <div className="font-medium">{propertyName} — Unit {unitNumber}</div>
                <div className="text-sm text-muted-foreground">Owner: {lease.units?.properties?.owner_id || 'N/A'}</div>
              </div>

              <div className="space-y-2">
                <div className="text-xs text-muted-foreground">Lease Period</div>
                <div className="font-medium">{format(new Date(lease.lease_start_date), 'MMM dd, yyyy')} — {format(new Date(lease.lease_end_date), 'MMM dd, yyyy')}</div>
                <div className="text-sm text-muted-foreground">Duration: {Math.ceil((new Date(lease.lease_end_date).getTime() - new Date(lease.lease_start_date).getTime()) / (1000*60*60*24))} days</div>
              </div>

              <div className="space-y-2">
                <div className="text-xs text-muted-foreground">Financials</div>
                <div className="font-medium">{formatAmount(lease.monthly_rent)}</div>
                <div className="text-sm text-muted-foreground">Security Deposit: {lease.security_deposit ? formatAmount(lease.security_deposit) : 'N/A'}</div>
              </div>

              {lease.notes && (
                <div className="md:col-span-2">
                  <div className="text-xs text-muted-foreground">Notes</div>
                  <div className="text-sm">{lease.notes}</div>
                </div>
              )}

              <div className="md:col-span-2 flex justify-end gap-2">
                <Button size="sm" variant="outline" onClick={() => handleOpenChange(false)}>Close</Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
