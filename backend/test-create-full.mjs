// 完整创建客户：上传 2 个附件 + 填充所有字段
import { readFile } from 'node:fs/promises';
import { PrismaClient } from '@prisma/client';

const BASE = 'http://127.0.0.1:3001/api';
const prisma = new PrismaClient();

async function main() {
  // 1. 登录
  const login = await fetch(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: '123456' }),
  });
  const j = await login.json();
  const token = j.access_token || j.token;
  console.log('1. 登录 OK');

  // 2. 上传 1 张图片 + 1 个 txt 文件
  const pngPath = 'D:/github/xiangmutest/opencode/zhibang/backend/uploads/1787900722120-555649492.png';
  const txtPath = 'D:/github/xiangmutest/opencode/zhibang/backend/uploads/1787828969427-276837653.txt';
  const pngBuf = await readFile(pngPath);
  const txtBuf = await readFile(txtPath);

  async function uploadOne(file, name) {
    const fd = new FormData();
    fd.append('file', new Blob([file]), name);
    const r = await fetch(`${BASE}/upload`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: fd,
    });
    if (!r.ok) throw new Error(`上传 ${name} 失败: ${r.status} ${await r.text()}`);
    return r.json();
  }
  const png = await uploadOne(pngBuf, 'test-logo.png');
  const txt = await uploadOne(txtBuf, 'test-doc.txt');
  console.log('2. 上传 2 个附件 OK:', png.originalname, '|', txt.originalname);

  // 3. 构造 payload（所有字段，值合法）
  const payload = {
    name: 'AI测试新建客户',
    pinyin: null,
    type: '单位客户',
    category: '终端公司',
    followStage: '初期沟通',
    source: '独立开发',
    industry: '国防军工',
    valueRating: '高',
    creditLevel: 'AAA',
    currencyCode: '人民币',
    region: ['北京市', '市辖区'],
    stateId: 1,
    cityId: 2,
    districtId: null,
    address: '北京市朝阳区测试地址 1 号',
    zipcode: '100000',
    legalPerson: '张法人',
    registeredCapital: '100',
    park: '中关村科技园',
    phone: '010-12345678',
    fax: '010-87654321',
    email: 'test@example.com',
    website: 'http://www.example.com',
    intro: '这是一个 AI 自动化测试创建的客户',
    cooperationStatus: '初次接触',
    prospect: '有合作意向',
    strategy: '持续跟进',
    bankName: '中国工商银行',
    accountName: 'AI测试新建客户',
    bankAccount: '6222021234567890123',
    bankCode: '102100000001',
    bankAddress: '北京市西城区',
    bankPhone: '010-12345678',
    taxId: '91110000XXXXXXXX1X',
    paymentDays: 30,
    settleDay: 15,
    settleContact: '李结算',
    paymentLimitPct: '30',
    invoiceTitle: 'AI测试新建客户',
    invoiceBank: '中国工商银行',
    invoiceBankAccount: '6222021234567890123',
    sharedUserIds: [],
    contacts: [
      {
        name: '张联系人',
        gender: '男',
        department: '研发部',
        position: '经理',
        mobile: '13800138000',
        wechat: 'test_wechat',
        officePhone: '010-12345678',
        fax: '010-87654321',
      },
    ],
    attachments: [png, txt],
    remark: '这是 AI 自动化测试的备注\n第二行\n第三行',
    submitStatus: 'active',
  };

  console.log('\n3. payload 字段数:', Object.keys(payload).length);
  console.log('   contacts 数量:', payload.contacts.length);
  console.log('   attachments 数量:', payload.attachments.length);

  // 4. 调 create
  console.log('\n4. 调 POST /api/customer ...');
  const r = await fetch(`${BASE}/customer`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload),
  });
  console.log('   状态:', r.status);
  const text = await r.text();
  console.log('   body:', text.slice(0, 500));
  if (r.ok) {
    const created = JSON.parse(text);
    console.log('\n   创建成功, id:', created.id, 'name:', created.name);
    console.log('   attachments 保存数量:', created.attachments?.length);
  }
}

main()
  .catch((e) => console.log('主错误:', e.message))
  .finally(() => prisma.$disconnect());
