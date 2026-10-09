import React, { useEffect, useRef } from 'react';

const SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
const LOCAL_TEST_SITE_KEY = '1x00000000000000000000AA';
let scriptPromise;

function loadTurnstile() {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${SCRIPT_SRC}"]`);
    if (existing) {
      existing.addEventListener('load', () => resolve(window.turnstile), { once: true });
      existing.addEventListener('error', reject, { once: true });
      return;
    }
    const script = document.createElement('script');
    script.src = SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => window.turnstile ? resolve(window.turnstile) : reject(new Error('Turnstile unavailable'));
    script.onerror = () => reject(new Error('Turnstile unavailable'));
    document.head.appendChild(script);
  });
  return scriptPromise;
}

export default function TurnstileWidget({ onToken, onError, action, resetKey = 0 }) {
  const containerRef = useRef(null);
  const widgetRef = useRef(null);
  const onTokenRef = useRef(onToken);
  const onErrorRef = useRef(onError);
  const configuredSiteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY;
  const isLocalhost = ['localhost', '127.0.0.1'].includes(window.location.hostname);
  const siteKey = configuredSiteKey && !/^your[_-].*site[_-]?key$/i.test(configuredSiteKey)
    ? configuredSiteKey
    : (isLocalhost ? LOCAL_TEST_SITE_KEY : '');

  useEffect(() => { onTokenRef.current = onToken; }, [onToken]);
  useEffect(() => { onErrorRef.current = onError; }, [onError]);

  useEffect(() => {
    let mounted = true;
    if (!siteKey || !containerRef.current) {
      onErrorRef.current?.('Security verification is not configured.');
      return undefined;
    }
    onTokenRef.current?.('');
    loadTurnstile().then(turnstile => {
      if (!mounted || !containerRef.current) return;
      try {
        widgetRef.current = turnstile.render(containerRef.current, {
          sitekey: siteKey,
          action,
          callback: token => onTokenRef.current?.(token),
          'expired-callback': () => onTokenRef.current?.(''),
          'error-callback': () => { onTokenRef.current?.(''); onErrorRef.current?.('Security verification failed. Please try again.'); },
          theme: 'light',
        });
      } catch {
        onErrorRef.current?.('Security verification could not be loaded. Please refresh and try again.');
      }
    }).catch(() => {
      if (mounted) onErrorRef.current?.('Security verification is unavailable. Please try again.');
    });
    return () => {
      mounted = false;
      if (widgetRef.current !== null && window.turnstile) window.turnstile.remove(widgetRef.current);
      widgetRef.current = null;
    };
  }, [action, resetKey, siteKey]);

  return <div ref={containerRef} aria-live="polite" />;
}
