-- R17 3.2: 给 CrmSalesSchedule 加 daysSnapshot Json? 字段
-- 作用：销售主动 upsert 时（提交计划/总结）冻结当时的 days 聚合快照
--       后续 follow 被改/删，历史查看仍保留快照版本
-- 执行：psql -U postgres -d zhibang -f backend/prisma/migrations/2026-09-28-r17-days-snapshot.sql

ALTER TABLE "CrmSalesSchedule"
  ADD COLUMN IF NOT EXISTS "daysSnapshot" JSONB;

-- 回滚（如需）：
-- ALTER TABLE "CrmSalesSchedule" DROP COLUMN IF EXISTS "daysSnapshot";