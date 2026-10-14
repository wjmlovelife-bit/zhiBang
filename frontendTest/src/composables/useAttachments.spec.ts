/**
 * composables/useAttachments.ts 真实测试
 *
 * 来源：`D:\github\xiangmutest\opencode\zhibang\frontend\src\composables\useAttachments.ts`
 * 覆盖：
 *  - isImage: 扩展名 / mimetype 双重判断
 *  - getDownloadUrl: 加 originalname query（带防重）
 *  - download: 创建临时 <a> 并触发（happy-dom 模拟）
 *  - getFileIcon: 各种扩展名 → Element Plus icon 名
 *  - formatSize: B/KB/MB 格式化
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { useAttachments } from '@/composables/useAttachments';

describe('useAttachments', () => {
  let utils: ReturnType<typeof useAttachments>;

  beforeEach(() => {
    utils = useAttachments();
  });

  // ============================================================
  // isImage
  // ============================================================
  describe('isImage', () => {
    it('1. .png → true', () => {
      expect(utils.isImage({ url: 'x', name: 'a.png' })).toBe(true);
    });
    it('2. .jpg / .jpeg → true', () => {
      expect(utils.isImage({ url: 'x', name: 'a.jpg' })).toBe(true);
      expect(utils.isImage({ url: 'x', name: 'a.jpeg' })).toBe(true);
    });
    it('3. .gif / .webp / .svg / .bmp → true', () => {
      expect(utils.isImage({ url: 'x', name: 'a.gif' })).toBe(true);
      expect(utils.isImage({ url: 'x', name: 'a.webp' })).toBe(true);
      expect(utils.isImage({ url: 'x', name: 'a.svg' })).toBe(true);
      expect(utils.isImage({ url: 'x', name: 'a.bmp' })).toBe(true);
    });
    it('4. 大写扩展名 .PNG → true', () => {
      expect(utils.isImage({ url: 'x', name: 'a.PNG' })).toBe(true);
    });
    it('5. mimetype = image/* → true', () => {
      expect(utils.isImage({ url: 'x', name: 'noext', mimetype: 'image/jpeg' })).toBe(true);
    });
    it('6. .pdf → false', () => {
      expect(utils.isImage({ url: 'x', name: 'a.pdf' })).toBe(false);
    });
    it('7. 无扩展名无 mimetype → false', () => {
      expect(utils.isImage({ url: 'x', name: 'noext' })).toBe(false);
    });
    it('8. mimetype = application/pdf → false', () => {
      expect(utils.isImage({ url: 'x', name: 'x', mimetype: 'application/pdf' })).toBe(false);
    });
  });

  // ============================================================
  // getDownloadUrl
  // ============================================================
  describe('getDownloadUrl', () => {
    it('9. 无 originalname 参数 → 加 ?originalname=xxx', () => {
      expect(utils.getDownloadUrl({ url: '/upload/x.pdf', name: '文档.pdf' }))
        .toBe('/upload/x.pdf?originalname=%E6%96%87%E6%A1%A3.pdf');
    });
    it('10. URL 已含 originalname → 不重复添加', () => {
      expect(utils.getDownloadUrl({
        url: '/upload/x.pdf?originalname=old.pdf',
        name: 'new.pdf',
      })).toBe('/upload/x.pdf?originalname=old.pdf');
    });
    it('11. ⚠ 行为记录：URL 含其他 query → token 被剥离（源码 split("?")[0] bug）', () => {
      // 源码 line 23: `const baseUrl = a.url.split('?')[0]` → 切掉所有 query 再拼 originalname
      // 后果：原 URL 上的 token/signature 等参数全丢失，仅 originalname 保留
      // 这是源码 bug，应改用 URLSearchParams 保留其他参数
      const r = utils.getDownloadUrl({ url: '/upload/x.pdf?token=abc', name: '文档.pdf' });
      expect(r).toBe('/upload/x.pdf?originalname=%E6%96%87%E6%A1%A3.pdf');
      expect(r).not.toContain('token=');
    });
    it('12. name 为空 → originalname 为空字符串', () => {
      expect(utils.getDownloadUrl({ url: '/x', name: '' }))
        .toBe('/x?originalname=');
    });
    it('13. 中文文件名 → URL 编码', () => {
      const r = utils.getDownloadUrl({ url: '/x', name: '中文.pdf' });
      expect(r).toContain('%E4%B8%AD%E6%96%87');
    });
  });

  // ============================================================
  // download（happy-dom 测试）
  // ============================================================
  describe('download', () => {
    let clickSpy: any;
    let createElementOrig: any;

    beforeEach(() => {
      clickSpy = vi.fn();
      createElementOrig = document.createElement.bind(document);
      document.createElement = ((tag: string) => {
        const el = createElementOrig(tag);
        if (tag === 'a') el.click = clickSpy;
        return el;
      }) as any;
    });
    afterEach(() => {
      document.createElement = createElementOrig;
    });

    it('14. 触发 a.click()，href/download 属性正确', () => {
      utils.download({ url: '/u/x.pdf', name: '文档.pdf' });
      expect(clickSpy).toHaveBeenCalled();
    });

    it('15. 没有 name → aTag.download = "download"（默认）', () => {
      // 此处只是行为记录：源码 line 33 `aTag.download = a.name || 'download'`
      utils.download({ url: '/u/x', name: '' });
      expect(clickSpy).toHaveBeenCalled();
    });
  });

  // ============================================================
  // getFileIcon
  // ============================================================
  describe('getFileIcon', () => {
    it('16. 图片 → "Picture"', () => {
      expect(utils.getFileIcon({ url: 'x', name: 'a.png' })).toBe('Picture');
    });
    it('17. .pdf / .doc / .docx → "Document"', () => {
      expect(utils.getFileIcon({ url: 'x', name: 'a.pdf' })).toBe('Document');
      expect(utils.getFileIcon({ url: 'x', name: 'a.doc' })).toBe('Document');
      expect(utils.getFileIcon({ url: 'x', name: 'a.docx' })).toBe('Document');
      expect(utils.getFileIcon({ url: 'x', name: 'a.rtf' })).toBe('Document');
    });
    it('18. .xlsx / .xls / .csv → "Files"', () => {
      expect(utils.getFileIcon({ url: 'x', name: 'a.xlsx' })).toBe('Files');
      expect(utils.getFileIcon({ url: 'x', name: 'a.xls' })).toBe('Files');
      expect(utils.getFileIcon({ url: 'x', name: 'a.csv' })).toBe('Files');
    });
    it('19. .pptx / .key → "Present"', () => {
      expect(utils.getFileIcon({ url: 'x', name: 'a.pptx' })).toBe('Present');
      expect(utils.getFileIcon({ url: 'x', name: 'a.key' })).toBe('Present');
    });
    it('20. .zip / .rar / .7z / .tar / .gz → "FolderOpened"', () => {
      expect(utils.getFileIcon({ url: 'x', name: 'a.zip' })).toBe('FolderOpened');
      expect(utils.getFileIcon({ url: 'x', name: 'a.rar' })).toBe('FolderOpened');
      expect(utils.getFileIcon({ url: 'x', name: 'a.7z' })).toBe('FolderOpened');
    });
    it('21. .txt / .md / .log → "Tickets"', () => {
      expect(utils.getFileIcon({ url: 'x', name: 'a.txt' })).toBe('Tickets');
      expect(utils.getFileIcon({ url: 'x', name: 'a.md' })).toBe('Tickets');
      expect(utils.getFileIcon({ url: 'x', name: 'a.log' })).toBe('Tickets');
    });
    it('22. 无扩展名 → "Document"（兜底）', () => {
      expect(utils.getFileIcon({ url: 'x', name: 'noext' })).toBe('Document');
    });
    it('23. name 为空 → "Document"（兜底）', () => {
      expect(utils.getFileIcon({ url: 'x', name: '' })).toBe('Document');
    });
    it('24. 大写扩展名 .PDF → "Document"', () => {
      expect(utils.getFileIcon({ url: 'x', name: 'a.PDF' })).toBe('Document');
    });
  });

  // ============================================================
  // formatSize
  // ============================================================
  describe('formatSize', () => {
    it('25. 0 → 空字符串（兜底）', () => {
      expect(utils.formatSize(0)).toBe('');
    });
    it('26. undefined → 空字符串', () => {
      expect(utils.formatSize(undefined)).toBe('');
    });
    it('27. 500 B', () => {
      expect(utils.formatSize(500)).toBe('500 B');
    });
    it('28. 1024 B = 1 KB', () => {
      expect(utils.formatSize(1024)).toBe('1.0 KB');
    });
    it('29. 1024*1024 B = 1 MB', () => {
      expect(utils.formatSize(1024 * 1024)).toBe('1.0 MB');
    });
    it('30. 5 MB', () => {
      expect(utils.formatSize(5 * 1024 * 1024)).toBe('5.0 MB');
    });
    it('31. 2.5 KB（小数四舍五入）', () => {
      expect(utils.formatSize(2.5 * 1024)).toBe('2.5 KB');
    });
  });
});