# Roadmap: Brazilian Job Scrapers for career-ops (Sandbox)

> **⚠️ SANDBOX / FORK ONLY** — Este documento e o código associado **NÃO fazem parte do career-ops oficial** (santifer/career-ops). São modificações locais para uso pessoal do Pittaya, mantidas em repositório próprio. Não submeter PRs upstream sem alinhamento prévio.

> **Princípio**: Documentação auto-contida. Qualquer agente lê isto e continua de onde parou — sem depender de contexto de conversa, memória externa ou conhecimento tribal.

---

## 1. Visão Geral (Essência)

**Objetivo**: Integrar scrapers/providers de sites de vagas BR (Gupy, Kenoby, Solides, Pandapé, Vagas.com, Catho, 99jobs, Trampos) no career-ops, seguindo a arquitetura nativa (providers + local parsers + scan-ats-full).

**Estado Atual (2026-11-07)**:
- ✅ **7 providers/parsers criados e testados** (carregam, detectam, normalizam)
- ✅ **portals.br-example.yml** com 26 empresas de exemplo configuradas
- ⏳ **Integração no `scan-ats-full.mjs`** (discovery via seeds + pattern) — **próximo passo**
- ⏳ **Provider Freehire** (safety net grátis) — opcional, baixo esforço

**Arquitetura alvo (híbrida, 3 camadas)**:
```
┌─────────────────────────────────────────────────────────────┐
│ 1. TRACKED COMPANIES (providers/parsers) — Cirúrgico        │
│    kenoby, solides, pandape, 99jobs, trampos, gupy,         │
│    vagascom-company.js, catho-company.js                    │
│    → Empresas-alvo, frequência controlada, alta precisão   │
├─────────────────────────────────────────────────────────────┤
│ 2. DISCOVERY (scan-ats-full.mjs) — Amplo                    │
│    ATS globais (8) + ATS BR (kenoby, solides, pandape, gupy)│
│    → Encontra empresas NOVAS via seeds + pattern            │
├─────────────────────────────────────────────────────────────┤
│ 3. FREEHIRE PROVIDER (opcional) — Safety net                │
│    API pública grátis → pega o que escapou                  │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. Princípios de Engenharia (SOLID aplicado)

| Princípio | Como aplicamos aqui |
|-----------|---------------------|
| **S — Single Responsibility** | Cada provider/parser faz **uma coisa**: detecta + fetch + normaliza `Job[]`. Scanner orquestra, não faz parsing. |
| **O — Open/Closed** | Novos ATS BR = novo provider/parser + entrada no `ATS_CONFIG` do scanner. **Não modifica** código existente. |
| **L — Liskov Substitution** | Todos providers implementam interface `Provider { detect, fetch }`. Parsers locais: `stdin→JSON[]`. Scanner trata todos igual. |
| **I — Interface Segregation** | `Provider` interface mínima. `LocalParser` contract: `{careers_url, company} → JSON[]`. Sem métodos inúteis. |
| **D — Dependency Inversion** | Scanner depende de **abstração** (`ATS_CONFIG` map), não de implementações concretas. Providers injetados via config. |

**Regra prática**: Se precisar de `if (ats === 'kenoby')` fora do `ATS_CONFIG`, **quebrou OCP**. Adicione entrada no config.

---

## 3. Arquivos Envolvidos (Mapa)

### Providers (já criados, em `providers/`)
| Arquivo | ATS/Site | Tipo | Status |
|---------|----------|------|--------|
| `kenoby.mjs` | Kenoby (`*.kenoby.com`) | Provider (API) | ✅ Testado |
| `solides.mjs` | Solides (`*.solides.jobs`, `*.solides.com.br`) | Provider (API) | ✅ Testado |
| `pandape.mjs` | Pandapé (`*.pandape.com.br`, `ats.pandape.com.br/*`) | Provider (API) | ✅ Testado |
| `99jobs.mjs` | 99jobs.com | Provider (API + GraphQL + RSS fallback) | ✅ Testado |
| `trampos.mjs` | trampos.co | Provider (API + RSS fallback) | ✅ Testado |
| `gupy.mjs` | Gupy (já existia) | Provider (board-wide) | ✅ Nativo |

### Local Parsers (já criados, em `local/`)
| Arquivo | Site | Tipo | Status |
|---------|------|------|--------|
| `vagascom-company.js` | Vagas.com (empresa) | Playwright parser | ✅ Testado (`--help`) |
| `catho-company.js` | Catho (empresa) | Playwright parser | ✅ Testado (`--help`) |

### Configuração
| Arquivo | Propósito | Status |
|---------|-----------|--------|
| `portals.br-example.yml` | Exemplo completo: 3 job_boards + 26 tracked_companies + filtros BR | ✅ Pronto |
| `portals.yml` | **Seu config real** (copie do example, edite) | ⏳ Você cria |

### Scanner (precisa extensão)
| Arquivo | O que faz | O que falta |
|---------|-----------|-------------|
| `scan-ats-full.mjs` | Reverse-ATS: descobre boards → varre APIs → filtra → dedup | **Adicionar 4 entradas no `ATS_CONFIG`** (kenoby, solides, pandape, gupy) |

---

## 4. O Que Falta Fazer (Checklist Acionável)

### 4.1 Extender `scan-ats-full.mjs` — Discovery BR (PRIORIDADE ALTA)

**Arquivo**: `scan-ats-full.mjs` (linha ~onde está `ATS_CONFIG`)

**Ação**: Adicionar 4 entradas no objeto `ATS_CONFIG`:

```javascript
// JÁ EXISTE: getBRSeeds(ctx, atsId) — extrai tenants do tracked_companies + scan-history.tsv
// JÁ EXISTE: normalizeKenobyJob, normalizeSolidesJob, normalizePandapeJob — em providers/

const ATS_CONFIG = {
  // ... entradas existentes (greenhouse, lever, ashby, workday, icims, bamboohr, paylocity, join)
  
  // === NOVAS: ATS BRASILEIROS ===
  kenoby: {
    id: 'kenoby',
    name: 'Kenoby',
    discoverBoards: async (ctx) => getBRSeeds(ctx, 'kenoby'),
    boardToApi: (tenant) => `https://${tenant}.kenoby.com/api/v1/jobs?page=1&per_page=50`,
    normalize: normalizeKenobyJob, // import de providers/kenoby.mjs
    pagination: 'page',
    maxPages: 20,
    rateLimitMs: 100, // 10 req/s por tenant
  },
  
  solides: {
    id: 'solides',
    name: 'Solides',
    discoverBoards: async (ctx) => getBRSeeds(ctx, 'solides'),
    boardToApi: (tenant) => `https://${tenant}.solides.jobs/api/v1/jobs?page=1&per_page=50`,
    normalize: normalizeSolidesJob, // import de providers/solides.mjs
    pagination: 'page',
    maxPages: 20,
    rateLimitMs: 100,
  },
  
  pandape: {
    id: 'pandape',
    name: 'Pandapé',
    discoverBoards: async (ctx) => getBRSeeds(ctx, 'pandape'), // retorna [{tenant, pattern}]
    boardToApi: ({tenant, pattern}) => {
      if (pattern === 'branded') return `https://${tenant}.pandape.com.br/api/v1/jobs?page=1&per_page=50`;
      if (pattern === 'shared') return `https://ats.pandape.com.br/api/${tenant}/api/v1/jobs?page=1&per_page=50`;
    },
    normalize: normalizePandapeJob, // import de providers/pandape.mjs
    pagination: 'page',
    maxPages: 20,
    rateLimitMs: 100,
  },
  
  gupy: {
    id: 'gupy',
    name: 'Gupy (board-wide)',
    discoverBoards: async () => [], // SEM descoberta per-company
    customFetch: async (ctx, entry) => fetchGupyBoardWide(ctx, entry), // usa provider gupy.mjs
    // Gupy funciona DIFERENTE: keyword search no portal.gupy.io, não per-company
  },
};
```

**Função `getBRSeeds`** (já existe em essência — buscar `getSeedsFromTrackerAndHistory`):
```javascript
// Em scan-ats-full.mjs, já existe lógica similar para ATS globais
// Adapte para filtrar por hostname pattern:
async function getBRSeeds(ctx, atsId) {
  const seeds = await getSeedsFromTrackerAndHistory(ctx); // JÁ EXISTE
  const patterns = {
    kenoby: /\.kenoby\.com$/,
    solides: /\.(solides\.jobs|solides\.com\.br)$/,
    pandape: /(\.pandape\.com\.br$|ats\.pandape\.com\.br\/)/,
  };
  return seeds
    .filter(s => patterns[atsId].test(s.hostname))
    .map(s => ({
      tenant: extractTenant(s.url, atsId), // nubank de nubank.kenoby.com
      pattern: detectPandapePattern(s.url), // 'branded' ou 'shared'
      name: s.company,
    }));
}
```

**Teste**:
```bash
node scan-ats-full.mjs --seeds-only --json  # Deve mostrar jobs dos ATS BR
```

---

### 4.2 Provider Freehire (PRIORIDADE BAIXA — Safety Net)

**Arquivo novo**: `providers/freehire.mjs`

**API**: `https://freehire.me/api/v1/jobs?query=...&location=Brazil&limit=100` (sem auth, grátis)

```javascript
// providers/freehire.mjs
import { fetchJsonWithRetry } from './_http.mjs';

function detect(entry) {
  if (entry?.provider === 'freehire') return { url: 'https://freehire.me/api/v1/jobs' };
  return null;
}

async function fetch(entry, ctx) {
  const cfg = entry?.freehire || {};
  const query = cfg.query || 'developer OR engineer OR backend';
  const location = cfg.location || 'Brazil';
  const limit = cfg.limit || 100;
  
  const url = `https://freehire.me/api/v1/jobs?query=${encodeURIComponent(query)}&location=${encodeURIComponent(location)}&limit=${limit}`;
  
  const data = await fetchJsonWithRetry(ctx, url);
  return (data?.jobs || []).map(normalizeFreehireJob);
}

function normalizeFreehireJob(raw) {
  // Mapear campos Freehire → Job[] career-ops
  // Ver docs em freehire.me ou inspecione resposta da API
}

export default { id: 'freehire', detect, fetch };
```

**No `portals.yml`**:
```yaml
job_boards:
  - provider: freehire
    freehire:
      query: "backend OR developer OR engineer OR 'software engineer'"
      location: "Brazil"
      limit: 100
    enabled: true
```

**Teste rápido antes de codar**:
```bash
curl 'https://freehire.me/api/v1/jobs?query=backend&location=Brazil&limit=3'
```

---

### 4.3 Validar `portals.yml` Real

**Ação**: Você cria seu `portals.yml` baseado no `portals.br-example.yml`

```bash
cp portals.br-example.yml portals.yml
# Edita: tracked_companies (suas empresas), title_filter.positive (seus cargos)
```

**Teste**:
```bash
node verify-portals.mjs --json  # Valida providers/parsers configurados
node scan.mjs --json             # Scan completo (tracked + job_boards)
```

---

### 4.4 Documentação de Decisões (ADR) — Para Não Perder Contexto

Crie `docs/adr/` se não existir. Para cada decisão arquitetural relevante:

| ADR | Título | Status |
|-----|--------|--------|
| 001 | Adotar providers/parsers BR no sandbox | ✅ Decidido |
| 002 | Seeds + pattern para discovery BR no scan-ats-full | ✅ Decidido |
| 003 | Freehire como safety net opcional | 🟡 Proposto |
| 004 | Não contribuir upstream (fork sandbox) | ✅ Decidido |

**Template ADR** (salve como `docs/adr/00X-titulo.md`):
```markdown
# ADR 00X: [Título]

## Contexto
[O que motivou a decisão]

## Decisão
[O que foi decidido]

## Consequências
- Positivas: [...]
- Negativas/Riscos: [...]
- Mitigação: [...]

## Alternativas Consideradas
- [Alt 1]: por que não
- [Alt 2]: por que não
```

---

## 5. Como Testar Tudo (Comandos de Validação)

```bash
# 1. Providers carregam e detectam
node -e "
const k = await import('./providers/kenoby.mjs');
const s = await import('./providers/solides.mjs');
const p = await import('./providers/pandape.mjs');
const t = await import('./providers/trampos.mjs');
const j = await import('./providers/99jobs.mjs');
console.log('kenoby:', k.default.detect({careers_url:'https://nubank.kenoby.com'}));
console.log('solides:', s.default.detect({careers_url:'https://c6bank.solides.jobs'}));
console.log('pandape:', p.default.detect({careers_url:'https://magazineluiza.pandape.com.br'}));
console.log('trampos:', t.default.detect({provider:'trampos'}));
console.log('99jobs:', j.default.detect({provider:'99jobs'}));
"

# 2. Parsers locais rodam
node local/vagascom-company.js --help
node local/catho-company.js --help

# 3. YAML válido
node -e "import * as yaml from 'js-yaml'; import fs from 'fs'; console.log('OK:', !!yaml.load(fs.readFileSync('portals.br-example.yml','utf8')).job_boards)"

# 4. Scan discovery (depois de estender scan-ats-full)
node scan-ats-full.mjs --seeds-only --json

# 5. Scan completo
node scan.mjs --json
```

---

## 6. Riscos Conhecidos & Mitigação

| Risco | Probabilidade | Impacto | Mitigação |
|-------|---------------|---------|-----------|
| ATS BR muda API (breaking) | 🟡 Média (anos) | Quebra provider | Monitorar 404/500; versionar `normalize*`; testar mensal |
| Rate limit no discovery | 🟢 Baixa | Scan incompleto | `rateLimitMs: 100` por tenant; backoff exponencial no `_http.mjs` |
| Freehire API muda/cai | 🟡 Média | Safety net falha | Tratar como opcional; log warning; não bloquear scan |
| Vagas.com/Catho anti-bot bloqueia parser | 🟠 Alta | Parser falha | `--max-pages` baixo; user-agent rotativo; cookies persistentes (futuro) |
| Gupy board-wide não cobre todas empresas | 🟢 Baixa | Lacunas | Providers per-company (kenoby/solides/pandape) já cobrem major players |

---

## 7. Próximos Passos Imediatos (Ordem de Execução)

| # | Ação | Esforço | Responsável | Status |
|---|------|---------|-------------|--------|
| 1 | Criar repo próprio no GitHub (push sandbox) | 5 min | Você | ⏳ |
| 2 | Copiar `portals.br-example.yml` → `portals.yml` e personalizar | 10 min | Você | ⏳ |
| 3 | Estender `scan-ats-full.mjs` com 4 entradas ATS BR | 4-6h | Agente/Claude | ⏳ |
| 4 | Testar `scan-ats-full.mjs --seeds-only --json` | 30 min | Agente/Claude | ⏳ |
| 5 | (Opcional) Criar `providers/freehire.mjs` | 2h | Agente/Claude | ⏳ |
| 6 | Rodar `scan.mjs --json` completo validando tudo | 30 min | Agente/Claude | ⏳ |
| 7 | Documentar ADRs no `docs/adr/` | 30 min | Agente/Claude | ⏳ |

---

## 8. Como Continuar (Para Próximo Agente/Sessão)

**Leia nesta ordem**:
1. **Este arquivo** (`ROADMAP_BR_SCRAPERS.md`) — visão completa
2. `providers/kenoby.mjs`, `solides.mjs`, `pandape.mjs`, `99jobs.mjs`, `trampos.mjs` — providers prontos
3. `local/vagascom-company.js`, `local/catho-company.js` — parsers prontos
4. `scan-ats-full.mjs` — procure `ATS_CONFIG` e `getSeedsFromTrackerAndHistory`
5. `portals.br-example.yml` — config de referência
6. `docs/adr/` — decisões arquiteturais (se existirem)

**Comandos para validar estado atual**:
```bash
node doctor.mjs --json                    # Setup OK?
node -e "import('./providers/kenoby.mjs').then(m=>console.log(m.default.detect({careers_url:'https://nubank.kenoby.com'})))"
node scan-ats-full.mjs --seeds-only --json  # Discovery funcionando?
```

**Se parou no meio**: veja checklist **Seção 4** — cada item é independente e testável.

---

## 9. Referências Rápidas

| Documento | Link/Local |
|-----------|------------|
| career-ops AGENTS.md | `AGENTS.md` (raiz) |
| Data Contract | `DATA_CONTRACT.md` |
| Provider Interface | `providers/_types.js` |
| HTTP Utils | `providers/_http.mjs` |
| Scan ATS Full | `scan-ats-full.mjs` |
| Freehire API | `https://freehire.me/api/v1/jobs?limit=1` |
| PittayaCV Análise | `../PittayaCV/ANALISE_CAREER_OPS.md` |
| PittayaCV Plano | `../PittayaCV/PLANO_PARSERS_BR.md` |

---

**Fim do Roadmap**. Este documento é **vivo** — atualize conforme avança. Próximo agente: leia, entenda o estado atual (Seção 4), pegue o próximo item não feito e execute. Boa caça! 🎯