# Scalability Analysis: 100 → 10K → 1M Users

_Generated 2026-04-01 — based on full codebase audit_

## Current Architecture Summary

- **Backend**: Single Express.js process, stateless, no database
- **Caching**: All in-memory (no Redis)
- **Rate Limiting**: Per-process in-memory (`express-rate-limit`)
- **External APIs**: Aladhan (prayer times), OpenAI (dua matching), Google Maps (mosques)
- **Frontend**: Expo/React Native, all user data in AsyncStorage (on-device)
- **Docs Site**: Static HTML on GitHub Pages (sirat.dev)
- **Infrastructure**: No Docker, no IaC, no APM, no centralized logging

---

## At 100 Users: Works Fine

The current architecture handles this comfortably. A single Express process with in-memory caching and external API proxying is well-suited for a small user base.

### Minor issues

- **Cold start latency**: First requests after deploy hit Aladhan/OpenAI with no cache — 1-3s delays until caches warm
- **Dua endpoint cost**: Every dua request calls OpenAI GPT-4 Turbo (~$0.01-0.03/call). At 100 users ~$50-100/mo
- **No error visibility**: No APM (Sentry, Datadog) means broken things go unnoticed unless users report them

---

## At 10,000 Users: Cracks Appear

### Backend bottlenecks

| Issue | Why it hurts | Impact |
|-------|-------------|--------|
| **In-memory rate limiting** | `express-rate-limit` stores counters in process memory. Multiple instances behind a load balancer each track separately — users get N× their actual limit | Rate limits become ineffective |
| **In-memory caching** | Cache is per-process. Two instances = double the upstream API calls, no shared cache | Cache miss storms on Aladhan, possible 429s |
| **Single process / no clustering** | Node.js is single-threaded. A slow OpenAI call (10s timeout) doesn't block the event loop per se, but CPU-bound work does | Tail latency spikes under concurrent load |
| **OpenAI costs** | At 10K users dua requests could hit $500-2,000/mo | Cost scales linearly with no response caching |
| **Google Maps API costs** | Mosque search hits Google Places every request (24hr client-side cache only) | Potentially $1K+/mo |
| **No request timeout on apiClient** | Frontend `fetch()` has no configured timeout — if backend hangs, the app spins | Poor UX during backend issues |

### Infrastructure gaps

- **No Docker/containerization**: Deploying, scaling, and rolling back is manual and error-prone
- **Health endpoints don't verify upstream dependencies** (Aladhan, OpenAI, Google Maps)
- **No structured logging**: `console.log` to stdout — no searchable logs, no correlation IDs
- **Duas loaded from filesystem** (`process.cwd()/public/duas.json`): Breaks with read-only containers or serverless

### Frontend concerns

- **4.1 MB Quran JSON bundled in-app**: Increases download size and startup memory on low-end devices
- **AsyncStorage not batched**: Sequential `getItem`/`setItem` instead of `multiGet`/`multiSet`
- **No request deduplication in apiClient**: Quick navigation fires duplicate requests

---

## At 1,000,000 Users: Fundamental Redesign Needed

### 1. No database = no user data at scale

Currently stateless — all user data lives on-device in AsyncStorage:
- No cross-device sync (new phone = lost bookmarks, settings, reading progress)
- No analytics on actual usage patterns
- No server-side targeted notifications

At 1M users you need user accounts and a database (PostgreSQL + Redis minimum).

### 2. External API dependencies become single points of failure

| Dependency | Risk at 1M users |
|-----------|------------------|
| **Aladhan API** | Free tier will rate-limit you. Compute prayer times locally instead (the math is well-documented) or negotiate enterprise access |
| **OpenAI API** | $50K-200K/mo. Cache responses by category/intent, use a smaller model, or fine-tune a local model |
| **Google Maps API** | $10K-50K/mo. Consider OpenStreetMap + Overpass API for mosque data |

### 3. In-memory everything collapses

- Need **Redis** for shared cache, rate limit counters, session storage
- Need **a CDN** (Cloudflare/Fastly) in front of the API for static responses and DDoS protection
- Need **multiple backend instances** behind a load balancer — all in-memory state must be externalized

### 4. No horizontal scaling path

- Current: 1 Express process → serves everything
- Needed: Load balancer → N stateless Express instances → Redis → PostgreSQL
- No clustering, no PM2, no container orchestration

### 5. Notification scheduling won't work

Currently all notification scheduling is client-side via `expo-notifications`:
- OS-level notification limits cause missed prayers at scale
- No server-side push system (FCM/APNs)
- No way to send announcements, Ramadan reminders, or holiday greetings

### 6. No observability

At 1M users without APM you're flying blind:
- Distributed tracing (OpenTelemetry)
- Error tracking (Sentry)
- Metrics dashboards (Grafana/Datadog)
- Alerting on error rates, latency percentiles, upstream failures

### 7. OTA update risk

Expo OTA updates push to all users simultaneously. At 1M users a bad update bricks everyone:
- Need staged rollouts (1% → 10% → 100%)
- Feature flags
- Instant rollback capability

---

## Priority Fixes by Stage

### To reach 10K (quick wins)

- [ ] Add Redis for shared cache + rate limiting (`rate-limit-redis`)
- [ ] Add Sentry for error tracking (backend + frontend)
- [ ] Dockerize the backend
- [ ] Add request timeouts to frontend apiClient
- [ ] Cache dua AI responses by category (avoid redundant OpenAI calls)
- [ ] Batch AsyncStorage operations with `multiGet`/`multiSet`
- [ ] Remove unused `axios` dependency from frontend

### To reach 1M (architectural changes)

- [ ] Compute prayer times locally instead of proxying Aladhan
- [ ] Replace Google Maps with self-hosted mosque database
- [ ] Add PostgreSQL + user accounts for cross-device sync
- [ ] Implement server-side push notifications (FCM/APNs)
- [ ] Deploy behind CDN with edge caching
- [ ] Kubernetes or ECS for auto-scaling
- [ ] OpenTelemetry for distributed tracing
- [ ] Staged OTA rollouts with feature flags
