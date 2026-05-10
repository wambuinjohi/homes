import { useState, useCallback, useEffect } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FileText, Download, Eye, Calendar, Crown, CheckCircle2, BarChart3, DollarSign, Building2, TrendingUp, Users, PieChart, Wrench, UserX, AlertTriangle, LineChart, Calculator, CalendarDays, ArrowRight, Lock } from "lucide-react";
import { reportConfigs } from "@/lib/reporting/config";
import { useOptimizedReportGeneration } from "@/hooks/useOptimizedReportGeneration";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { ReportViewModal } from "@/components/reports/ReportViewModal";
import { PreviewReportDialog } from "@/components/reporting/PreviewReportDialog";
import { ReportConfig } from "@/lib/reporting/types";
import { FeatureGate } from "@/components/ui/feature-gate";
import { FEATURES } from "@/hooks/usePlanFeatureAccess";
import { getReportFeature, canAccessReport } from "@/lib/reporting/reportAccess";
import { usePlanFeatureAccess } from "@/hooks/usePlanFeatureAccess";
import { useReportAccess } from "@/hooks/useReportAccess";
import { PlanUpgradeButton } from "@/components/feature-access/PlanUpgradeButton";
import { useReportPrefetch } from "@/hooks/useReportPrefetch";
import { supabase } from "@/integrations/supabase/client";
import { useExecutiveSummary } from "@/hooks/useExecutiveSummary";
import { ReportPreloadManager } from "@/components/reporting/ReportPreloadManager";
import { fmtCurrency, fmtCurrencyCompact } from "@/lib/format";
import { DisabledActionWrapper } from "@/components/feature-access/DisabledActionWrapper";
import { ReportKpiCards } from "@/components/reports/ReportKpiCards";
import { QuickExpiryCheck } from "@/components/reports/QuickExpiryCheck";
import { PDFGenerationProgress } from "@/components/ui/pdf-generation-progress";
import { useRole } from "@/context/RoleContext";
import { TrialFeatureBadge } from "@/components/trial/TrialFeatureBadge";
import type { Feature } from "@/hooks/usePlanFeatureAccess";

const Reports = () => {
  const [selectedReport, setSelectedReport] = useState<any>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [progressOpen, setProgressOpen] = useState(false);
  const [currentGeneratingReport, setCurrentGeneratingReport] = useState<string>("");
  
  const { user } = useAuth();
  const { effectiveRole, isSubUser } = useRole();
  const { 
    generateOptimizedReport, 
    isActive: isGenerating, 
    progress, 
    currentStep,
    isComplete 
  } = useOptimizedReportGeneration();
  const { prefetchReportData } = useReportPrefetch();

  // Check plan access for the three feature tiers
  const basicReporting = usePlanFeatureAccess(FEATURES.BASIC_REPORTING);
  const advancedReporting = usePlanFeatureAccess(FEATURES.ADVANCED_REPORTING);
  const financialReports = usePlanFeatureAccess(FEATURES.FINANCIAL_REPORTS);

  // Determine display role - sub-users see landlord reports in grid but permission gates will control access
  const displayRole = isSubUser ? 'landlord' : effectiveRole;

  // Auto-close progress dialog when PDF generation is complete
  useEffect(() => {
    if (isComplete && progressOpen) {
      setTimeout(() => {
        setProgressOpen(false);
        setCurrentGeneratingReport("");
      }, 1500); // Show success briefly before closing
    }
  }, [isComplete, progressOpen]);


  // Basic SEO for the page
  useEffect(() => {
    document.title = 'Reports | Zira Homes';
    const metaDesc = 'Generate executive, financial, and operational property management reports.';
    let meta = document.querySelector('meta[name="description"]');
    if (!meta) {
      meta = document.createElement('meta');
      meta.setAttribute('name', 'description');
      document.head.appendChild(meta);
    }
    meta.setAttribute('content', metaDesc);

    let canonical = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
    if (!canonical) {
      canonical = document.createElement('link');
      canonical.rel = 'canonical';
      document.head.appendChild(canonical);
    }
    canonical.href = window.location.href;
  }, []);

  // Get all reports for display role
  const allReportsForRole = reportConfigs
    .filter(config => config.roles.includes(displayRole as any));
  
  // Use granular report access checks
  const reportsWithAccess = allReportsForRole.map(config => {
    const { hasAccess } = useReportAccess(config.id);
    return { config, hasAccess };
  });

  // Separate available and locked reports based on granular access
  const availableReports = reportsWithAccess
    .filter(({ hasAccess }) => hasAccess)
    .map(({ config }) => config);
  
  const lockedReports = reportsWithAccess
    .filter(({ hasAccess }) => !hasAccess)
    .map(({ config }) => config);
  
  // Build allowed features array for backwards compatibility
  const allowedFeatures: string[] = [];
  if (basicReporting.allowed) allowedFeatures.push(FEATURES.BASIC_REPORTING);
  if (advancedReporting.allowed) allowedFeatures.push(FEATURES.ADVANCED_REPORTING);
  if (financialReports.allowed) allowedFeatures.push(FEATURES.FINANCIAL_REPORTS);

  // Console logs for debugging
  console.log(`Reports: ${availableReports.length} available, ${lockedReports.length} locked`);
  console.log('Allowed features:', allowedFeatures);

  const handlePreviewReport = (config: any) => {
    setSelectedReport(config);
    setPreviewOpen(true);
  };

  const handleGenerateReport = async (reportConfig: any, filters: any) => {
    try {
      setCurrentGeneratingReport(reportConfig.title);
      setProgressOpen(true);
      
      // Extract table-only option from filters
      const { tableOnly, ...cleanFilters } = filters;
      
      // Add date range to filters if using preset
      const updatedFilters = {
        ...cleanFilters,
        startDate: cleanFilters.startDate,
        endDate: cleanFilters.endDate
      };
      
      await generateOptimizedReport(
        reportConfig.queryId, // Use queryId for data fetching
        reportConfig.id, // Use reportId for PDF config
        reportConfig.title,
        updatedFilters,
        { tableOnly } // Pass tableOnly option separately
      );
    } catch (error) {
      console.error('Failed to generate report:', error);
      toast.error('Failed to generate PDF report');
    }
  };

  const getReportIcon = (reportId: string) => {
    const iconMap: Record<string, any> = {
      'rent-collection': DollarSign,
      'financial-summary': BarChart3,
      'occupancy-report': Building2,
      'maintenance-report': Wrench,
      'lease-expiry': Calendar,
      'tenant-turnover': UserX,
      'outstanding-balances': AlertTriangle,
      'property-performance': TrendingUp,
      'profit-loss': Calculator,
      'revenue-vs-expenses': LineChart,
      'expense-summary': PieChart,
      'cash-flow': TrendingUp,
      'market-rent': Building2,
      'executive-summary': BarChart3,
    };
    return iconMap[reportId] || FileText;
  };

  // Find the executive summary report
  const executiveSummaryReport = availableReports.find(config => config.id === 'executive-summary');
  const leaseExpiryReport = availableReports.find(config => config.id === 'lease-expiry');

  // Get executive summary data
  const { 
    totalRevenue, 
    netOperatingIncome, 
    outstandingAmount, 
    collectionRate,
    occupancyRate,
    periodLabel,
    isLoading: summaryLoading 
  } = useExecutiveSummary();

  const handleViewLeaseExpiryDetails = () => {
    if (leaseExpiryReport) {
      handlePreviewReport(leaseExpiryReport);
    }
  };

  const handleKpiClick = (reportType: string) => {
    switch (reportType) {
      case 'rent-collection':
        const rentReport = availableReports.find(r => r.id === 'rent-collection');
        if (rentReport) {
          handlePreviewReport(rentReport);
        }
        break;
      case 'scheduled':
        // Scroll to reports grid
        document.getElementById('reports-grid')?.scrollIntoView({ behavior: 'smooth' });
        break;
      case 'all':
      case 'coverage':
      default:
        // Show a toast with info
        toast.success("Browse available reports below to generate detailed insights.");
    }
  };

  return (
    <DashboardLayout>
      <ReportPreloadManager 
        filters={{ periodPreset: 'current_period' }}
      />
      <div className="bg-tint-gray p-3 sm:p-4 lg:p-6 space-y-8">
        {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-primary">Reports</h1>
              <p className="text-muted-foreground">
                Generate financial and operational reports
              </p>
            </div>
            {lockedReports.length > 0 && (
              <Badge variant="outline" className="bg-warning/10 text-warning border-warning/20">
                <Lock className="h-3 w-3 mr-1" />
                {lockedReports.length} Premium report{lockedReports.length > 1 ? 's' : ''} available
              </Badge>
            )}
          </div>

          {/* Executive Summary Report Card */}
          {executiveSummaryReport && (
            <Card className="hover:shadow-elevated transition-all duration-500 border-border/20 bg-gradient-to-br from-background to-background/80 overflow-hidden relative">
              <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent pointer-events-none" />
              <CardHeader className="pb-4 relative">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-4">
                    <div className="p-3 rounded-xl bg-gradient-to-br from-primary/10 to-primary/20 shadow-inner">
                      <BarChart3 className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-lg font-bold text-foreground tracking-tight">
                        {executiveSummaryReport.title}
                      </CardTitle>
                      <p className="text-sm text-muted-foreground mt-1 max-w-md">
                        {executiveSummaryReport.description}
                      </p>
                    </div>
                  </div>
                  <Badge variant="secondary" className="bg-gradient-to-r from-success to-success/90 text-white border-0 shadow-sm">
                    Ready
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="pt-0 relative">
                <div className="space-y-6">
                  {/* Main Financial Metrics */}
                  <div className="grid grid-cols-3 gap-8">
                    <div className="text-center group">
                      <div className="text-muted-foreground mb-3 text-xs font-semibold uppercase tracking-wide">Revenue ({periodLabel})</div>
                      {summaryLoading ? (
                        <div className="h-10 bg-muted animate-pulse rounded-lg"></div>
                      ) : (
                        <div className="text-3xl font-bold text-success transition-transform group-hover:scale-105 duration-200">
                          {fmtCurrencyCompact(totalRevenue)}
                        </div>
                      )}
                    </div>
                    <div className="text-center group">
                      <div className="text-muted-foreground mb-3 text-xs font-semibold uppercase tracking-wide">Net Income</div>
                      {summaryLoading ? (
                        <div className="h-10 bg-muted animate-pulse rounded-lg"></div>
                      ) : (
                        <div className={`text-3xl font-bold transition-transform group-hover:scale-105 duration-200 ${
                          netOperatingIncome >= 0 ? 'text-success' : 'text-destructive'
                        }`}>
                          {fmtCurrencyCompact(netOperatingIncome)}
                        </div>
                      )}
                    </div>
                    <div className="text-center group">
                      <div className="text-muted-foreground mb-3 text-xs font-semibold uppercase tracking-wide">Outstanding</div>
                      {summaryLoading ? (
                        <div className="h-10 bg-muted animate-pulse rounded-lg"></div>
                      ) : (
                        <div className="text-3xl font-bold text-warning transition-transform group-hover:scale-105 duration-200">
                          {fmtCurrencyCompact(outstandingAmount)}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Period Badge */}
                  <div className="flex items-center justify-center py-2">
                    <div className="px-4 py-2 bg-gradient-to-r from-muted/60 to-muted/40 rounded-full">
                      <span className="text-sm font-semibold text-foreground">
                        {periodLabel}
                      </span>
                    </div>
                  </div>

                  {/* Performance Metrics */}
                  <div className="relative">
                    <div className="absolute inset-0 bg-gradient-to-r from-border/10 via-border/5 to-border/10 rounded-lg"></div>
                    <div className="relative bg-background/80 backdrop-blur-sm rounded-lg p-4 border border-border/20">
                      <div className="grid grid-cols-2 gap-8">
                        <div className="text-center group">
                          <div className="text-muted-foreground mb-3 text-xs font-semibold uppercase tracking-wide">Collection Rate</div>
                          {summaryLoading ? (
                            <div className="h-8 bg-muted animate-pulse rounded-lg"></div>
                          ) : (
                            <div className="text-2xl font-bold text-primary transition-transform group-hover:scale-105 duration-200">
                              {(collectionRate || 0).toFixed(1)}%
                            </div>
                          )}
                        </div>
                        <div className="text-center group">
                          <div className="text-muted-foreground mb-3 text-xs font-semibold uppercase tracking-wide">Occupancy</div>
                          {summaryLoading ? (
                            <div className="h-8 bg-muted animate-pulse rounded-lg"></div>
                          ) : (
                            <div className="text-2xl font-bold text-primary transition-transform group-hover:scale-105 duration-200">
                              {(occupancyRate || 0).toFixed(0)}%
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="grid grid-cols-2 gap-3 pt-2">
                    <DisabledActionWrapper 
                      feature={getReportFeature(executiveSummaryReport.id) as any}
                      fallbackTitle="Preview Report"
                      fallbackDescription="Preview executive summary with advanced analytics and insights."
                    >
                      <Button
                        variant="outline"
                        size="sm"
                        className="border border-border/40 text-foreground hover:bg-primary hover:text-primary-foreground hover:border-primary transition-all duration-200 font-medium w-full"
                        onClick={() => handlePreviewReport(executiveSummaryReport)}
                      >
                        <Eye className="h-3 w-3 mr-1.5" />
                        Preview
                      </Button>
                    </DisabledActionWrapper>
                    <DisabledActionWrapper 
                      feature={getReportFeature(executiveSummaryReport.id) as any}
                      fallbackTitle="Generate PDF"
                      fallbackDescription="Generate comprehensive PDF report with executive summary."
                    >
                      <Button
                        variant="default"
                        size="sm"
                        className="bg-gradient-to-r from-primary to-primary/90 text-primary-foreground border-0 hover:shadow-elevated transition-all duration-200 font-medium w-full"
                        onClick={() => handleGenerateReport(executiveSummaryReport, { periodPreset: executiveSummaryReport.defaultPeriod })}
                      >
                        <Download className="h-3 w-3 mr-1.5" />
                        PDF
                      </Button>
                    </DisabledActionWrapper>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Report KPIs */}
          <ReportKpiCards 
            availableCount={availableReports.length}
            totalCount={allReportsForRole.length}
            onReportClick={handleKpiClick}
          />

          {/* Lease Expiry Alert */}
          <QuickExpiryCheck 
            onViewDetails={handleViewLeaseExpiryDetails}
          />

          {/* All Reports Grid */}
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-foreground">Other Reports</h2>
              <div className="text-sm text-muted-foreground">
                {availableReports.length - (executiveSummaryReport ? 1 : 0)} of {allReportsForRole.length - (executiveSummaryReport ? 1 : 0)} reports available
              </div>
            </div>

            {/* Available Reports Section */}
            {availableReports.filter(config => config.id !== 'executive-summary').length > 0 && (
              <div className="space-y-4">
                <h3 className="text-lg font-medium text-foreground">Available Reports</h3>
                <div id="reports-grid" className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                  {availableReports
                    .filter(config => config.id !== 'executive-summary')
                    .map((config) => {
                      const Icon = getReportIcon(config.id);
                      return (
                        <TrialFeatureBadge 
                          key={config.id}
                          feature={getReportFeature(config.id) as Feature}
                          showTooltip={true}
                        >
                          <Card className="hover:shadow-elevated transition-all duration-300 border-border/20 bg-gradient-to-br from-background to-background/80 overflow-hidden relative group">
                          <div className="absolute inset-0 bg-gradient-to-br from-primary/3 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
                          <CardHeader className="pb-3 relative">
                            <div className="flex items-start justify-between">
                              <div className="flex items-center gap-3">
                                <div className="p-2 rounded-lg bg-gradient-to-br from-primary/10 to-primary/20">
                                  <Icon className="h-5 w-5 text-primary" />
                                </div>
                                <CardTitle className="text-base font-semibold text-foreground leading-tight">
                                  {config.title}
                                </CardTitle>
                              </div>
                              <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">
                                Available
                              </Badge>
                            </div>
                          </CardHeader>
                          <CardContent className="pt-0 relative">
                            <p className="text-sm text-muted-foreground mb-4 leading-relaxed">
                              {config.description}
                            </p>
                            
                            <div className="grid grid-cols-2 gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                className="border border-border/40 text-foreground hover:bg-primary hover:text-primary-foreground hover:border-primary transition-all duration-200 font-medium w-full"
                                onClick={() => handlePreviewReport(config)}
                              >
                                <Eye className="h-3 w-3 mr-1.5" />
                                Preview
                              </Button>
                              <Button
                                variant="default"
                                size="sm"
                                className="bg-gradient-to-r from-primary to-primary/90 text-primary-foreground border-0 hover:shadow-elevated transition-all duration-200 font-medium w-full"
                                onClick={() => handleGenerateReport(config, { periodPreset: config.defaultPeriod })}
                              >
                                <Download className="h-3 w-3 mr-1.5" />
                                PDF
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                        </TrialFeatureBadge>
                      );
                    })}
                </div>
              </div>
            )}

            {/* Locked Reports Section */}
            {lockedReports.filter(config => config.id !== 'executive-summary').length > 0 && (
              <div className="space-y-4">
                <h3 className="text-lg font-medium text-muted-foreground">Premium Reports (Locked)</h3>
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                  {lockedReports
                    .filter(config => config.id !== 'executive-summary')
                    .map((config) => {
                      const Icon = getReportIcon(config.id);
                      return (
                        <TrialFeatureBadge 
                          key={config.id}
                          feature={getReportFeature(config.id) as Feature}
                          showTooltip={true}
                        >
                          <Card className="relative overflow-hidden opacity-75 cursor-not-allowed">
                           {/* Enhanced blur overlay */}
                           <div className="absolute inset-0 bg-background/60 backdrop-blur-[1px] z-10 flex items-center justify-center">
                             <div className="text-center p-4">
                               <Lock className="h-6 w-6 mx-auto mb-2 text-primary" />
                               <p className="text-sm font-medium text-foreground mb-1">{config.title}</p>
                               <p className="text-xs text-muted-foreground mb-3">
                                 Advanced {config.id.includes('financial') || config.id.includes('profit') || config.id.includes('cash') ? 'financial' : 'operational'} insights & analytics
                               </p>
                               <PlanUpgradeButton 
                                 feature={getReportFeature(config.id) as any}
                                 size="sm" 
                                 className="text-xs"
                               >
                                 <Crown className="h-3 w-3 mr-1" />
                                 Unlock Pro
                               </PlanUpgradeButton>
                             </div>
                           </div>
                          
                          <CardHeader className="pb-3">
                            <div className="flex items-start justify-between">
                              <div className="flex items-center gap-3">
                                <div className="p-2 rounded-lg bg-gradient-to-br from-primary/10 to-primary/20">
                                  <Icon className="h-5 w-5 text-primary" />
                                </div>
                                <CardTitle className="text-base font-semibold">
                                  {config.title}
                                </CardTitle>
                              </div>
                              <Badge variant="secondary" className="text-xs bg-orange-50 text-orange-700 border-orange-200">
                                Pro
                              </Badge>
                            </div>
                          </CardHeader>
                          <CardContent className="pt-0">
                            <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
                              {config.description}
                            </p>
                            <div className="grid grid-cols-2 gap-2">
                              <Button variant="outline" size="sm" disabled>
                                <Eye className="h-3 w-3 mr-1.5" />
                                Preview
                              </Button>
                              <Button variant="default" size="sm" disabled>
                                <Download className="h-3 w-3 mr-1.5" />
                                PDF
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                        </TrialFeatureBadge>
                      );
                    })}
                </div>
              </div>
            )}
          </div>

          {/* Preview Dialog */}
          {selectedReport && (
            <PreviewReportDialog
              open={previewOpen}
              onOpenChange={setPreviewOpen}
              reportConfig={selectedReport}
              onGeneratePDF={(filters) => handleGenerateReport(selectedReport, filters)}
              isGenerating={isGenerating}
            />
          )}

          {/* PDF Generation Progress Dialog */}
          <PDFGenerationProgress
            open={progressOpen}
            onOpenChange={setProgressOpen}
            isGenerating={isGenerating}
            progress={progress}
            currentStep={currentStep}
            isComplete={false}
            reportTitle={currentGeneratingReport}
          />
      </div>
    </DashboardLayout>
  );
};

export default Reports;
