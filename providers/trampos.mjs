// @ts-check
/**
 * Trampos Provider for career-ops
 * Trampos (trampos.co) is a Brazilian job board focused on tech/creative roles.
 * Checks for RSS feed or JSON API.
 *
 * Usage in portals.yml (job_boards):
 *   - provider: trampos
 *     trampos:
 *       keywords: ["Desenvolvedor", "Designer", "Product Manager", "Data Scientist"]
 *       since_days: 14
 *     enabled: true
 */

import { fetchJsonWithRetry, fetchTextWithRetry } from './_http.mjs';

/** @typedef {import('./_types.js').Provider} Provider */

const TRAMPOS_HOST = 'trampos.co';
const API_BASE = 'https://trampos.co/api/v1';
const RSS_URL = 'https://trampos.co/oportunidades.rss';

const DEFAULT_MAX_PAGES = 5;
const PER_PAGE = 50;

function detect(entry) {
  if (entry?.provider === 'trampos') return { url: API_BASE };
  for (const candidate of [entry?.careers_url, entry?.api]) {
    if (typeof candidate !== 'string' || !candidate) continue;
    try {
      const parsed = new URL(candidate);
      if (parsed.protocol === 'https:' && parsed.hostname === TRAMPOS_HOST) {
        return { url: candidate };
      }
    } catch {
      // not a URL
    }
  }
  return null;
}

async function fetch(entry, ctx) {
  const cfg = entry?.trampos || {};
  const keywords = Array.isArray(cfg.keywords) ? cfg.keywords.filter(k => typeof k === 'string' && k.trim()).map(k => k.trim()) : [];
  const sinceDays = Number.isInteger(cfg.since_days) && cfg.since_days > 0 ? cfg.since_days : 14;
  const maxPages = entry?.max_pages && Number.isInteger(entry.max_pages) && entry.max_pages > 0
    ? Math.min(entry.max_pages, 20)
    : DEFAULT_MAX_PAGES;

  const cutoffMs = sinceDaysToCutoffMs(sinceDays);
  const seen = new Set();
  const out = [];

  // Try JSON API first
  if (keywords.length > 0) {
    for (const keyword of keywords) {
      for (let page = 1; page <= maxPages; page++) {
        const url = `${API_BASE}/oportunidades?search=${encodeURIComponent(keyword)}&page=${page}&per_page=${PER_PAGE}`;

        let json;
        try {
          json = await fetchJsonWithRetry(ctx, url, { redirect: 'error' });
        } catch (err) {
          console.error(`⚠️  trampos: API fetch failed for "${keyword}" page ${page}: ${err?.message || String(err)}`);
          break;
        }

        const rows = json?.data || json?.oportunidades || json?.results || [];
        if (!Array.isArray(rows) || rows.length === 0) break;

        let pageHasNew = false;
        for (const raw of rows) {
          const normalized = normalizeTramposJob(raw);
          if (!normalized) continue;
          if (seen.has(normalized.url)) continue;

          // Filter by date if available
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

  // Fallback: Try RSS feed if no keywords or API failed
  if (out.length === 0) {
    try {
      const rssText = await fetchTextWithRetry(ctx, RSS_URL, { redirect: 'error' });
      const rssJobs = parseRSS(rssText, cutoffMs);
      for (const job of rssJobs) {
        if (!seen.has(job.url)) {
          seen.add(job.url);
          out.push(job);
        }
      }
    } catch (err) {
      console.error(`⚠️  trampos: RSS fetch failed: ${err?.message || String(err)}`);
    }
  }

  return out;
}

function sinceDaysToCutoffMs(days) {
  const d = new Date(Date.now() - days * 86_400_000);
  if (Number.isNaN(d.getTime())) return null;
  return Date.parse(`${d.toISOString().slice(0, 10)}T00:00:00Z`);
}

function normalizeTramposJob(raw) {
  if (!raw || typeof raw !== 'object') return null;

  const title = typeof raw.title === 'string' ? raw.title.trim()
    : typeof raw.nome === 'string' ? raw.nome.trim()
    : typeof raw.name === 'string' ? raw.name.trim()
    : '';
  if (!title) return null;

  const rawUrl = typeof raw.url === 'string' ? raw.url.trim()
    : typeof raw.link === 'string' ? raw.link.trim()
    : typeof raw.apply_url === 'string' ? raw.apply_url.trim()
    : '';
  if (!rawUrl) return null;

  // Ensure absolute URL
  let url = rawUrl;
  if (!url.startsWith('http')) {
    try {
      url = new URL(rawUrl, 'https://trampos.co').href;
    } catch {
      return null;
    }
  }

  const company = typeof raw.company === 'string' ? raw.company.trim()
    : typeof raw.empresa === 'string' ? raw.empresa.trim()
    : typeof raw.company_name === 'string' ? raw.company_name.trim()
    : '';

  const locationParts = [];
  if (typeof raw.city === 'string' && raw.city.trim()) locationParts.push(raw.city.trim());
  if (typeof raw.state === 'string' && raw.state.trim()) locationParts.push(raw.state.trim());
  if (typeof raw.remote === 'string' && raw.remote.trim()) locationParts.push(raw.remote.trim());
  else if (raw.is_remote === true || raw.remote === true) locationParts.push('Remoto');
  const location = locationParts.join(', ') || 'Brasil';

  let postedAt = null;
  for (const field of ['published_at', 'publishedAt', 'created_at', 'createdAt', 'date', 'data']) {
    if (typeof raw[field] === 'string' && raw[field].trim()) {
      const ms = Date.parse(raw[field]);
      if (!Number.isNaN(ms) && ms > 0) {
        postedAt = ms;
        break;
      }
    }
  }

  let workplaceType = null;
  if (raw.is_remote === true || raw.remote === true || (typeof raw.remote === 'string' && raw.remote.toLowerCase().includes('remoto'))) {
    workplaceType = 'remote';
  } else if (typeof raw.workplace_type === 'string') {
    const t = raw.workplace_type.trim().toLowerCase();
    if (['remote', 'hybrid', 'on-site'].includes(t)) workplaceType = t;
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
    url,
    company,
    location,
    postedAt,
    workplaceType,
    jobType,
    description: typeof raw.description === 'string' && raw.description.trim() ? raw.description.trim() : undefined,
  };
}

function parseRSS(xmlText, cutoffMs) {
  const jobs = [];
  try {
    // Simple RSS parsing - look for <item> elements
    const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
    let match;
    while ((match = itemRegex.exec(xmlText)) !== null) {
      const item = match[1];

      const titleMatch = item.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>|<title>(.*?)<\/title>/i);
      const linkMatch = item.match(/<link><!\[CDATA\[(.*?)\]\]><\/link>|<link>(.*?)<\/link>/i);
      const descMatch = item.match(/<description><!\[CDATA\[(.*?)\]\]><\/description>|<description>(.*?)<\/description>/i);
      const dateMatch = item.match(/<pubDate>(.*?)<\/pubDate>/i);

      const title = (titleMatch?.[1] || titleMatch?.[2] || '').trim();
      const url = (linkMatch?.[1] || linkMatch?.[2] || '').trim();
      const description = (descMatch?.[1] || descMatch?.[2] || '').trim();
      const pubDate = dateMatch?.[1] ? Date.parse(dateMatch[1]) : null;

      if (!title || !url) continue;

      let postedAt = null;
      if (pubDate && !Number.isNaN(pubDate) && pubDate > 0) {
        if (!cutoffMs || pubDate >= cutoffMs) {
          postedAt = pubDate;
        } else {
          continue; // Too old
        }
      }

      // Extract company from description or title
      let company = '';
      const companyMatch = description.match(/Empresa[:\s]+([^\n<]+)/i) || title.match(/^([^-]+)\s*[-–]\s*/);
      if (companyMatch) company = companyMatch[1].trim();

      jobs.push({
        title,
        url,
        company,
        location: 'Brasil',
        postedAt,
        workplaceType: null,
        jobType: null,
        description: description.slice(0, 500),
      });
    }
  } catch (err) {
    console.error('RSS parse error:', err.message);
  }
  return jobs;
}

/** @type {Provider} */
export default {
  id: 'trampos',
  detect,
  fetch,
};