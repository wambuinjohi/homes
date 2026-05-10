export interface MpesaError {
  errorId?: string;
  error: string;
  userMessage: string;
  shouldRetry: boolean;
  requiresAction?: string;
}

export function parseMpesaError(error: any): MpesaError {
  console.log('🔍 Parsing M-Pesa error:', JSON.stringify(error, null, 2));
  
  let errorId = '';
  let errorMessage = 'Failed to initiate payment';
  
  // Try multiple extraction methods
  try {
    // Method 1: Supabase Functions context
    if (error.context?.body) {
      const body = typeof error.context.body === 'string' 
        ? JSON.parse(error.context.body) 
        : error.context.body;
      errorId = body.errorId || '';
      errorMessage = body.error || errorMessage;
    }
    
    // Method 2: Direct properties
    if (error.errorId) errorId = error.errorId;
    if (error.error) errorMessage = error.error;
    
    // Method 3: Parse from message
    if (error.message && error.message.includes('{')) {
      const parsed = JSON.parse(error.message.substring(error.message.indexOf('{')));
      errorId = parsed.errorId || errorId;
      errorMessage = parsed.error || errorMessage;
    }
  } catch (e) {
    console.error('Error parsing M-Pesa error:', e);
  }
  
  // Map to user-friendly messages
  const errorMap: Record<string, { message: string; action?: string; retry: boolean }> = {
    'AUTH_INVALID_JWT': {
      message: 'Your session has expired. Please log in again.',
      retry: false
    },
    'AUTH_NOT_AUTHORIZED': {
      message: 'You are not authorized to make this payment.',
      retry: false
    },
    'AUTH_INVOICE_NOT_FOUND': {
      message: 'Invoice not found. Please refresh the page and try again.',
      retry: true
    },
    'MPESA_CONFIG_MISSING': {
      message: 'M-Pesa payments are not set up for this property.',
      action: 'Please contact your landlord to enable M-Pesa payments.',
      retry: false
    },
    'MPESA_TOKEN_FAILED': {
      message: 'Failed to connect to M-Pesa payment gateway.',
      action: 'Please try again in a moment.',
      retry: true
    },
    'MPESA_INVALID_ACCESS_TOKEN': {
      message: 'Payment gateway credentials or environment are mismatched.',
      action: 'Please contact your landlord or admin to verify M-Pesa configuration (credentials, shortcode, passkey, and environment).',
      retry: false
    },
    'MPESA_STK_FAILED': {
      message: 'Failed to send payment request to your phone.',
      action: 'Please check your phone number and try again.',
      retry: true
    },
    'MPESA_ENCRYPTION_CONFIG_MISSING': {
      message: 'Server encryption not configured properly.',
      action: 'Please contact support.',
      retry: false
    },
    'MPESA_DECRYPTION_FAILED': {
      message: 'Failed to decrypt M-Pesa credentials.',
      action: 'The landlord may need to re-configure M-Pesa settings.',
      retry: false
    }
  };
  
  const mapped = errorMap[errorId] || {
    message: errorMessage,
    retry: true
  };
  
  return {
    errorId,
    error: errorMessage,
    userMessage: mapped.message,
    shouldRetry: mapped.retry,
    requiresAction: mapped.action
  };
}
