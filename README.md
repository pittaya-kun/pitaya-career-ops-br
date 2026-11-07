<p align="center"><picture><source media="(prefers-color-scheme: dark)" srcset="docs/wordmark-dark.svg"><img src="docs/wordmark-light.svg" alt="career-ops" width="250" height="56"></picture></p>

<p align="center">The open-source AI job search agent — <strong>Pittaya's BR Sandbox Fork</strong></p>

<p align="center">
  <a href="README.md">English</a> |
  <a href="README.pt-BR.md">Português (Brasil)</a>
</p>

---

## ⚠️ What This Repo Is

**This is a personal sandbox/fork** of [career-ops](https://github.com/career-ops-hq/career-ops) (original by [@santifer](https://github.com/santifer)), customized for **Brazilian job market scraping**.

> **Original project**: https://github.com/career-ops-hq/career-ops  
> **Original author**: Santiago Fernández de Valderrama Aparicio ([@santifer](https://github.com/santifer))  
> **This fork**: Maintained by [@pittaya-kun](https://github.com/pittaya-kun) for personal use — not an official release, not affiliated with career-ops-hq.

---

## 🇧🇷 What's Different Here (Brazilian Scrapers)

This fork adds **providers and parsers for major Brazilian job sites/ATS**:

| Provider/Parser | Type | Sites Covered |
|-----------------|------|---------------|
| `kenoby.mjs` | ATS API | Nubank, iFood, Loft, Creditas, QuintoAndar, etc. |
| `solides.mjs` | ATS API | C6 Bank, Banco Inter, XP Inc, etc. |
| `pandape.mjs` | ATS API | Magazine Luiza, Grupo Boticário, etc. |
| `99jobs.mjs` | Job Board API | 99jobs.com (tech/startup focused) |
| `trampos.mjs` | Job Board API + RSS | trampos.co (tech/creative) |
| `vagascom-company.js` | Playwright Parser | Vagas.com company pages |
| `catho-company.js` | Playwright Parser | Catho company pages |
| `gupy.mjs` | Board-wide API | Gupy (already in upstream) |

**Config example**: `portals.br-example.yml` — 3 job boards + 26 tracked companies + Brazil-focused filters.

---

## 🏗️ Architecture

Follows career-ops native patterns:

```
┌─────────────────────────────────────────────────────────────┐
│ 1. TRACKED COMPANIES (providers/parsers) — Cirúrgico        │
│    kenoby, solides, pandape, 99jobs, trampos, gupy,         │
│    vagascom-company.js, catho-company.js                    │
├─────────────────────────────────────────────────────────────┤
│ 2. DISCOVERY (scan-ats-full.mjs) — Amplo (WIP)              │
│    ATS globais + ATS BR via seeds + pattern                 │
├─────────────────────────────────────────────────────────────┤
│ 3. FREEHIRE PROVIDER (optional) — Safety net grátis         │
└─────────────────────────────────────────────────────────────┘
```

See `ROADMAP_BR_SCRAPERS.md` for full plan and progress.

---

## 🚀 Quick Start

```bash
# 1. Install deps
npm ci

# 2. Copy example config and edit for your targets
cp portals.br-example.yml portals.yml
# Edit portals.yml with your companies/keywords

# 3. Verify setup
node doctor.mjs --json

# 4. Test providers load
node -e "
import('./providers/kenoby.mjs').then(m=>console.log('kenoby:', m.default.detect({careers_url:'https://nubank.kenoby.com'})));
import('./providers/solides.mjs').then(m=>console.log('solides:', m.default.detect({careers_url:'https://c6bank.solides.jobs'})));
import('./providers/pandape.mjs').then(m=>console.log('pandape:', m.default.detect({careers_url:'https://magazineluiza.pandape.com.br'})));
"

# 5. Run scan
node scan.mjs --json
```

---

## 📚 Key Files

| File | Purpose |
|------|---------|
| `ROADMAP_BR_SCRAPERS.md` | **Read this first** — full plan, status, how to continue |
| `portals.br-example.yml` | Reference config for Brazilian sites |
| `providers/*.mjs` | ATS/Board providers (kenoby, solides, pandape, 99jobs, trampos) |
| `local/*.js` | Playwright parsers (vagascom, catho) |
| `scan-ats-full.mjs` | Reverse-ATS scanner (needs BR ATS entries added) |

---

## 🔗 Upstream (Original career-ops)

| Link | Description |
|------|-------------|
| https://github.com/career-ops-hq/career-ops | **Original repo** — all credit to @santifer and contributors |
| https://career-ops.org/ | Official website |
| https://github.com/career-ops-hq/career-ops/blob/main/AGENTS.md | Agent instructions (also applies here) |
| https://github.com/career-ops-hq/career-ops/blob/main/DATA_CONTRACT.md | Data contract (critical) |

---

## 📄 License

Same as upstream: **MIT License** — see [LICENSE](LICENSE).

> This fork inherits the original license. The original career-ops was built by [@santifer](https://github.com/santifer) with 700+ contributors. This sandbox adds Brazilian scrapers for personal use.

---

## 🙏 Credits

- **Original career-ops**: [@santifer](https://github.com/santifer) + [700+ contributors](https://github.com/career-ops-hq/career-ops#builders)
- **Brazilian scrapers**: Custom additions in this fork
- **Freehire API** (optional safety net): https://freehire.me — open source job aggregator

---

<p align="center"><sub>This is a personal sandbox. For the production-ready, community-supported version, use <a href="https://github.com/career-ops-hq/career-ops">career-ops-hq/career-ops</a>.</sub></p>