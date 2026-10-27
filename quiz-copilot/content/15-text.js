/* ============================================================
 * 答题助手 QuizCopilot — 纯文本题提取（div/li 铺的题目）
 * 文件：content/15-text.js
 * 说明：挂在 window.__QC 上，与其它模块共享；content script 的隔离环境，页面看不到
 * ============================================================ */
(() => {
  const Q = (window.__QC = window.__QC || {});
  const { HOST_ID, LETTERS, VER, S, norm, squash, oneLine, isVisible, esc, allDocs, countFrames, commonAncestor, OPT_CTRL_SEL, nearestOptionBox, BLANK_MARK, TYPE_CN, optionText, TRUE_RE, FALSE_RE, detectType, RE_OPT_LINE, NOISE_LINE, NOISE_INLINE, clampStem, cleanStemText, extractStem, inQuestionContainer, looksLikeQuizChoice, extractFromInputs } = Q;
  /* ============================================================
   * 三、题目识别 —— 方案 B：纯文本（div/li 铺的题目）
   * ============================================================ */

  const RE_QSTART =
    /^\s*(?:第\s*(\d{1,3})\s*题[\s、\.．:：]*|(\d{1,3})\s*[\.、．\)）]\s*|[(（]\s*(\d{1,3})\s*[)）]\s*)/;
  const RE_OPT = /^\s*[(（]?\s*([A-Ja-j])\s*[\)）\.、．:：]\s*(.+)$/;

  function parseTextToQuestions(rawText) {
    const lines = norm(rawText)
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    const out = [];
    let cur = null;

    const flush = () => {
      if (cur) {
        if (cur.options.length >= 2) {
          out.push(cur);
        } else if (cur.options.length === 0 && BLANK_MARK.test(cur.stem)) {
          // 没有选项、但题干里有空位 → 填空题
          cur.type = 'blank';
          out.push(cur);
        }
      }
      cur = null;
    };

    for (const line of lines) {
      const mo = line.match(RE_OPT);
      if (mo && cur) {
        const expect = String.fromCharCode(65 + cur.options.length);
        const got = mo[1].toUpperCase();
        if (got === expect || cur.options.length === 0) {
          cur.options.push({ letter: got, text: mo[2].trim() });
          continue;
        }
      }

      const mq = line.match(RE_QSTART);
      if (mq) {
        flush();
        const stripped = line.replace(RE_QSTART, '');
        cur = { source: 'text', type: 'single', stem: stripped, options: [] };
        continue;
      }

      if (cur && cur.options.length === 0) {
        if ((cur.stem + line).length < 1500) {
          cur.stem += (cur.stem ? '\n' : '') + line;
        }
        continue;
      }

      if (!cur && line.length >= 8 && /[？?]$/.test(line)) {
        cur = { source: 'text', type: 'single', stem: line, options: [] };
      }
    }
    flush();

    // 过滤与定类型
    const cleaned = out
      .filter(
        (q) =>
          (q.options.length >= 2 && q.options.length <= 10) ||
          (q.type === 'blank' && q.options.length === 0)
      )
      .filter((q) => q.stem && q.stem.trim().length >= 3)
      .slice(0, 200);

    for (const q of cleaned) {
      if (q.type === 'blank') {
        q.stem = clampStem(q.stem);
        q.options = [];
        continue;
      }
      q.options = q.options.slice(0, 10).map((o, i) => ({
        letter: o.letter || LETTERS[i],
        text: o.text
      }));
      const isJudge =
        q.options.length === 2 &&
        q.options.every((o) => TRUE_RE.test(o.text) || FALSE_RE.test(o.text));
      q.type = isJudge ? 'judge' : 'single';
      q.stem = clampStem(q.stem);
    }

    return cleaned;
  }


  Object.assign(Q, { RE_QSTART, RE_OPT, parseTextToQuestions });
})();
