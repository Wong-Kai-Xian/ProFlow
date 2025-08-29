// Centralized Google OAuth (GIS) helpers for Gmail and Drive
// - Silent auth with prompt: 'none' for background checks
// - Interactive consent with prompt: 'consent' only on explicit user action
// - Caches tokens in-memory for the session and sets localStorage authorization flags

const GIS_SRC = 'https://accounts.google.com/gsi/client';

export const GMAIL_SCOPES_READONLY = 'https://www.googleapis.com/auth/gmail.readonly';
export const GMAIL_SCOPES_SEND = 'https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/gmail.send';
export const DRIVE_SCOPES = 'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/drive.readonly';

function getClientId() {
  try {
    return localStorage.getItem('google_oauth_client_id') || '';
  } catch {
    return '';
  }
}

export async function loadGIS() {
  return await new Promise((resolve, reject) => {
    if (typeof window !== 'undefined' && window.google && window.google.accounts && window.google.accounts.oauth2) {
      resolve();
      return;
    }
    if (document.querySelector(`script[src="${GIS_SRC}"]`)) {
      // Script already requested; wait a tick for it to initialize
      const ready = () => (window.google && window.google.accounts && window.google.accounts.oauth2);
      const iv = setInterval(() => { if (ready()) { clearInterval(iv); resolve(); } }, 50);
      setTimeout(() => { try { clearInterval(iv); } catch {} resolve(); }, 1500);
      return;
    }
    const s = document.createElement('script');
    s.src = GIS_SRC;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('Failed to load Google Identity Services'));
    document.head.appendChild(s);
  });
}

function getServiceFromScopes(scopes) {
  const s = String(scopes || '').toLowerCase();
  if (s.includes('gmail')) return 'gmail';
  if (s.includes('drive')) return 'drive';
  return 'other';
}

function setAuthorizedFlag(service, value) {
  try { localStorage.setItem(`${service}_authorized`, value ? '1' : '0'); } catch {}
}

export function isAuthorized(service) {
  try { return localStorage.getItem(`${service}_authorized`) === '1'; } catch { return false; }
}

function getTokenCache() {
  if (typeof window === 'undefined') return {};
  if (!window.__proflow_google_tokens) window.__proflow_google_tokens = {};
  return window.__proflow_google_tokens;
}

function cacheToken(service, scopes, token) {
  try {
    const key = `${service}:${scopes}`;
    const store = getTokenCache();
    store[key] = { token, ts: Date.now() };
  } catch {}
}

function getCachedToken(service, scopes) {
  try {
    const key = `${service}:${scopes}`;
    const store = getTokenCache();
    const entry = store[key];
    if (entry && typeof entry.token === 'string' && entry.token.length > 0) return entry.token;
  } catch {}
  return '';
}

async function requestTokenInternal({ scopes, prompt }) {
  const clientId = getClientId();
  if (!clientId) return '';
  await loadGIS();
  return await new Promise((resolve) => {
    try {
      const tokenClient = window.google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: scopes,
        prompt,
        callback: (resp) => resolve(resp?.access_token || '')
      });
      tokenClient.requestAccessToken({ prompt });
    } catch { resolve(''); }
  });
}

export async function ensureTokenFor(scopes) {
  const service = getServiceFromScopes(scopes);
  const cached = getCachedToken(service, scopes);
  if (cached) return cached;
  const token = await requestTokenInternal({ scopes, prompt: 'none' });
  if (token) {
    cacheToken(service, scopes, token);
  }
  return token;
}

export async function requestConsentFor(scopes) {
  const service = getServiceFromScopes(scopes);
  const token = await requestTokenInternal({ scopes, prompt: 'consent' });
  if (token) {
    cacheToken(service, scopes, token);
    setAuthorizedFlag(service, true);
  }
  return token;
}

// Convenience wrappers
export async function ensureGmailReadonlyToken() {
  return await ensureTokenFor(GMAIL_SCOPES_READONLY);
}

export async function ensureGmailSendToken() {
  return await ensureTokenFor(GMAIL_SCOPES_SEND);
}

export async function requestGmailConsent(readWrite = false) {
  const scopes = readWrite ? GMAIL_SCOPES_SEND : GMAIL_SCOPES_READONLY;
  return await requestConsentFor(scopes);
}

export async function ensureDriveToken() {
  return await ensureTokenFor(DRIVE_SCOPES);
}

export async function requestDriveConsent() {
  return await requestConsentFor(DRIVE_SCOPES);
}


