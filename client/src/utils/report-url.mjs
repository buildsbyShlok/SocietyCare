export function reportUrl(token, configuredOrigin, browserOrigin, production) {
  const message = 'Set VITE_PUBLIC_FRONTEND_URL to the public HTTPS frontend origin and rebuild the client.';
  let url;
  try {
    url = new URL(configuredOrigin || (production ? '' : browserOrigin));
  } catch {
    throw new Error(message);
  }
  const host = url.hostname.toLowerCase().replace(/\.$/, '');
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password ||
      url.pathname !== '/' || url.search || url.hash ||
      (production && (url.protocol !== 'https:' || !host.includes('.') ||
        host.endsWith('.localhost') || host.endsWith('.local') || /^[0-9.]+$/.test(host)))) {
    throw new Error(message);
  }
  return new URL('/report/' + encodeURIComponent(token), url.origin).href;
}
