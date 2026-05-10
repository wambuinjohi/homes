/**
 * Comprehensive security validation utilities
 */

import { sanitizeHtmlStrict, sanitizeForDatabase } from './enhancedXssProtection';

// Input validation patterns
export const VALIDATION_PATTERNS = {
  email: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
  phone: /^(\+?254|0)?[17]\d{8}$/,
  amount: /^\d+(\.\d{1,2})?$/,
  uuid: /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
  alphanumeric: /^[a-zA-Z0-9\s]+$/,
  numeric: /^\d+$/
};

// Rate limiting store (in-memory for demo, use Redis in production)
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

/**
 * Validate and sanitize form input
 */
export const validateFormInput = (input: any, rules: ValidationRules): ValidationResult => {
  const errors: Record<string, string> = {};
  const sanitized: Record<string, any> = {};

  for (const [field, fieldRules] of Object.entries(rules)) {
    const value = input[field];
    
    // Required field validation
    if (fieldRules.required && (!value || (typeof value === 'string' && !value.trim()))) {
      errors[field] = `${field} is required`;
      continue;
    }

    if (value === undefined || value === null) {
      sanitized[field] = value;
      continue;
    }

    let sanitizedValue = value;

    // Type validation and sanitization
    switch (fieldRules.type) {
      case 'email':
        if (typeof value === 'string') {
          sanitizedValue = value.toLowerCase().trim();
          if (!VALIDATION_PATTERNS.email.test(sanitizedValue)) {
            errors[field] = 'Invalid email format';
          }
        } else {
          errors[field] = 'Email must be a string';
        }
        break;

      case 'phone':
        if (typeof value === 'string') {
          sanitizedValue = value.replace(/\s/g, '');
          if (!VALIDATION_PATTERNS.phone.test(sanitizedValue)) {
            errors[field] = 'Invalid phone number format';
          }
        } else {
          errors[field] = 'Phone must be a string';
        }
        break;

      case 'amount':
        if (typeof value === 'number' || typeof value === 'string') {
          const numValue = typeof value === 'string' ? parseFloat(value) : value;
          if (isNaN(numValue) || numValue < 0) {
            errors[field] = 'Invalid amount';
          } else {
            sanitizedValue = numValue;
          }
        } else {
          errors[field] = 'Amount must be a number';
        }
        break;

      case 'text':
        if (typeof value === 'string') {
          sanitizedValue = sanitizeForDatabase(value.trim());
          if (fieldRules.maxLength && sanitizedValue.length > fieldRules.maxLength) {
            errors[field] = `${field} must be less than ${fieldRules.maxLength} characters`;
          }
        } else {
          errors[field] = `${field} must be a string`;
        }
        break;

      case 'html':
        if (typeof value === 'string') {
          sanitizedValue = sanitizeHtmlStrict(value);
        } else {
          errors[field] = `${field} must be a string`;
        }
        break;

      case 'uuid':
        if (typeof value === 'string') {
          if (!VALIDATION_PATTERNS.uuid.test(value)) {
            errors[field] = 'Invalid UUID format';
          }
        } else {
          errors[field] = 'UUID must be a string';
        }
        break;
    }

    sanitized[field] = sanitizedValue;
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
    sanitized
  };
};

/**
 * Rate limiting check
 */
export const checkRateLimit = (
  key: string, 
  limit: number = 10, 
  windowMs: number = 60000
): { allowed: boolean; remainingRequests: number; resetTime: number } => {
  const now = Date.now();
  const record = rateLimitStore.get(key);

  if (!record || now > record.resetTime) {
    // Create new record or reset expired one
    const newRecord = { count: 1, resetTime: now + windowMs };
    rateLimitStore.set(key, newRecord);
    return { allowed: true, remainingRequests: limit - 1, resetTime: newRecord.resetTime };
  }

  if (record.count >= limit) {
    return { allowed: false, remainingRequests: 0, resetTime: record.resetTime };
  }

  record.count++;
  rateLimitStore.set(key, record);
  return { allowed: true, remainingRequests: limit - record.count, resetTime: record.resetTime };
};

/**
 * CSRF token validation
 */
export const validateCSRFToken = (token: string, expectedToken: string): boolean => {
  if (!token || !expectedToken) return false;
  return token === expectedToken;
};

/**
 * File upload security validation
 */
export const validateFileUpload = (file: File): { valid: boolean; error?: string } => {
  const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
  const ALLOWED_TYPES = [
    'image/jpeg', 'image/png', 'image/gif', 'image/webp',
    'application/pdf', 'text/plain', 'text/csv',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel'
  ];

  if (file.size > MAX_FILE_SIZE) {
    return { valid: false, error: 'File size exceeds 10MB limit' };
  }

  if (!ALLOWED_TYPES.includes(file.type)) {
    return { valid: false, error: 'File type not allowed' };
  }

  // Check file extension matches MIME type
  const extension = file.name.toLowerCase().split('.').pop();
  const mimeTypeMap: Record<string, string[]> = {
    'image/jpeg': ['jpg', 'jpeg'],
    'image/png': ['png'],
    'image/gif': ['gif'],
    'image/webp': ['webp'],
    'application/pdf': ['pdf'],
    'text/plain': ['txt'],
    'text/csv': ['csv'],
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['xlsx'],
    'application/vnd.ms-excel': ['xls']
  };

  const allowedExtensions = mimeTypeMap[file.type];
  if (!extension || !allowedExtensions?.includes(extension)) {
    return { valid: false, error: 'File extension does not match file type' };
  }

  return { valid: true };
};

// Type definitions
export interface ValidationRules {
  [field: string]: {
    type: 'email' | 'phone' | 'amount' | 'text' | 'html' | 'uuid';
    required?: boolean;
    maxLength?: number;
  };
}

export interface ValidationResult {
  isValid: boolean;
  errors: Record<string, string>;
  sanitized: Record<string, any>;
}