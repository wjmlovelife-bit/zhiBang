/**
 * Jest 全局 setup
 * - 加载 zhibang_test 数据库环境变量
 * - mock 共享依赖
 */
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL
  || 'postgresql://zhibang_app:ZhibangPg@2026@localhost:5432/zhibang_test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret';
process.env.JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';
