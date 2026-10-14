-- 一次性回填脚本：修复孤儿项目（CrmOpportunity customerId=NULL 但 customerCode 有值）
-- 创建客户 KH202608270002（项目 6/2 的 customerCode 找不到对应客户）+ 回填 3 个项目
-- 加 PG trigger 防再产生

-- 1. 创建缺失的客户 KH202608270002
INSERT INTO "CrmCustomer" (
  "id", "code", "name", "type", "category", "followStage",
  "currencyCode", "isActive", "ownerId", "createdById", "createdAt", "updatedAt"
)
SELECT
  (SELECT COALESCE(MAX("id"), 0) + 1 FROM "CrmCustomer"),
  'KH202608270002',
  '烟雾测试客户（自动回填）',
  '单位客户',
  '系统集成',
  '高',
  '人民币',
  true,
  (SELECT "id" FROM "SysUser" WHERE username = 'admin' LIMIT 1),
  (SELECT "id" FROM "SysUser" WHERE username = 'admin' LIMIT 1),
  NOW(),
  NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM "CrmCustomer" WHERE "code" = 'KH202608270002'
);

-- 2. 回填所有 customerId=NULL 且 customerCode 有匹配客户的项目
UPDATE "CrmOpportunity" o
SET "customerId" = c."id",
    "updatedAt" = NOW()
FROM "CrmCustomer" c
WHERE o."customerCode" = c."code"
  AND o."customerId" IS NULL;

-- 3. 创建 trigger function（自动同步 customerCode → customerId）
CREATE OR REPLACE FUNCTION sync_opportunity_customer() RETURNS trigger AS $$
BEGIN
  IF NEW."customerId" IS NULL
     AND NEW."customerCode" IS NOT NULL
     AND NEW."customerCode" != '' THEN
    SELECT "id" INTO NEW."customerId"
    FROM "CrmCustomer"
    WHERE "code" = NEW."customerCode"
    LIMIT 1;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4. 创建 trigger（在 BEFORE INSERT/UPDATE 时自动反查）
DROP TRIGGER IF EXISTS trg_sync_opportunity_customer ON "CrmOpportunity";
CREATE TRIGGER trg_sync_opportunity_customer
  BEFORE INSERT OR UPDATE OF "customerCode", "customerId"
  ON "CrmOpportunity"
  FOR EACH ROW
  EXECUTE FUNCTION sync_opportunity_customer();

-- 5. 验证：列出所有孤儿项目（应该 0 个）
SELECT COUNT(*) AS remaining_orphans
FROM "CrmOpportunity" o
LEFT JOIN "CrmCustomer" c ON c."code" = o."customerCode"
WHERE o."customerId" IS NULL
  AND o."customerCode" IS NOT NULL
  AND o."customerCode" != '';
