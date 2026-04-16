/**
 * Logger utility for development debugging
 * 
 * Usage:
 *   import { createLogger } from '@/utils/logger';
 *   const log = createLogger('app:componentName');
 *   log('Message:', value);
 * 
 * Two separate controls for debugging:
 * 
 * 1. VITE_DEBUG_LOGS - Controls console log output (what you see in DevTools)
 *    Example: VITE_DEBUG_LOGS=app:* npm run dev    // All app logs
 *    Example: VITE_DEBUG_LOGS=app:store npm run dev // Only store logs
 *    Set to empty string or leave unset to disable logging
 * 
 * 2. VITE_SHOW_DEBUG_UI - Shows/hides debug UI tools (Debug Options panel in ToolPalette)
 *    Example: VITE_SHOW_DEBUG_UI=true npm run dev
 *    Shows: zoom controls, coordinate fixes, mask overlay options
 * 
 * Combine both:
 *    VITE_DEBUG_LOGS=app:* VITE_SHOW_DEBUG_UI=true npm run dev
 * 
 * Logs are automatically suppressed in production builds.
 */

// Simple namespace matching for wildcard patterns
function matchesPattern(namespace: string, pattern: string): boolean {
  if (!pattern) return false;
  
  // Handle wildcard patterns like "app:*" or "app:canvas,app:sam2"
  const patterns = pattern.split(',').map(p => p.trim());
  
  return patterns.some(p => {
    if (p.endsWith('*')) {
      // Wildcard pattern: match prefix
      const prefix = p.slice(0, -1);
      return namespace.startsWith(prefix);
    } else {
      // Exact match
      return namespace === p;
    }
  });
}

const debugPattern = import.meta.env.VITE_DEBUG_LOGS;

export const createLogger = (namespace: string) => {
  return function logger(...args: any[]) {
    // Check if this namespace should be logged
    if (!matchesPattern(namespace, debugPattern)) {
      return;
    }
    
    // Format the output with namespace and timestamp
    const timestamp = new Date().toLocaleTimeString('en-US', { 
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      fractionalSecondDigits: 3
    });
    
    console.log(`%c${namespace}%c [${timestamp}]`, 
      'color: #0099ff; font-weight: bold;',
      'color: #888;',
      ...args
    );
  };
};

// Pre-created loggers for common modules
export const loggers = {
  app: createLogger('app:main'),
  canvas: createLogger('app:canvas'),
  sam2: createLogger('app:sam2'),
  store: createLogger('app:store'),
  auth: createLogger('app:auth'),
  debug: createLogger('app:debug'),
  masks: createLogger('app:masks'),
  annotationRenderer: createLogger('app:annotationRenderer'),
  history: createLogger('app:history'),
  panoptes: createLogger('app:panoptes')
};
