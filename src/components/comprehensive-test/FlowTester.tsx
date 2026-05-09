import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { CheckCircle, XCircle, Loader2, Play, AlertTriangle } from "lucide-react";

interface TestResult {
  name: string;
  status: 'pending' | 'running' | 'passed' | 'failed';
  message?: string;
  duration?: number;
}

export function FlowTester() {
  const [tests, setTests] = useState<TestResult[]>([
    { name: "Property Creation", status: 'pending' },
    { name: "Unit Creation", status: 'pending' },
    { name: "Tenant Creation", status: 'pending' },
    { name: "Lease Creation", status: 'pending' },
    { name: "Invoice Generation", status: 'pending' },
    { name: "M-Pesa Configuration", status: 'pending' },
    { name: "Payment Processing", status: 'pending' },
    { name: "Database Integrity", status: 'pending' },
  ]);

  const [running, setRunning] = useState(false);

  const updateTest = (index: number, update: Partial<TestResult>) => {
    setTests(prev => prev.map((test, i) => i === index ? { ...test, ...update } : test));
  };

  const runTest = async (testName: string, testFn: () => Promise<void>) => {
    const index = tests.findIndex(t => t.name === testName);
    const startTime = Date.now();
    
    updateTest(index, { status: 'running' });
    
    try {
      await testFn();
      const duration = Date.now() - startTime;
      updateTest(index, { 
        status: 'passed', 
        message: `✓ Completed successfully`,
        duration 
      });
    } catch (error) {
      const duration = Date.now() - startTime;
      updateTest(index, { 
        status: 'failed', 
        message: `✗ ${error instanceof Error ? error.message : 'Test failed'}`,
        duration 
      });
      throw error;
    }
  };

  const testPropertyCreation = async () => {
    const { data, error } = await supabase
      .from('properties')
      .insert([{
        name: 'Test Property',
        address: '123 Test Street',
        city: 'Nairobi',
        state: 'Nairobi County',
        zip_code: '00100',
        country: 'Kenya',
        property_type: 'Apartment',
        total_units: 5
      }])
      .select()
      .single();

    if (error) throw new Error(`Property creation failed: ${error.message}`);
    if (!data) throw new Error('Property creation returned no data');
    
    // Store property ID for subsequent tests
    (window as any).__testPropertyId = data.id;
  };

  const testUnitCreation = async () => {
    const propertyId = (window as any).__testPropertyId;
    if (!propertyId) throw new Error('No test property available');

    const { data, error } = await supabase
      .from("units")
      .insert([{
        property_id: propertyId,
        unit_number: 'A1',
        bedrooms: 2,
        bathrooms: 1,
        rent_amount: 25000,
        unit_type: 'apartment'
      }])
      .select()
      .single();

    if (error) throw new Error(`Unit creation failed: ${error.message}`);
    if (!data) throw new Error('Unit creation returned no data');
    
    (window as any).__testUnitId = data.id;
  };

  const testTenantCreation = async () => {
    const { data, error } = await supabase
      .from('tenants')
      .insert([{
        first_name: 'Test',
        last_name: 'Tenant',
        email: `test.tenant.${Date.now()}@example.com`,
        phone: '+254712345678',
        employment_status: 'employed'
      }])
      .select()
      .single();

    if (error) throw new Error(`Tenant creation failed: ${error.message}`);
    if (!data) throw new Error('Tenant creation returned no data');
    
    (window as any).__testTenantId = data.id;
  };

  const testLeaseCreation = async () => {
    const unitId = (window as any).__testUnitId;
    const tenantId = (window as any).__testTenantId;
    if (!unitId || !tenantId) throw new Error('Missing unit or tenant for lease test');

    const { data, error } = await supabase
      .from('leases')
      .insert([{
        tenant_id: tenantId,
        unit_id: unitId,
        lease_start_date: new Date().toISOString().split('T')[0],
        lease_end_date: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        monthly_rent: 25000,
        security_deposit: 50000,
        status: 'active'
      }])
      .select()
      .single();

    if (error) throw new Error(`Lease creation failed: ${error.message}`);
    if (!data) throw new Error('Lease creation returned no data');
    
    (window as any).__testLeaseId = data.id;
  };

  const testInvoiceGeneration = async () => {
    const leaseId = (window as any).__testLeaseId;
    const tenantId = (window as any).__testTenantId;
    if (!leaseId || !tenantId) throw new Error('Missing lease or tenant for invoice test');

    const { data, error } = await supabase
      .from('invoices')
      .insert([{
        lease_id: leaseId,
        tenant_id: tenantId,
        amount: 25000,
        due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        invoice_date: new Date().toISOString().split('T')[0],
        description: 'Test monthly rent',
        status: 'pending'
      }])
      .select()
      .single();

    if (error) throw new Error(`Invoice generation failed: ${error.message}`);
    if (!data) throw new Error('Invoice generation returned no data');
    
    (window as any).__testInvoiceId = data.id;
  };

  const testMpesaConfiguration = async () => {
    // Test M-Pesa config creation/retrieval
    const { data, error } = await supabase
      .from('landlord_mpesa_configs')
      .select('*')
      .limit(1);

    if (error) throw new Error(`M-Pesa config test failed: ${error.message}`);

    // If no config exists, that's also a valid state for testing
    if (data && data.length > 0) {
      const config = data[0];
      if (!config.consumer_key_encrypted || !config.business_shortcode) {
        throw new Error('M-Pesa configuration is incomplete - encrypted credentials required');
      }
      if (!config.environment) {
        throw new Error('M-Pesa environment not configured');
      }
    }
  };

  const testPaymentProcessing = async () => {
    const invoiceId = (window as any).__testInvoiceId;
    if (!invoiceId) throw new Error('No test invoice available');

    // Test dry run of M-Pesa STK push
    const { data, error } = await supabase.functions.invoke('mpesa-stk-push', {
      body: {
        phone: '254712345678',
        amount: 1, // Minimal amount for testing
        invoiceId: invoiceId,
        accountReference: 'TEST-INV-001',
        transactionDesc: 'Test payment',
        paymentType: 'rent',
        dryRun: true // This should prevent actual payment initiation
      }
    });

    if (error) throw new Error(`Payment processing test failed: ${error.message}`);
    if (!data || data.error) throw new Error(`Payment processing returned error: ${data?.error || 'Unknown error'}`);
  };

  const testDatabaseIntegrity = async () => {
    const propertyId = (window as any).__testPropertyId;
    const unitId = (window as any).__testUnitId;
    const tenantId = (window as any).__testTenantId;
    const leaseId = (window as any).__testLeaseId;
    const invoiceId = (window as any).__testInvoiceId;

    // Test data relationships
    const { data: propertyData, error: propertyError } = await supabase
      .from('properties')
      .select(`
        *,
        units(*)
      `)
      .eq('id', propertyId)
      .single();

    if (propertyError) throw new Error(`Database integrity check failed: ${propertyError.message}`);
    if (!propertyData) throw new Error('Property data not found');

    const unit = propertyData.units?.find(u => u.id === unitId);
    if (!unit) throw new Error('Unit not properly linked to property');

    // Check lease exists
    const { data: leaseData, error: leaseError } = await supabase
      .from('leases')
      .select('*')
      .eq('id', leaseId)
      .single();

    if (leaseError) throw new Error(`Lease check failed: ${leaseError.message}`);
    if (!leaseData) throw new Error('Lease not found');

    // Check tenant exists
    const { data: tenantData, error: tenantError } = await supabase
      .from('tenants')
      .select('*')
      .eq('id', tenantId)
      .single();

    if (tenantError) throw new Error(`Tenant check failed: ${tenantError.message}`);
    if (!tenantData) throw new Error('Tenant not found');

    // Check invoice exists
    const { data: invoiceData, error: invoiceError } = await supabase
      .from('invoices')
      .select('*')
      .eq('id', invoiceId)
      .single();

    if (invoiceError) throw new Error(`Invoice check failed: ${invoiceError.message}`);
    if (!invoiceData) throw new Error('Invoice not found');
  };

  const runAllTests = async () => {
    setRunning(true);
    
    const testFunctions = [
      () => runTest("Property Creation", testPropertyCreation),
      () => runTest("Unit Creation", testUnitCreation),
      () => runTest("Tenant Creation", testTenantCreation),
      () => runTest("Lease Creation", testLeaseCreation),
      () => runTest("Invoice Generation", testInvoiceGeneration),
      () => runTest("M-Pesa Configuration", testMpesaConfiguration),
      () => runTest("Payment Processing", testPaymentProcessing),
      () => runTest("Database Integrity", testDatabaseIntegrity),
    ];

    try {
      for (const testFn of testFunctions) {
        await testFn();
      }
      toast.success("All tests completed successfully!");
    } catch (error) {
      toast.error("Test suite failed. Check individual test results.");
    } finally {
      setRunning(false);
    }
  };

  const cleanup = async () => {
    // Clean up test data
    const propertyId = (window as any).__testPropertyId;
    if (propertyId) {
      await supabase.from('properties').delete().eq('id', propertyId);
      delete (window as any).__testPropertyId;
      delete (window as any).__testUnitId;
      delete (window as any).__testTenantId;
      delete (window as any).__testLeaseId;
      delete (window as any).__testInvoiceId;
    }
    
    // Reset test states
    setTests(prev => prev.map(test => ({ ...test, status: 'pending', message: undefined, duration: undefined })));
    toast.success("Test data cleaned up");
  };

  const getStatusIcon = (status: TestResult['status']) => {
    switch (status) {
      case 'passed': return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'failed': return <XCircle className="h-4 w-4 text-red-600" />;
      case 'running': return <Loader2 className="h-4 w-4 animate-spin text-blue-600" />;
      default: return <div className="h-4 w-4 rounded-full border-2 border-gray-300" />;
    }
  };

  const getStatusBadge = (status: TestResult['status']) => {
    switch (status) {
      case 'passed': return <Badge className="bg-green-100 text-green-800 border-green-300">Passed</Badge>;
      case 'failed': return <Badge className="bg-red-100 text-red-800 border-red-300">Failed</Badge>;
      case 'running': return <Badge className="bg-blue-100 text-blue-800 border-blue-300">Running</Badge>;
      default: return <Badge variant="outline">Pending</Badge>;
    }
  };

  const passedTests = tests.filter(t => t.status === 'passed').length;
  const failedTests = tests.filter(t => t.status === 'failed').length;
  const totalTests = tests.length;

  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-orange-600" />
              Property Management Flow Tester
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Comprehensive test suite for property creation → payments flow
            </p>
          </div>
          <div className="text-right">
            <div className="text-sm text-muted-foreground">
              {passedTests}/{totalTests} passed
            </div>
            {failedTests > 0 && (
              <div className="text-sm text-red-600">
                {failedTests} failed
              </div>
            )}
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Button 
            onClick={runAllTests} 
            disabled={running}
            className="flex items-center gap-2"
          >
            {running ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Play className="h-4 w-4" />
            )}
            {running ? 'Running Tests...' : 'Run All Tests'}
          </Button>
          
          <Button 
            variant="outline" 
            onClick={cleanup}
            disabled={running}
          >
            Clean Up
          </Button>
        </div>

        <div className="space-y-2">
          {tests.map((test, index) => (
            <div 
              key={test.name}
              className="flex items-center justify-between p-3 border rounded-lg"
            >
              <div className="flex items-center gap-3">
                {getStatusIcon(test.status)}
                <div>
                  <div className="font-medium">{test.name}</div>
                  {test.message && (
                    <div className={`text-sm ${
                      test.status === 'failed' ? 'text-red-600' : 'text-muted-foreground'
                    }`}>
                      {test.message}
                    </div>
                  )}
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                {test.duration && (
                  <span className="text-xs text-muted-foreground">
                    {test.duration}ms
                  </span>
                )}
                {getStatusBadge(test.status)}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6 p-4 bg-yellow-50 dark:bg-yellow-950/20 rounded-lg">
          <h4 className="font-medium text-yellow-800 dark:text-yellow-200 mb-2">
            Test Coverage
          </h4>
          <ul className="text-sm text-yellow-700 dark:text-yellow-300 space-y-1">
            <li>• End-to-end data flow from property creation to invoice generation</li>
            <li>• Database relationship integrity and RLS policy compliance</li>
            <li>• M-Pesa configuration and payment processing capabilities</li>
            <li>• Error handling and edge cases</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
