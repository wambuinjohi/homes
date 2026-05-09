import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Clock, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';

interface TrialCountdownProps {
  daysRemaining: number;
  status: string;
  className?: string;
}

export const TrialCountdown: React.FC<TrialCountdownProps> = ({ 
  daysRemaining, 
  status, 
  className = "" 
}) => {
  const getStatusIcon = () => {
    switch (status) {
      case 'trial':
        return daysRemaining <= 3 ? <AlertTriangle className="h-3 w-3" /> : <Clock className="h-3 w-3" />;
      case 'active':
        return <CheckCircle className="h-3 w-3" />;
      case 'suspended':
      case 'trial_expired':
        return <XCircle className="h-3 w-3" />;
      default:
        return <Clock className="h-3 w-3" />;
    }
  };

  const getStatusColor = () => {
    switch (status) {
      case 'trial':
        if (daysRemaining <= 3) return 'bg-destructive text-destructive-foreground';
        if (daysRemaining <= 7) return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300';
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300';
      case 'active':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
      case 'suspended':
      case 'trial_expired':
        return 'bg-destructive text-destructive-foreground';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  const getDisplayText = () => {
    switch (status) {
      case 'trial':
        return `${daysRemaining} days left`;
      case 'active':
        return 'Active';
      case 'suspended':
        return 'Suspended';
      case 'trial_expired':
        return 'Expired';
      default:
        return 'Unknown';
    }
  };

  return (
    <Badge 
      variant="secondary" 
      className={`${getStatusColor()} ${className} flex items-center gap-1 font-medium`}
    >
      {getStatusIcon()}
      {getDisplayText()}
    </Badge>
  );
};