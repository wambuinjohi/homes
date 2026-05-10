
import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { TablePaginator } from '@/components/ui/table-paginator';
import { useUrlPageParam } from '@/hooks/useUrlPageParam';
import { useToast } from '@/hooks/use-toast';
import { formatDistanceToNow } from 'date-fns';
import { Server, Plus, Eye, Pause, Play, Trash2, Copy } from 'lucide-react';

interface SelfHostedInstance {
  id: string;
  landlord_id: string;
  name: string;
  domain: string;
  status: 'active' | 'suspended';
  last_seen_at: string;
  metadata: Record<string, any>;
  created_at: string;
}

export function SelfHostedInstancesManager() {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [selectedInstance, setSelectedInstance] = useState<SelfHostedInstance | null>(null);
  const [newInstance, setNewInstance] = useState({
    name: '',
    domain: '',
    landlord_id: '',
    metadata: {}
  });
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { page, pageSize, offset, setPage, setPageSize } = useUrlPageParam({ defaultPage: 1, pageSize: 10 });

  const { data: instancesData, isLoading } = useQuery({
    queryKey: ['self-hosted-instances', page, pageSize],
    queryFn: async () => {
      // Get total count
      const { count } = await supabase
        .from('self_hosted_instances')
        .select('*', { count: 'exact', head: true });

      // Get paginated data
      const { data, error } = await supabase
        .from('self_hosted_instances')
        .select('*')
        .order('created_at', { ascending: false })
        .range(offset, offset + pageSize - 1);
      
      if (error) throw error;
      return { instances: data as SelfHostedInstance[], total: count || 0 };
    }
  });

  const instances = instancesData?.instances || [];
  const totalInstances = instancesData?.total || 0;

  const createInstanceMutation = useMutation({
    mutationFn: async (instanceData: typeof newInstance) => {
      // Generate a write key and hash it
      const writeKey = crypto.randomUUID() + '-' + Date.now();
      const encoder = new TextEncoder();
      const keyData = encoder.encode(writeKey);
      const hashBuffer = await crypto.subtle.digest('SHA-256', keyData);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const writeKeyHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

      const { data, error } = await supabase
        .from('self_hosted_instances')
        .insert({
          ...instanceData,
          write_key_hash: writeKeyHash,
          status: 'active'
        })
        .select()
        .single();

      if (error) throw error;
      
      return { instance: data, writeKey };
    },
    onSuccess: ({ instance, writeKey }) => {
      queryClient.invalidateQueries({ queryKey: ['self-hosted-instances'] });
      setIsCreateDialogOpen(false);
      setNewInstance({ name: '', domain: '', landlord_id: '', metadata: {} });
      
      // Show the write key to the user (they need to save it)
      toast({
        title: 'Instance Created Successfully',
        description: `Write Key: ${writeKey} (Save this - it won't be shown again!)`,
        duration: 10000
      });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: 'Failed to create instance',
        variant: 'destructive'
      });
      console.error('Failed to create instance:', error);
    }
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: 'active' | 'suspended' }) => {
      const { error } = await supabase
        .from('self_hosted_instances')
        .update({ status })
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['self-hosted-instances'] });
      toast({
        title: 'Success',
        description: 'Instance status updated'
      });
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to update instance status',
        variant: 'destructive'
      });
    }
  });

  const handleCreateInstance = () => {
    createInstanceMutation.mutate(newInstance);
  };

  const handleStatusToggle = (instance: SelfHostedInstance) => {
    const newStatus = instance.status === 'active' ? 'suspended' : 'active';
    updateStatusMutation.mutate({ id: instance.id, status: newStatus });
  };

  const copyInstanceId = (id: string) => {
    navigator.clipboard.writeText(id);
    toast({
      title: 'Copied',
      description: 'Instance ID copied to clipboard'
    });
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Server className="h-5 w-5" />
            Self-Hosted Instances
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            Loading instances...
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Server className="h-5 w-5" />
              Self-Hosted Instances
            </div>
            <Button onClick={() => setIsCreateDialogOpen(true)} size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Add Instance
            </Button>
          </CardTitle>
          <CardDescription>
            Manage and monitor self-hosted deployments
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!instances || instances.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No self-hosted instances registered yet
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Domain</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Last Seen</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {instances.map((instance) => (
                  <TableRow key={instance.id}>
                    <TableCell className="font-medium">
                      {instance.name}
                    </TableCell>
                    <TableCell>
                      {instance.domain ? (
                        <a 
                          href={`https://${instance.domain}`} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:underline"
                        >
                          {instance.domain}
                        </a>
                      ) : (
                        <span className="text-muted-foreground">No domain</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={instance.status === 'active' ? 'default' : 'secondary'}>
                        {instance.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {instance.last_seen_at ? (
                        <span className="text-sm">
                          {formatDistanceToNow(new Date(instance.last_seen_at), { addSuffix: true })}
                        </span>
                      ) : (
                        <span className="text-muted-foreground text-sm">Never</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => copyInstanceId(instance.id)}
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedInstance(instance)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleStatusToggle(instance)}
                        >
                          {instance.status === 'active' ? (
                            <Pause className="h-4 w-4" />
                          ) : (
                            <Play className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          
          {/* Pagination */}
          <div className="mt-4">
            <TablePaginator
              currentPage={page}
              totalPages={Math.ceil(totalInstances / pageSize)}
              pageSize={pageSize}
              totalItems={totalInstances}
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
              showPageSizeSelector={true}
            />
          </div>
        </CardContent>
      </Card>

      {/* Create Instance Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Self-Hosted Instance</DialogTitle>
            <DialogDescription>
              Register a new self-hosted deployment for monitoring
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="name">Instance Name</Label>
              <Input
                id="name"
                value={newInstance.name}
                onChange={(e) => setNewInstance({ ...newInstance, name: e.target.value })}
                placeholder="My Company's Instance"
              />
            </div>
            <div>
              <Label htmlFor="domain">Domain (optional)</Label>
              <Input
                id="domain"
                value={newInstance.domain}
                onChange={(e) => setNewInstance({ ...newInstance, domain: e.target.value })}
                placeholder="property.mycompany.com"
              />
            </div>
            <div>
              <Label htmlFor="landlord_id">Landlord User ID</Label>
              <Input
                id="landlord_id"
                value={newInstance.landlord_id}
                onChange={(e) => setNewInstance({ ...newInstance, landlord_id: e.target.value })}
                placeholder="UUID of the landlord user"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateInstance} disabled={createInstanceMutation.isPending}>
              {createInstanceMutation.isPending ? 'Creating...' : 'Create Instance'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Instance Details Dialog */}
      <Dialog open={!!selectedInstance} onOpenChange={() => setSelectedInstance(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Instance Details</DialogTitle>
          </DialogHeader>
          {selectedInstance && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Name</Label>
                  <p className="text-sm mt-1">{selectedInstance.name}</p>
                </div>
                <div>
                  <Label>Status</Label>
                  <div className="mt-1">
                    <Badge variant={selectedInstance.status === 'active' ? 'default' : 'secondary'}>
                      {selectedInstance.status}
                    </Badge>
                  </div>
                </div>
                <div>
                  <Label>Instance ID</Label>
                  <p className="text-sm mt-1 font-mono">{selectedInstance.id}</p>
                </div>
                <div>
                  <Label>Landlord ID</Label>
                  <p className="text-sm mt-1 font-mono">{selectedInstance.landlord_id}</p>
                </div>
                <div>
                  <Label>Domain</Label>
                  <p className="text-sm mt-1">{selectedInstance.domain || 'Not set'}</p>
                </div>
                <div>
                  <Label>Last Seen</Label>
                  <p className="text-sm mt-1">
                    {selectedInstance.last_seen_at ? 
                      formatDistanceToNow(new Date(selectedInstance.last_seen_at), { addSuffix: true }) : 
                      'Never'
                    }
                  </p>
                </div>
              </div>
              {selectedInstance.metadata && Object.keys(selectedInstance.metadata).length > 0 && (
                <div>
                  <Label>Metadata</Label>
                  <pre className="text-xs mt-1 p-2 bg-muted rounded">
                    {JSON.stringify(selectedInstance.metadata, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
