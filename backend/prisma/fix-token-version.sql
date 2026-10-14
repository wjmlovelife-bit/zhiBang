-- R32 方案C：JWT tokenVersion 字段
-- 用途：登录时把 SysUser.tokenVersion 写入 JWT payload；改密/改权限时 ++ → 旧 token 立即失效
-- 回填：所有现有用户的默认值 0（ALTER 时自动填），无需手动 backfill
ALTER TABLE "SysUser" ADD COLUMN "tokenVersion" INT NOT NULL DEFAULT 0;