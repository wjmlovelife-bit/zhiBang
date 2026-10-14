-- R33 P1-2 优化：CrmCustomer 关键词搜索（contains → ILIKE '%xx%'）从全表 seq scan 改走 GIN trgm 索引
-- 启用扩展（PG 12+ 自带 contrib，CREATE EXTENSION 需要 superuser）
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 为 name / code / pinyin 加 GIN trgm 索引（GIN 索引约比 btree 大 3x，写入慢 2-3x，但搜索 <5ms 即使百万级）
CREATE INDEX IF NOT EXISTS idx_crm_customer_name_trgm
  ON "CrmCustomer" USING gin (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_crm_customer_code_trgm
  ON "CrmCustomer" USING gin (code gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_crm_customer_pinyin_trgm
  ON "CrmCustomer" USING gin ("pinyin" gin_trgm_ops);

-- ANALYZE 让 planner 立即感知新索引（避免首查全表扫）
ANALYZE "CrmCustomer";