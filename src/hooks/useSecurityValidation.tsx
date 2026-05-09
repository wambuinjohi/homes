import { useCallback } from 'react';
import { validateFormInput, checkRateLimit, type ValidationRules, type ValidationResult } from '@/utils/securityValidation';
import { toast } from 'sonner';

export const useSecurityValidation = () => {
  const validateInput = useCallback((input: any, rules: ValidationRules): ValidationResult => {
    return validateFormInput(input, rules);
  }, []);

  const checkLimit = useCallback((key: string, limit: number = 10, windowMs: number = 60000) => {
    const result = checkRateLimit(key, limit, windowMs);
    
    if (!result.allowed) {
      toast.error('Too many requests. Please wait before trying again.');
    }
    
    return result;
  }, []);

  const validateAndSubmit = useCallback(async (
    input: any,
    rules: ValidationRules,
    submitFn: (sanitizedData: any) => Promise<void>,
    options?: {
      rateLimitKey?: string;
      rateLimitCount?: number;
      rateLimitWindow?: number;
    }
  ) => {
    // Rate limiting check
    if (options?.rateLimitKey) {
      const rateLimit = checkLimit(
        options.rateLimitKey,
        options.rateLimitCount,
        options.rateLimitWindow
      );
      if (!rateLimit.allowed) {
        return { success: false, error: 'Rate limit exceeded' };
      }
    }

    // Input validation
    const validation = validateInput(input, rules);
    if (!validation.isValid) {
      const firstError = Object.values(validation.errors)[0];
      toast.error(firstError);
      return { success: false, errors: validation.errors };
    }

    try {
      await submitFn(validation.sanitized);
      return { success: true };
    } catch (error: any) {
      toast.error(error.message || 'An error occurred');
      return { success: false, error: error.message };
    }
  }, [validateInput, checkLimit]);

  return {
    validateInput,
    checkRateLimit: checkLimit,
    validateAndSubmit
  };
};