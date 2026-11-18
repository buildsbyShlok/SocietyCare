// Only QR report destinations are accepted; external and protocol-relative redirects are rejected.
export function safeReportReturn(value) {
  if (typeof value !== 'string' || value.length > 2048 || !value.startsWith('/') || value.startsWith('//') || /[\\\r\n]/.test(value)) return '/';
  try {
    const url = new URL(value, 'https://society-return.invalid');
    return url.origin === 'https://society-return.invalid' && /^\/report\/(?:asset\/)?[A-Za-z0-9_-]{43}$/.test(url.pathname) ? value : '/';
  } catch { return '/'; }
}
export function reportAuthPath(path, returnTo) {
  const destination = safeReportReturn(returnTo);
  return destination === '/' ? path : path + '?returnTo=' + encodeURIComponent(destination);
}
