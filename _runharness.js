/* 用无头 Chrome 跑 _test-harness.html，把 PASS / FAIL 打出来
 * 用法：node _runharness.js [虚拟时间预算ms]
 * 退出码：全过 0，有失败 1，跑不起来 2
 */
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const DIR = __dirname;
const CANDIDATES = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
];
const BROWSER = CANDIDATES.find((f) => fs.existsSync(f));
if (!BROWSER) {
  console.error('找不到 Chrome / Edge，跳过 UI 回归。');
  process.exit(2);
}

// 先按最新的 content/*.js 重新生成测试页
execFileSync(process.execPath, [path.join(DIR, '_gentest.js')], { stdio: 'ignore' });

const page = 'file:///' + path.join(DIR, '_test-harness.html').replace(/\\/g, '/');
const budget = String(process.argv[2] || process.env.QC_BUDGET || 60000);

let dom = '';
try {
  dom = execFileSync(
    BROWSER,
    [
      '--headless=new',
      '--disable-gpu',
      '--no-sandbox',
      '--disable-dev-shm-usage',
      '--virtual-time-budget=' + budget,
      '--dump-dom',
      page
    ],
    { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'], timeout: 180000 }
  );
} catch (e) {
  console.error('浏览器没跑起来：' + (e && e.message));
  process.exit(2);
}

const m = dom.match(/<div id="out">([\s\S]*?)<\/div>/);
if (!m) {
  console.error('页面没跑到结果区（#out 还是空的）。把 --virtual-time-budget 调大再试。');
  process.exit(2);
}

const text = m[1]
  .replace(/&lt;/g, '<')
  .replace(/&gt;/g, '>')
  .replace(/&quot;/g, '"')
  .replace(/&amp;/g, '&');

const lines = text.split('\n').filter((l) => /^(PASS|FAIL) \|/.test(l));
if (!lines.length) {
  console.error('结果区没有断言。原始内容开头：' + text.slice(0, 200));
  process.exit(2);
}

const failed = lines.filter((l) => l.startsWith('FAIL'));
lines.forEach((l) => console.log(l));
console.log('');
console.log(`${lines.length - failed.length} passed, ${failed.length} failed`);
process.exit(failed.length ? 1 : 0);
