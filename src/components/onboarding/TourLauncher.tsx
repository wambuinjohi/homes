import React from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { HelpCircle, PlayCircle, Loader2 } from 'lucide-react';
import { useTour } from '@/hooks/useTour';
import { useLocation } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';

interface TourOption {
  id: string;
  name: string;
  page: string;
  description: string;
}

const AVAILABLE_TOURS: TourOption[] = [
  {
    id: 'add_property_tour',
    name: 'Add Property',
    page: '/dashboard/properties',
    description: 'Learn how to add and manage properties'
  },
  {
    id: 'add_tenant_tour',
    name: 'Add Tenant',
    page: '/dashboard/tenants',
    description: 'Learn how to invite and manage tenants'
  },
  {
    id: 'generate_report_tour',
    name: 'Generate Reports',
    page: '/dashboard/reports',
    description: 'Learn how to create financial reports'
  },
  {
    id: 'bulk_upload_tour',
    name: 'Bulk Upload',
    page: '/dashboard/units',
    description: 'Learn how to bulk upload units and tenants'
  },
  {
    id: 'payment_settings_tour',
    name: 'Payment Settings',
    page: '/dashboard/payment-settings',
    description: 'Configure payment methods for your tenants'
  }
];

export function TourLauncher() {
  const { startTour, loading } = useTour();
  const location = useLocation();
  const { toast } = useToast();

  const currentPageTours = AVAILABLE_TOURS.filter(
    tour => tour.page === location.pathname
  );

  const otherTours = AVAILABLE_TOURS.filter(
    tour => tour.page !== location.pathname
  );

  const handleTourStart = (tourId: string) => {
    try {
      startTour(tourId);
    } catch (error) {
      toast({
        title: "Tour unavailable",
        description: "This tour is not configured yet. Please check back later.",
        variant: "destructive",
      });
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="text-white hover:bg-white/20"
          title="Interactive Tours & Help"
          aria-label="Open interactive tours menu"
          disabled={loading}
        >
          <div className="w-6 h-6 bg-white/30 rounded-full flex items-center justify-center backdrop-blur-sm">
            {loading ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <HelpCircle className="h-3 w-3" />
            )}
          </div>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        <DropdownMenuLabel>Interactive Tours</DropdownMenuLabel>
        <DropdownMenuSeparator />
        
        {currentPageTours.length > 0 && (
          <>
            <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
              Tours for this page
            </div>
            {currentPageTours.map(tour => (
              <DropdownMenuItem
                key={tour.id}
                onClick={() => handleTourStart(tour.id)}
                disabled={loading}
                className="flex items-start gap-3 py-3 cursor-pointer"
              >
                <PlayCircle className="h-4 w-4 mt-0.5 text-primary" />
                <div className="flex-1">
                  <div className="font-medium">{tour.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {tour.description}
                  </div>
                </div>
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
          </>
        )}
        
        {otherTours.length > 0 && (
          <>
            <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
              Other tours
            </div>
            {otherTours.map(tour => (
              <DropdownMenuItem
                key={tour.id}
                onClick={() => handleTourStart(tour.id)}
                disabled={loading}
                className="flex items-start gap-3 py-2 cursor-pointer"
              >
                <div className="flex-1">
                  <div className="font-medium text-sm">{tour.name}</div>
                  <div className="text-xs text-muted-foreground">
                    Available on {tour.page}
                  </div>
                </div>
              </DropdownMenuItem>
            ))}
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
