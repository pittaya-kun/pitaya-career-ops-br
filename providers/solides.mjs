// @ts-check
/**
 * Sólides ATS Provider for career-ops
 * Sólides is a Brazilian HR Tech/ATS platform.
 * Detects *.solides.jobs or *.solides.com.br career pages.
 *
 * Usage in portals.yml (tracked_companies):
 *   - name: "Empresa Exemplo"
 *     careers_url: "https://empresa.solides.jobs"
 *     provider: solides
 *     enabled: true
 */

import { fetchJsonWithRetry } from './_http.mjs';

/** @typedef {import('./_types.js').Provider} Provider */

const SOLIDES_HOST_PATTERN = /^https?:\/\/([^.]+)\.(?:solides\.jobs|solides\.com\.br)/;
// Common API paths for Sólides
const API_PATHS = [
  '/api/v1/jobs',
  '/api/v2/jobs',
  '/api/jobs',
  '/jobs/api/v1/jobs',
  '/api/public/jobs',
];

const DEFAULT_MAX_PAGES = 10;
const PER_PAGE = 50;

function detect(entry) {
  for (const url of [entry?.careers_url, entry?.api]) {
    if (!url) continue;
    const match = url.match(SOLIDES_HOST_PATTERN);
    if (match) {
      const tenant = match[1];
      for (const path of API_PATHS) {
        return { url: `https://${tenant}.solides.jobs${path}` };
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
      console.error(`⚠️  solides: fetch failed at page ${page + 1}: ${err?.message || String(err)}`);
      break;
    }

    const rows = json?.data || json?.jobs || json?.results || json?.items || [];
    if (!Array.isArray(rows) || rows.length === 0) break;

    let pageHasNew = false;
    for (const raw of rows) {
      const normalized = normalizeSolidesJob(raw, entry);
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

function normalizeSolidesJob(raw, entry) {
  if (!raw || typeof raw !== 'object') return null;

  const title = typeof raw.title === 'string' ? raw.title.trim()
    : typeof raw.name === 'string' ? raw.name.trim()
    : '';
  if (!title) return null;

  const rawUrl = typeof raw.url === 'string' ? raw.url.trim()
    : typeof raw.apply_url === 'string' ? raw.apply_url.trim()
    : typeof raw.job_url === 'string' ? raw.job_url.trim()
    : typeof raw.link === 'string' ? raw.link.trim()
    : '';
  if (!rawUrl) return null;

  try {
    const parsed = new URL(rawUrl);
    if (!parsed.hostname.includes('solides')) {
      // Might be relative URL
    }
  } catch {
    return null;
  }

  const company = typeof raw.company === 'string' ? raw.company.trim()
    : typeof raw.career_page_name === 'string' ? raw.career_page_name.trim()
    : entry?.name || '';

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

  let workplaceType = null;
  if (typeof raw.workplace_type === 'string') {
    const t = raw.workplace_type.trim().toLowerCase();
    if (['remote', 'hybrid', 'on-site'].includes(t)) workplaceType = t;
  } else if (raw.is_remote === true || raw.remote === true) {
    workplaceType = 'remote';
  }

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
  id: 'solides',
  detect,
  fetch,
};