import {
  Controller,
  Post,
  Get,
  Param,
  Req,
  Res,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { PinoLogger, InjectPinoLogger } from 'nestjs-pino';
import { diskStorage } from 'multer';
import { existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import type { Response, Request } from 'express';
import { Public } from '../../common/decorators/public.decorator';
import { ApiTags } from '@nestjs/swagger';

const UPLOAD_DIR = join(process.cwd(), 'uploads');
const ALLOWED = ['.png', '.jpg', '.jpeg', '.gif', '.bmp', '.webp', '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.txt', '.zip'];

@ApiTags('文件上传')
@Controller('upload')
export class UploadController {
  constructor(@InjectPinoLogger(UploadController.name) private readonly logger: PinoLogger) {}

  @Post()
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (_req, _file, cb) => {
          if (!existsSync(UPLOAD_DIR)) mkdirSync(UPLOAD_DIR, { recursive: true });
          cb(null, UPLOAD_DIR);
        },
        filename: (_req, file, cb) => {
          const ext = (file.originalname.match(/\.[^.]+$/) || [''])[0].toLowerCase();
          const name = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
          cb(null, name);
        },
      }),
      limits: { fileSize: 20 * 1024 * 1024 },
      fileFilter: (_req, file, cb) => {
        const ext = (file.originalname.match(/\.[^.]+$/) || [''])[0].toLowerCase();
        if (!ALLOWED.includes(ext)) return cb(new BadRequestException(`不支持的文件类型: ${ext}`), false);
        cb(null, true);
      },
    }),
  )
  upload(@UploadedFile() file: any, @Req() req: any) {
    if (!file) throw new BadRequestException('未接收到文件');
    const decodedName = decodeOriginalname(file.originalname);
    this.logger.info({ userId: req?.user?.id, filename: file.filename, originalname: decodedName, size: file.size, mimetype: file.mimetype }, 'upload done');
    return {
      url: `/api/upload/${file.filename}?originalname=${encodeURIComponent(decodedName)}`,
      filename: file.filename,
      originalname: decodedName,
      size: file.size,
      mimetype: file.mimetype,
    };
  }

  @Get(':filename(.*)')
  @Public()
  getFile(@Param('filename') filename: string, @Req() req: Request, @Res() res: Response) {
    // 防目录穿越
    if (filename.includes('/') || filename.includes('\\') || filename.includes('..')) {
      throw new BadRequestException('非法的文件名');
    }
    const full = join(UPLOAD_DIR, filename);
    if (!existsSync(full)) throw new NotFoundException('文件不存在');

    // 优先从 query 拿原始文件名（前端传过来的 UTF-8），无则用 filename
    let originalName = filename;
    if (req.query.originalname) {
      try {
        originalName = decodeURIComponent(req.query.originalname as string);
      } catch {
        originalName = filename;
      }
    }

    // RFC 5987 支持 UTF-8 文件名（兼容老 IE）
    const ua = (req.headers['user-agent'] || '') as string;
    const isIE = ua.includes('MSIE') || ua.includes('Trident');
    const asciiSafe = originalName.replace(/[^\x20-\x7E]/g, '_');
    const disposition = isIE
      ? `attachment; filename="${encodeURIComponent(originalName)}"`
      : `attachment; filename="${asciiSafe}"; filename*=UTF-8''${encodeURIComponent(originalName)}`;

    res.setHeader('Content-Disposition', disposition);
    res.setHeader('Cache-Control', 'private, max-age=0, must-revalidate');
    return res.sendFile(full);
  }
}

/**
 * 中文文件名解码：
 * Node 的 HTTP body 解析按 latin1 接收字节，所以客户端发的 UTF-8 字节会被当成 latin1 字符串存储
 * （每个中文字符变成 3 个 latin1 字符 = 看起来是"乱码字符串"，但每个字符正好对应原始 UTF-8 字节）
 * 解码思路：把这串乱码字符串重新编码为 latin1 Buffer（拿到原始 UTF-8 字节），再按 UTF-8 解码即可。
 * 如果检测到不含中文（纯 ASCII 或 macOS/Linux 上传），直接返回原值。
 */
function decodeOriginalname(raw: string): string {
  if (!raw) return raw;
  // 纯 ASCII 直接返回
  // eslint-disable-next-line no-control-regex
  if (/^[\x00-\x7F]*$/.test(raw)) return raw;
  // 先按 latin1 还原 Buffer（拿到客户端原始 UTF-8 字节）
  const buf = Buffer.from(raw, 'latin1');
  // 再按 UTF-8 解码
  const decoded = buf.toString('utf8');
  // 如果解码失败（含 U+FFFD 替换字符），说明原始不是 UTF-8，尝试 GBK
  if (!decoded.includes('\uFFFD') && decoded.length > 0) return decoded;
  // 尝试 GBK 解码（兼容 Windows 老 GBK 客户端）
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const iconv = require('iconv-lite');
    const gbkDecoded = iconv.decode(buf, 'gbk');
    if (gbkDecoded && !gbkDecoded.includes('\uFFFD') && gbkDecoded.length > 0) return gbkDecoded;
  } catch {
    /* ignore */
  }
  // 实在不行返回原值
  return raw;
}