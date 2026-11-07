<p align="center"><picture><source media="(prefers-color-scheme: dark)" srcset="docs/wordmark-dark.svg"><img src="docs/wordmark-light.svg" alt="career-ops" width="250" height="56"></picture></p>

<p align="center">O agente de IA open source para buscar emprego — <strong>Sandbox BR do Pittaya (Fork Pessoal)</strong></p>

<p align="center">
  <a href="README.md">English</a> |
  <a href="README.pt-BR.md">Português (Brasil)</a>
</p>

---

## ⚠️ O Que É Este Repositório

**Este é um sandbox/fork pessoal** do [career-ops](https://github.com/career-ops-hq/career-ops) (original do [@santifer](https://github.com/santifer)), customizado para **scraping do mercado de vagas brasileiro**.

> **Projeto original**: https://github.com/career-ops-hq/career-ops  
> **Autor original**: Santiago Fernández de Valderrama Aparicio ([@santifer](https://github.com/santifer))  
> **Este fork**: Mantido por [@pittaya-kun](https://github.com/pittaya-kun) para uso pessoal — **não é release oficial**, não afiliado ao career-ops-hq.

---

## 🇧🇷 O Que Tem Diferente Aqui (Scrapers Brasileiros)

Este fork adiciona **providers e parsers para os principais sites/ATS brasileiros**:

| Provider/Parser | Tipo | Sites Cobertos |
|-----------------|------|----------------|
| `kenoby.mjs` | ATS API | Nubank, iFood, Loft, Creditas, QuintoAndar, etc. |
| `solides.mjs` | ATS API | C6 Bank, Banco Inter, XP Inc, etc. |
| `pandape.mjs` | ATS API | Magazine Luiza, Grupo Boticário, etc. |
| `99jobs.mjs` | Job Board API | 99jobs.com (foco tech/startup) |
| `trampos.mjs` | Job Board API + RSS | trampos.co (tech/criativo) |
| `vagascom-company.js` | Playwright Parser | Páginas de empresa no Vagas.com |
| `catho-company.js` | Playwright Parser | Páginas de empresa no Catho |
| `gupy.mjs` | Board-wide API | Gupy (já existia no upstream) |

**Config de exemplo**: `portals.br-example.yml` — 3 job boards + 26 empresas tracked + filtros focados no Brasil.

---

## 🏗️ Arquitetura

Segue os padrões nativos do career-ops:

```
┌─────────────────────────────────────────────────────────────┐
│ 1. TRACKED COMPANIES (providers/parsers) — Cirúrgico        │
│    kenoby, solides, pandape, 99jobs, trampos, gupy,         │
│    vagascom-company.js, catho-company.js                    │
├─────────────────────────────────────────────────────────────┤
│ 2. DISCOVERY (scan-ats-full.mjs) — Amplo (WIP)              │
│    ATS globais + ATS BR via seeds + pattern                 │
├─────────────────────────────────────────────────────────────┤
│ 3. FREEHIRE PROVIDER (opcional) — Safety net grátis         │
└─────────────────────────────────────────────────────────────┘
```

Veja `ROADMAP_BR_SCRAPERS.md` para plano completo e progresso.

---

## 🚀 Início Rápido

```bash
# 1. Instala dependências
npm ci

# 2. Copia config de exemplo e edita pro seu alvo
cp portals.br-example.yml portals.yml
# Edita portals.yml com suas empresas/keywords

# 3. Verifica setup
node doctor.mjs --json

# 4. Testa se providers carregam
node -e "
import('./providers/kenoby.mjs').then(m=>console.log('kenoby:', m.default.detect({careers_url:'https://nubank.kenoby.com'})));
import('./providers/solides.mjs').then(m=>console.log('solides:', m.default.detect({careers_url:'https://c6bank.solides.jobs'})));
import('./providers/pandape.mjs').then(m=>console.log('pandape:', m.default.detect({careers_url:'https://magazineluiza.pandape.com.br'})));
"

# 5. Roda scan
node scan.mjs --json
```

---

## 📚 Arquivos-Chave

| Arquivo | Propósito |
|---------|-----------|
| `ROADMAP_BR_SCRAPERS.md` | **Leia primeiro** — plano completo, status, como continuar |
| `portals.br-example.yml` | Config de referência para sites brasileiros |
| `providers/*.mjs` | Providers ATS/Board (kenoby, solides, pandape, 99jobs, trampos) |
| `local/*.js` | Parsers Playwright (vagascom, catho) |
| `scan-ats-full.mjs` | Scanner reverse-ATS (precisa adicionar entradas ATS BR) |

---

## 🔗 Upstream (career-ops Original)

| Link | Descrição |
|------|-----------|
| https://github.com/career-ops-hq/career-ops | **Repo original** — todo crédito ao @santifer e contribuidores |
| https://career-ops.org/ | Site oficial |
| https://github.com/career-ops-hq/career-ops/blob/main/AGENTS.md | Instruções para agentes (valem aqui também) |
| https://github.com/career-ops-hq/career-ops/blob/main/DATA_CONTRACT.md | Contrato de dados (crítico) |

---

## 📄 Licença

Mesma do upstream: **MIT License** — veja [LICENSE](LICENSE).

> Este fork herda a licença original. O career-ops original foi construído pelo [@santifer](https://github.com/santifer) com 700+ contribuidores. Este sandbox adiciona scrapers brasileiros para uso pessoal.

---

## 🙏 Créditos

- **career-ops original**: [@santifer](https://github.com/santifer) + [700+ contribuidores](https://github.com/career-ops-hq/career-ops#builders)
- **Scrapers brasileiros**: Adições customizadas neste fork
- **Freehire API** (safety net opcional): https://freehire.me — agregador de vagas open source

---

<p align="center"><sub>Este é um sandbox pessoal. Para a versão production-ready, suportada pela comunidade, use <a href="https://github.com/career-ops-hq/career-ops">career-ops-hq/career-ops</a>.</sub></p>