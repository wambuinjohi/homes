import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Download, Eye, Building2, Calendar, DollarSign, FileText } from "lucide-react";
import { UnifiedPDFRenderer } from "@/utils/unifiedPDFRenderer";

interface ServiceChargeInvoice {
  id: string;
  invoice_number: string;
  billing_period_start: string;
  billing_period_end: string;
  rent_collected: number;
  service_charge_amount: number;
  sms_charges: number;
  whatsapp_charges?: number;
  other_charges?: number;
  total_amount: number;
  due_date: string;
  status: string;
  currency: string;
  payment_date?: string;
  payment_method?: string;
  payment_reference?: string;
  notes?: string;
}

interface ServiceChargeInvoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  invoice: ServiceChargeInvoice | null;
  landlordInfo?: {
    name: string;
    email: string;
    phone?: string;
  };
}

const formatCurrency = (amount: number, currency: string = 'KES') => {
  return new Intl.NumberFormat('en-KE', {
    style: 'currency',
    currency: currency,
  }).format(amount);
};

const getStatusBadge = (status: string) => {
  switch (status) {
    case 'paid':
      return <Badge className="bg-green-100 text-green-800">Paid</Badge>;
    case 'pending':
      return <Badge className="bg-yellow-100 text-yellow-800">Pending</Badge>;
    case 'overdue':
      return <Badge className="bg-red-100 text-red-800">Overdue</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
};

export const ServiceChargeInvoiceModal: React.FC<ServiceChargeInvoiceModalProps> = ({
  isOpen,
  onClose,
  invoice,
  landlordInfo = {
    name: "Property Owner",
    email: "owner@example.com"
  }
}) => {
  if (!invoice) return null;

  const handleDownloadPDF = async () => {
    try {
      const { generateServiceChargeInvoicePDF } = await import('@/utils/serviceChargeInvoicePDF');
      await generateServiceChargeInvoicePDF(invoice, landlordInfo);
    } catch (error) {
      console.error('Error generating PDF:', error);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center">
              <FileText className="h-5 w-5 mr-2" />
              Service Charge Invoice
            </DialogTitle>
            <div className="flex items-center space-x-2">
              <Button variant="outline" size="sm" onClick={handleDownloadPDF}>
                <Download className="h-4 w-4 mr-2" />
                Download PDF
              </Button>
              {getStatusBadge(invoice.status)}
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-6">
          {/* Invoice Header */}
          <Card>
            <CardHeader className="bg-gradient-to-r from-primary/10 to-primary/5">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <Building2 className="h-8 w-8 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="text-2xl">Zira Homes</CardTitle>
                    <p className="text-muted-foreground">Property Management Services</p>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm text-muted-foreground">Invoice Number</div>
                  <div className="text-lg font-bold">{invoice.invoice_number}</div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <h4 className="font-semibold mb-2">Bill To:</h4>
                  <div className="space-y-1">
                    <div className="font-medium">{landlordInfo.name}</div>
                    <div className="text-sm text-muted-foreground">{landlordInfo.email}</div>
                    {landlordInfo.phone && (
                      <div className="text-sm text-muted-foreground">{landlordInfo.phone}</div>
                    )}
                  </div>
                </div>
                <div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="text-sm text-muted-foreground">Billing Period</div>
                      <div className="font-medium">
                        {new Date(invoice.billing_period_start).toLocaleDateString()} - {new Date(invoice.billing_period_end).toLocaleDateString()}
                      </div>
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground">Due Date</div>
                      <div className="font-medium">
                        {new Date(invoice.due_date).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Invoice Details */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <DollarSign className="h-5 w-5 mr-2" />
                Service Charges Breakdown
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* Rent Collection Summary */}
                <div className="bg-accent/50 p-4 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium">Total Rent Collected</div>
                      <div className="text-sm text-muted-foreground">
                        For period: {new Date(invoice.billing_period_start).toLocaleDateString()} - {new Date(invoice.billing_period_end).toLocaleDateString()}
                      </div>
                    </div>
                    <div className="text-xl font-bold">
                      {formatCurrency(invoice.rent_collected, invoice.currency)}
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Charges Breakdown */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium">Property Management Service Charge</div>
                      <div className="text-sm text-muted-foreground">
                        Professional property management and rent collection services
                      </div>
                    </div>
                    <div className="font-semibold">
                      {formatCurrency(invoice.service_charge_amount, invoice.currency)}
                    </div>
                  </div>

                  {invoice.sms_charges > 0 && (
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium">SMS Communication Charges</div>
                        <div className="text-sm text-muted-foreground">
                          Tenant notifications and maintenance updates
                        </div>
                      </div>
                      <div className="font-semibold">
                        {formatCurrency(invoice.sms_charges, invoice.currency)}
                      </div>
                    </div>
                  )}

                  {invoice.whatsapp_charges && invoice.whatsapp_charges > 0 && (
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium">WhatsApp Business Messaging Charges</div>
                        <div className="text-sm text-muted-foreground">
                          Enhanced tenant communication via WhatsApp
                        </div>
                      </div>
                      <div className="font-semibold">
                        {formatCurrency(invoice.whatsapp_charges, invoice.currency)}
                      </div>
                    </div>
                  )}

                  {invoice.other_charges > 0 && (
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium">Administrative & Processing Fees</div>
                        <div className="text-sm text-muted-foreground">
                          Platform maintenance and payment processing
                        </div>
                      </div>
                      <div className="font-semibold">
                        {formatCurrency(invoice.other_charges, invoice.currency)}
                      </div>
                    </div>
                  )}
                </div>

                <Separator />

                {/* Total */}
                <div className="flex items-center justify-between bg-primary/5 p-4 rounded-lg">
                  <div className="font-bold text-lg">Total Amount Due</div>
                  <div className="font-bold text-xl text-primary">
                    {formatCurrency(invoice.total_amount, invoice.currency)}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Payment Information */}
          {invoice.status === 'paid' && invoice.payment_date && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center text-green-600">
                  <Calendar className="h-5 w-5 mr-2" />
                  Payment Information
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-sm text-muted-foreground">Payment Date</div>
                    <div className="font-medium">
                      {new Date(invoice.payment_date).toLocaleDateString()}
                    </div>
                  </div>
                  {invoice.payment_method && (
                    <div>
                      <div className="text-sm text-muted-foreground">Payment Method</div>
                      <div className="font-medium">{invoice.payment_method}</div>
                    </div>
                  )}
                  {invoice.payment_reference && (
                    <div>
                      <div className="text-sm text-muted-foreground">Reference</div>
                      <div className="font-medium">{invoice.payment_reference}</div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Notes */}
          {invoice.notes && (
            <Card>
              <CardHeader>
                <CardTitle>Notes</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm">{invoice.notes}</p>
              </CardContent>
            </Card>
          )}

          {/* Footer */}
          <div className="text-center text-sm text-muted-foreground pt-4 border-t">
            <p>Thank you for choosing Zira Homes for your property management needs.</p>
            <p>For questions about this invoice, please contact our billing department.</p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};