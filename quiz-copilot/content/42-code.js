/* ============================================================
 * 答题助手 QuizCopilot — 编程题：读题面、生成解法、写进代码编辑器
 * 文件：content/42-code.js
 * 说明：判题页（LeetCode / 牛客 / 洛谷这类）没有「填空」这回事，
 *       答案是一段代码。这里负责把它读出来、算出来、再塞回编辑器。
 *       写入必须发生在页面主世界（Monaco 的 model 不在隔离环境里），
 *       所以真正动手的那一步交给 background 用 MAIN world 注入。
 * ============================================================ */
(() => {
  const Q = (window.__QC = window.__QC || {});
  const { S, squash, oneLine, esc, allDocs, isVisible } = Q;

  /* 题面容器：按「越具体越靠前」排，命中一个就停 */
  const STEM_SELECTORS = [
    '[data-track-load="description_content"]',
    '[data-cy="question-content"]',
    '.question-content',
    '.subject-question',
    '.problem-statement',
    '#problem-content',
    '.problem-content',
    '[class*="problem-desc"]',
    '[class*="question-desc"]',
    '[class*="subject-desc"]',
    '[class*="description"]',
    'article',
    'main'
  ];

  const STEM_HINT = /(题目|描述|说明|输入|输出|示例|样例|提示|限制|要求|example|input|output|constraint)/i;
  const STEM_WORDS = /(输入|输出|示例|样例|题目描述|限制|提示|example|input|output|constraint)/gi;

  const MAX_STEM = 6000;
  const MAX_TEMPLATE = 1600;

  /* ---------------- 找编辑器 ---------------- */

  function editorEl() {
    const sel = Q.CODE_EDITOR_SEL;
    if (!sel) return null;
    let best = null;
    let bestArea = 0;
    for (const doc of allDocs()) {
      let list = [];
      try {
        list = doc.querySelectorAll(sel);
      } catch (e) {
        continue;
      }
      for (const el of list) {
        if (!isVisible(el)) continue;
        const r = el.getBoundingClientRect();
        const area = r.width * r.height;
        if (area > bestArea) {
          bestArea = area;
          best = el;
        }
      }
    }
    return best;
  }

  /* 编辑器里现有的代码（也就是题目给的模板）。
     Monaco 只渲染可视区的行，读到的可能不全，所以只当「语言和函数签名的线索」用。 */
  function readTemplate() {
    const el = editorEl();
    if (!el) return '';
    const parts = ['.view-lines', '.cm-content', '.CodeMirror-code', '.ace_text-layer'];
    for (const sel of parts) {
      let n = null;
      try {
        n = el.matches && el.matches(sel) ? el : el.querySelector(sel);
      } catch (e) {
        n = null;
      }
      if (!n) continue;
      const t = String(n.innerText || '')
        .split('\n')
        .map((s) => s.replace(/\s+$/, ''))
        .join('\n')
        .trim();
      if (t.length > 3) return t.slice(0, MAX_TEMPLATE);
    }
    const raw = String(el.innerText || '').trim();
    return raw.slice(0, MAX_TEMPLATE);
  }

  /* ---------------- 读题面 ---------------- */

  function textOf(el) {
    if (!el) return '';
    const t = el.innerText == null ? el.textContent : el.innerText;
    return squash(String(t || ''));
  }

  function readTitle() {
    const sels = ['[data-cy="question-title"]', '.question-title', '[class*="question-title"]', 'h1', 'h2'];
    for (const sel of sels) {
      let list = [];
      try {
        list = document.querySelectorAll(sel);
      } catch (e) {
        continue;
      }
      for (const el of list) {
        const t = oneLine(el.innerText == null ? el.textContent : el.innerText);
        if (t && t.length >= 2 && t.length <= 120) return t;
      }
    }
    const dt = oneLine(document.title || '');
    if (!dt) return '';
    return (dt.split(/[|｜\-–—:：]/)[0] || '').trim().slice(0, 120);
  }

  function readStem(ed) {
    const host = Q.HOST_ID;
    const blocked = (el) => {
      if (!el) return true;
      try {
        if (ed && (el.contains(ed) || ed.contains(el))) return true;
        if (host && el.closest && el.closest('#' + host)) return true;
      } catch (e) {}
      return false;
    };

    for (const sel of STEM_SELECTORS) {
      for (const doc of allDocs()) {
        let list = [];
        try {
          list = doc.querySelectorAll(sel);
        } catch (e) {
          continue;
        }
        for (const el of list) {
          if (blocked(el)) continue;
          const t = textOf(el);
          if (t.length < 80 || t.length > 9000) continue;
          if (!STEM_HINT.test(t)) continue;
          return t.slice(0, MAX_STEM);
        }
      }
    }

    /* 兜底：扫常见区块，挑「题面关键词命中最多、又不太长」的那块 */
    let best = '';
    let bestScore = 0;
    try {
      const cands = document.querySelectorAll('div,section,article,main,td');
      const limit = Math.min(cands.length, 800);
      for (let i = 0; i < limit; i++) {
        const el = cands[i];
        if (blocked(el)) continue;
        if (el.closest && el.closest('nav,header,footer,aside')) continue;
        const t = textOf(el);
        if (t.length < 120 || t.length > 7000) continue;
        const hits = (t.match(STEM_WORDS) || []).length;
        if (hits < 2) continue;
        const score = hits * 100 - t.length / 100;
        if (score > bestScore) {
          bestScore = score;
          best = t;
        }
      }
    } catch (e) {}
    return best.slice(0, MAX_STEM);
  }

  /* ---------------- 语言猜想 ---------------- */

  const LANG_ALIAS = {
    cpp: 'C++',
    'c++': 'C++',
    cc: 'C++',
    cxx: 'C++',
    c: 'C',
    py: 'Python',
    python: 'Python',
    python3: 'Python',
    java: 'Java',
    js: 'JavaScript',
    javascript: 'JavaScript',
    ts: 'TypeScript',
    typescript: 'TypeScript',
    go: 'Go',
    golang: 'Go',
    rs: 'Rust',
    rust: 'Rust',
    cs: 'C#',
    csharp: 'C#',
    'c#': 'C#',
    kt: 'Kotlin',
    kotlin: 'Kotlin',
    rb: 'Ruby',
    ruby: 'Ruby',
    php: 'PHP',
    swift: 'Swift'
  };

  function normLang(name) {
    const raw = String(name || '').trim();
    if (!raw) return '';
    return LANG_ALIAS[raw.toLowerCase()] || raw;
  }

  function guessLang(t) {
    const s = String(t || '');
    if (!s.trim()) return '';
    if (/#include\s*[<"]|std::|using namespace std|vector\s*<|cout\s*<<|printf\s*\(|class\s+\w+[\s\S]{0,200}?\bpublic\s*:/.test(s)) {
      return 'C++';
    }
    if (/^\s*(from\s+\w+\s+import|import\s+\w+)/m.test(s) || /^\s*def\s+\w+\s*\(/m.test(s) || /class\s+Solution\s*:/.test(s)) return 'Python';
    if (/public\s+(static\s+)?(class|void|int|String)|System\.out\.print|import\s+java\./.test(s)) return 'Java';
    if (/package\s+main|^\s*func\s+\w+\s*\(/m.test(s) || /fmt\.Print/.test(s)) return 'Go';
    if (/(^|\s)(const|let|var)\s+\w+\s*=/.test(s) || /=>\s*\{/.test(s)) return 'JavaScript';
    if (/^\s*fn\s+\w+\s*\(/m.test(s) || /let\s+mut\s+/.test(s)) return 'Rust';
    return '';
  }

  const FENCE_LANG = {
    'C++': 'cpp',
    C: 'c',
    Python: 'python',
    Java: 'java',
    Go: 'go',
    JavaScript: 'javascript',
    Rust: 'rust'
  };

  function langTag(name) {
    return FENCE_LANG[String(name || '').trim()] || String(name || '').trim().toLowerCase();
  }

  /* ---------------- 产出题目对象 ---------------- */

  function extractCode() {
    if (!Q.pageKind || Q.pageKind() !== 'code-judge') return [];
    const ed = editorEl();
    const body = readStem(ed);
    if (!body) return [];

    const title = readTitle();
    // 题面里已经带标题就别重复
    const head = title && body.indexOf(title) < 0 ? title + '\n' : '';
    const template = readTemplate();

    return [
      {
        type: 'code',
        source: 'code',
        stem: (head + body).slice(0, MAX_STEM),
        template,
        lang: guessLang(template),
        root: ed || null
      }
    ];
  }

  /* ---------------- 提示词 ---------------- */

  function buildCodePrompt(q) {
    const lang = q.forceLang || q.lang || guessLang(q.template) || '';
    const lines = [
      '这是一道在线判题平台的编程题，请给出完整解法。',
      '',
      '题目：',
      q.stem,
      ''
    ];

    if (q.forceLang) lines.push(`请用 ${q.forceLang} 写这道题（用别的不算）。`, '');

    const tpl = String(q.template || '').trim();
    if (tpl) {
      lines.push(
        '编辑器里已有的代码模板（函数名、类名、参数名必须原样保留）：',
        '```',
        tpl,
        '```',
        ''
      );
    }

    lines.push(
      '输出格式（严格遵守，不要输出 JSON，不要输出别的东西）：',
      '思路：<3-5 句话，先说用什么算法或数据结构，再说为什么，最后一句说明边界情况怎么处理>',
      '复杂度：时间 O(...)，空间 O(...)',
      '```' + langTag(lang),
      '<完整代码>',
      '```',
      '',
      '要求：',
      '1. 代码必须完整、可直接提交：需要 include / import 的写上；模板里已有的函数签名不要改；',
      '2. 语言必须和上面指定的语言一致；没有指定就沿用模板的语言，不要自作主张换语言；',
      '3. 模板是「函数题」（已经给了 class Solution / def 之类）就只补全函数体，不要写 main、不要写输入输出；',
      '   没有模板或模板为空时按「ACM 模式」写完整程序（自己读输入、自己输出）；',
      '4. 不要写测试用例、不要打印调试信息、不要留 TODO；',
      '5. 关键步骤写一句注释即可，不要整段注释，也不要把解释写进代码；',
      '6. 空输入、单元素、负数、溢出这类边界自己处理，并在「思路」里点一句；',
      '7. 写完先自查：拿题面里的示例逐个走一遍，在「思路」最后按「示例 1：输入 … → 输出 …（与题目一致）」的格式列出来；',
      '   对不上就改代码，直到全部对上；',
      '8. 题目信息缺失（输入范围、返回格式没给全）时按最常见约定实现，并在「思路」最后写明你的假设。'
    );
    return lines.join('\n');
  }

  /* ---------------- 解析模型回复 ---------------- */

  function cutCode(head, tail) {
    const idea = squash([head, tail].filter(Boolean).join('\n')).trim();
    return idea;
  }

  /* 没围栏时的兜底判断：这一坨到底像不像代码，别把「我不会」写进编辑器 */
  function looksLikeCode(s) {
    const t = String(s || '');
    if (!t.trim()) return false;
    if (/\n/.test(t) && /[{};]|=>|^\s*(def|class|import|from|func|package)\b/m.test(t)) return true;
    return /^\s*(#include|import\s|from\s+\w+\s+import|class\s|def\s|func\s|package\s|using\s+namespace|public\s+(?:class|static)|int\s+main)/m.test(t);
  }

  function parseCodeReply(text) {
    let s = String(text == null ? '' : text).replace(/\r\n?/g, '\n').trim();
    if (!s) throw new Error('模型返回了空内容。');

    // 整段被包在 ``` 里：先剥一层外壳，避免把「思路」也当成代码
    const fences = [];
    const re = /```([a-zA-Z0-9_+#-]*)[ \t]*\n([\s\S]*?)```/g;
    let m;
    while ((m = re.exec(s)) !== null) fences.push({ lang: m[1] || '', code: m[2] });

    let code = '';
    let lang = '';
    let head = '';
    let tail = '';

    if (fences.length) {
      const best = fences.slice().sort((a, b) => b.code.length - a.code.length)[0];
      code = best.code;
      lang = best.lang;
      const first = s.indexOf('```');
      const last = s.lastIndexOf('```');
      head = s.slice(0, first);
      tail = last > first ? s.slice(last + 3) : '';
    } else {
      /* 没围栏：从「第一行看起来像代码」的地方切开 */
      const m2 = s.match(/\n(?=\s*(?:#include|import\s|from\s+\w+\s+import|class\s|def\s|func\s|package\s|using\s+namespace|public\s+(?:class|static)))/);
      if (m2 && m2.index > 0) {
        head = s.slice(0, m2.index);
        code = s.slice(m2.index + 1);
      } else {
        code = s;
      }
    }

    code = String(code || '')
      .replace(/^```[a-zA-Z0-9_+#-]*\n/, '')
      .replace(/\n```\s*$/, '')
      .replace(/^\n+/, '')
      .replace(/\s+$/, '');

    if (!code.trim()) throw new Error('模型回复里没找到代码块。');
    if (!fences.length && !looksLikeCode(code)) throw new Error('模型回复里没找到代码块。');

    const idea = cutCode(head, tail);
    return {
      code,
      reason: idea,
      lang: guessLang(code) || normLang(lang)
    };
  }

  /* ---------------- 读编辑器 / 页面语言 ---------------- */

  /* DOM 里只有可视区的行，模板一长就残缺；这里进主世界拿全量 */
  async function readEditorCode() {
    if (!Q.sendBg) return { ok: false, code: '' };
    try {
      const resp = await Q.sendBg({ type: 'QC_CODE_READ' });
      if (!resp || !resp.ok) return { ok: false, code: '' };
      return { ok: true, code: String(resp.code || ''), how: resp.how || '' };
    } catch (e) {
      return { ok: false, code: '' };
    }
  }

  /* 页面语言选择器上的文字（LeetCode 右上角那个 C++ / Python3）。
     只在「恰好认出一个」时才给值，认不出或有歧义就返回空，宁可不提示也别瞎提示。 */
  const LANG_TEXT = {
    'c++': 'C++',
    cpp: 'C++',
    'c#': 'C#',
    csharp: 'C#',
    python: 'Python',
    python3: 'Python',
    py: 'Python',
    java: 'Java',
    javascript: 'JavaScript',
    js: 'JavaScript',
    typescript: 'TypeScript',
    ts: 'TypeScript',
    go: 'Go',
    golang: 'Go',
    rust: 'Rust',
    kotlin: 'Kotlin',
    swift: 'Swift',
    php: 'PHP',
    ruby: 'Ruby',
    scala: 'Scala'
  };

  function readPageLang() {
    const ed = editorEl();
    const edTop = ed ? ed.getBoundingClientRect().top + window.scrollY : null;
    const host = Q.HOST_ID || '';

    const found = new Set();
    const sels = ['select', '[class*="lang"]', '[class*="Lang"]', '[role="combobox"]'];

    for (const sel of sels) {
      let list = [];
      try {
        list = document.querySelectorAll(sel);
      } catch (e) {
        continue;
      }
      const limit = Math.min(list.length, 300);
      for (let i = 0; i < limit; i++) {
        const el = list[i];
        if (!isVisible(el)) continue;
        try {
          if (host && el.closest && el.closest('#' + host)) continue;
        } catch (e) {}

        // 离编辑器太远的多半是别的东西
        if (edTop != null) {
          const r = el.getBoundingClientRect();
          if (Math.abs(r.top + window.scrollY - edTop) > 600) continue;
        }

        let t = '';
        if (el.tagName === 'SELECT') {
          const o = el.options && el.options[el.selectedIndex];
          t = o ? oneLine(o.textContent) : '';
        } else {
          t = oneLine(el.innerText == null ? el.textContent : el.innerText);
        }
        if (!t || t.length > 14) continue;

        const norm = LANG_TEXT[t.toLowerCase().replace(/\s+/g, '')];
        if (!norm) continue;
        found.add(norm);
        if (found.size > 1) return ''; // 页面上同时出现多个语言名，别猜
      }
      if (found.size === 1) return [...found][0];
    }
    return found.size === 1 ? [...found][0] : '';
  }

  /* ---------------- 调模型 ---------------- */

  async function solveCodeQ(q) {
    if (!Q.sendBg) throw new Error('发送模块还没加载');

    // 先用主世界读一遍完整代码当模板，DOM 里那份可能被截断
    const full = await readEditorCode();
    if (full.ok && full.code.trim()) {
      const prev = String(q.template || '');
      if (full.code.trim().length >= prev.trim().length) q.template = full.code;
      if (!q.lang) q.lang = guessLang(q.template);
    }
    q.pageLang = readPageLang() || '';

    const resp = await Q.sendBg({ type: 'QC_CODE', text: buildCodePrompt(q) });
    if (!resp || !resp.ok) throw new Error((resp && resp.error) || '调用失败');

    const r = parseCodeReply(resp.text || '');
    q.answer = r.code;
    q.reason = r.reason;
    q.codeLang = r.lang || q.forceLang || q.lang || '';
    q.fillState = '';
    if (resp.usage && Q.S) Q.S.lastUsage = resp.usage;
    return r;
  }

  /* ---------------- 写进编辑器 ---------------- */

  async function pushCode(code) {
    if (!Q.sendBg) return '发送模块还没加载';
    let resp;
    try {
      resp = await Q.sendBg({ type: 'QC_CODE_WRITE', code: String(code == null ? '' : code) });
    } catch (e) {
      return String((e && e.message) || e);
    }
    if (!resp || !resp.ok) {
      return (resp && resp.error) || '写入失败，点「复制代码」自己粘一下';
    }
    return '';
  }

  async function writeCode(q) {
    const code = String((q && q.answer) || '').trim();
    if (!code) return '还没有生成代码';

    // 写之前先留一份原件，「还原」要靠它
    let cur = '';
    try {
      const r = await readEditorCode();
      if (r.ok) cur = String(r.code || '');
    } catch (e) {}

    const err = await pushCode(code);
    if (!err && cur.trim() && cur.trim() !== code) q.prevCode = cur;
    return err;
  }

  async function restoreCode(q) {
    const prev = String((q && q.prevCode) || '');
    if (!prev.trim()) return '没有可还原的内容';
    const err = await pushCode(prev);
    if (!err) {
      q.prevCode = '';
      q.fillState = 'ok';
    }
    return err;
  }

  Object.assign(Q, {
    editorEl,
    readTemplate,
    readStem,
    readTitle,
    readEditorCode,
    readPageLang,
    guessLang,
    normLang,
    langTag,
    extractCode,
    buildCodePrompt,
    parseCodeReply,
    solveCodeQ,
    pushCode,
    writeCode,
    restoreCode
  });
})();
