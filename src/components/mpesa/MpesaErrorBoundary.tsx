import React, { Component, ErrorInfo, ReactNode } from "react";
import { AlertTriangle, RefreshCw, Smartphone, HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { errorReporter } from "@/utils/errorReporting";
import { logger } from "@/utils/logger";

interface Props {
  children: ReactNode;
  onRetry?: () => void;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  errorCategory: 'network' | 'config' | 'auth' | 'validation' | 'unknown';
}

export class MpesaErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { 
      hasError: false, 
      error: null, 
      errorInfo: null,
      errorCategory: 'unknown'
    };
  }

  public static getDerivedStateFromError(error: Error): Partial<State> {
    const errorCategory = MpesaErrorBoundary.categorizeError(error);
    return { 
      hasError: true, 
      error, 
      errorInfo: null,
      errorCategory 
    };
  }

  private static categorizeError(error: Error): State['errorCategory'] {
    const message = error.message.toLowerCase();
    
    if (message.includes('network') || message.includes('fetch') || message.includes('timeout')) {
      return 'network';
    }
    if (message.includes('config') || message.includes('credentials') || message.includes('api key')) {
      return 'config';
    }
    if (message.includes('auth') || message.includes('session') || message.includes('token')) {
      return 'auth';
    }
    if (message.includes('phone') || message.includes('amount') || message.includes('invalid')) {
      return 'validation';
    }
    
    return 'unknown';
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ error, errorInfo });
    
    const errorId = errorReporter.reportError(error, {
      componentStack: errorInfo.componentStack,
      context: 'mpesa-payment',
      errorCategory: this.state.errorCategory,
      errorBoundary: true
    });
    
    logger.error(`MpesaErrorBoundary caught error (ID: ${errorId})`, error, {
      errorInfo,
      category: this.state.errorCategory
    });
  }

  private handleRetry = () => {
    this.setState({ hasError: false, error: null, errorInfo: null, errorCategory: 'unknown' });
    this.props.onRetry?.();
  };

  private getErrorGuidance = (): { title: string; description: string; actions: string[] } => {
    const { errorCategory } = this.state;
    
    switch (errorCategory) {
      case 'network':
        return {
          title: "Connection Issue",
          description: "Unable to connect to M-Pesa services. This might be due to network issues or service unavailability.",
          actions: [
            "Check your internet connection",
            "Try again in a few moments",
            "Contact support if the issue persists"
          ]
        };
      
      case 'config':
        return {
          title: "Configuration Error",
          description: "M-Pesa payment is not properly configured. This is typically a setup issue.",
          actions: [
            "Contact your landlord to enable M-Pesa payments",
            "Use alternative payment methods",
            "Contact support for assistance"
          ]
        };
      
      case 'auth':
        return {
          title: "Authentication Error",
          description: "Your session has expired or authentication failed.",
          actions: [
            "Log out and log back in",
            "Clear your browser cache and try again",
            "Contact support if the issue persists"
          ]
        };
      
      case 'validation':
        return {
          title: "Invalid Payment Details",
          description: "The payment information provided is not valid.",
          actions: [
            "Check your phone number format (e.g., 0712345678)",
            "Verify the payment amount",
            "Ensure all required fields are filled"
          ]
        };
      
      default:
        return {
          title: "Payment Error",
          description: "An unexpected error occurred while processing your M-Pesa payment.",
          actions: [
            "Try again after a few moments",
            "Use an alternative payment method",
            "Contact support with error details"
          ]
        };
    }
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const { error } = this.state;
      const guidance = this.getErrorGuidance();

      return (
        <div className="p-4">
          <Card className="border-destructive/20">
            <CardHeader className="text-center">
              <div className="flex justify-center mb-4">
                <div className="p-3 bg-destructive/10 rounded-full">
                  <AlertTriangle className="h-8 w-8 text-destructive" />
                </div>
              </div>
              <CardTitle className="text-destructive flex items-center justify-center gap-2">
                <Smartphone className="h-5 w-5" />
                {guidance.title}
              </CardTitle>
              <CardDescription>
                {guidance.description}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert>
                <HelpCircle className="h-4 w-4" />
                <AlertDescription>
                  <strong className="block mb-2">What you can do:</strong>
                  <ul className="list-disc list-inside space-y-1 text-sm">
                    {guidance.actions.map((action, index) => (
                      <li key={index}>{action}</li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>

              {process.env.NODE_ENV === "development" && error && (
                <Alert className="border-warning/20 bg-warning/5">
                  <AlertDescription className="font-mono text-xs">
                    <strong>Error:</strong> {error.message}
                    {error.stack && (
                      <details className="mt-2">
                        <summary className="cursor-pointer text-warning hover:text-warning/80">
                          View stack trace
                        </summary>
                        <pre className="mt-2 text-xs bg-muted p-2 rounded overflow-auto max-h-40">
                          {error.stack}
                        </pre>
                      </details>
                    )}
                  </AlertDescription>
                </Alert>
              )}

              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Button
                  onClick={this.handleRetry}
                  variant="outline"
                  className="flex items-center gap-2"
                >
                  <RefreshCw className="h-4 w-4" />
                  Try Again
                </Button>
              </div>

              <div className="text-center text-sm text-muted-foreground">
                Need help? Contact support with error ID: {error?.message.substring(0, 8)}
              </div>
            </CardContent>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}
