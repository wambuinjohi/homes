import React, { Suspense } from "react";
import { TenantLayout } from "@/components/TenantLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useTenantProfile } from "@/hooks/useTenantProfile";
import { useTenantLeases } from "@/hooks/useTenantLeases";
import { useTenantContacts } from "@/hooks/useTenantContacts";
import { EmergencyContactCard } from "@/components/tenant/EmergencyContactCard";
import { LeaseSelector } from "@/components/tenant/LeaseSelector";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Edit, RefreshCw, Building2, Users } from "lucide-react";
import { useState } from "react";
import { TenantEditForm } from "@/components/forms/TenantEditForm";
import { LoadingSkeleton } from "@/components/ui/loading-skeleton";

export default function TenantProfile() {
  const { data: profileData, loading: profileLoading, error, refetch } = useTenantProfile();
  const { leases, hasMultipleLeases, hasMultipleProperties } = useTenantLeases();
  const { contacts, loading: contactsLoading } = useTenantContacts();
  const [isEditing, setIsEditing] = useState(false);
  const [selectedLeaseId, setSelectedLeaseId] = useState<string | null>(null);

  if (profileLoading || contactsLoading) {
    return (
      <TenantLayout>
        <div className="container mx-auto p-6 max-w-4xl">
          <LoadingSkeleton type="card" count={3} />
        </div>
      </TenantLayout>
    );
  }

  if (error) {
    return (
      <TenantLayout>
        <div className="container mx-auto p-6 max-w-4xl">
          <Card>
            <CardContent className="p-6 text-center">
              <p className="text-destructive mb-4">Error loading profile: {error}</p>
              <Button onClick={refetch} variant="outline" size="sm">
                <RefreshCw className="h-4 w-4 mr-2" />
                Retry
              </Button>
            </CardContent>
          </Card>
        </div>
      </TenantLayout>
    );
  }

  const tenant = profileData?.tenant;
  const allLeases = profileData?.leases || [];
  const selectedLease = selectedLeaseId 
    ? allLeases.find(l => l.id === selectedLeaseId) 
    : allLeases[0];
  const lease = selectedLease || profileData?.lease; // Fallback to old single lease format
  const landlord = profileData?.landlord;

  // Show friendly empty state if no tenant data found (not an error)
  if (profileData && !tenant && !lease && !landlord) {
    return (
      <TenantLayout>
        <div className="container mx-auto p-6 max-w-4xl">
          <Card>
            <CardContent className="p-6 text-center">
              <h3 className="text-lg font-medium mb-2">Profile Not Found</h3>
              <p className="text-muted-foreground mb-4">
                We couldn't find your tenant profile yet. Please contact your landlord or property manager to set up your profile.
              </p>
              <Button onClick={refetch} variant="outline" size="sm">
                <RefreshCw className="h-4 w-4 mr-2" />
                Check Again
              </Button>
            </CardContent>
          </Card>
        </div>
      </TenantLayout>
    );
  }

  return (
    <TenantLayout>
      <div className="container mx-auto p-6 max-w-4xl">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold">My Profile</h1>
            {hasMultipleLeases() && (
              <div className="flex items-center gap-2 mt-2 text-muted-foreground">
                <Building2 className="h-4 w-4" />
                <span className="text-sm">
                  {hasMultipleProperties() ? 
                    `${leases.length} units across multiple properties` : 
                    `${leases.length} units in ${leases[0]?.property_name}`
                  }
                </span>
              </div>
            )}
          </div>
          <Button
            onClick={() => setIsEditing(true)}
            variant="outline"
            size="sm"
          >
            <Edit className="h-4 w-4 mr-2" />
            Edit Profile
          </Button>
        </div>

        {/* Lease Selector for Multi-unit Tenants */}
        {hasMultipleLeases() && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Your Properties & Units
              </CardTitle>
            </CardHeader>
            <CardContent>
              <LeaseSelector 
                leases={leases}
                selectedLeaseId={selectedLeaseId || leases[0]?.id}
                onLeaseSelect={setSelectedLeaseId}
                showAsCards={false}
              />
            </CardContent>
          </Card>
        )}

        <div className="grid gap-6 md:grid-cols-2">
          {/* Personal Information */}
          <Card>
            <CardHeader>
              <CardTitle>Personal Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">First Name</label>
                  <p className="text-sm">{tenant?.first_name || 'Not provided'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Last Name</label>
                  <p className="text-sm">{tenant?.last_name || 'Not provided'}</p>
                </div>
              </div>
              
              <div>
                <label className="text-sm font-medium text-muted-foreground">Email</label>
                <p className="text-sm">{tenant?.email || 'Not provided'}</p>
              </div>
              
              <div>
                <label className="text-sm font-medium text-muted-foreground">Phone</label>
                <p className="text-sm">{tenant?.phone || 'Not provided'}</p>
              </div>

              {tenant?.profession && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Profession</label>
                  <p className="text-sm">{tenant.profession}</p>
                </div>
              )}

              {tenant?.employment_status && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Employment Status</label>
                  <Badge variant="secondary">{tenant.employment_status}</Badge>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Lease Information */}
          <Card>
            <CardHeader>
              <CardTitle>Lease Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {lease ? (
                <>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Property</label>
                    <p className="text-sm font-medium">{lease.property_name}</p>
                    <p className="text-xs text-muted-foreground">{lease.address}, {lease.city}, {lease.state}</p>
                  </div>
                  
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Unit</label>
                    <p className="text-sm">{lease.unit_number || 'Not specified'}</p>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Lease Start</label>
                      <p className="text-sm">
                        {lease.lease_start_date 
                          ? new Date(lease.lease_start_date).toLocaleDateString()
                          : 'Not specified'
                        }
                      </p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Lease End</label>
                      <p className="text-sm">
                        {lease.lease_end_date 
                          ? new Date(lease.lease_end_date).toLocaleDateString()
                          : 'Not specified'
                        }
                      </p>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Monthly Rent</label>
                      <p className="text-sm font-medium">KES {lease.monthly_rent?.toLocaleString()}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Status</label>
                      <Badge variant={lease.status === 'active' ? 'default' : 'secondary'}>
                        {lease.status || 'Active'}
                      </Badge>
                    </div>
                  </div>

                  {lease.amenities && lease.amenities.length > 0 && (
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Amenities</label>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {lease.amenities.map((amenity, index) => (
                          <Badge key={index} variant="outline" className="text-xs">
                            {amenity}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <p className="text-sm text-muted-foreground">No active lease found</p>
              )}
            </CardContent>
          </Card>

          {/* Emergency Contact */}
          {tenant?.emergency_contact_name && (
            <Card>
              <CardHeader>
                <CardTitle>Emergency Contact</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Name</label>
                  <p className="text-sm">{tenant.emergency_contact_name}</p>
                </div>
                {tenant.emergency_contact_phone && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Phone</label>
                    <p className="text-sm">{tenant.emergency_contact_phone}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Landlord Contact */}
          {landlord && (
            <Card>
              <CardHeader>
                <CardTitle>Landlord Contact</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Name</label>
                  <p className="text-sm">{landlord.landlord_first_name} {landlord.landlord_last_name}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Email</label>
                  <p className="text-sm">{landlord.landlord_email}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Phone</label>
                  <p className="text-sm">{landlord.landlord_phone}</p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        <Separator className="my-6" />

        {/* Emergency Contacts */}
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Emergency Contacts</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <EmergencyContactCard />
          </div>
        </div>

        {isEditing && (
          <Suspense fallback={<div className="flex items-center justify-center p-4"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>}>
            <TenantEditForm
              tenant={tenant}
              onSave={() => {
                setIsEditing(false);
                window.location.reload();
              }}
              onCancel={() => setIsEditing(false)}
            />
          </Suspense>
        )}
      </div>
    </TenantLayout>
  );
}