# Real Estate Platform Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Replace live XML search with a Supabase-backed catalogue, authenticated administration, and a reviewable XML import pipeline.

**Architecture:** Express remains the server boundary and is divided into focused CommonJS modules. Supabase PostgreSQL stores the official catalogue, Auth identifies administrators, and Storage receives new media. An XML import creates a reviewable batch; administrator approval alone can apply it to the catalogue.

**Tech Stack:** Node.js 20+, Express 4, CommonJS, Supabase PostgreSQL/Auth/Storage, @supabase/supabase-js, fast-xml-parser, zod, multer, helmet, express-rate-limit, node:test, supertest, HTML/CSS/vanilla JavaScript.

**Spec:** docs/superpowers/specs/2026-09-29-real-estate-platform-design.md

## Responsibilities

- **Codex:** generate and review everything in supabase/migrations, supabase/seed, .env.example, and the SQL execution guide. The human runs approved SQL in the Supabase SQL Editor.
- **Gemini / Antigravity:** implement Node, frontend, and test files in the task order. It never creates, invents, or runs SQL migrations.
- **Human:** creates the Supabase project and initial Auth user, runs migrations in order, provides environment variables privately, and makes the production smoke test.

## File Map

| Path | Responsibility |
| --- | --- |
| supabase/migrations/0001_catalog.sql | Enums, catalogue, media, features, batches, records, indexes, and atomic import RPC. |
| supabase/migrations/0002_security_audit.sql | Admin registry, RLS, public view, audit triggers, and Storage policies. |
| docs/supabase-execution.md | Exact SQL order and expected verification output. |
| src/app.js | Express composition and static assets. |
| src/config/env.js | Validated, fail-fast environment parsing. |
| src/config/supabase.js | Server-only Supabase service client. |
| src/middleware/require-admin.js | Bearer token verification and administrator membership. |
| src/modules/properties | CRUD, public search and status rules. |
| src/modules/imports | XML parsing, preview, conflict detection, and approval. |
| src/modules/media | Media validation and Supabase Storage calls. |
| src/modules/audit | Read-only property audit history. |
| public | Public catalogue interface. |
| admin | Administrator interface. |
| tests | Unit, API integration, and browser-contract tests. |

## Global Constraints

- Use Node 20 or later and CommonJS; package.json declares engines.node as >=20.
- Never expose SUPABASE_SERVICE_ROLE_KEY in browser assets, logs, commits, or HTTP errors.
- Database columns are snake_case; API payloads are camelCase; repositories own conversion.
- A public result always has status disponivel and is_published true.
- Valid statuses: rascunho, disponivel, reservado, vendido, alugado, inativo.
- XML download timeout is 15 seconds and maximum payload is 25 MiB. JPEG, PNG, and WebP uploads are limited to 10 MiB.
- A reimport never deletes a property or updates a field included in manual_fields. Missing source items are review records.
- Render feed-derived data with DOM creation and textContent, never with innerHTML interpolation.
- SQL files are numbered and the guide records required verification queries.

## Review Focus

1. Malformed or oversized XML creates a failed batch and never a partial catalogue update. Task 6 owns this test.
2. An XML record that matches manually edited data becomes a conflict instead of replacing protected fields. Task 6 owns this test.
3. An Auth user outside admin_users receives 403 from every /api/admin route. Task 4 owns this test.
4. Crafted public filters never expose unpublished, rented, sold, reserved, or inactive properties. Task 5 owns this test.
5. A fake image or upload exceeding 10 MiB is rejected before it reaches Storage. Task 7 owns this test.

---

## Task 1: Establish the server boundary and test harness

**Owner:** Gemini / Antigravity

**Files:**
- Modify: package.json, server.js
- Create: .env.example, src/app.js, src/config/env.js, src/config/supabase.js, src/lib/app-error.js, src/middleware/error-handler.js
- Test: tests/unit/config/env.test.js

**Interfaces:**
- Produces createApp({ env, supabase }) returning an Express application.
- Produces loadEnv(source = process.env) returning validated configuration.
- Produces AppError(status, code, details) for every service module.

- [ ] **Step 1: Write the failing environment test**

~~~
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadEnv } = require('../../../src/config/env');

test('rejects missing Supabase service key', () => {
  assert.throws(
    () => loadEnv({ SUPABASE_URL: 'https://sample.supabase.co', SUPABASE_ANON_KEY: 'anon' }),
    /SUPABASE_SERVICE_ROLE_KEY/
  );
});
~~~

- [ ] **Step 2: Verify failure**

Run: node --test tests/unit/config/env.test.js  
Expected: failure because src/config/env.js is absent.

- [ ] **Step 3: Implement the configuration boundary**

~~~
const { z } = require('zod');
const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3333),
  SUPABASE_URL: z.string().url(),
  SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  PUBLIC_APP_ORIGIN: z.string().url()
});
function loadEnv(source = process.env) { return schema.parse(source); }
module.exports = { loadEnv };
~~~

~~~
class AppError extends Error {
  constructor(status, code, details = undefined) {
    super(code);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}
module.exports = { AppError };
~~~

Create a service client with SUPABASE_SERVICE_ROLE_KEY only. Add @supabase/supabase-js, zod, multer, helmet, express-rate-limit, and supertest; add npm test as node --test and engines.node >=20. Compose static assets, 1 MiB JSON parsing, Helmet, strict CORS, not-found and error middleware in createApp. The error handler maps AppError to its status and code and maps every other error to HTTP 500 with error internal_error. Keep server.js limited to loading configuration, building the app, and listening.

- [ ] **Step 4: Verify the harness**

Run: node --test tests/unit/config/env.test.js && npm test  
Expected: both commands pass.

- [ ] **Step 5: Commit**

~~~
git add package.json package-lock.json server.js .env.example src tests/unit/config/env.test.js
git commit -m "chore: add validated server foundation"
~~~

## Task 2: Create the catalogue and import SQL schema

**Owner:** Codex

**Files:**
- Create: supabase/migrations/0001_catalog.sql, supabase/seed/0001_development.sql, docs/supabase-execution.md

**Interfaces:**
- Produces properties with a UUID primary key and unique (source_name, source_listing_id).
- Produces apply_import_batch(p_batch_id uuid, p_actor_id uuid) returning jsonb.
- Later tasks consume the schema only through a Supabase service client.

- [ ] **Step 1: Add pre-execution checks to the guide**

~~~
select to_regclass('public.properties') as properties_table;
select to_regtype('public.property_status') as property_status_type;
~~~

Expected before execution: both values are null. If objects already exist, stop and preserve them before applying migration.

- [ ] **Step 2: Generate 0001_catalog.sql**

~~~
create extension if not exists pgcrypto;
create type property_status as enum ('rascunho','disponivel','reservado','vendido','alugado','inativo');
create type transaction_type as enum ('venda','locacao','venda_locacao');
create type import_batch_status as enum ('processando','pronto_para_revisao','aprovado','descartado','falhou');
create type import_record_action as enum ('criar','atualizar','sem_alteracao','conflito','ignorar','ausente_na_fonte');

create table properties (
  id uuid primary key default gen_random_uuid(),
  source_name text not null,
  source_listing_id text not null,
  external_code text not null,
  status property_status not null default 'rascunho',
  is_published boolean not null default false,
  published_at timestamptz,
  archived_at timestamptz,
  transaction_type transaction_type not null,
  property_type text not null,
  usage_type text not null,
  title text not null,
  description text not null default '',
  sale_price numeric(14,2),
  rental_price numeric(14,2),
  condo_fee numeric(14,2),
  iptu_fee numeric(14,2),
  living_area numeric(12,2),
  constructed_area numeric(12,2),
  lot_area numeric(12,2),
  bedrooms integer not null default 0 check (bedrooms >= 0),
  suites integer not null default 0 check (suites >= 0),
  bathrooms integer not null default 0 check (bathrooms >= 0),
  garage_spaces integer not null default 0 check (garage_spaces >= 0),
  address text, street_number text, complement text, neighborhood text,
  city text, state text, postal_code text,
  latitude numeric(10,7), longitude numeric(10,7),
  partner_url text, virtual_tour_url text,
  manual_fields jsonb not null default '[]'::jsonb check (jsonb_typeof(manual_fields) = 'array'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (source_name, source_listing_id)
);
~~~

Complete the same migration with features, property_features, property_media, import_batches, import_records, indexes for public filters, and the apply_import_batch RPC. The RPC only accepts pronto_para_revisao, skips manual_fields, applies create/update in one transaction, changes the batch to aprovado, and returns created/updated/conflicts counts.

- [ ] **Step 3: Execute and verify in a non-production project**

~~~
select to_regclass('public.properties') as properties_table;
select unnest(enum_range(null::property_status))::text as allowed_status;
select proname from pg_proc where proname = 'apply_import_batch';
~~~

Expected: properties table, six statuses, and exactly one import RPC.

- [ ] **Step 4: Commit**

~~~
git add supabase/migrations/0001_catalog.sql supabase/seed/0001_development.sql docs/supabase-execution.md
git commit -m "feat: add property catalogue schema"
~~~

## Task 3: Create administrator, RLS, audit, and Storage SQL

**Owner:** Codex

**Files:**
- Create: supabase/migrations/0002_security_audit.sql
- Modify: docs/supabase-execution.md

**Interfaces:**
- Produces is_admin() returning boolean, public_properties view, audit triggers, and property-media bucket policies.
- API middleware in Task 4 consumes admin_users.

- [ ] **Step 1: Record the failure assertion**

~~~
set local role anon;
select * from properties;
reset role;
~~~

The documented expected result after migration is permission denied. A separate anonymous query against public_properties is permitted and returns only the explicit safe columns and published available records.

- [ ] **Step 2: Generate security migration**

~~~
create table admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create or replace function is_admin()
returns boolean language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from admin_users
    where user_id = auth.uid() and is_active = true
  );
$$;

alter table properties enable row level security;
create policy "administrators manage properties"
  on properties for all to authenticated
  using (is_admin()) with check (is_admin());
revoke all on properties from anon, authenticated;
~~~

Add corresponding RLS and raw-table revocations to child, import, and audit tables. Create a private property-media Storage bucket with policies requiring is_admin(). Add property_audit_log and an append-only trigger recording old_data, new_data, actor, action, and timestamp. Create public_properties with an explicit public column list, filtering is_published true and status disponivel; grant select on that view to anon and authenticated.

- [ ] **Step 3: Verify the security migration**

~~~
select tablename, rowsecurity
from pg_tables
where schemaname = 'public'
  and tablename in ('properties','import_batches','property_audit_log');
set local role anon;
select * from public_properties limit 1;
reset role;
~~~

Expected: every named table shows rowsecurity true; public_properties returns only explicit safe columns and never a non-public record.

- [ ] **Step 4: Commit**

~~~
git add supabase/migrations/0002_security_audit.sql docs/supabase-execution.md
git commit -m "feat: add Supabase access controls and audit"
~~~

## Task 4: Add authentication middleware and protected API shell

**Owner:** Gemini / Antigravity

**Files:**
- Create: src/middleware/require-admin.js, src/routes/index.js, src/modules/auth/auth.routes.js
- Modify: src/app.js
- Test: tests/integration/auth/admin-access.test.js

**Interfaces:**
- Produces requireAdmin({ supabase }) Express middleware.
- Produces GET /api/admin/session returning user id and email for active administrators.

- [ ] **Step 1: Write failing authorization tests**

~~~
test('returns 401 without bearer token', async () => {
  const response = await request(app).get('/api/admin/session');
  assert.equal(response.status, 401);
});

test('returns 403 for authenticated non-admin', async () => {
  const response = await request(app)
    .get('/api/admin/session')
    .set('Authorization', 'Bearer valid-token');
  assert.equal(response.status, 403);
});
~~~

- [ ] **Step 2: Verify failure**

Run: node --test tests/integration/auth/admin-access.test.js  
Expected: failure because middleware and route are missing.

- [ ] **Step 3: Implement bearer validation**

~~~
function requireAdmin({ supabase }) {
  return async (req, res, next) => {
    const token = req.get('authorization')?.replace(/^Bearer\s+/i, '');
    if (!token) return res.status(401).json({ error: 'authentication_required' });
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) return res.status(401).json({ error: 'invalid_session' });
    const { data: admin } = await supabase.from('admin_users')
      .select('user_id').eq('user_id', user.id).eq('is_active', true).maybeSingle();
    if (!admin) return res.status(403).json({ error: 'administrator_required' });
    req.admin = { id: user.id, email: user.email };
    next();
  };
}
module.exports = { requireAdmin };
~~~

Mount middleware before every /api/admin module. Limit POST /api/admin/imports to 10 requests per IP per minute.

- [ ] **Step 4: Verify and commit**

Run: node --test tests/integration/auth/admin-access.test.js  
Expected: missing token is 401, inactive user is 403, active user is 200.

~~~
git add src/app.js src/middleware/require-admin.js src/routes src/modules/auth tests/integration/auth/admin-access.test.js
git commit -m "feat: protect administrator API routes"
~~~

## Task 5: Implement the Supabase-backed public catalogue API

**Owner:** Gemini / Antigravity

**Files:**
- Create: src/modules/properties/property.schemas.js, property.repository.js, public-property.service.js, public-property.routes.js
- Modify: src/routes/index.js
- Test: tests/unit/properties/public-property.service.test.js, tests/integration/properties/public-search.test.js

**Interfaces:**
- Produces listPublicProperties(filters) returning items, total, offset, limit.
- Produces parsePublicFilters(query) from property.schemas.js.
- Produces GET /api/public/properties and GET /api/public/properties/:externalCode.

- [ ] **Step 1: Write failing visibility and pagination tests**

~~~
test('never returns non-public status for crafted query', async () => {
  const response = await request(app).get('/api/public/properties?status=vendido');
  assert.equal(response.body.items.every((item) => item.status === 'disponivel' && item.isPublished), true);
});

test('rejects negative offset', () => {
  assert.throws(() => parsePublicFilters({ offset: '-1' }), /offset/);
});
~~~

- [ ] **Step 2: Implement filter parsing and query**

~~~
const publicFilterSchema = z.object({
  query: z.string().trim().max(120).optional(),
  transactionType: z.enum(['venda', 'locacao', 'venda_locacao']).optional(),
  city: z.string().trim().max(80).optional(),
  neighborhoods: z.array(z.string().trim().max(80)).max(20).default([]),
  minPrice: z.coerce.number().nonnegative().optional(),
  maxPrice: z.coerce.number().positive().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(40),
  offset: z.coerce.number().int().min(0).default(0)
});
~~~

Query public_properties only. Apply both is_published and disponivel predicates in repository despite the view. Use rental_price for locacao ordering and filtering, sale_price for venda, and return both values for venda_locacao. Validate feature, city, neighbourhood, bedrooms, suites, bathrooms, garage, area, tour, price, sort, limit, and offset filters.

- [ ] **Step 3: Verify and commit**

Run: node --test tests/unit/properties/public-property.service.test.js tests/integration/properties/public-search.test.js  
Expected: visibility, filtering, validation, price ordering, and pagination pass.

~~~
git add src/modules/properties src/routes/index.js tests/unit/properties tests/integration/properties
git commit -m "feat: add public Supabase property search"
~~~

## Task 6: Build XML staging, comparison, and approval

**Owner:** Gemini / Antigravity

**Files:**
- Create: src/modules/imports/import.schemas.js, xml-normalizer.js, import.service.js, import.repository.js, import.routes.js
- Create: tests/fixtures/valid-feed.xml, duplicate-code-feed.xml, malformed-feed.xml
- Create: tests/helpers/fixture.js
- Test: tests/unit/imports/xml-normalizer.test.js, tests/integration/imports/import-flow.test.js

**Interfaces:**
- Produces normalizeFeed(xmlText, sourceName).
- Produces createImportPreview({ actorId, sourceName, xmlText }).
- Produces approveImportBatch({ actorId, batchId }).
- Produces protected import endpoints: POST /api/admin/imports, GET /api/admin/imports/:id, POST /api/admin/imports/:id/approve, POST /api/admin/imports/:id/discard.

- [ ] **Step 1: Write failing normalizer and conflict tests**

~~~
const { readFile } = require('node:fs/promises');
const { join } = require('node:path');
async function fixture(name) {
  return readFile(join(__dirname, '../../fixtures', name), 'utf8');
}
const fakeRepository = { appliedBatchCount: 0 };

test('marks manually edited title as conflict', async () => {
  const preview = await createImportPreview({
    actorId: 'admin-1', sourceName: 'vivareal', xmlText: await fixture('valid-feed.xml')
  });
  assert.equal(preview.records.find((record) => record.externalCode === '8797').action, 'conflito');
});

test('oversized XML cannot mutate catalogue', async () => {
  await assert.rejects(() => createImportPreview({
    actorId: 'admin-1', sourceName: 'vivareal', xmlText: 'x'.repeat(25 * 1024 * 1024 + 1)
  }), /xml_too_large/);
  assert.equal(fakeRepository.appliedBatchCount, 0);
});
~~~

- [ ] **Step 2: Implement normalizer and preview**

~~~
const MAX_XML_BYTES = 25 * 1024 * 1024;
function assertXmlSize(xmlText) {
  if (Buffer.byteLength(xmlText, 'utf8') > MAX_XML_BYTES) {
    throw new AppError(413, 'xml_too_large');
  }
}
function importKey(listing) {
  if (!listing.sourceListingId) throw new AppError(422, 'missing_source_listing_id');
  return { sourceName: listing.sourceName, sourceListingId: listing.sourceListingId };
}
~~~

Normalize ListingID, transaction, title, description, prices, areas, address, features, media, partner URL, tour URL, and source status. Hash original XML with SHA-256. Insert import_batches and import_records without touching properties. Compare source_name plus source_listing_id to properties; mark manual-fields changes as conflito, missing catalogues as criar, identical rows as sem_alteracao, and absent source properties as ausente_na_fonte.

- [ ] **Step 3: Implement approval**

~~~
async function approveImportBatch({ actorId, batchId }) {
  const { data, error } = await supabase.rpc('apply_import_batch', {
    p_batch_id: batchId,
    p_actor_id: actorId
  });
  if (error) throw mapSupabaseError(error);
  return data;
}
~~~

Define mapSupabaseError(error) in import.repository.js: error code P0001 maps to AppError(409, 'import_batch_not_reviewable'); any other database error maps to AppError(500, 'import_apply_failed'). Reject unknown, failed, discarded, and already approved batches. Discard changes a reviewable batch only to descartado. Approval and discard must create audit events.

- [ ] **Step 4: Verify and commit**

Run: node --test tests/unit/imports/xml-normalizer.test.js tests/integration/imports/import-flow.test.js  
Expected: valid preview, duplicate handling, malformed/oversized rejection, manual conflict, absence review, and approval-only mutation pass.

~~~
git add src/modules/imports tests/fixtures tests/unit/imports tests/integration/imports
git commit -m "feat: add reviewable XML import batches"
~~~

## Task 7: Implement administrator CRUD, status rules, and media

**Owner:** Gemini / Antigravity

**Files:**
- Create: src/modules/properties/admin-property.service.js, admin-property.routes.js
- Create: src/modules/media/media.service.js, media.routes.js
- Create: src/modules/audit/audit.routes.js
- Modify: src/routes/index.js
- Test: tests/integration/properties/admin-property.test.js, tests/integration/media/upload.test.js

**Interfaces:**
- Produces administrator CRUD under /api/admin/properties.
- Produces transitionStatus({ property, nextStatus, reactivationReason }).
- Produces multipart POST /api/admin/properties/:id/media field file.

- [ ] **Step 1: Write failing status and media tests**

~~~
test('requires a reason to reactivate sold property', async () => {
  const response = await request(app)
    .patch('/api/admin/properties/property-1/status')
    .set(adminHeader).send({ status: 'disponivel' });
  assert.equal(response.status, 422);
  assert.equal(response.body.error, 'reactivation_required');
});

test('rejects fake image before Storage', async () => {
  const response = await request(app)
    .post('/api/admin/properties/property-1/media')
    .set(adminHeader)
    .attach('file', Buffer.from('not-an-image'), { filename: 'invoice.pdf', contentType: 'application/pdf' });
  assert.equal(response.status, 415);
});
~~~

- [ ] **Step 2: Implement domain and upload validation**

~~~
const terminalStatuses = new Set(['vendido', 'alugado']);
function transitionStatus({ property, nextStatus, reactivationReason }) {
  if (terminalStatuses.has(property.status) && nextStatus === 'disponivel' && !reactivationReason?.trim()) {
    throw new AppError(422, 'reactivation_required');
  }
  return { ...property, status: nextStatus, isPublished: nextStatus === 'disponivel' ? property.isPublished : false };
}

const allowedMimeTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_MEDIA_BYTES = 10 * 1024 * 1024;
~~~

Validate all property bodies with Zod. Add edited database column names to manual_fields. Archive by changing status to inativo and is_published to false; never physically delete. Use Multer memory storage. Store manual media as property-id/uuid.extension in property-media and insert property_media metadata. Preserve XML remote URLs without downloading them.

- [ ] **Step 3: Verify and commit**

Run: node --test tests/integration/properties/admin-property.test.js tests/integration/media/upload.test.js  
Expected: status, archive, manual field, MIME, and size checks pass.

~~~
git add src/modules/properties src/modules/media src/modules/audit src/routes/index.js tests/integration/properties tests/integration/media
git commit -m "feat: add administrator property management"
~~~

## Task 8: Migrate public UI to the catalogue API

**Owner:** Gemini / Antigravity

**Files:**
- Modify: public/index.html, public/app.js, public/style.css
- Create: tests/browser/public-contract.test.js

**Interfaces:**
- Consumes GET /api/public/properties and GET /api/public/properties/:externalCode.
- Removes all calls to legacy sync, stats, and filter-options routes.

- [ ] **Step 1: Write failing safe-rendering test**

~~~
test('renders feed-derived title as text', () => {
  const card = renderPropertyCard({ title: '<img src=x onerror=alert(1)>', status: 'disponivel', isPublished: true });
  assert.equal(card.querySelector('h4').textContent, '<img src=x onerror=alert(1)>');
  assert.equal(card.querySelector('img[onerror]'), null);
});
~~~

- [ ] **Step 2: Replace live XML UI assumptions**

~~~
function renderPropertyCard(property) {
  const card = document.createElement('article');
  const title = document.createElement('h4');
  title.textContent = property.title;
  card.append(title);
  return card;
}
async function searchProperties(params) {
  const response = await fetch('/api/public/properties?' + new URLSearchParams(params));
  if (!response.ok) throw new Error('public_search_failed');
  return response.json();
}
~~~

Build filters from public data. Retain search, pagination, gallery, WhatsApp, and copy actions using API data. Do not expose status filtering publicly.

- [ ] **Step 3: Verify and commit**

Run: node --test tests/browser/public-contract.test.js  
Manual: search code, city, multiple neighbourhoods, price, and a single listing.  
Expected: only published available records appear and angle brackets are visible text.

~~~
git add public tests/browser/public-contract.test.js
git commit -m "feat: connect public search to Supabase catalogue"
~~~

## Task 9: Build administrator UI

**Owner:** Gemini / Antigravity

**Files:**
- Create: admin/index.html, admin/app.js, admin/style.css, admin/auth.js, admin/properties.js, admin/imports.js, admin/media.js, public/runtime-config.js
- Modify: src/app.js
- Test: tests/browser/admin-contract.test.js

**Interfaces:**
- Browser uses Supabase Auth anonymous key only.
- Browser adds Authorization Bearer token to every /api/admin request.

- [ ] **Step 1: Write failing contracts**

~~~
test('does not request admin data without token', async () => {
  const calls = [];
  await loadProperties({ token: null, fetch: (...args) => calls.push(args) });
  assert.equal(calls.length, 0);
});
test('cannot approve conflicted batch', () => {
  assert.equal(canApproveBatch({ status: 'pronto_para_revisao', conflicts: 1 }), false);
});
~~~

- [ ] **Step 2: Implement auth and screens**

~~~
async function adminFetch(path, options = {}) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error('administrator_session_required');
  return fetch(path, {
    ...options,
    headers: { ...options.headers, Authorization: 'Bearer ' + session.access_token }
  });
}
function canApproveBatch(batch) {
  return batch.status === 'pronto_para_revisao' && batch.conflicts === 0;
}
~~~

Login uses supabase.auth.signInWithPassword in the browser and immediately checks /api/admin/session. A 403 signs out. Implement list/create/edit/archive/reactivate/status/media/audit views plus XML upload or allowed URL, preview counts, conflict resolution, approval, and discard. Do not include a hard-delete UI.

- [ ] **Step 3: Verify and commit**

Run: node --test tests/browser/admin-contract.test.js  
Manual: active admin login, draft save, WebP upload, XML preview, inactive-user 403 sign-out.

~~~
git add admin public/runtime-config.js src/app.js tests/browser/admin-contract.test.js
git commit -m "feat: add administrator dashboard"
~~~

## Task 10: Retire legacy sync and write the operating guide

**Owner:** Gemini / Antigravity for code; Codex for Supabase guide amendments

**Files:**
- Modify: server.js, README.md, docs/supabase-execution.md
- Create: docs/operations/import-runbook.md, tests/integration/legacy-routes.test.js

**Interfaces:**
- Removes public POST /api/sync and all in-memory listing state.
- Preserves GET / and GET /admin static routes.

- [ ] **Step 1: Write failing route-removal test**

~~~
test('does not expose unauthenticated legacy sync', async () => {
  const response = await request(app).post('/api/sync');
  assert.equal(response.status, 404);
});
~~~

- [ ] **Step 2: Remove obsolete server behaviour**

~~~
const { loadEnv } = require('./src/config/env');
const { createServiceClient } = require('./src/config/supabase');
const { createApp } = require('./src/app');
const env = loadEnv();
const app = createApp({ env, supabase: createServiceClient(env) });
app.listen(env.PORT, () => console.log('Server listening on port ' + env.PORT));
~~~

The runbook gives concrete actions: create Auth user; insert UUID in admin_users; run 0001 then 0002; configure environment; preview XML; resolve conflicts; approve or discard; verify public count; reactivate property; inspect property_audit_log. State that recovery uses the selected Supabase plan backup/PITR capability and never a blanket SQL delete.

- [ ] **Step 3: Run complete verification and commit**

Run: npm test && node --check server.js && node --check public/app.js && node --check admin/app.js  
Expected: all tests and syntax checks pass.

~~~
git add server.js README.md docs tests/integration/legacy-routes.test.js
git commit -m "docs: document Supabase property operations"
~~~

## Execution Order and Human Checkpoints

1. Gemini completes Task 1 and stops for review.
2. Codex produces Tasks 2 and 3 SQL. The human runs it in a non-production project and shares verification output without credentials.
3. Gemini completes Tasks 4 through 7 against the non-production project.
4. The human imports a copy of the candidate XML and approves mapping quality before production import.
5. Gemini completes Tasks 8 through 10.
6. Codex reviews SQL execution instructions. The human runs reviewed migrations in production and creates the first administrator.
7. Repeat public smoke tests using a production-safe XML sample before release.

## Phase 2 Boundary: XML Export

Write a separate specification before export work. It must define target partner schema, destination authentication, image URL policy, publication mapping, validation XSD when available, generation schedule, retry policy, and output ownership. Phase 1 tables retain data needed for export but this plan creates no exporter or scheduled job.
