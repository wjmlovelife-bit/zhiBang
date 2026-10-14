/**
 * @OperLog({ module, action }) 装饰器
 * 用法：@OperLog({ module: '客户', action: '创建' }) 在 controller 方法上
 * 优先级高于自动推断（适用于 url 无法精确推断的场景）
 */
import { SetMetadata } from '@nestjs/common';

export const OPER_LOG_KEY = 'oper_log_meta';

export interface OperLogMeta {
  module?: string;
  action?: string;
}

export const OperLog = (meta: OperLogMeta) => SetMetadata(OPER_LOG_KEY, meta);