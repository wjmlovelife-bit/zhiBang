// vitest 全局 setup：mock navigator.sendBeacon 避免 happy-dom 实际打 localhost:3000
// sendBeacon 返回 true 让 vitest 看不到 unhandled error
(globalThis as any).navigator = (globalThis as any).navigator || {};
(globalThis as any).navigator.sendBeacon = () => true;