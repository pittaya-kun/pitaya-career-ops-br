// @ts-check
/**
 * 99jobs Provider for career-ops
 * 99jobs (99jobs.com) is a Brazilian job board focused on tech/startups.
 * Attempts to use their GraphQL/REST API.
 *
 * Usage in portals.yml (job_boards):
 *   - provider: 99jobs
 *     99jobs:
 *       keywords: ["Desenvolvedor", "Product Manager", "Data Scientist", "Designer"]
 *       since_days: 14
 *       location: "São Paulo"
 *     enabled: true
 */

import { fetchJsonWithRetry } from './_http.mjs';

/** @typedef {import('./_types.js').Provider} Provider */

const JOBS99_HOST = '99jobs.com';
const API_BASE = 'https://99jobs.com/api/v1'; // May need adjustment based on actual API
const GRAPHQL_URL = 'https://99jobs.com/graphql';

const DEFAULT_MAX_PAGES = 5;
const PER_PAGE = 20;

function detect(entry) {
  if (entry?.provider === '99jobs') return { url: API_BASE };
  for (const candidate of [entry?.careers_url, entry?.api]) {
    if (typeof candidate !== 'string' || !candidate) continue;
    try {
      const parsed = new URL(candidate);
      if (parsed.protocol === 'https:' && parsed.hostname === JOBS99_HOST) {
        return { url: candidate };
      }
    } catch {
      // not a URL
    }
  }
  return null;
}

async function fetch(entry, ctx) {
  const cfg = entry?.['99jobs'] || entry?.jobs99 || {};
  const keywords = Array.isArray(cfg.keywords) ? cfg.keywords.filter(k => typeof k === 'string' && k.trim()).map(k => k.trim()) : [];
  const location = typeof cfg.location === 'string' ? cfg.location.trim() : '';
  const sinceDays = Number.isInteger(cfg.since_days) && cfg.since_days > 0 ? cfg.since_days : 14;
  const maxPages = entry?.max_pages && Number.isInteger(entry.max_pages) && entry.max_pages > 0
    ? Math.min(entry.max_pages, 20)
    : DEFAULT_MAX_PAGES;

  const cutoffMs = sinceDaysToCutoffMs(sinceDays);
  const seen = new Set();
  const out = [];

  // Try REST API first
  if (keywords.length > 0) {
    for (const keyword of keywords) {
      for (let page = 1; page <= maxPages; page++) {
        const params = new URLSearchParams({
          q: keyword,
          page: String(page),
          per_page: String(PER_PAGE),
        });
        if (location) params.set('location', location);

        const url = `${API_BASE}/jobs?${params}`;

        let json;
        try {
          json = await fetchJsonWithRetry(ctx, url, { redirect: 'error' });
        } catch (err) {
          // REST API might not exist, try GraphQL
          console.error(`⚠️  99jobs: REST API fetch failed for "${keyword}" page ${page}: ${err?.message || String(err)}`);
          break;
        }

        const rows = json?.data || json?.jobs || json?.results || json?.items || [];
        if (!Array.isArray(rows) || rows.length === 0) break;

        let pageHasNew = false;
        for (const raw of rows) {
          const normalized = normalize99JobsJob(raw);
          if (!normalized) continue;
          if (seen.has(normalized.url)) continue;

          if (cutoffMs && typeof normalized.postedAt === 'number' && normalized.postedAt < cutoffMs) {
            continue;
          }

          seen.add(normalized.url);
          out.push(normalized);
          pageHasNew = true;
        }

        if (!pageHasNew) break;
        if (rows.length < PER_PAGE) break;
      }
    }
  }

  // If REST API failed, try GraphQL
  if (out.length === 0 && keywords.length > 0) {
    for (const keyword of keywords) {
      const gqlJobs = await fetchGraphQL(keyword, location, maxPages, cutoffMs, ctx);
      for (const job of gqlJobs) {
        if (!seen.has(job.url)) {
          seen.add(job.url);
          out.push(job);
        }
      }
    }
  }

  return out;
}

function sinceDaysToCutoffMs(days) {
  const d = new Date(Date.now() - days * 86_400_000);
  if (Number.isNaN(d.getTime())) return null;
  return Date.parse(`${d.toISOString().slice(0, 10)}T00:00:00Z`);
}

async function fetchGraphQL(keyword, location, maxPages, cutoffMs, ctx) {
  const query = `
    query SearchJobs($query: String!, $location: String, $page: Int!, $perPage: Int!) {
      jobs(search: $query, location: $location, page: $page, perPage: $perPage) {
        data {
          id
          title
          url
          company { name }
          city
          state
          country
          workplaceType
          jobType
          publishedAt
          description
        }
        pageInfo { hasNextPage }
      }
    }
  `;

  const jobs = [];
  for (let page = 1; page <= maxPages; page++) {
    const variables = { query: keyword, location, page, perPage: PER_PAGE };

    let json;
    try {
      json = await fetchJsonWithRetry(ctx, GRAPHQL_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, variables }),
        redirect: 'error',
      });
    } catch (err) {
      console.error(`⚠️  99jobs: GraphQL fetch failed for "${keyword}" page ${page}: ${err?.message || String(err)}`);
      break;
    }

    const data = json?.data?.jobs?.data;
    if (!Array.isArray(data) || data.length === 0) break;

    let pageHasNew = false;
    for (const raw of data) {
      const normalized = normalize99JobsGraphQLJob(raw);
      if (!normalized) continue;

      if (cutoffMs && typeof normalized.postedAt === 'number' && normalized.postedAt < cutoffMs) {
        continue;
      }

      jobs.push(normalized);
      pageHasNew = true;
    }

    const hasNext = json?.data?.jobs?.pageInfo?.hasNextPage === true;
    if (!pageHasNew || !hasNext) break;
  }

  return jobs;
}

function normalize99JobsJob(raw) {
  if (!raw || typeof raw !== 'object') return null;

  const title = typeof raw.title === 'string' ? raw.title.trim()
    : typeof raw.name === 'string' ? raw.name.trim()
    : '';
  if (!title) return null;

  const rawUrl = typeof raw.url === 'string' ? raw.url.trim()
    : typeof raw.link === 'string' ? raw.link.trim()
    : typeof raw.apply_url === 'string' ? raw.apply_url.trim()
    : '';
  if (!rawUrl) return null;

  let url = rawUrl;
  if (!url.startsWith('http')) {
    try {
      url = new URL(rawUrl, 'https://99jobs.com').href;
    } catch {
      return null;
    }
  }

  const company = typeof raw.company === 'string' ? raw.company.trim()
    : typeof raw.company_name === 'string' ? raw.company_name.trim()
    : (raw.company && typeof raw.company === 'object' && raw.company.name) ? String(raw.company.name).trim()
    : '';

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
  const location = locationParts.join(', ') || 'Brasil';

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
  if (typeof raw.job_type === 'string') {
    const t = raw.job_type.trim().toLowerCase();
    if (['full-time', 'part-time', 'contract', 'temporary', 'internship'].includes(t)) jobType = t;
    else if (t === 'clt' || t === 'efetivo') jobType = 'full-time';
    else if (t === 'pj') jobType = 'contract';
    else if (t === 'estágio' || t === 'estagio') jobType = 'internship';
  } else if (typeof raw.type === 'string') {
    const t = raw.type.trim().toLowerCase();
    if (['full-time', 'part-time', 'contract', 'temporary', 'internship'].includes(t)) jobType = t;
    else if (t === 'clt' || t === 'efetivo') jobType = 'full-time';
    else if (t === 'pj') jobType = 'contract';
    else if (t === 'estágio' || t === 'estagio') jobType = 'internship';
  }

  return {
    title,
    url,
    company,
    location,
    postedAt,
    workplaceType,
    jobType,
    description: typeof raw.description === 'string' && raw.description.trim() ? raw.description.trim() : undefined,
  };
}

function normalize99JobsGraphQLJob(raw) {
  if (!raw || typeof raw !== 'object') return null;

  const title = typeof raw.title === 'string' ? raw.title.trim() : '';
  if (!title) return null;

  const rawUrl = typeof raw.url === 'string' ? raw.url.trim() : '';
  if (!rawUrl) return null;

  let url = rawUrl;
  if (!url.startsWith('http')) {
    try {
      url = new URL(rawUrl, 'https://99jobs.com').href;
    } catch {
      return null;
    }
  }

  const company = raw.company && typeof raw.company === 'object' && raw.company.name
    ? String(raw.company.name).trim()
    : '';

  const locationParts = [];
  if (typeof raw.city === 'string' && raw.city.trim()) locationParts.push(raw.city.trim());
  if (typeof raw.state === 'string' && raw.state.trim()) locationParts.push(raw.state.trim());
  if (typeof raw.country === 'string' && raw.country.trim()) locationParts.push(raw.country.trim());
  if (typeof raw.workplaceType === 'string' && raw.workplaceType.trim()) {
    const type = raw.workplaceType.trim().toLowerCase();
    const label = { remote: 'Remoto', hybrid: 'Híbrido', 'on-site': 'Presencial' }[type] || type;
    locationParts.unshift(label);
  }
  const location = locationParts.join(', ') || 'Brasil';

  let postedAt = null;
  if (typeof raw.publishedAt === 'string' && raw.publishedAt.trim()) {
    const ms = Date.parse(raw.publishedAt);
    if (!Number.isNaN(ms) && ms > 0) postedAt = ms;
  }

  let workplaceType = null;
  if (typeof raw.workplaceType === 'string') {
    const t = raw.workplaceType.trim().toLowerCase();
    if (['remote', 'hybrid', 'on-site'].includes(t)) workplaceType = t;
  }

  let jobType = null;
  if (typeof raw.jobType === 'string') {
    const t = raw.jobType.trim().toLowerCase();
    if (['full-time', 'part-time', 'contract', 'temporary', 'internship'].includes(t)) jobType = t;
    else if (t === 'clt' || t === 'efetivo') jobType = 'full-time';
    else if (t === 'pj') jobType = 'contract';
    else if (t === 'estágio' || t === 'estagio') jobType = 'internship';
  }

  return {
    title,
    url,
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
  id: '99jobs',
  detect,
  fetch,
};