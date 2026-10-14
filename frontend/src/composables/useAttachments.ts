// 统一的附件操作 composable
// 用法：const { isImage, getDownloadUrl, download, getFileIcon } = useAttachments();
import type { Ref } from 'vue';

export interface Attachment {
  url: string;
  name: string;
  size?: number;
  mimetype?: string;
}

/** 判断是否为图片（基于扩展名或 mimetype）*/
function isImage(a: Attachment): boolean {
  const name = (a.name || '').toLowerCase();
  if (name.match(/\.(png|jpe?g|gif|bmp|webp|svg)$/i)) return true;
  if (a.mimetype?.startsWith('image/')) return true;
  return false;
}

/** 获取下载 URL（带 originalname query 让后端用作下载名）*/
function getDownloadUrl(a: Attachment): string {
  // 去掉 URL 上已有的 query，避免重复添加
  const baseUrl = a.url.split('?')[0];
  // 如果 URL 已经包含 originalname 参数，不再添加
  if (a.url.includes('originalname=')) return a.url;
  return `${baseUrl}?originalname=${encodeURIComponent(a.name || '')}`;
}

/** 触发浏览器下载（用动态创建 <a download>，避免新标签打开）*/
function download(a: Attachment) {
  const aTag = document.createElement('a');
  aTag.href = getDownloadUrl(a);
  aTag.download = a.name || 'download';
  aTag.style.display = 'none';
  document.body.appendChild(aTag);
  aTag.click();
  document.body.removeChild(aTag);
}

/** 获取文件类型对应的 Element Plus icon 名称 */
function getFileIcon(a: Attachment): string {
  const name = (a.name || '').toLowerCase();
  if (isImage(a)) return 'Picture';
  if (/\.pdf$/i.test(name)) return 'Document';
  if (/\.(docx?|rtf)$/i.test(name)) return 'Document';
  if (/\.(xlsx?|csv)$/i.test(name)) return 'Files';
  if (/\.(pptx?|key)$/i.test(name)) return 'Present';
  if (/\.(zip|rar|7z|tar|gz)$/i.test(name)) return 'FolderOpened';
  if (/\.(txt|md|log)$/i.test(name)) return 'Tickets';
  return 'Document';
}

/** 格式化文件大小（B/KB/MB）*/
function formatSize(bytes?: number): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function useAttachments() {
  return { isImage, getDownloadUrl, download, getFileIcon, formatSize };
}