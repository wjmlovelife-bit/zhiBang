// 统一前端 logger：
// - dev (import.meta.env.DEV=true)：console 全打（带前缀 + 时间戳）
// - prod：warn/error 打，info/debug 静默（避免泄漏敏感数据 + 性能开销）
// - R15：warn/error 自动调 report() 远程上报到后端 pino（异步、非阻塞、不限流）

const isDev = (() => {
  try {
    return import.meta.env?.DEV ?? false;
  } catch {
    return false;
  }
})();

const ts = () => new Date().toISOString().slice(11, 23); // HH:MM:SS.mmm

function fmt(level: string, args: any[]) {
  return [`[${ts()}] [${level}]`, ...args];
}

// R15：懒加载 report 避免循环依赖
async function reportIfNeeded(level: 'warn' | 'error', msg: string, extra?: any) {
  try {
    const { report } = await import('./report');
    report(level, msg, extra);
  } catch {
    // report 模块加载失败 / sendBeacon 失败：静默
  }
}

export const logger = {
  debug: (...args: any[]) => { if (isDev) console.debug(...fmt('DEBUG', args)); },
  info:  (...args: any[]) => { if (isDev) console.info(...fmt('INFO', args)); },
  warn:  (...args: any[]) => {
    console.warn(...fmt('WARN', args));
    void reportIfNeeded('warn', args.map(a => typeof a === 'string' ? a : JSON.stringify(a)).join(' '), { args });
  },
  error: (...args: any[]) => {
    console.error(...fmt('ERROR', args));
    void reportIfNeeded('error', args.map(a => typeof a === 'string' ? a : JSON.stringify(a)).join(' '), { args });
  },
};