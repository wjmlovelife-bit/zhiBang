/**
 * UploadController 单元测试（覆盖 modules/upload/upload.controller.ts）
 *
 * 说明：控制器无构造依赖，可直接实例化。
 * - getFile：目录穿越拦截（/、\、..）与文件不存在（NotFoundException）为真实方法逻辑，可直接测。
 * - upload：方法内调用 decodeOriginalname（中文 latin1→UTF-8 解码）；直接传假 file 对象即可测解码，
 *   无需真正跑 multer。
 * - 20MB 大小限制与扩展名/mime 白名单位于 multer 的 fileFilter（仅 multer 实际处理时触发），
 *   属集成测试范畴，未在此单测覆盖（见备注）。
 */
import { UploadController } from '@app/modules/upload/upload.controller';
import { BadRequestException, NotFoundException } from '@nestjs/common';

describe('UploadController', () => {
  let controller: UploadController;

  beforeEach(() => {
    controller = new UploadController();
  });

  // ===== getFile 防目录穿越 =====
  it('1. 目录穿越拒绝（../）', () => {
    expect(() => controller.getFile('../../../etc/passwd', {} as any, {} as any))
      .toThrow(BadRequestException);
  });

  it('2. 目录穿越拒绝（绝对路径 /）', () => {
    expect(() => controller.getFile('/etc/passwd', {} as any, {} as any))
      .toThrow(BadRequestException);
  });

  it('3. 目录穿越拒绝（Windows \\）', () => {
    expect(() => controller.getFile('..\\..\\win.ini', {} as any, {} as any))
      .toThrow(BadRequestException);
  });

  it('4. 合法文件名但文件不存在 → NotFoundException', () => {
    expect(() => controller.getFile('nonexistent.png', {} as any, {} as any))
      .toThrow(NotFoundException);
  });

  // ===== upload 方法（decodeOriginalname 解码）=====
  it('5. upload：ASCII 文件名原样返回', () => {
    const file = { originalname: 'report.pdf', filename: '123-report.pdf', size: 100, mimetype: 'application/pdf' };
    const out: any = controller.upload(file as any);
    expect(out.originalname).toBe('report.pdf');
    expect(out.filename).toBe('123-report.pdf');
    expect(out.url).toContain('/api/upload/123-report.pdf');
  });

  it('6. upload：latin1 字节串 → UTF-8 中文解码', () => {
    // 模拟 Node 按 latin1 接到的原始 UTF-8 字节串
    const raw = Buffer.from('测试报告.png', 'utf8').toString('latin1');
    const file = { originalname: raw, filename: 'x.png', size: 200, mimetype: 'image/png' };
    const out: any = controller.upload(file as any);
    expect(out.originalname).toBe('测试报告.png');
  });
});
