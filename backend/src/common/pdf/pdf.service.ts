import { Injectable } from '@nestjs/common';
import { PinoLogger, InjectPinoLogger } from 'nestjs-pino';
import * as os from 'os';

@Injectable()
export class PdfService {
  constructor(@InjectPinoLogger(PdfService.name) private readonly log: PinoLogger) {}

  /** 渲染 HTML 字符串为 A4 PDF(Buffer) */
  async htmlToPdf(html: string): Promise<Buffer> {
    // 优先使用 puppeteer(自带 Chromium)；不可用时回退 playwright-core 并自动探测 Chromium 路径
    let browser: any;
    try {
      const puppeteer = require('puppeteer');
      browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-gpu'] });
    } catch (e) {
      const { chromium } = require('playwright-core');
      browser = await chromium.launch({
        executablePath: await this.findChrome(),
        headless: true,
        args: ['--no-sandbox', '--disable-gpu'],
      });
    }
    try {
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'networkidle' });
      const pdf = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: { top: '15mm', bottom: '15mm', left: '15mm', right: '15mm' },
      });
      return Buffer.from(pdf);
    } finally {
      await browser.close();
    }
  }

  /** 自动探测本机已安装的 Chromium 可执行文件 */
  private async findChrome(): Promise<string> {
    const home = os.homedir();
    const roots = [`${home}/AppData/Local/ms-playwright`, `${home}/.cache/puppeteer`];
    const fsx = require('fs') as typeof import('fs');
    for (const root of roots) {
      try {
        for (const dir of fsx.readdirSync(root)) {
          if (dir.startsWith('chromium') && !dir.includes('headless')) {
            for (const sub of ['chrome-win/chrome.exe', 'chrome-win64/chrome.exe']) {
              const p = `${root}/${dir}/${sub}`;
              try {
                await fsx.promises.access(p);
                return p;
              } catch {}
            }
          }
        }
      } catch {}
    }
    throw new Error('未找到 Chromium，请确认已安装 Playwright/puppeteer Chromium');
  }
}
