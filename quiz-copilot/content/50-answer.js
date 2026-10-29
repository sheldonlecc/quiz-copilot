/* ============================================================
 * 答题助手 QuizCopilot — 答案匹配与回填（勾选 / 填字 / 下拉）
 * 文件：content/50-answer.js
 * 说明：挂在 window.__QC 上，与其它模块共享；content script 的隔离环境，页面看不到
 * ============================================================ */
(() => {
  const Q = (window.__QC = window.__QC || {});
  const { HOST_ID, LETTERS, VER, S, norm, squash, oneLine, isVisible, esc, allDocs, countFrames, commonAncestor, OPT_CTRL_SEL, nearestOptionBox, BLANK_MARK, TYPE_CN, optionText, TRUE_RE, FALSE_RE, detectType, RE_OPT_LINE, NOISE_LINE, NOISE_INLINE, clampStem, cleanStemText, extractStem, inQuestionContainer, looksLikeQuizChoice, extractFromInputs, RE_QSTART, RE_OPT, parseTextToQuestions, NOT_QUIZ_SIG, NOT_QUIZ_CN, ANSWER_LABEL, PERSONAL_ID, checkFillable, isQuizFillable, nearbyLabelText, collectCandidates, looksLikeQuestion, blankContainer, stemWithBlanks, extractBlanks, SELECT_SKIP, rowDescriptor, stemOfContainer, matchContainer, extractMatches, pageKind, KIND_TEXT, noQuestionHint, diagnose, describeEl, finalize, extractAll, extractFromSelection, buildPrompt, solve, sendBg } = Q;
  const setStatus = (...a) => Q.setStatus(...a);
  const render = (...a) => Q.render(...a);
  /* ============================================================
   * 六、答案 → 选项 匹配 & 勾选
   * ============================================================ */

  function targetOptions(q) {
    const ans = oneLine(q.answer).toUpperCase().replace(/[\s,，、/]+/g, '');
    if (!ans) return [];

    if (q.type === 'judge') {
      const isTrue = TRUE_RE.test(ans) || /正确/.test(ans) || /对/.test(ans);
      const isFalse = FALSE_RE.test(ans) || /错误/.test(ans) || /错/.test(ans);
      const want = isTrue ? TRUE_RE : isFalse ? FALSE_RE : null;
      if (want) {
        const hit = q.options.filter((o) => want.test(oneLine(o.text)));
        if (hit.length) return hit;
      }
      // 退化：按 A/B 顺序（判断常见 A=对 B=错）
      return isTrue ? [q.options[0]].filter(Boolean) : isFalse ? [q.options[1]].filter(Boolean) : [];
    }

    // 单选 / 多选：按字母取
    const letters = ans.replace(/[^A-J]/g, '');
    if (letters) {
      const hits = [];
      for (const ch of letters) {
        const idx = ch.charCodeAt(0) - 65;
        const opt = q.options[idx] || q.options.find((o) => o.letter === ch);
        if (opt && !hits.includes(opt)) hits.push(opt);
      }
      if (hits.length) return hits;
    }

    // 退化：答案直接是选项文本
    const byText = q.options.filter((o) => o.text && (ans.includes(oneLine(o.text).toUpperCase()) || oneLine(o.text).toUpperCase().includes(ans)));
    return byText.slice(0, 1);
  }

  function clickInput(inp) {
    const label = (inp.labels && inp.labels[0]) || inp.closest('label');
    try {
      (label || inp).click();
    } catch (e) {}
    if (!inp.checked) {
      try {
        inp.checked = true;
        inp.dispatchEvent(new Event('input', { bubbles: true }));
        inp.dispatchEvent(new Event('change', { bubbles: true }));
        inp.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      } catch (e) {}
    }
  }

  /* 多空答案分隔：模型返回 "北京|||上海"；也兼容全角竖线、分号 */
  function splitBlankAnswer(ans) {
    const s = String(ans == null ? '' : ans).trim();
    if (!s) return [];
    const parts = s
      .split(/\s*(?:\|\|\||\uFF5C{2,}|；|;)\s*/)
      .map((x) => x.trim())
      .filter(Boolean);
    return parts.length ? parts : [s];
  }

  /* 写入输入框：走原型上的 setter，才能让 React/Vue 的受控组件同步到 */
  function setNativeValue(el, val) {
    try {
      if (el.isContentEditable) {
        el.focus();
        el.textContent = val;
        el.dispatchEvent(new InputEvent('input', { bubbles: true, data: val }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
        return;
      }
      const proto =
        el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
      const desc = Object.getOwnPropertyDescriptor(proto, 'value');
      if (desc && desc.set) desc.set.call(el, val);
      else el.value = val;

      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
      el.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, key: 'Unidentified' }));
    } catch (e) {
      try {
        el.value = val;
      } catch (e2) {}
    }
  }

  /* ---------- 论述题：整段写入，不走多空分隔 ---------- */

  function escHtml(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  /* 段落之间用 \n\n 分开，单换行变 <br> */
  function toEssayHtml(text) {
    return String(text)
      .split(/\n{2,}/)
      .map((p) => '<p>' + escHtml(p).replace(/\n/g, '<br>') + '</p>')
      .join('');
  }

  function isRichEdit(el, doc) {
    return !!(el && (el.isContentEditable || el === doc.body));
  }

  /* 富文本编辑器：先走 execCommand('insertText')，让编辑器收到「输入」而不是被改 DOM */
  function setEssayValue(el, text) {
    const doc = el.ownerDocument || document;
    const win = doc.defaultView || window;
    if (!isRichEdit(el, doc)) {
      setNativeValue(el, text);
      return;
    }

    try { el.focus(); } catch (e) {}

    let ok = false;
    try {
      const range = doc.createRange();
      range.selectNodeContents(el);
      const sel = win.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
      ok = doc.execCommand('insertText', false, text);
    } catch (e) {}

    if (!ok) {
      try {
        el.innerHTML = toEssayHtml(text);
      } catch (e) {}
    }

    try {
      el.dispatchEvent(new InputEvent('input', { bubbles: true, data: text, inputType: 'insertText' }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    } catch (e) {}
  }

  function readEssay(el) {
    const doc = el.ownerDocument || document;
    if (isRichEdit(el, doc)) return String(el.innerText || el.textContent || '');
    return String(el.value || '');
  }

  function fillEssay(q) {
    const target = (q.blanks || [])[0] || {};
    const el = target.el;
    if (!el || !el.isConnected) return '这题找不到编辑框了（页面可能重新渲染过），请重新读取';

    const text = String(q.answer || '').trim();
    if (!text) return '没有拿到答案';

    setEssayValue(el, text);

    // UEditor 这类编辑器：真正提交的是它藏起来的 textarea，顺手也写一份
    if (isRichEdit(el, el.ownerDocument || document)) {
      try {
        const doc = el.ownerDocument || document;
        const frame = doc.defaultView && doc.defaultView.frameElement;
        let box = frame && frame.parentElement;
        let ta = null;
        for (let i = 0; i < 4 && box && !ta; i++, box = box.parentElement) {
          ta = box.querySelector('textarea');
        }
        if (ta && !ta.disabled) {
          const cur = String(ta.value || '');
          if (cur.length < text.length) setNativeValue(ta, text);
        }
      } catch (e) {}
    }

    const got = readEssay(el).replace(/\s+/g, '');
    const want = text.replace(/\s+/g, '');
    if (!got) return '编辑器没接受写入，点「复制全文」手动粘贴';
    if (got.length < want.length * 0.85) {
      return `只写进去 ${got.length} 字（应写 ${want.length} 字），建议复制全文手动粘贴`;
    }
    return '';
  }

  /* 用于展示/复制的答案文本 */
  function answerDisplay(q) {
    if (q.type === 'essay' || q.type === 'code') return q.answer || '（未作答）';
    if (q.type === 'blank' || q.type === 'match' || q.type === 'matrix') {
      const parts = splitBlankAnswer(q.answer);
      if (!parts.length) return '（未作答）';
      return parts.length > 1 ? parts.map((v, i) => `${i + 1}.${v}`).join('  ') : parts[0];
    }
    return q.answer || '（未作答）';
  }

  /* 把答案文字对到 <select> 的某个 option 上 */
  function pickSelectOption(sel, text) {
    const key = (s) => oneLine(s).toLowerCase().replace(/[\s\-_.,，。()（）[\]【】]/g, '');
    const want = key(text);
    if (!want) return null;

    let partial = null;
    for (const opt of sel.options) {
      const t = key(opt.textContent || '');
      if (!t) continue;
      if (t === want) return opt;
      if (!partial && (t.includes(want) || want.includes(t))) partial = opt;
    }
    return partial;
  }

  function setSelectValue(sel, text) {
    const opt = pickSelectOption(sel, text);
    if (!opt) return false;
    try {
      sel.value = opt.value;
    } catch (e) {
      try {
        opt.selected = true;
      } catch (e2) {}
    }
    try {
      sel.dispatchEvent(new Event('input', { bubbles: true }));
      sel.dispatchEvent(new Event('change', { bubbles: true }));
    } catch (e) {}
    return sel.selectedIndex === opt.index;
  }

  function fillBlank(q) {
    const parts = splitBlankAnswer(q.answer);
    if (!parts.length) return '没有拿到答案';

    const els = (q.blanks || []).map((b) => b.el).filter((e) => e && e.isConnected);
    if (!els.length) return '这题找不到输入框了（页面可能重新渲染过），请重新读取';

    let hit = 0;
    els.forEach((el, i) => {
      const v = parts[i] != null ? parts[i] : '';
      if (!v) return;

      if (el.tagName === 'SELECT') {
        if (setSelectValue(el, v)) hit++;
        return;
      }

      setNativeValue(el, v);
      if (String(el.value || el.textContent || '').trim() === v.trim()) hit++;
    });

    if (!hit) {
      return q.type === 'match'
        ? '答案文字和下拉框里的选项对不上，请手动选'
        : '写入后读不回内容（页面可能拦截了修改）';
    }
    if (hit < els.length) return `只填上了 ${hit}/${els.length} 项`;
    return '';
  }

  /* 编程题：写入是跨世界的异步操作，先当成功，结果回来再改状态 */
  function fillCode(q) {
    const code = String(q.answer || '').trim();
    if (!code) return '还没有生成代码';
    if (!Q.writeCode) return '写入模块没加载，点「复制代码」手动粘贴';

    q.fillState = 'writing';
    Q.writeCode(q).then(
      (err) => {
        q.fillState = err ? 'fail' : 'ok';
        setStatus(err ? `第 ${q.index} 题：${err}` : `第 ${q.index} 题：代码已写进编辑器，先跑一遍再提交。`, err ? 'warn' : 'ok');
        render();
      },
      (e) => {
        q.fillState = 'fail';
        setStatus(`第 ${q.index} 题：${String((e && e.message) || e)}`, 'warn');
        render();
      }
    );
    return '';
  }

  function fillOne(q) {
    if (q.type === 'code') return fillCode(q);
    if (q.type === 'essay') return fillEssay(q);
    if (q.type === 'blank' || q.type === 'match' || q.type === 'matrix') return fillBlank(q);

    const targets = targetOptions(q);
    if (!targets.length) return '答案与选项对不上';

    if (q.source === 'input') {
      let hit = 0;
      for (const opt of q.options) {
        const should = targets.includes(opt);
        if (should) {
          if (!opt.input.checked) clickInput(opt.input);
          if (opt.input.checked) hit++;
        } else if (q.type === 'multi' && opt.input.checked) {
          clickInput(opt.input);
        }
      }
      return hit ? '' : '点击后未能勾选（页面可能拦截了事件）';
    }

    // 文本型：按文字找可点击元素
    if (!TEXT_INDEX) TEXT_INDEX = buildTextIndex();
    let ok = 0;
    for (const t of targets) {
      const el = findClickableByText(t.text);
      if (el) {
        try {
          el.click();
          ok++;
        } catch (e) {}
      }
    }
    return ok ? '' : '没找到可点击的选项元素';
  }

  /* 纯文本型页面：先建一次文本索引，避免每个选项都全页扫描（会卡死页面） */
  let TEXT_INDEX = null;

  function buildTextIndex() {
    const map = new Map();
    const nodes = document.querySelectorAll('li,label,div,span,p,td,a,button');
    const limit = Math.min(nodes.length, 8000);
    for (let i = 0; i < limit; i++) {
      const el = nodes[i];
      if (el.children.length > 3) continue;
      const t = oneLine(el.textContent || '');
      if (!t || t.length > 100) continue;
      if (!map.has(t)) map.set(t, []);
      map.get(t).push(el);
    }
    return map;
  }

  function findClickableByText(text) {
    const target = oneLine(text);
    if (!target) return null;
    if (!TEXT_INDEX) TEXT_INDEX = buildTextIndex();
    const list = TEXT_INDEX.get(target);
    if (!list) return null;
    for (const el of list) {
      if (el.closest('#' + HOST_ID)) continue;
      if (isVisible(el)) return el;
    }
    return null;
  }

  function fillAll() {
    if (!S.questions.length) return { ok: 0, total: 0, fail: 0 };
    TEXT_INDEX = null; // 页面可能已重新渲染，索引重建一次
    let okCount = 0;
    let failCount = 0;
    let answered = 0;
    S.questions.forEach((q) => {
      if (!q.answer) return;
      answered++;
      const err = fillOne(q);
      // 编程题是异步写入，成功与否等回调自己改，别在这里抢先盖掉
      if (q.type !== 'code') q.fillState = err ? 'fail' : 'ok';
      if (err) failCount++;
      else okCount++;
    });
    const conflictCount = S.questions.filter((q) => q.conflict).length;

    // 头顶弹个数字球 + 飞出去一张小卡片：把「写进页面」这件事演出来
    if (okCount && Q.mascot) {
      if (Q.mascot.countTo) Q.mascot.countTo(okCount);
      if (Q.mascot.flyOut) Q.mascot.flyOut();
    }

    setStatus(
      `已填入 ${okCount} 道题` +
        (conflictCount ? `，${conflictCount} 道答案与解析对不上（面板里标黄，可一键改用解析值）` : '') +
        (failCount ? `，${failCount} 道失败（可手动核对）` : '') +
        '。请自行核对后提交。',
      failCount || conflictCount ? 'warn' : 'ok'
    );
    render();
    return { ok: okCount, total: answered, fail: failCount };
  }

  Object.assign(Q, { targetOptions, clickInput, splitBlankAnswer, setNativeValue, answerDisplay, pickSelectOption, setSelectValue, fillBlank, fillOne, fillCode, fillEssay, setEssayValue, readEssay, toEssayHtml, buildTextIndex, findClickableByText, fillAll });
})();
