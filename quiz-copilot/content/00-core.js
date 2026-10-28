/* ============================================================
 * 答题助手 QuizCopilot — 基础工具：常量、DOM 小工具、共享状态
 * 文件：content/00-core.js
 * 说明：挂在 window.__QC 上，与其它模块共享；content script 的隔离环境，页面看不到
 * ============================================================ */
(() => {
  const Q = (window.__QC = window.__QC || {});

  const HOST_ID = 'quiz-copilot-host';
  const LETTERS = 'ABCDEFGHIJ';

  /* 运行时版本号：直接读 manifest，不会和打包版本脱节 */
  let VER = '?';
  try {
    VER = chrome.runtime.getManifest().version;
  } catch (e) {}
  try {
    console.info('[答题助手] 已加载 v' + VER);
  } catch (e) {}

  const S = {
    questions: [],
    result: [],
    hostEl: null,
    shadow: null,
    panelEl: null,
    fabEl: null,
    busy: false,
    status: '',
    error: '',
    autoFill: false,
    autoPage: false,
    pageLimit: 30,
    pomoCustom: 25,
    chatLevel: 2,
    botWear: { hat: 'none', ears: 'none', neck: 'none' },
    showFab: true,
    diag: '',
    lastUsage: null,
    skin: 'blue',
    selExplain: true,
    explain: null,   // 划词解释的结果：{ src, body, loading, error }
    pomo: null       // 番茄钟：{ end, total, timer }
  };

  /* ============================================================
   * 一、基础工具
   * ============================================================ */

  const norm = (s) => (s == null ? '' : String(s)).replace(/\u00a0/g, ' ').replace(/\r/g, '');
  const squash = (s) =>
    norm(s)
      .replace(/[ \t\u3000]+/g, ' ')
      .replace(/\n[ \t]*/g, '\n')
      .replace(/\n{2,}/g, '\n')
      .trim();
  const oneLine = (s) => squash(s).replace(/\n+/g, ' ').trim();

  function isVisible(el) {
    if (!el || !el.isConnected) return false;
    const r = el.getBoundingClientRect();
    if (r.width < 3 || r.height < 3) return false;
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden') return false;
    return true;
  }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /* 主文档 + 同源 iframe 文档（跨域的拿不到，返回 null 就跳过） */
  function allDocs() {
    const docs = [];
    const seen = new Set();
    const walk = (doc, depth) => {
      if (!doc || seen.has(doc) || depth > 2) return;
      seen.add(doc);
      docs.push(doc);
      let frames = [];
      try {
        frames = doc.querySelectorAll('iframe, frame');
      } catch (e) {
        return;
      }
      for (const f of frames) {
        let d = null;
        try {
          d = f.contentDocument;
        } catch (e) {
          d = null;
        }
        if (d) walk(d, depth + 1);
      }
    };
    walk(document, 0);
    return docs;
  }

  function countFrames() {
    let total = 0;
    let readable = 0;
    for (const doc of allDocs()) {
      try {
        const fs = doc.querySelectorAll('iframe, frame');
        total += fs.length;
        for (const f of fs) {
          try {
            if (f.contentDocument) readable++;
          } catch (e) {}
        }
      } catch (e) {}
    }
    return { total, readable };
  }

  function commonAncestor(nodes) {    if (!nodes || !nodes.length) return null;
    let path = [];
    let p = nodes[0].parentElement;
    while (p) {
      path.push(p);
      p = p.parentElement;
    }
    for (let i = 1; i < nodes.length; i++) {
      const set = new Set();
      let q = nodes[i].parentElement;
      while (q) {
        set.add(q);
        q = q.parentElement;
      }
      path = path.filter((el) => set.has(el));
      if (!path.length) return null;
    }
    return path[0] || null;
  }

  const OPT_CTRL_SEL = 'input[type="radio"],input[type="checkbox"]';

  /* 就近的"选项箱"：从这个控件往上，第一个包含 >= 2 个同类控件的容器。
     Moodle 给每个选项单独起名，靠它把散落的选项并回同一题。 */
  function nearestOptionBox(el) {
    const doc = el.ownerDocument || document;
    let p = el.parentElement;
    let tooBig = null;
    for (let i = 0; i < 6 && p; i++) {
      if (p === doc.body || p === doc.documentElement) break;
      const n = p.querySelectorAll(OPT_CTRL_SEL).length;
      if (n >= 2) {
        const t = squash(p.innerText || '');
        // 容器文本太长说明已经跨到整份试卷了，不要合并
        if (t.length <= 2000) return p;
        if (!tooBig) tooBig = p;
        break;
      }
      p = p.parentElement;
    }
    return tooBig || el.parentElement || el;
  }

  /* ============================================================
   * 二、题目识别 —— 方案 A：表单控件（radio / checkbox）
   * ============================================================ */


  // 从别的模块挪过来的两个常量：多个模块都要用，放这里最省事
  const BLANK_MARK = /(_{2,}|＿{2,}|（\s{0,4}）|\(\s{0,4}\))/;
  const TYPE_CN = { single: '单选', multi: '多选', judge: '判断', blank: '填空', match: '匹配', matrix: '表格', essay: '论述' };

  Object.assign(Q, { HOST_ID, LETTERS, VER, S, norm, squash, oneLine, isVisible, esc, allDocs, countFrames, commonAncestor, OPT_CTRL_SEL, nearestOptionBox, BLANK_MARK, TYPE_CN });
})();
