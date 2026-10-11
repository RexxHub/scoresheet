import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';

const LS = 'caportal_supabase';
const clean = (v) => String(v || '').trim().replace(/^['"]|['"]$/g, '').replace(/\/+$/, '');
const looksFake = (v) => /your[-_ ]?(project|anon)|placeholder|xxxx/i.test(v);

// Returns '' when the values look right, otherwise a plain-language problem.
export const checkValues = (rawUrl, rawKey) => {
  const url = clean(rawUrl), key = clean(rawKey);
  if (!url || !key) return 'Enter both the Project URL and the anon public key.';
  if (looksFake(url) || looksFake(key)) return 'These are still the example values. Copy the real ones from Supabase > Project Settings > API.';
  if (!/^https:\/\/[^\s/]+\.[^\s/]+$/i.test(url)) return 'The Project URL must look like https://abcdefgh.supabase.co (nothing after the .co).';
  if (/dashboard/i.test(url)) return 'That is the dashboard link. Use the Project URL from Project Settings > API.';
  if (key.length < 30 || /\s/.test(key)) return 'The key looks incomplete. Copy the whole anon public key.';
  return '';
};

const stored = () => { try { return JSON.parse(localStorage.getItem(LS) || 'null') || {}; } catch (e) { return {}; } };
const pick = (...sets) => {
  for (const [u, k] of sets) { const url = clean(u), key = clean(k); if (url && key && !checkValues(url, key)) return { url, key }; }
  return null;
};

const envUrl = import.meta.env.VITE_SUPABASE_URL;
const envKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const cfg = pick([envUrl, envKey], [SUPABASE_URL, SUPABASE_ANON_KEY], [stored().url, stored().key]);

export const configured = Boolean(cfg);
export const supabase = cfg ? createClient(cfg.url, cfg.key) : null;
export const envIssue = (envUrl || envKey) ? checkValues(envUrl, envKey) : '';
export const hasStoredConfig = () => Boolean(stored().url);
export const saveConfig = (url, key) => localStorage.setItem(LS, JSON.stringify({ url: clean(url), key: clean(key) }));
export const clearConfig = () => localStorage.removeItem(LS);

// Calls Supabase once to prove the URL and key work. Returns '' on success.
export const testConnection = async (rawUrl, rawKey) => {
  const bad = checkValues(rawUrl, rawKey);
  if (bad) return bad;
  try {
    const r = await fetch(clean(rawUrl) + '/auth/v1/settings', { headers: { apikey: clean(rawKey) } });
    if (r.status === 401 || r.status === 403) return 'Supabase rejected this key. Copy the anon public key again (not service_role).';
    if (!r.ok) return 'Supabase answered with error ' + r.status + '. Check the Project URL.';
    return '';
  } catch (e) {
    return 'Cannot reach this address. Check the Project URL, your internet, and that the project is not paused in the Supabase dashboard.';
  }
};
