import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PinoLogger, InjectPinoLogger } from 'nestjs-pino';
import * as XLSX from 'xlsx';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * 非销售日程管理：按 (ownerId, weekStart) 一周一条记录。
 * 7 天 × 2 行（上午/下午）共 14 行单元格的 4 列内容存 days JSON：
 *   [{ date: 'YYYY-MM-DD', am: {content, progress, done, remark}, pm: {...} }, ...]
 * 顶部 3 行（计划/总结/领导评定）单独存 planText/summaryText/leaderComment。
 */
@Injectable()
export class WeeklyScheduleService {
  constructor(
    private prisma: PrismaService,
    @InjectPinoLogger(WeeklyScheduleService.name) private readonly logger: PinoLogger,
  ) {}

  /** 按 ownerId + weekStart 拉一条；不存在返回 null */
  async getByWeek(ownerId: number, weekStart: Date) {
    return this.prisma.crmWeeklySchedule.findUnique({
      where: { ownerId_weekStart: { ownerId, weekStart } },
    });
  }

  /** upsert 一条（按 ownerId + weekStart 唯一） */
  async upsert(body: any) {
    const ownerId = Number(body.ownerId);
    const weekStart = body.weekStart instanceof Date
      ? body.weekStart
      : new Date(body.weekStart);
    if (!ownerId || isNaN(weekStart.getTime())) {
      throw new BadRequestException('ownerId / weekStart 必填');
    }
    const data = {
      planText: body.planText ?? null,
      summaryText: body.summaryText ?? null,
      leaderComment: body.leaderComment ?? null,
      days: body.days ?? null,
    };
    return this.prisma.crmWeeklySchedule.upsert({
      where: { ownerId_weekStart: { ownerId, weekStart } },
      create: { ownerId, weekStart, ...data },
      update: data,
    });
  }

  /** 给前端兜底返回结构（含 days 默认 7 天 × 2 行空对象） */
  defaultDays(weekStart: Date) {
    const out: any[] = [];
    const start = new Date(weekStart);
    for (let i = 0; i < 7; i++) {
      const d = new Date(start);
      d.setUTCDate(d.getUTCDate() + i);
      out.push({
        date: d.toISOString().slice(0, 10),
        am: { content: '', progress: '', done: '', remark: '' },
        pm: { content: '', progress: '', done: '', remark: '' },
      });
    }
    return out;
  }

  /**
   * 导出某周日程为 xlsx Buffer
   * 列结构（6 列）：
   *   1 时间范围 | 2 字段(计划/总结/评定/日期/上下午) | 3 工作内容 | 4 完成进度 | 5 是否完成 | 6 备注
   * 行结构（18 行）：
   *   1 本周工作计划(跨5列) | 2 本周工作总结(跨5列) | 3 领导评定(跨5列)
   *   4 表头 | 5-18 7天 × 2行（上午/下午）
   */
  async exportToBuffer(ownerId: number, weekStart: Date): Promise<Buffer> {
    this.logger.info({ ownerId, weekStart: weekStart.toISOString().slice(0, 10) }, 'weekly-schedule export start');
    const row = await this.prisma.crmWeeklySchedule.findUnique({
      where: { ownerId_weekStart: { ownerId, weekStart } },
    });

    const days: any[] = Array.isArray(row?.days) && row.days.length === 7
      ? row.days
      : this.defaultDays(weekStart);

    const start = new Date(weekStart);
    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + 6);
    const fmtYMD = (d: Date) =>
      `${d.getUTCFullYear()}年${d.getUTCMonth() + 1}月${d.getUTCDate()}日`;
    const rangeText = `${fmtYMD(start)} ~ ${fmtYMD(end)}`;

    const weekdayLabels = ['星期一', '星期二', '星期三', '星期四', '星期五', '星期六', '星期日'];
    const dayInfos: any[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(start);
      d.setUTCDate(d.getUTCDate() + i);
      const am = days[i]?.am || {};
      const pm = days[i]?.pm || {};
      dayInfos.push({
        dateLabel: `${d.getUTCDate()}日 ${weekdayLabels[i]}`,
        am: {
          content: am.content ?? '',
          progress: am.progress ?? '',
          done: am.done === true ? '是' : am.done === false ? '否' : '',
          remark: am.remark ?? '',
        },
        pm: {
          content: pm.content ?? '',
          progress: pm.progress ?? '',
          done: pm.done === true ? '是' : pm.done === false ? '否' : '',
          remark: pm.remark ?? '',
        },
      });
    }

    // 6 列 × 18 行二维表
    const aoa: any[][] = [
      [rangeText, '本周工作计划', '', '', '', row?.planText ?? ''],
      ['',          '本周工作总结', '', '', '', row?.summaryText ?? ''],
      ['',          '领导评定',    '', '', '', row?.leaderComment ?? ''],
      ['',          '日期',         '工作内容', '完成进度', '是否完成', '备注'],
    ];
    dayInfos.forEach((day) => {
      aoa.push(['', day.dateLabel, '上午', day.am.content, day.am.progress, day.am.done, day.am.remark]);
      aoa.push(['', '',            '下午', day.pm.content, day.pm.progress, day.pm.done, day.pm.remark]);
    });

    const ws = XLSX.utils.aoa_to_sheet(aoa);

    // 合并单元格：列1跨 18 行；计划/总结/评定 各行 字段+4 列内容 合并为一行
    const merges: XLSX.Range[] = [
      { s: { r: 0, c: 0 }, e: { r: 17, c: 0 } }, // 时间范围 A1:A18
      { s: { r: 0, c: 1 }, e: { r: 0, c: 4 } }, // 本周工作计划 B1:E1
      { s: { r: 0, c: 5 }, e: { r: 17, c: 5 } }, // 备注列 F1:F18 合并（让右侧 4 列纵向成一片）
      //       ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
      //       上面这一行是有意为之吗？不行——这样会丢掉每行独立的"备注"内容。
      //       删除这行。
    ];
    // 上面的合并定义有 bug，重写
    merges.length = 0;
    merges.push({ s: { r: 0, c: 0 }, e: { r: 17, c: 0 } }); // 时间范围 A1:A18
    // 计划/总结/评定：每行把"字段名+工作内容+完成进度+是否完成" 4 列合并成一段，
    // 备注单独放。但页面布局是 5 列（合并后），最右侧"备注"是该行最后一个单元格。
    // 为了和页面 18×6 对齐：把 B-F（列 1-5，即字段+内容）合并为一行
    merges.push({ s: { r: 0, c: 1 }, e: { r: 0, c: 5 } }); // 本周工作计划
    merges.push({ s: { r: 1, c: 1 }, e: { r: 1, c: 5 } }); // 本周工作总结
    merges.push({ s: { r: 2, c: 1 }, e: { r: 2, c: 5 } }); // 领导评定

    // 每天 2 行：日期跨 2 行（和上午/下午并列）
    for (let i = 0; i < 7; i++) {
      const r1 = 4 + i * 2; // 上午所在行
      const r2 = r1 + 1;    // 下午所在行
      merges.push({ s: { r: r1, c: 1 }, e: { r: r2, c: 1 } }); // 日期 B 列跨 2 行
    }

    ws['!merges'] = merges;
    // 列宽
    ws['!cols'] = [
      { wch: 22 }, // 时间范围
      { wch: 14 }, // 字段/日期
      { wch: 14 }, // 上午/下午
      { wch: 50 }, // 工作内容
      { wch: 12 }, // 完成进度
      { wch: 10 }, // 是否完成
      { wch: 24 }, // 备注
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '周日程');
    return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
  }
}