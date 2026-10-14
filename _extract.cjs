const fs = require('fs');
const path = 'C:/Users/魏博/Downloads/ses_fc3cf5da3ffezy2NbOzJTdJ5mL.json';

const data = JSON.parse(fs.readFileSync(path, 'utf8'));
const msgs = data.messages || [];
console.log('TITLE:', data.info?.title);
console.log('DIR:', data.info?.directory);
console.log('TOTAL:', msgs.length);
console.log('\n================= 全部 USER 消息(需求) =================');
msgs.forEach((m, i) => {
  if (m.info?.role !== 'user') return;
  let text = '';
  if (m.parts) for (const p of m.parts) if (p.type === 'text') text += p.text;
  // 去掉过度空白
  text = text.replace(/\s+/g, ' ').trim();
  if (!text) return;
  console.log(`\n----- USER #${i} (len=${text.length}) -----`);
  console.log(text.slice(0, 1200));
});
