// @ts-check
/**
 * Kenoby ATS Provider for career-ops
 * Kenoby is a Brazilian ATS (like Greenhouse/Lever) used by many companies.
 * Detects *.kenoby.com career pages and fetches jobs via their public API.
 *
 * Usage in portals.yml (tracked_companies):
 *   - name: "Empresa Exemplo"
 *     careers_url: "https://empresa.kenoby.com"
 *     provider: kenoby
 *     enabled: true
 *
 * Or auto-detected from careers_url pointing to *.kenoby.com
 */

import { fetchJsonWithRetry } from './_http.mjs';

/** @typedef {import('./_types.js').Provider} Provider */

const KENOBY_HOST_PATTERN = /^https?:\/\/([^.]+)\.kenoby\.com/;
// Common API paths seen on Kenoby career pages
const API_PATHS = [
  '/api/v1/jobs',
  '/api/v2/jobs',
  '/api/jobs',
  '/jobs/api/v1/jobs',
];

const DEFAULT_MAX_PAGES = 10;
const PER_PAGE = 50;

function detect(entry) {
  for (const url of [entry?.careers_url, entry?.api]) {
    if (!url) continue;
    const match = url.match(KENOBY_HOST_PATTERN);
    if (match) {
      const tenant = match[1];
      // Try each known API path
      for (const path of API_PATHS) {
        return { url: `https://${tenant}.kenoby.com${path}` };
      }
    }
  }
  return null;
}

async function fetch(entry, ctx) {
  const detected = detect(entry);
  if (!detected) return [];

  const baseUrl = detected.url;
  const maxPages = entry?.max_pages && Number.isInteger(entry.max_pages) && entry.max_pages > 0
    ? Math.min(entry.max_pages, 100)
    : DEFAULT_MAX_PAGES;

  const seen = new Set();
  const out = [];

  for (let page = 0; page < maxPages; page++) {
    const url = `${baseUrl}?page=${page + 1}&per_page=${PER_PAGE}`;

    let json;
    try {
      json = await fetchJsonWithRetry(ctx, url, { redirect: 'error' });
    } catch (err) {
      console.error(`⚠️  kenoby: fetch failed at page ${page + 1}: ${err?.message || String(err)}`);
      break;
    }

    const rows = json?.data || json?.jobs || json?.results || json?.items || [];
    if (!Array.isArray(rows) || rows.length === 0) break;

    let pageHasNew = false;
    for (const raw of rows) {
      const normalized = normalizeKenobyJob(raw, entry);
      if (!normalized) continue;
      if (seen.has(normalized.url)) continue;
      seen.add(normalized.url);
      out.push(normalized);
      pageHasNew = true;
    }

    if (!pageHasNew) break;
    if (rows.length < PER_PAGE) break;
  }

  return out;
}

function normalizeKenobyJob(raw, entry) {
  if (!raw || typeof raw !== 'object') return null;

  // Title
  const title = typeof raw.title === 'string' ? raw.title.trim()
    : typeof raw.name === 'string' ? raw.name.trim()
    : '';
  if (!title) return null;

  // URL - try multiple fields
  const rawUrl = typeof raw.url === 'string' ? raw.url.trim()
    : typeof raw.apply_url === 'string' ? raw.apply_url.trim()
    : typeof raw.job_url === 'string' ? raw.job_url.trim()
    : typeof raw.link === 'string' ? raw.link.trim()
    : '';
  if (!rawUrl) return null;

  // Validate URL is on kenoby domain
  try {
    const parsed = new URL(rawUrl);
    if (!parsed.hostname.endsWith('.kenoby.com') && parsed.hostname !== 'kenoby.com') {
      return null;
    }
  } catch {
    return null;
  }

  // Company - from entry or raw data
  const company = typeof raw.company === 'string' ? raw.company.trim()
    : typeof raw.career_page_name === 'string' ? raw.career_page_name.trim()
    : entry?.name || '';

  // Location
  const locationParts = [];
  if (typeof raw.city === 'string' && raw.city.trim()) locationParts.push(raw.city.trim());
  if (typeof raw.state === 'string' && raw.state.trim()) locationParts.push(raw.state.trim());
  if (typeof raw.country === 'string' && raw.country.trim()) locationParts.push(raw.country.trim());
  if (typeof raw.workplace_type === 'string' && raw.workplace_type.trim()) {
    const type = raw.workplace_type.trim().toLowerCase();
    const label = { remote: 'Remoto', hybrid: 'Híbrido', 'on-site': 'Presencial' }[type] || type;
    locationParts.unshift(label);
  } else if (raw.is_remote === true || raw.remote === true) {
    locationParts.unshift('Remoto');
  }
  const location = locationParts.join(', ');

  // Posted date
  let postedAt = null;
  for (const field of ['published_at', 'publishedAt', 'created_at', 'createdAt', 'date_posted', 'datePosted']) {
    if (typeof raw[field] === 'string' && raw[field].trim()) {
      const ms = Date.parse(raw[field]);
      if (!Number.isNaN(ms) && ms > 0) {
        postedAt = ms;
        break;
      }
    }
  }

  // Workplace type
  let workplaceType = null;
  if (typeof raw.workplace_type === 'string') {
    const t = raw.workplace_type.trim().toLowerCase();
    if (['remote', 'hybrid', 'on-site'].includes(t)) workplaceType = t;
  } else if (raw.is_remote === true || raw.remote === true) {
    workplaceType = 'remote';
  }

  // Job type
  let jobType = null;
  if (typeof raw.type === 'string') {
    const t = raw.type.trim().toLowerCase();
    if (['full-time', 'part-time', 'contract', 'temporary', 'internship'].includes(t)) jobType = t;
    else if (t === 'clt' || t === 'efetivo') jobType = 'full-time';
    else if (t === 'pj') jobType = 'contract';
    else if (t === 'estágio' || t === 'estagio') jobType = 'internship';
  }

  return {
    title,
    url: rawUrl,
    company,
    location,
    postedAt,
    workplaceType,
    jobType,
    description: typeof raw.description === 'string' && raw.description.trim() ? raw.description.trim() : undefined,
  };
}

/** @type {Provider} */
export default {
  id: 'kenoby',
  detect,
  fetch,
};