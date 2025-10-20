# GitHub Issue Template - Performance Optimization

**Título del Issue:**
```
🚀 Performance Optimization: 3-5x Backend Improvement Opportunity
```

**Labels:** performance, optimization, high-priority, backend, frontend, database

---

**Body del Issue:**

```markdown
## 📊 Performance Analysis Summary

A comprehensive performance analysis has identified **critical optimization opportunities** that can improve system performance by **3-5x** and enhance user experience significantly.

**Full Analysis:** See [`docs/PERFORMANCE_ANALYSIS_2025.md`](../blob/claude/review-ux-performance-011CUK5DpQ88jzMP9dsULYg8/docs/PERFORMANCE_ANALYSIS_2025.md)

---

## 🎯 Key Findings

### Expected Performance Gains
- ⚡ **Backend:** 3-5x faster response times
- 📦 **Frontend:** 40-60% smaller bundle size
- 🗄️ **Database:** 70-80% query reduction
- ⏱️ **Time to Interactive:** 50% faster

---

## 🔴 Top 5 Critical Bottlenecks

### 1. Window Manager N+1 Queries ⚠️ CRITICAL
**Location:** `supabase/functions/_shared/whatsapp-window-manager.ts:521-562`

**Problem:** 1000 contacts = 1000 individual database queries
**Solution:** Batch query - reduce to 1 query
**Impact:** 99% query reduction, 80% faster

### 2. Scheduler N+1 Pattern ⚠️ CRITICAL
**Location:** `supabase/functions/scheduler_dispatch/index.ts:228-276`

**Problem:** 100 agreements × 5 reminders = 500+ queries in loop
**Solution:** `INSERT ... ON CONFLICT` pattern
**Impact:** From 500 queries to 1, 95% faster

### 3. Webhook Tenant Routing ⚠️ CRITICAL
**Location:** `supabase/functions/wa_webhook/index.ts:164-195`

**Problem:** 3-4 sequential queries to find tenant
**Solution:** Single RPC function with optimized JOINs
**Impact:** 60% faster webhook processing

### 4. Telegram State Management ⚠️ HIGH
**Location:** `supabase/functions/tg_webhook_simple/index.ts:41-96`

**Problem:** Reading/writing full record for metadata JSONB
**Solution:** Dedicated `conversation_states` table
**Impact:** 50% faster + better indexing

### 5. Menu Data Sequential Queries ⚠️ HIGH
**Location:** `supabase/functions/menu-data/index.ts:181-239`

**Problem:** 4+ sequential queries to load user loans
**Solution:** Single RPC function or materialized view
**Impact:** 70% faster menu loading

---

## 🗄️ Missing Database Indexes

Critical indexes that should be added immediately:

```sql
-- Window Manager queries (MOST CRITICAL)
CREATE INDEX idx_whatsapp_messages_window_check
  ON whatsapp_messages(tenant_id, tenant_contact_id, direction, created_at DESC)
  WHERE direction = 'inbound';

-- Agreement queries
CREATE INDEX idx_agreements_active_by_lender
  ON agreements(lender_tenant_contact_id, status, created_at DESC)
  WHERE status IN ('active', 'pending_confirmation');

-- Contact name searches
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX idx_tenant_contacts_name_trgm
  ON tenant_contacts USING gin(name gin_trgm_ops);

-- Message queue processing
CREATE INDEX idx_message_queue_pending
  ON message_queue(tenant_id, status, priority DESC, created_at ASC)
  WHERE status = 'pending';
```

---

## 🎯 Implementation Plan

### Phase 1: Quick Wins (1-2 days) 🚀
**Effort:** Low | **Impact:** High | **Risk:** Minimal

- [ ] Add database indexes (30 min)
- [ ] Implement lazy loading for routes (1 hour)
- [ ] Configure React Query cache (30 min)
- [ ] Remove production logs (30 min)

**Expected gain:** 40-50% immediate improvement

### Phase 2: Critical Backend Optimizations (3-5 days) 🔥
**Effort:** Medium-High | **Impact:** Very High | **Risk:** Medium

- [ ] Create RPC function for tenant routing (2 hours)
- [ ] Implement batch queries in Window Manager (4 hours)
- [ ] Add INSERT ON CONFLICT to scheduler (3 hours)
- [ ] Create conversation_states table + migration (4 hours)
- [ ] Optimize menu-data with RPC function (4 hours)
- [ ] Batch window status in message processor (3 hours)

**Expected gain:** 3-4x backend improvement

### Phase 3: Frontend Refactoring (1 week) 💪
**Effort:** Medium | **Impact:** Medium | **Risk:** Low

- [ ] Connect Dashboard to real API (1 day)
- [ ] Add skeleton loaders (1 day)
- [ ] Implement error boundaries (1 day)
- [ ] Optimize re-renders with React.memo (2 days)
- [ ] Consider CSS Modules migration (2 days - optional)

**Expected gain:** 30-40% improved perceived UX

---

## 📊 Success Metrics

### Before (Current Estimated)
- Webhook response: 800-1500ms
- Scheduler execution: 2-5s
- Queries per scheduler: 500+
- Bundle size: ~250KB
- Time to Interactive: 2-3s

### After (Target)
- Webhook response: 200-400ms ✅ **66% faster**
- Scheduler execution: 300-800ms ✅ **85% faster**
- Queries per scheduler: 10-20 ✅ **96% reduction**
- Bundle size: ~150KB ✅ **40% smaller**
- Time to Interactive: 1-1.5s ✅ **50% faster**

---

## 🛠️ Next Steps

1. **Review** the full analysis document
2. **Prioritize** which phase to implement first (recommend: Phase 1)
3. **Assign** team members to different optimization tracks
4. **Schedule** implementation timeline
5. **Set up** monitoring to measure improvements

---

## 📚 Resources

- **Full Documentation:** [`docs/PERFORMANCE_ANALYSIS_2025.md`](../blob/claude/review-ux-performance-011CUK5DpQ88jzMP9dsULYg8/docs/PERFORMANCE_ANALYSIS_2025.md)
- **Testing Scripts:** Included in analysis document
- **Migration Files:** SQL provided for all database changes

---

## 🏷️ Labels

performance, optimization, backend, frontend, database, high-priority

---

**Analysis Date:** 2025-10-20
**Branch:** `claude/review-ux-performance-011CUK5DpQ88jzMP9dsULYg8`
```

---

## Instrucciones para crear el Issue:

1. Ve a: https://github.com/Customware-cl/payme/issues/new
2. Copia el título desde arriba
3. Copia todo el contenido markdown del body
4. Agrega los labels: performance, optimization, high-priority
5. Crea el issue

Alternativamente, puedes usar este link directo (copia y pega en tu navegador):
```
https://github.com/Customware-cl/payme/issues/new?title=🚀%20Performance%20Optimization:%203-5x%20Backend%20Improvement%20Opportunity&labels=performance,optimization,high-priority
```
