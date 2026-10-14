/**
 * 构建带中文文件名的 Content-Disposition 响应头值
 *
 * 背景：Node.js HTTP 头只能包含 ISO 8859-1 字符；中文 UTF-8 字节（如销售日程_2026-09-21.xlsx）
 *      会触发 ERR_INVALID_CHAR，导致 res.setHeader 抛 TypeError → 500。
 *
 * 解决：按 RFC 5987 + RFC 6266 双写 ——
 *   Content-Disposition: attachment;
 *     filename="ascii-fallback";             (老浏览器 / 工具链)
 *     filename*=UTF-8''<percent-encoded>     (现代浏览器拿这个漂亮名)
 *
 * @param cnName 含中文/任意 UTF-8 字符的文件名（含扩展名）
 * @returns 完整的 Content-Disposition 值
 */
export function buildContentDisposition(cnName: string): string {
  // ASCII 后备：把所有非 ASCII 字符替换成 _（老 IE / 简单下载器识别）
  const asciiFallback = cnName.replace(/[^\x20-\x7E]+/g, '_');
  const utf8Encoded = encodeURIComponent(cnName);
  return `attachment; filename="${asciiFallback}"; filename*=UTF-8''${utf8Encoded}`;
}