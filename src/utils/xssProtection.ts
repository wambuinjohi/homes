/**
 * XSS Protection utilities using DOMPurify
 */
import DOMPurify from 'dompurify';

/**
 * Sanitize HTML content to prevent XSS attacks
 */
export const sanitizeHtml = (html: string): string => {
  const purified = DOMPurify.sanitize(html, {
    // Allow common HTML elements but sanitize dangerous content
    ALLOWED_TAGS: [
      'p', 'br', 'strong', 'em', 'u', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'ul', 'ol', 'li', 'a', 'img', 'code', 'pre', 'blockquote', 'div', 'span'
    ],
    ALLOWED_ATTR: ['href', 'src', 'alt', 'title', 'class', 'id', 'rel', 'target'],
    // SECURITY FIX: Force safe link attributes
    ADD_ATTR: ['target', 'rel'],
    FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover', 'onmouseout', 'onfocus', 'onblur'],
    // Remove any scripts or dangerous elements
    FORBID_TAGS: ['script', 'object', 'embed', 'form', 'input', 'textarea', 'select', 'iframe', 'frame'],
    // Ensure links open safely
    SANITIZE_DOM: true
  });

  // SECURITY FIX: Post-process to ensure all links are safe
  const div = document.createElement('div');
  div.innerHTML = purified;
  const links = div.querySelectorAll('a');
  links.forEach(link => {
    link.setAttribute('target', '_blank');
    link.setAttribute('rel', 'noopener noreferrer');
  });
  
  return div.innerHTML;
};

/**
 * Sanitize text content for safe display
 */
export const sanitizeText = (text: string): string => {
  return DOMPurify.sanitize(text, { ALLOWED_TAGS: [], ALLOWED_ATTR: [] });
};

/**
 * Sanitize markdown-style content for preview
 */
export const sanitizeMarkdown = (markdown: string): string => {
  // First convert basic markdown to HTML
  let html = markdown
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/`(.*?)`/g, '<code>$1</code>')
    .replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')
    .replace(/!\[(.*?)\]\((.*?)\)/g, '<img src="$2" alt="$1" style="max-width: 100%; height: auto;" />')
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    .replace(/\n/g, '<br>');
  
  // Wrap list items
  html = html.replace(/(<li>.*<\/li>)/g, '<ul>$1</ul>');
  
  // Sanitize the result
  return sanitizeHtml(html);
};

/**
 * Create safe props for dangerouslySetInnerHTML
 */
export const createSafeHtml = (html: string) => ({
  __html: sanitizeHtml(html)
});