-- 公司信息表（单例，全系统引用）
CREATE TABLE IF NOT EXISTS "SysCompany" (
  "id" SERIAL PRIMARY KEY,
  "name" VARCHAR(100) NOT NULL,
  "shortName" VARCHAR(50),
  "bankName" VARCHAR(100),
  "account" VARCHAR(50),
  "phone" VARCHAR(30),
  "address" VARCHAR(300),
  "taxNo" VARCHAR(50),
  "email" VARCHAR(100),
  "website" VARCHAR(200),
  "logoUrl" VARCHAR(500),
  "remark" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);

-- 工作日志·本周总结（按 用户+周 唯一）
CREATE TABLE IF NOT EXISTS "CrmWeekSummary" (
  "id" SERIAL PRIMARY KEY,
  "ownerId" INTEGER NOT NULL,
  "weekStart" TIMESTAMP(3) NOT NULL,
  "content" TEXT,
  "attachments" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CrmWeekSummary_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "SysUser"("id") ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "CrmWeekSummary_ownerId_weekStart_key" ON "CrmWeekSummary"("ownerId", "weekStart");
