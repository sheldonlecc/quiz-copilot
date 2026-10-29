/* 临时脚本：不依赖浏览器，用最小 DOM 桩验证「代码编辑器不算填空」这条改动 */
const vm = require('vm');
const fs = require('fs');
const path = require('path');

const DIR = __dirname;

function tokens(cls) {
  return String(cls || '').split(/\s+/).filter(Boolean);
}

function matches(el, sel) {
  return String(sel)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .some((s) => {
      if (s.startsWith('.')) return tokens(el.className).indexOf(s.slice(1)) >= 0;
      if (s.startsWith('#')) return el.id === s.slice(1);
      return el.tagName === s.toUpperCase();
    });
}

function makeEl(tag, opt) {
  const o = opt || {};
  const el = {
    tagName: String(tag).toUpperCase(),
    nodeType: 1,
    isConnected: true,
    id: o.id || '',
    className: o.cls || '',
    value: o.value || '',
    textContent: o.text || '',
    innerText: o.inner == null ? o.text || '' : o.inner,
    disabled: false,
    readOnly: false,
    rows: 2,
    style: {},
    dataset: {},
    attributes: {},
    parentElement: null,
    ownerDocument: null,
    children: [],
    isContentEditable: !!o.editable,
    getAttribute(k) { return k in this.attributes ? this.attributes[k] : null; },
    setAttribute(k, v) { this.attributes[k] = String(v); },
    hasAttribute(k) { return k in this.attributes; },
    closest(sel) {
      let n = this;
      while (n) {
        if (n.nodeType === 1 && matches(n, sel)) return n;
        n = n.parentElement;
      }
      return null;
    },
    querySelector() { return null; },
    querySelectorAll() { return []; },
    appendChild(c) { c.parentElement = this; this.children.push(c); return c; },
    remove() {
      if (this.parentElement) {
        const a = this.parentElement.children;
        const i = a.indexOf(this);
        if (i >= 0) a.splice(i, 1);
      }
      this.isConnected = false;
    },
    getBoundingClientRect() { return { left: 0, top: 0, width: 400, height: 120, right: 400, bottom: 120 }; },
    addEventListener() {},
    removeEventListener() {},
    dispatchEvent() { return true; },
    focus() {},
    contains(n) { return n === this; }
  };
  return el;
}

const body = makeEl('body');
const codeEditors = [];
const descs = [];

const document = {
  nodeType: 9,
  documentElement: body,
  body,
  head: body,
  createElement: (t) => makeEl(t),
  createTextNode: (t) => ({ nodeType: 3, nodeValue: t }),
  getElementById: () => null,
  querySelector: (sel) => {
    const s = String(sel || '');
    if (s.indexOf('.monaco-editor') >= 0) return codeEditors[0] || null;
    if (s.indexOf('description_content') >= 0) return descs[0] || null;
    return null;
  },
  querySelectorAll: (sel) => {
    const s = String(sel || '');
    if (s.indexOf('.monaco-editor') >= 0) return codeEditors.slice();
    if (s.indexOf('description_content') >= 0) return descs.slice();
    return [];
  },
  addEventListener() {},
  removeEventListener() {},
  visibilityState: 'visible',
  hidden: false,
  execCommand() { return false; },
  defaultView: null
};
body.ownerDocument = document;

const sandbox = {
  document,
  location: { href: 'https://example.com/problem' },
  navigator: { userAgent: 'node' },
  console: { info() {}, warn() {}, error() {}, log() {} },
  chrome: {
    runtime: { getManifest: () => ({ version: 'test' }) },
    storage: {
      sync: { get() {}, set() {}, remove() {} },
      local: { get() {}, set() {}, remove() {} },
      onChanged: { addListener() {} }
    }
  },
  getComputedStyle: () => ({ display: 'block', visibility: 'visible', opacity: '1' }),
  matchMedia: () => ({ matches: false, addEventListener() {} }),
  setTimeout,
  clearTimeout,
  setInterval,
  clearInterval,
  performance: { now: () => Date.now() },
  requestAnimationFrame: (fn) => setTimeout(() => fn(Date.now()), 0),
  cancelAnimationFrame: (id) => clearTimeout(id)
};
sandbox.window = sandbox;
sandbox.globalThis = sandbox;

vm.createContext(sandbox);

for (const f of ['00-core.js', '10-choice.js', '15-text.js', '20-blank.js', '30-match.js', '40-extract.js', '42-code.js', '45-solve.js']) {
  const code = fs.readFileSync(path.join(DIR, 'quiz-copilot/content', f), 'utf8');
  vm.runInContext(code, sandbox, { filename: f });
}

const Q = sandbox.window.__QC;
const lines = [];
const rec = (name, ok, extra) => {
  lines.push((ok ? 'PASS' : 'FAIL') + ' | ' + name + (extra != null ? ' | ' + extra : ''));
};

/* 造一个 Monaco 结构 */
const mon = makeEl('div', {
  cls: 'monaco-editor',
  inner: 'class Solution {\npublic:\n    int add(int a, int b) {\n        // 补全这里\n    }\n};'
});
const ta = makeEl('textarea', { cls: 'inputarea', value: 'class Solution {};' });
mon.appendChild(ta);
ta.ownerDocument = document;
mon.ownerDocument = document;

rec('inCodeEditor true inside editor', Q.inCodeEditor(ta) === true);

codeEditors.push(mon);
const r1 = Q.checkFillable(ta);
rec('editor textarea rejected', r1.ok === false && r1.why === '在代码编辑器里', JSON.stringify(r1));
rec('hasCodeEditor', Q.hasCodeEditor() === true);
rec('pageKind is code-judge', Q.pageKind() === 'code-judge', Q.pageKind());
rec('KIND_TEXT labels it', Q.KIND_TEXT['code-judge'] === '编程题页面（有代码编辑器）', Q.KIND_TEXT['code-judge']);
const hint = Q.noQuestionHint();
rec('hint mentions 编程题', hint.indexOf('编程题') >= 0, hint.slice(0, 30));

/* 判题页：不再产出填空，但要把整页读成一道「编程题」 */
body.innerText = '1. 下列哪个说法正确？\nA. 甲\nB. 乙\n';

const desc = makeEl('div', {
  text:
    '题目描述\n给你两个整数 a 和 b，返回它们的和。\n\n示例 1：\n输入：a = 1, b = 2\n输出：3\n\n' +
    '提示：-1000 <= a, b <= 1000，结果不会溢出。'
});
desc.ownerDocument = document;
descs.push(desc);

let onJudge = [];
try {
  onJudge = Q.extractAll();
} catch (e) {
  onJudge = [{ type: 'threw:' + e.message, stem: '', template: '' }];
}
rec('judge page yields one code question', onJudge.length === 1 && onJudge[0].type === 'code',
  onJudge.length + ' types=' + onJudge.map((q) => q.type).join(',') + ' kind=' + Q.pageKind());
rec('code question keeps stem', String(onJudge[0] && onJudge[0].stem).indexOf('返回它们的和') >= 0,
  String(onJudge[0] && onJudge[0].stem).slice(0, 24));
rec('code question reads template', String(onJudge[0] && onJudge[0].template).indexOf('class Solution') >= 0,
  JSON.stringify(String(onJudge[0] && onJudge[0].template).slice(0, 20)));
rec('no blank/essay on judge page', onJudge.every((q) => q.type !== 'blank' && q.type !== 'essay'));
rec('guessLang -> C++', Q.guessLang('class Solution {\npublic:\n  int f();\n};') === 'C++', Q.guessLang('class Solution {}'));

/* 提示词：题面和模板都要带上，并且明确要「思路」 */
const cp = Q.buildCodePrompt(onJudge[0]);
rec('prompt has stem', cp.indexOf('返回它们的和') >= 0);
rec('prompt has template', cp.indexOf('class Solution') >= 0);
rec('prompt asks 思路', cp.indexOf('思路：') >= 0);

/* 解析模型回复 */
const cr1 = Q.parseCodeReply(
  '思路：两数相加即可。\n复杂度：时间 O(1)，空间 O(1)\n```cpp\nclass Solution {\npublic:\n    int add(int a, int b) { return a + b; }\n};\n```'
);
rec('parse fenced code', cr1.code.indexOf('return a + b') >= 0, cr1.code.split('\n').length + ' lines');
rec('parse idea', cr1.reason.indexOf('两数相加') >= 0, cr1.reason.slice(0, 18));
rec('parse lang from code', cr1.lang === 'C++', cr1.lang);

const cr2 = Q.parseCodeReply('思路：直接返回。\n```python\ndef add(a, b):\n    return a + b\n```');
rec('parse python fence', cr2.lang === 'Python' && cr2.code.indexOf('def add') >= 0, cr2.lang + ' / ' + cr2.code.split('\n').length + ' 行');

const cr3 = Q.parseCodeReply('思路：直接算。\n#include <bits/stdc++.h>\nint main(){int a,b;std::cin>>a>>b;std::cout<<a+b;}');
rec('parse unfenced code', cr3.code.indexOf('int main') >= 0, cr3.code.slice(0, 20));

let threw = '';
try {
  Q.parseCodeReply('思路：这题我不会。');
} catch (e) {
  threw = e.message;
}
rec('refusal -> throws instead of writing prose', !!threw, threw.slice(0, 22));

codeEditors.length = 0;
let offJudge = [];
try {
  offJudge = Q.extractAll();
} catch (e) {
  offJudge = [];
}
rec('questions come back off judge page', offJudge.length >= 1,
  offJudge.length + ' types=' + offJudge.map((q) => q.type).join(',') + ' kind=' + Q.pageKind() + ' text=' + JSON.stringify(String(body.innerText).slice(0, 20)));

rec('pageKind back to generic', Q.pageKind() === 'generic', Q.pageKind());
rec('hasCodeEditor false after removal', Q.hasCodeEditor() === false);

/* 对照：代码编辑器外面的 textarea 不该被这条规则拦掉 */
const plain = makeEl('textarea', { cls: 'answer' });
body.appendChild(plain);
plain.ownerDocument = document;
let plainWhy = '';
try {
  plainWhy = Q.checkFillable(plain).why;
} catch (e) {
  plainWhy = 'threw:' + e.message;
}
rec('plain textarea not blocked by code rule', plainWhy !== '在代码编辑器里', plainWhy || '(passed)');

/* 诊断面板也要说清楚是编程题，别写成「没读出来」 */
codeEditors.push(mon);
let dg = '';
try {
  dg = Q.diagnose();
} catch (e) {
  dg = 'threw:' + e.message;
}
rec('diagnose explains code page', dg.indexOf('编程题') >= 0 && dg.indexOf('读到的题面') >= 0, dg.slice(-46));
codeEditors.length = 0;

/* ============================================================
 * 走一遍 solve()：编程题必须走 QC_CODE 通道，不能被塞进 JSON 那批
 * ============================================================ */
const sentTypes = [];
sandbox.chrome.runtime.sendMessage = function (msg, cb) {
  sentTypes.push(msg && msg.type);
  if (msg && msg.type === 'QC_CODE_READ') {
    setTimeout(function () {
      cb({
        ok: true,
        how: 'monaco',
        code: 'class Solution {\npublic:\n    int add(int a, int b) {\n        // FULL-TEMPLATE-MARK\n    }\n};'
      });
    }, 0);
    return;
  }
  if (msg && msg.type === 'QC_CODE') {
    setTimeout(function () {
      cb({
        ok: true,
        text:
          '思路：两个数直接相加，不需要额外结构。\n复杂度：时间 O(1)，空间 O(1)\n' +
          '```cpp\nclass Solution {\npublic:\n    int add(int a, int b) { return a + b; }\n};\n```'
      });
    }, 0);
    return;
  }
  setTimeout(function () {
    cb({ ok: true, answers: [{ index: 1, answer: 'A', reason: '测试' }] });
  }, 0);
};
Q.setStatus = function () {};
Q.render = function () {};

(async function () {
  Q.S.questions = [
    { index: 1, type: 'code', stem: '两数之和', template: 'class Solution {};', lang: 'C++', answer: '', reason: '', fillState: '' }
  ];
  try {
    await Q.solve({ autoFill: false });
  } catch (e) {
    rec('solve() runs', false, String(e && e.message));
  }
  const q1 = Q.S.questions[0];
  rec('solve() uses QC_CODE channel', sentTypes.indexOf('QC_CODE') >= 0 && sentTypes.indexOf('QC_SOLVE') < 0, sentTypes.join(','));
  rec('solve() reads full template from page world', String(q1.template).indexOf('FULL-TEMPLATE-MARK') >= 0, String(q1.template).slice(0, 24));
  rec('solve() stores code in answer', /return a \+ b/.test(String(q1.answer)), String(q1.answer).split('\n').length + ' 行');
  rec('solve() keeps idea in reason', String(q1.reason).indexOf('直接相加') >= 0, String(q1.reason).slice(0, 16));
  rec('solve() records language', q1.codeLang === 'C++', String(q1.codeLang));

  /* 语言跟随模板；模板读不到时才用页面语言兜底（只进提示词，不改界面） */
  const cpPy = Q.buildCodePrompt(Object.assign({}, q1, { lang: '', template: '', pageLang: 'Python' }));
  rec('prompt falls back to page language', cpPy.indexOf('```python') >= 0, cpPy.split('\n')[0].slice(0, 14));
  rec('prompt asks sample self-check', cpPy.indexOf('示例 1：输入') >= 0);

  /* 还原：把写入前的原件再推回去 */
  q1.prevCode = '// ORIGIN';
  const errRestore = await Q.restoreCode(q1);
  rec('restoreCode pushes original back', errRestore === '' && q1.prevCode === '', errRestore || 'ok');

  console.log('RESULT');
  console.log(lines.join('\n'));
  console.log('DONE');
})();
