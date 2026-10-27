/* ============================================================
 * 答题助手 QuizCopilot — 匹配题提取（下拉框 / Matching）
 * 文件：content/30-match.js
 * 说明：挂在 window.__QC 上，与其它模块共享；content script 的隔离环境，页面看不到
 * ============================================================ */
(() => {
  const Q = (window.__QC = window.__QC || {});
  const { HOST_ID, LETTERS, VER, S, norm, squash, oneLine, isVisible, esc, allDocs, countFrames, commonAncestor, OPT_CTRL_SEL, nearestOptionBox, BLANK_MARK, TYPE_CN, optionText, TRUE_RE, FALSE_RE, detectType, RE_OPT_LINE, NOISE_LINE, NOISE_INLINE, clampStem, cleanStemText, extractStem, inQuestionContainer, looksLikeQuizChoice, extractFromInputs, RE_QSTART, RE_OPT, parseTextToQuestions, NOT_QUIZ_SIG, NOT_QUIZ_CN, ANSWER_LABEL, PERSONAL_ID, checkFillable, isQuizFillable, nearbyLabelText, collectCandidates, looksLikeQuestion, blankContainer, stemWithBlanks, extractBlanks } = Q;
  /* ============================================================
   * 三之三、匹配题（下拉框 / Matching）
   * 典型形态：左边一列图标或名词，右边一列 <select>，选对应项
   * ============================================================ */

  const SELECT_SKIP =
    /(lang|language|sort|order|filter|perpage|page-size|pagesize|nav|jump|search|locale|currency|country|timezone|theme|font)/i;

  /* 取这一行的描述：优先用图片的 alt / title / 文件名，其次用行内文字 */
  function rowDescriptor(sel) {
    // 向上找"这一行"：要有图片，或者有除下拉框以外的文字。
    // 注意不能直接用 innerText 判断——<select> 的 innerText 会把所有选项都算进去。
    let row = sel.parentElement;
    for (let i = 0; i < 5 && row; i++) {
      if (row.querySelector('img')) break;
      let t = '';
      try {
        const clone = row.cloneNode(true);
        clone.querySelectorAll('select, option, button').forEach((s) => s.remove());
        t = squash(clone.innerText || clone.textContent || '');
      } catch (e) {
        t = '';
      }
      if (t.length >= 1) break;
      row = row.parentElement;
    }
    if (!row) return '';

    const parts = [];

    for (const img of row.querySelectorAll('img')) {
      const alt = (img.getAttribute('alt') || img.getAttribute('title') || '').trim();
      const src = img.getAttribute('src') || '';
      let base = '';
      try {
        base = decodeURIComponent(String(src).split('/').pop().split('?')[0])
          .replace(/\.[a-z0-9]+$/i, '')
          .replace(/[_-]+/g, ' ')
          .trim();
      } catch (e) {}
      if (alt && !/^(image|icon|图)/i.test(alt)) parts.push(alt);
      else if (base) parts.push('[' + base + ']');
    }

    // 行内文字：克隆一份，把 select 摘掉，避免把选项文字混进来
    try {
      const clone = row.cloneNode(true);
      clone.querySelectorAll('select, option, button').forEach((s) => s.remove());
      const t = squash(clone.innerText || clone.textContent || '');
      if (t && t.length <= 160) parts.push(t);
    } catch (e) {}

    return oneLine(parts.filter(Boolean).join(' ')).slice(0, 200);
  }

  function stemOfContainer(container) {
    let raw = '';
    try {
      const clone = container.cloneNode(true);
      clone.querySelectorAll('select, option, button').forEach((s) => s.remove());
      raw = squash(clone.innerText || clone.textContent || '');
    } catch (e) {
      raw = squash(container.innerText || '');
    }
    const lines = raw
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean)
      .filter((l) => !/^(choose|select|pick|请选择|选择|--|—|-{1,4})[.…\s]*$/i.test(l));
    return clampStem(lines.join('\n'));
  }

  /* 匹配题的容器：要往上找到包含题干的那一层。
     不能沿用 blankContainer——它只爬 5 层，对表格布局会停在 .ablock 上，抓不到题干。 */
  function matchContainer(sel) {
    const doc = sel.ownerDocument || document;
    let p = sel.parentElement;
    let fallback = null;
    for (let i = 0; i < 8 && p; i++) {
      if (p === doc.body || p === doc.documentElement) break;
      let t = '';
      try {
        const clone = p.cloneNode(true);
        clone.querySelectorAll('select, option').forEach((s) => s.remove());
        t = squash(clone.innerText || clone.textContent || '');
      } catch (e) {
        t = '';
      }
      if (t.length > 800) break; // 已经跨到整份试卷
      if (t.length >= 6) {
        fallback = p;
        if (t.length >= 12) return p;
      }
      p = p.parentElement;
    }
    return fallback || sel.parentElement || sel;
  }

  function extractMatches() {
    const sels = [];
    for (const doc of allDocs()) {
      let list = [];
      try {
        list = doc.querySelectorAll('select');
      } catch (e) {
        continue;
      }
      for (const s of list) {
        if (s.closest('#' + HOST_ID)) continue;
        if (s.disabled || s.options.length < 2) continue;
        if (!isVisible(s)) continue;

        const sig = [s.name, s.id, typeof s.className === 'string' ? s.className : '']
          .filter(Boolean)
          .join(' ');
        if (SELECT_SKIP.test(sig)) continue;

        let p = s.parentElement;
        let bad = false;
        for (let i = 0; i < 4 && p; i++) {
          if (/^(HEADER|NAV|FOOTER)$/.test(p.tagName)) {
            bad = true;
            break;
          }
          p = p.parentElement;
        }
        if (bad) continue;

        sels.push(s);
      }
    }
    if (sels.length < 2) return [];

    const groups = new Map();
    for (const s of sels) {
      const c = matchContainer(s);
      if (!groups.has(c)) groups.set(c, []);
      groups.get(c).push(s);
    }

    const out = [];
    for (const [container, list] of groups) {
      // 只有一个下拉框的不猜——排序、筛选这类控件到处都是
      if (list.length < 2) continue;
      if (!isVisible(container)) continue;

      list.sort((a, b) =>
        a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1
      );

      const rows = list.map((s) => rowDescriptor(s));
      const stem = stemOfContainer(container);
      if (!stem && !rows.some(Boolean)) continue;

      // 所有下拉框里的候选答案去重
      const choices = [];
      const seen = new Set();
      for (const s of list) {
        for (const o of s.options) {
          const t = oneLine(o.textContent || '');
          if (!t) continue;
          if (/^(choose|select|pick|请选择|选择|--|—)$/i.test(t.replace(/[.…\s]+$/g, ''))) continue;
          if (seen.has(t)) continue;
          seen.add(t);
          choices.push(t);
        }
      }
      if (choices.length < 2) continue;

      out.push({
        source: 'select',
        type: 'match',
        stem: stem || '把左右两列对应起来',
        options: [],
        rows,
        choices,
        blanks: list.map((el) => ({ el })),
        root: container
      });
    }

    return out;
  }

  Object.assign(Q, { SELECT_SKIP, rowDescriptor, stemOfContainer, matchContainer, extractMatches });
})();
