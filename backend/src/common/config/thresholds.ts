/**
 * 慢告警阈值配置（R15）
 * - slowQuery:    SQL > 2000ms 升级为 warn 级别（Prisma $on('query') 监听）
 * - slowRequest:  HTTP > 2000ms 升级为 warn 级别（LoggingInterceptor 监听）
 * - 默认 2000ms（用户 R15 决策：统一阈值）；可读环境变量覆盖
 *
 * 警告：阈值过小（< 100ms）会让正常请求刷 warn，过大（> 5000ms）失去预警意义
 */
export const THRESHOLDS = {
  slowQuery: Number(process.env.SLOW_QUERY_MS) || 2000,
  slowRequest: Number(process.env.SLOW_REQUEST_MS) || 2000,
};