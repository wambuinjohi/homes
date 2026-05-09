import React, { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { AddTenantDialog } from "@/components/tenants/AddTenantDialog";
import { CreateInvoiceDialog } from "@/components/invoices/CreateInvoiceDialog"; 
import { AddExpenseDialog } from "@/components/expenses/AddExpenseDialog";
import { DisabledActionWrapper } from "@/components/feature-access/DisabledActionWrapper";
import { useIsMobile } from "@/hooks/use-mobile";
import { FEATURES } from "@/hooks/usePlanFeatureAccess";
import { 
  Plus, 
  UserPlus, 
  FileText, 
  Receipt, 
  Building2,
  X
} from "lucide-react";

const allActions = [
  {
    title: "Add Property & Units",
    icon: Building2,
    color: "bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70",
    action: "navigate-properties",
    contexts: ["dashboard", "properties", "tenants"],
    feature: FEATURES.PROPERTIES_MAX
  },
  {
    title: "Add Tenant", 
    icon: UserPlus,
    color: "bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700",
    action: "open-tenant-dialog",
    contexts: ["dashboard", "properties", "tenants", "invoices"],
    feature: FEATURES.TENANTS_MAX
  },
  {
    title: "Create Invoice",
    icon: FileText,
    color: "bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700",
    action: "open-invoice-dialog",
    contexts: ["dashboard", "properties", "tenants", "expenses"],
    feature: FEATURES.INVOICING
  },
  {
    title: "Add Expense",
    icon: Receipt,
    color: "bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700",
    action: "open-expense-dialog",
    contexts: ["dashboard", "tenants", "invoices"],
    feature: FEATURES.EXPENSE_TRACKING
  },
];

export function GatedFloatingActionMenu() {
  const navigate = useNavigate();
  const location = useLocation();
  const [isExpanded, setIsExpanded] = useState(false);
  const [tenantDialogOpen, setTenantDialogOpen] = useState(false);
  const [invoiceDialogOpen, setInvoiceDialogOpen] = useState(false);
  const [expenseDialogOpen, setExpenseDialogOpen] = useState(false);

  const hiddenPaths = ['/auth', '/tenant', '/admin', '/'];
  const shouldHide = hiddenPaths.some(path => 
    path === '/' ? location.pathname === '/' : location.pathname.startsWith(path)
  );

  const getCurrentContext = () => {
    const path = location.pathname;
    if (path === '/dashboard') return 'dashboard';
    if (path.startsWith('/dashboard/properties')) return 'properties';
    if (path.startsWith('/dashboard/tenants')) return 'tenants';
    if (path.startsWith('/dashboard/invoices')) return 'invoices';
    if (path.startsWith('/dashboard/expenses')) return 'expenses';
    return 'dashboard';
  };

  const contextualActions = allActions.filter(action => 
    action.contexts.includes(getCurrentContext())
  );

  if (shouldHide) return null;

  const handleActionClick = (action: string) => {
    setIsExpanded(false);
    
    switch (action) {
      case "navigate-properties":
        navigate("/dashboard/properties");
        break;
      case "open-tenant-dialog":
        setTenantDialogOpen(true);
        break;
      case "open-invoice-dialog":
        setInvoiceDialogOpen(true);
        break;
      case "open-expense-dialog":
        setExpenseDialogOpen(true);
        break;
      default:
        break;
    }
  };

  return (
    <>
      {isExpanded && (
        <div 
          className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40"
          onClick={() => setIsExpanded(false)}
        />
      )}

      <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end">
        <div className={`flex flex-col gap-3 mb-4 transition-all duration-400 ease-out ${
          isExpanded ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-95 translate-y-4 pointer-events-none'
        }`}>
          {contextualActions.map((action, index) => {
            const ActionButton = (
              <Button
                onClick={() => handleActionClick(action.action)}
                className={`${action.color} text-white rounded-xl px-4 py-3 shadow-lg hover:shadow-xl transition-all duration-300 ease-out flex items-center justify-between min-w-[180px] hover:scale-105 active:scale-95`}
                aria-label={action.title}
              >
                <span className="font-medium text-sm">{action.title}</span>
                <action.icon className="h-4 w-4" />
              </Button>
            );

            if (action.feature) {
              return (
                <DisabledActionWrapper
                  key={action.title}
                  feature={action.feature as any}
                  tooltipSide="left"
                >
                  {ActionButton}
                </DisabledActionWrapper>
              );
            }

            return <div key={action.title}>{ActionButton}</div>;
          })}
        </div>

        <Button
          onClick={() => setIsExpanded(!isExpanded)}
          className={`bg-primary hover:bg-primary/90 text-primary-foreground rounded-full w-16 h-16 p-0 shadow-2xl hover:scale-110 active:scale-95 transition-all duration-300 ${
            isExpanded ? 'rotate-45' : 'rotate-0'
          }`}
        >
          {isExpanded ? <X className="h-6 w-6" /> : <Plus className="h-6 w-6" />}
        </Button>
      </div>

      {tenantDialogOpen && (
        <AddTenantDialog
          onTenantAdded={() => setTenantDialogOpen(false)}
          open={tenantDialogOpen}
          onOpenChange={setTenantDialogOpen}
          showTrigger={false}
        />
      )}
      
      {invoiceDialogOpen && (
        <CreateInvoiceDialog onInvoiceCreated={() => setInvoiceDialogOpen(false)} />
      )}
      
      <AddExpenseDialog 
        open={expenseDialogOpen}
        onOpenChange={setExpenseDialogOpen}
        properties={[]}
        onSuccess={() => setExpenseDialogOpen(false)}
      />
    </>
  );
}
