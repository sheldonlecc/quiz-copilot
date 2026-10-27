/* ============================================================
 * 答题助手 QuizCopilot — 填空题提取（文本框 / 数字框 / 可编辑区）
 * 文件：content/20-blank.js
 * 说明：挂在 window.__QC 上，与其它模块共享；content script 的隔离环境，页面看不到
 * ============================================================ */
(() => {
  const Q = (window.__QC = window.__QC || {});
  const { HOST_ID, LETTERS, VER, S, norm, squash, oneLine, isVisible, esc, allDocs, countFrames, commonAncestor, OPT_CTRL_SEL, nearestOptionBox, BLANK_MARK, TYPE_CN, optionText, TRUE_RE, FALSE_RE, detectType, RE_OPT_LINE, NOISE_LINE, NOISE_INLINE, clampStem, cleanStemText, extractStem, inQuestionContainer, looksLikeQuizChoice, extractFromInputs, RE_QSTART, RE_OPT, parseTextToQuestions } = Q;
  /* ============================================================
   * 三之二、题目识别 —— 方案 C：填空题（文本输入框）
   * ============================================================ */

  // 空位标记：连续下划线 / 全角下划线 / 空括号

  // 明显不是答题框的关键词
  const NOT_QUIZ_SIG =
    /(search|keyword|query|captcha|passw|pwd|email|mail|phone|mobile|username|nickname|comment|message|feedback|verif|address|company|dept|studentno|idcard)/i;
  const NOT_QUIZ_CN =
    /(搜索|邮箱|手机|密码|验证码|用户名|登录|昵称|留言|评论|反馈|订阅|姓名|名字|学号|工号|身份证|地址|公司|单位|职务|部门|性别|年龄|出生)/;

  // 强正向信号：紧挨着这个框的文字是「Answer:」「答案：」这类
  const ANSWER_LABEL = /^(answer|your answer|ans|答案|作答|回答|请填写|填写|填空)\s*[:：]?$/i;

  const PERSONAL_ID = /^(name|username|user|email|phone|tel|code|pwd|password|search|keyword|realname)$/;

  /* 判断一个元素能不能当填空框；返回原因，便于诊断 */
  function checkFillable(el) {
    if (!el) return { ok: false, why: '元素不存在' };
    if (el.disabled) return { ok: false, why: 'disabled' };
    if (el.readOnly) return { ok: false, why: 'readOnly' };

    const isTextarea = el.tagName === 'TEXTAREA';
    const editable = el.isContentEditable;

    if (el.tagName === 'INPUT') {
      const t = (el.getAttribute('type') || 'text').toLowerCase();
      if (t !== 'text' && t !== 'number' && t !== '') return { ok: false, why: 'type=' + t };
    } else if (!isTextarea && !editable) {
      return { ok: false, why: '不是文本控件' };
    }

    if (!isVisible(el)) return { ok: false, why: '不可见' };

    const r = el.getBoundingClientRect();

    // 属性层面的非答题信号
    const sig = [
      el.getAttribute('name'),
      el.id,
      el.getAttribute('placeholder'),
      el.getAttribute('aria-label'),
      typeof el.className === 'string' ? el.className : '',
      el.getAttribute('autocomplete')
    ]
      .filter(Boolean)
      .join(' ');

    if (NOT_QUIZ_SIG.test(sig) || NOT_QUIZ_CN.test(sig)) return { ok: false, why: '属性命中非答题关键词' };

    const nm = (el.getAttribute('name') || '').trim().toLowerCase();
    if (PERSONAL_ID.test(nm)) return { ok: false, why: 'name 是个人信息字段' };
    const eid = (el.id || '').trim().toLowerCase();
    if (PERSONAL_ID.test(eid)) return { ok: false, why: 'id 是个人信息字段' };

    // 结构层面：头部、导航、搜索区都不是答题区
    let p = el.parentElement;
    for (let i = 0; i < 4 && p; i++) {
      if (/^(HEADER|NAV|FOOTER)$/.test(p.tagName)) return { ok: false, why: '位于 header/nav/footer' };
      const role = p.getAttribute && p.getAttribute('role');
      if (role && /search/i.test(role)) return { ok: false, why: '位于搜索区域' };
      const cls = typeof p.className === 'string' ? p.className : '';
      if (/(^|\s)(search|navbar|header|footer|toolbar)(\s|$)/i.test(cls)) return { ok: false, why: '位于搜索/导航容器' };
      p = p.parentElement;
    }

    // 登录/注册表单里的输入框全部跳过
    const form = el.closest('form');
    if (form && form.querySelector('input[type="password"]')) return { ok: false, why: '登录表单内' };

    // 尺寸：只排除明显不像答题框的，宁可放宽也别漏掉
    const near = nearbyLabelText(el);
    const hasAnswerLabel = !!(near && ANSWER_LABEL.test(near));

    const maxW = hasAnswerLabel ? 1200 : 820;
    if (r.width > maxW) return { ok: false, why: `过宽(${Math.round(r.width)}px)` };

    if (isTextarea && !hasAnswerLabel) {
      if (el.rows > 8 || r.height > 200) return { ok: false, why: `大文本框(${el.rows}行)` };
    }
    if (!isTextarea && !editable && r.height > 200) return { ok: false, why: `过高(${Math.round(r.height)}px)` };

    return { ok: true, why: '', hasAnswerLabel };
  }

  function isQuizFillable(el) {
    return checkFillable(el).ok;
  }

  // 取紧邻这个输入框的文字（label / 前一个兄弟 / 父容器），用来识别「Answer:」
  function nearbyLabelText(el) {
    const own = squash(el.innerText || '').replace(BLANK_MARK, '').trim();

    const label = el.closest('label');
    if (label) {
      const t = squash(label.innerText || '').trim();
      if (t) return t.slice(0, 40);
    }

    let sib = el.previousSibling;
    let guard = 0;
    let acc = '';
    while (sib && guard++ < 4) {
      if (sib.nodeType === 3) acc = sib.nodeValue + acc;
      else if (sib.nodeType === 1 && !/^(INPUT|TEXTAREA|SELECT)$/.test(sib.tagName)) {
        acc = (sib.innerText || sib.textContent || '') + acc;
        if (acc.trim()) break;
      }
      sib = sib.previousSibling;
    }
    const t = squash(acc).trim();
    if (t) return t.slice(0, 40);

    const p = el.parentElement;
    if (p) {
      const pt = squash(p.innerText || '').trim();
      if (pt && pt.length <= 40) return pt;
    }
    return own.slice(0, 40);
  }

  /* ============================================================
   * 诊断：把页面上到底有什么、为什么没认出来，摊开给用户看
   * ============================================================ */

  function collectCandidates() {
    const raw = [];
    for (const doc of allDocs()) {
      let list = [];
      try {
        list = doc.querySelectorAll('input, textarea, [contenteditable]');
      } catch (e) {
        continue;
      }
      for (const el of list) {
        if (el.closest('#' + HOST_ID)) continue;
        raw.push(el);
      }
    }
    const ok = [];
    const rejected = [];
    const SKIP = /^(hidden|checkbox|radio|submit|button|reset|file|password|search|range|color|date|time|month|week|datetime-local|image)$/i;

    for (const el of raw) {
      const res = checkFillable(el);
      if (res.ok) {
        ok.push({ el, hasAnswerLabel: res.hasAnswerLabel });
      } else if (el.tagName === 'INPUT' && SKIP.test((el.getAttribute('type') || 'text').toLowerCase())) {
        // 结构性控件和敏感输入不列进诊断，避免噪音
      } else {
        rejected.push({ el, why: res.why });
      }
    }
    return { raw, ok, rejected };
  }

  function looksLikeQuestion(t) {
    if (!t) return false;
    if (BLANK_MARK.test(t)) return true;
    if (/^\s*(第\s*\d{1,3}\s*题|\d{1,3}\s*[\.、．\)）])/.test(t)) return true;
    const lines = t.split('\n').filter(Boolean);
    if (lines.length <= 3 && /[？?。：:]\s*$/.test(t) && t.length >= 8) return true;
    return false;
  }

  // 找到这个输入框所属的题目容器
  function blankContainer(el) {
    const doc = el.ownerDocument || document;
    let p = el.parentElement;
    let prev = null;
    for (let i = 0; i < 5 && p; i++) {
      if (p === doc.body || p === doc.documentElement) break;
      const t = squash(p.innerText || '');
      if (t.length > 800) break; // 已经爬到题目列表了，上一层更接近题目
      if (t.length >= 6) {
        if (looksLikeQuestion(t)) return p;
        prev = p;
      }
      p = p.parentElement;
    }
    return prev || el.parentElement || el;
  }

  // 把容器文本重建一遍，每个输入框就地替换成 ____，保证空位数量和顺序与输入框一致
  function stemWithBlanks(container, fillables) {
    const set = new Set(fillables);
    let out = '';
    const BLOCK = /^(DIV|P|LI|UL|OL|TR|TD|H[1-6]|SECTION|ARTICLE|BLOCKQUOTE|PRE|DL|DD|DT)$/;

    const walk = (node) => {
      for (const c of node.childNodes) {
        if (c.nodeType === 3) {
          out += c.nodeValue;
        } else if (c.nodeType === 1) {
          if (set.has(c)) {
            // 题干里已经画了下划线 / 空括号的话，就地复用，别插出两个空
            if (/[_＿]{2,}[\s\u3000]*$/.test(out)) {
              out = out.replace(/[_＿]{2,}[\s\u3000]*$/, '____ ');
            } else if (/[（(][\s\u3000]{0,4}[)）][\s\u3000]*$/.test(out)) {
              out = out.replace(/[（(][\s\u3000]{0,4}[)）][\s\u3000]*$/, '____ ');
            } else {
              out += ' ____ ';
            }
            continue;
          }
          if (/^(SCRIPT|STYLE|BUTTON|SELECT|OPTION|NOSCRIPT)$/.test(c.tagName)) continue;
          if (c.tagName === 'BR') {
            out += '\n';
            continue;
          }
          const block = BLOCK.test(c.tagName);
          if (block) out += '\n';
          walk(c);
          if (block) out += '\n';
        }
      }
    };

    walk(container);
    return clampStem(
      squash(out)
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean)
        // 纯下划线是空位标记，必须保留
        .filter((l) => /^_+$/.test(l) || !/^[\-—*·•\s]+$/.test(l))
        .join('\n')
    );
  }

  /* 一组输入框如果同属一张表，就是表格题（问卷星的矩阵题、试卷的填表题） */
  function groupTable(list) {
    let t = null;
    for (const el of list) {
      const tb = el.closest ? el.closest('table') : null;
      if (!tb) return null;
      if (!t) t = tb;
      else if (t !== tb) return null;
    }
    return t;
  }

  function cellsOf(tr) {
    return Array.from(tr.cells || tr.querySelectorAll('td,th'));
  }

  function rowInputs(tr) {
    return Array.from(tr.querySelectorAll('input,textarea,[contenteditable]'));
  }

  /* 把表格拆成「列头 + 每行的标签和空格」，顺序按页面从上到下、从左到右 */
  function matrixInfo(table, list) {
    const set = new Set(list);
    let trs = [];
    try {
      trs = Array.from(table.querySelectorAll('tr'));
    } catch (e) {
      return null;
    }

    const filled = trs.filter((tr) => rowInputs(tr).some((e) => set.has(e)));
    if (filled.length < 2) return null;

    // 列头：第一个「没有输入框、且不止一格」的行
    let cols = [];
    for (const tr of trs) {
      if (rowInputs(tr).length) continue;
      const texts = cellsOf(tr)
        .map((td) => oneLine(td.innerText || td.textContent || ''))
        .filter(Boolean);
      if (texts.length >= 1) {
        cols = texts.slice(0, 8);
        break;
      }
    }

    const rows = filled.map((tr, i) => {
      const inputs = rowInputs(tr).filter((e) => set.has(e));
      let label = '';
      for (const td of cellsOf(tr)) {
        if (rowInputs(td).length) continue;
        const t = oneLine(td.innerText || td.textContent || '');
        if (t) { label = t; break; }
      }
      return {
        label: (label || '第 ' + (i + 1) + ' 行').slice(0, 40),
        blanks: inputs.map((el) => ({ el }))
      };
    });

    /* 防止把「用表格排版的普通表单」误判成矩阵：
       要么某行有 2 个以上的空，要么有列头，要么至少 3 行 */
    const wide = rows.some((r) => r.blanks.length >= 2);
    if (!wide && !cols.length && rows.length < 3) return null;

    return { cols, rows };
  }

  /* 表格题的题干：把表格本身摘掉，只留题目说明，避免行内容重复一遍 */
  function stemWithoutTables(container) {
    try {
      const clone = container.cloneNode(true);
      clone.querySelectorAll('table').forEach((t) => t.remove());
      return clampStem(squash(clone.innerText || clone.textContent || ''));
    } catch (e) {
      return '';
    }
  }

  /* 表格题的外层容器：从表格往上走，直到遇到另一张表为止 */
  function tableContainer(table) {
    const doc = table.ownerDocument || document;
    let p = table.parentElement;
    let best = table.parentElement || table;
    for (let i = 0; i < 4 && p; i++) {
      if (p === doc.body || p === doc.documentElement) break;
      let n = 0;
      try {
        n = p.querySelectorAll('table').length;
      } catch (e) {}
      if (n > 1) break;
      best = p;
      p = p.parentElement;
    }
    return best;
  }

  const docOrder = (a, b) =>
    a === b ? 0 : a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1;

  function extractBlanks() {
    const { ok } = collectCandidates();
    const els = ok.map((o) => o.el);
    if (!els.length) return [];

    const out = [];

    /* 第一步：先按 <table> 把表格题单独挑出来。
       表格的空格散在各行各列，靠「最近的题目容器」分组会串题或落到 <td> 上。 */
    const byTable = new Map();
    const rest = [];
    for (const el of els) {
      const tb = el.closest ? el.closest('table') : null;
      if (!tb) {
        rest.push(el);
        continue;
      }
      if (!byTable.has(tb)) byTable.set(tb, []);
      byTable.get(tb).push(el);
    }

    for (const [table, raw] of byTable) {
      const list = raw.slice().sort(docOrder);
      // 一个表里只有一个输入框，当普通填空处理
      const matrix = list.length >= 2 ? matrixInfo(table, list) : null;
      if (!matrix || matrix.rows.length < 2) {
        rest.push(...list);
        continue;
      }

      const box = tableContainer(table);
      if (!isVisible(box)) continue;

      const onlyTitle = stemWithoutTables(box);
      const stem = onlyTitle && onlyTitle.length >= 4 ? onlyTitle : stemWithBlanks(box, list);
      if (!stem || stem.length < 4) continue;

      out.push({
        source: 'blank',
        type: 'matrix',
        stem,
        options: [],
        blanks: list.map((el) => ({ el })),
        rows: matrix.rows,
        cols: matrix.cols,
        root: box
      });
    }

    /* 第二步：剩下的按「最近的题目容器」分组，走普通填空题 */
    const groups = new Map();
    for (const el of rest) {
      const c = blankContainer(el);
      if (!groups.has(c)) groups.set(c, []);
      groups.get(c).push(el);
    }

    for (const [container, list] of groups) {
      if (!isVisible(container)) continue;
      list.sort(docOrder);

      const stem = stemWithBlanks(container, list);
      if (!stem || stem.length < 4) continue;
      if (!BLANK_MARK.test(stem)) continue;

      const hasNumber = /^\s*(第\s*\d{1,3}\s*题|\d{1,3}\s*[\.、．\)）])/.test(stem);
      if (!hasNumber && stem.length < 8) continue; // 太短又没题号，多半不是题目

      out.push({
        source: 'blank',
        type: 'blank',
        stem,
        options: [],
        blanks: list.map((el) => ({ el })),
        root: container
      });
    }

    return out;
  }

  Object.assign(Q, { NOT_QUIZ_SIG, NOT_QUIZ_CN, ANSWER_LABEL, PERSONAL_ID, checkFillable, isQuizFillable, nearbyLabelText, collectCandidates, looksLikeQuestion, blankContainer, stemWithBlanks, groupTable, matrixInfo, stemWithoutTables, tableContainer, extractBlanks });
})();
