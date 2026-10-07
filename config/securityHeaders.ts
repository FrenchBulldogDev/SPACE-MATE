const policy = (development: boolean) => [
  "default-src 'self'",
  "script-src 'self'" + (development ? " 'unsafe-inline'" : ''),
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self'",
  "img-src 'self' data: blob:",
  "connect-src 'self'" + (development ? ' ws://127.0.0.1:5173 ws://localhost:5173' : ''),
  "object-src 'none'",
  "base-uri 'self'",
  "frame-ancestors 'none'",
  "form-action 'none'",
].join('; ');

export function securityHeaders(development = false): Record<string, string> {
  return {
    'Content-Security-Policy': policy(development),
    'Referrer-Policy': 'no-referrer',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
  };
}
