import { sanitizeHtml, sanitizeText, sanitizeMarkdown, createSafeHtml } from './xssProtection';

/**
 * Standardized XSS protection utilities for the application
 * Use these instead of direct DOMPurify calls to ensure consistency
 */

export const XSSProtection = {
  /**
   * Sanitize HTML content for safe rendering
   * Use with dangerouslySetInnerHTML
   */
  html: (content: string) => createSafeHtml(content),
  
  /**
   * Sanitize plain text (removes all HTML)
   * Use for user input that should be displayed as text only
   */
  text: sanitizeText,
  
  /**
   * Sanitize markdown content
   * Converts markdown to safe HTML
   */
  markdown: sanitizeMarkdown,
  
  /**
   * Sanitize URLs to prevent javascript: and data: schemes
   */
  url: (url: string): string => {
    if (!url) return '';
    
    try {
      const parsed = new URL(url);
      // Only allow http, https, mailto, and tel protocols
      if (['http:', 'https:', 'mailto:', 'tel:'].includes(parsed.protocol)) {
        return url;
      }
      return '#';
    } catch {
      // If URL parsing fails, it's likely malformed
      return '#';
    }
  },
  
  /**
   * Sanitize CSS values to prevent CSS injection
   */
  css: (value: string): string => {
    if (!value) return '';
    
    // Remove potentially dangerous CSS constructs
    return value
      .replace(/javascript:/gi, '')
      .replace(/expression\s*\(/gi, '')
      .replace(/url\s*\(\s*javascript:/gi, '')
      .replace(/@import/gi, '')
      .replace(/binding:/gi, '');
  },
  
  /**
   * Sanitize HTML attributes
   */
  attribute: (value: string): string => {
    if (!value) return '';
    
    // Remove quotes and potential script injection
    return value
      .replace(/['"<>]/g, '')
      .replace(/javascript:/gi, '')
      .replace(/on\w+=/gi, '');
  }
};