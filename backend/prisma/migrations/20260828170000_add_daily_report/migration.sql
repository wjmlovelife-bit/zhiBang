-- 工作日报（按 用户+日期 唯一）
CREATE TABLE IF NOT EXISTS "CrmDailyReport" (
  "id" SERIAL PRIMARY KEY,
  "ownerId" INTEGER NOT NULL,
  "date" TIMESTAMP(3) NOT NULL,
  "content" TEXT,
  "attachments" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CrmDailyReport_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "SysUser"("id") ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "CrmDailyReport_ownerId_date_key" ON "CrmDailyReport"("ownerId", "date");
CREATE INDEX IF NOT EXISTS "CrmDailyReport_ownerId_date_idx" ON "CrmDailyReport"("ownerId", "date");
