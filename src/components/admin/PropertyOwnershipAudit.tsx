import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { AlertCircle, RefreshCw, CheckCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface MisassignedProperty {
  property_id: string;
  property_name: string;
  owner_id: string;
  owner_email: string;
  owner_role: string | null;
}

interface Landlord {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
}

export function PropertyOwnershipAudit() {
  const [misassignedProperties, setMisassignedProperties] = useState<MisassignedProperty[]>([]);
  const [landlords, setLandlords] = useState<Landlord[]>([]);
  const [loading, setLoading] = useState(true);
  const [reassignments, setReassignments] = useState<Record<string, string>>({});
  const [processing, setProcessing] = useState(false);
  const { toast } = useToast();

  const fetchAuditData = async () => {
    setLoading(true);
    try {
      // Fetch misassigned properties using direct query
      const { data: properties, error: propsError } = await supabase
        .from('properties')
        .select(`
          id,
          name,
          owner_id,
          profiles!properties_owner_id_fkey(email),
          user_roles!inner(role)
        `)
        .neq('user_roles.role', 'Landlord');

      if (propsError) throw propsError;
      
      const formattedProperties = (properties || []).map(prop => ({
        property_id: prop.id,
        property_name: prop.name,
        owner_id: prop.owner_id,
        owner_email: (prop.profiles as any)?.email || 'Unknown',
        owner_role: (prop.user_roles as any)?.role || 'none'
      }));
      
      setMisassignedProperties(formattedProperties);

      // Fetch all landlords for reassignment
      const { data: landlordData, error: landlordsError } = await supabase
        .from('profiles')
        .select('id, email, first_name, last_name')
        .in('id', 
          await supabase
            .from('user_roles')
            .select('user_id')
            .eq('role', 'Landlord')
            .then(res => res.data?.map(r => r.user_id) || [])
        );

      if (landlordsError) throw landlordsError;
      setLandlords(landlordData || []);
    } catch (error: any) {
      toast({
        title: "Error loading audit data",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAuditData();
  }, []);

  const handleReassign = (propertyId: string, landlordId: string) => {
    setReassignments(prev => ({ ...prev, [propertyId]: landlordId }));
  };

  const applyReassignments = async () => {
    if (Object.keys(reassignments).length === 0) {
      toast({
        title: "No changes",
        description: "Please select landlords for properties to reassign",
        variant: "destructive"
      });
      return;
    }

    setProcessing(true);
    try {
      for (const [propertyId, landlordId] of Object.entries(reassignments)) {
        const { error } = await supabase
          .from('properties')
          .update({ owner_id: landlordId })
          .eq('id', propertyId);

        if (error) throw error;

        // Log the change
        await supabase.rpc('log_system_event', {
          _type: 'ownership_reassignment',
          _message: `Property ${propertyId} reassigned to landlord ${landlordId}`,
          _service: 'admin',
          _details: { property_id: propertyId, new_owner_id: landlordId },
          _user_id: (await supabase.auth.getUser()).data.user?.id
        });
      }

      toast({
        title: "Reassignment successful",
        description: `${Object.keys(reassignments).length} properties reassigned to correct landlords`
      });

      setReassignments({});
      fetchAuditData();
    } catch (error: any) {
      toast({
        title: "Error reassigning properties",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Property Ownership Audit</CardTitle>
          <CardDescription>Loading...</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Property Ownership Audit</CardTitle>
            <CardDescription>
              Properties with incorrect ownership assignments
            </CardDescription>
          </div>
          <Button onClick={fetchAuditData} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {misassignedProperties.length === 0 ? (
          <div className="flex items-center justify-center p-8 text-center">
            <div>
              <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
              <p className="text-lg font-medium">All properties correctly assigned</p>
              <p className="text-sm text-muted-foreground">No ownership issues found</p>
            </div>
          </div>
        ) : (
          <>
            <div className="mb-4 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-yellow-600 dark:text-yellow-400 mt-0.5" />
              <div>
                <p className="font-medium text-yellow-900 dark:text-yellow-200">
                  {misassignedProperties.length} properties need reassignment
                </p>
                <p className="text-sm text-yellow-700 dark:text-yellow-300">
                  These properties are owned by non-Landlord accounts. Assign them to the correct landlords below.
                </p>
              </div>
            </div>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Property Name</TableHead>
                  <TableHead>Current Owner</TableHead>
                  <TableHead>Current Role</TableHead>
                  <TableHead>Reassign To</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {misassignedProperties.map((prop) => (
                  <TableRow key={prop.property_id}>
                    <TableCell className="font-medium">{prop.property_name}</TableCell>
                    <TableCell>{prop.owner_email || 'Unknown'}</TableCell>
                    <TableCell>
                      <Badge variant={prop.owner_role === 'none' ? 'destructive' : 'secondary'}>
                        {prop.owner_role || 'No Role'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Select
                        value={reassignments[prop.property_id] || ''}
                        onValueChange={(value) => handleReassign(prop.property_id, value)}
                      >
                        <SelectTrigger className="w-[250px]">
                          <SelectValue placeholder="Select landlord" />
                        </SelectTrigger>
                        <SelectContent>
                          {landlords.map((landlord) => (
                            <SelectItem key={landlord.id} value={landlord.id}>
                              {landlord.first_name} {landlord.last_name} ({landlord.email})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            <div className="mt-6 flex justify-end gap-3">
              <Button
                variant="outline"
                onClick={() => setReassignments({})}
                disabled={processing || Object.keys(reassignments).length === 0}
              >
                Clear Selections
              </Button>
              <Button
                onClick={applyReassignments}
                disabled={processing || Object.keys(reassignments).length === 0}
              >
                {processing ? 'Processing...' : `Reassign ${Object.keys(reassignments).length} Properties`}
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
