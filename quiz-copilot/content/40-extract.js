/* ============================================================
 * 答题助手 QuizCopilot — 统一入口 + 页面类型判断 + 诊断
 * 文件：content/40-extract.js
 * 说明：挂在 window.__QC 上，与其它模块共享；content script 的隔离环境，页面看不到
 * ============================================================ */
(() => {
  const Q = (window.__QC = window.__QC || {});
  const { HOST_ID, LETTERS, VER, S, norm, squash, oneLine, isVisible, esc, allDocs, countFrames, commonAncestor, OPT_CTRL_SEL, nearestOptionBox, BLANK_MARK, TYPE_CN, optionText, TRUE_RE, FALSE_RE, detectType, RE_OPT_LINE, NOISE_LINE, NOISE_INLINE, clampStem, cleanStemText, extractStem, inQuestionContainer, looksLikeQuizChoice, extractFromInputs, RE_QSTART, RE_OPT, parseTextToQuestions, NOT_QUIZ_SIG, NOT_QUIZ_CN, ANSWER_LABEL, PERSONAL_ID, checkFillable, isQuizFillable, nearbyLabelText, collectCandidates, looksLikeQuestion, blankContainer, stemWithBlanks, extractBlanks, SELECT_SKIP, rowDescriptor, stemOfContainer, matchContainer, extractMatches } = Q;
  const setStatus = (...a) => Q.setStatus(...a);
  const render = (...a) => Q.render(...a);
  const solve = (...a) => Q.solve(...a);
  /* 页面上有没有代码编辑器（LeetCode / 牛客 / 洛谷那种判题页） */
  function hasCodeEditor() {
    const sel = Q.CODE_EDITOR_SEL;
    if (!sel) return false;
    try {
      for (const doc of allDocs()) {
        if (doc.querySelector && doc.querySelector(sel)) return true;
      }
    } catch (e) {}
    return false;
  }

  /* 判断当前是答题页还是"已交卷的回看页"，两者行为完全不同 */
  function pageKind() {
    const href = String(location.href);
    if (/\/mod\/quiz\/review\.php/i.test(href)) return 'moodle-review';
    if (/\/mod\/quiz\/attempt\.php/i.test(href)) return 'moodle-attempt';
    if (/\/course\/view\.php/i.test(href)) return 'moodle-course';
    if (/\/mod\/quiz\//i.test(href)) return 'moodle-quiz';
    if (hasCodeEditor()) return 'code-judge';
    return 'generic';
  }

  const KIND_TEXT = {
    'moodle-review': 'Moodle 答卷回顾页（review.php）',
    'moodle-attempt': 'Moodle 答题页（attempt.php）',
    'moodle-course': 'Moodle 课程页（course/view.php，活动列表）',
    'moodle-quiz': 'Moodle 测验页面',
    'code-judge': '编程题页面（有代码编辑器）',
    generic: '普通页面'
  };

  /* 0 道题时给一句有信息量的话，而不是笼统的"读不到" */
  function noQuestionHint() {
    const kind = pageKind();
    if (kind === 'moodle-review') {
      return '这是答卷回顾页，答案框都是只读的，本来就不能作答。想验证请重新进入测验的答题页（attempt.php）。';
    }
    if (kind === 'moodle-course') {
      return '这是课程的「活动列表」页，不是测验页——这里只有学习任务，没有题目。请点进标着 Quiz 的那一项，进入 attempt.php 再读。';
    }
    if (kind === 'code-judge') {
      return '这页是编程题：答案是写进右边代码编辑器的一段代码，不是填空或选择，我填不进去。想让我帮忙的话，选中题目文字用「解释这段」讲思路。';
    }
    let raw = 0;
    let ok = 0;
    let ro = 0;
    try {
      const c = collectCandidates();
      raw = c.raw.length;
      ok = c.ok.length;
      ro = c.rejected.filter((r) => r.why === 'readOnly' || r.why === 'disabled').length;
    } catch (e) {}

    if (ro > 0 && ok === 0) {
      return `找到 ${ro} 个答题框，但全部是只读状态——这份卷子应该已经交过了。点「诊断」看细节。`;
    }
    if (raw === 0) {
      return '页面上没有任何输入类元素。题目可能嵌在跨域 iframe 或 Shadow DOM 里，用「读取选中文字」框选试试。';
    }
    return `页面上有 ${raw} 个输入类元素、${ok} 个通过初筛，但没拼成完整题目。点「诊断」看细节。`;
  }

  function diagnose() {
    const lines = [];
    const push = (s) => lines.push(s);

    const kind = pageKind();
    const isReview = kind === 'moodle-review';

    push('插件版本：v' + VER);
    push('页面类型：' + (KIND_TEXT[kind] || '普通页面') + (isReview ? '　← 已交卷的回看页面，不能作答' : ''));
    push('地址：' + String(location.href).slice(0, 140));
    push('框架：' + (window.top === window ? '顶层页面' : '子框架 iframe'));

    const fr = countFrames();
    if (fr.total) {
      push(`页面内 iframe：共 ${fr.total} 个，其中同源可读 ${fr.readable} 个` +
        (fr.total > fr.readable ? '（跨域的读不到，题目若在跨域框架里就用「读取选中文字」）' : ''));
    }
    push('');

    const radios = document.querySelectorAll('input[type="radio"]').length;
    const checks = document.querySelectorAll('input[type="checkbox"]').length;
    push(`单选/复选控件：radio ${radios} 个，checkbox ${checks} 个`);

    const { raw, ok, rejected } = collectCandidates();
    const readOnlyCount = rejected.filter((r) => r.why === 'readOnly' || r.why === 'disabled').length;

    // 论述题单独统计：它们往往会因为「过宽」被填空初筛拒掉，得让用户看到
    let essayCount = 0;
    try {
      essayCount = Q.extractEssays ? Q.extractEssays().length : 0;
    } catch (e) {}
    if (essayCount) push(`论述/简答编辑器：${essayCount} 个（大编辑框，按论述题处理）`);
    push(`输入类元素总数：${raw.length} 个，通过初筛：${ok.length} 个` +
      (readOnlyCount ? `，其中 ${readOnlyCount} 个是只读/禁用的` : ''));
    push('');

    if (rejected.length) {
      push('被排除的输入框（最多列 10 个）：');
      rejected.slice(0, 10).forEach((r, i) => {
        const id = describeEl(r.el);
        push(`  ${i + 1}. ${id} → ${r.why}`);
      });
      push('');
    }

    if (ok.length) {
      push('通过初筛的输入框：');
      ok.slice(0, 10).forEach((o, i) => {
        const el = o.el;
        const r = el.getBoundingClientRect();
        const c = blankContainer(el);
        const stem = stemWithBlanks(c, [el]);
        push(`  ${i + 1}. ${describeEl(el)} 宽${Math.round(r.width)} 高${Math.round(r.height)}`);
        push(`     所属容器文本：${stem ? stem.slice(0, 60).replace(/\n/g, ' / ') : '（空）'}`);
        push(`     判定：${stem && stem.length >= 4 ? '可成题' : '文本太短，被丢弃'}`);
      });
    } else if (readOnlyCount > 0) {
      push(`找到了 ${readOnlyCount} 个答题框，但全部处于只读状态。`);
      push('这说明这份卷子已经提交/批改过了，页面本身就不允许再改答案。');
    } else if (radios + checks === 0) {
      push('页面上既没有可填的输入框，也没有单选/复选控件。');
      push('可能原因：题目在 iframe 里、由 Shadow DOM 渲染、或者这一页只有叙述题没有选项。');
    } else {
      push('没有找到可用的答题框，但页面上有单选/复选控件，可能是自定义组件。');
    }

    const qs = extractAll();
    push('');
    push(`最终识别结果：${qs.length} 道题`);
    qs.slice(0, 5).forEach((q) => {
      push(`  第${q.index}题[${TYPE_CN[q.type] || q.type}] ${q.stem.slice(0, 50).replace(/\n/g, ' ')}`);
    });

    /* ---- 结论与下一步 ---- */
    if (!qs.length) {
      push('');
      push('结论：');
      if (isReview) {
        push('  · 这是答卷回顾页，不是答题页。所有答案框都是只读的，');
        push('    页面本身不提供作答入口 —— 所以填不进去是正常的，不是加密，也不是插件坏了。');
        push('  · 想验证插件，请回课程页重新进入测验，点「Attempt quiz now / 再次作答」，');
        push('    地址栏变成 attempt.php?attempt=… 之后再读取。');
      } else if (kind === 'moodle-course') {
        push('  · 这是课程的活动列表页，不是测验页。这里的勾选框是「完成状态」，不是选项。');
        push('  · 请点进标着 Quiz 的那一项，进入 attempt.php 之后再读取。');
      } else if (kind === 'code-judge') {
        push('  · 这页是编程题（页面右侧有代码编辑器），答案是写进编辑器的一段代码。');
        push('  · 插件只处理填空 / 选择 / 判断这类表单题，没有「替你写代码」这条路，');
        push('    所以这里一道题都不产出是故意的，不是没读出来。');
        push('  · 想让它帮忙：选中题目文字，点「解释这段」，让它讲思路。');
      } else if (readOnlyCount > 0) {
        push(`  · 有 ${readOnlyCount} 个答题框是只读/禁用的，这份卷子看起来已经交过卷。`);
        push('  · 请确认打开的是尚未提交的 attempt.php 页面。');
      } else if (raw.length === 0) {
        push('  · 页面上没有任何输入类元素，插件确实无从下手。');
        push('  · 可以用「读取选中文字」把题目框选给插件。');
      }
    }

    return lines.join('\n');
  }

  function describeEl(el) {
    const bits = [el.tagName.toLowerCase()];
    const nm = el.getAttribute('name');
    const id = el.id;
    const cls = typeof el.className === 'string' ? el.className.split(/\s+/).filter(Boolean).slice(0, 2).join('.') : '';
    const ph = el.getAttribute('placeholder');
    if (nm) bits.push(`name="${nm}"`);
    if (id) bits.push(`id="${id}"`);
    if (cls) bits.push(`.${cls}`);
    if (ph) bits.push(`placeholder="${ph}"`);
    return bits.join(' ');
  }

  /* ============================================================
   * 四、统一入口
   * ============================================================ */

  function finalize(questions) {
    questions.forEach((q, i) => {
      q.index = i + 1;
      q.answer = '';
      q.reason = '';
      q.fillState = '';
    });
    return questions;
  }

  function extractAll() {
    const kind = pageKind();
    const choice = extractFromInputs();
    const blanks = extractBlanks();
    const matches = extractMatches();
    let list = choice.concat(blanks, matches);

    /* 判题页（有 Monaco / CodeMirror 这类代码编辑器）：填空和论述一律不要。
       这类页面根本没有「填答案」这回事，硬读出来的只会是编辑器里的碎片。
       选择题保留——万一某个课程页同时放了测验和代码练习。 */
    if (kind === 'code-judge') {
      list = list.filter((q) => q.type !== 'blank' && q.type !== 'essay');
    }

    if (!list.length && kind !== 'code-judge') {
      list = parseTextToQuestions(document.body.innerText || '');
    }

    // 按页面顺序排好，选择题和填空题可能交错
    list.sort((a, b) => {
      if (!a.root || !b.root || a.root === b.root) return 0;
      if (a.root.ownerDocument !== b.root.ownerDocument) return 0;
      const rel = a.root.compareDocumentPosition(b.root);
      if (rel & 1) return 0; // DISCONNECTED
      if (rel & 4) return -1; // FOLLOWING
      if (rel & 2) return 1; // PRECEDING
      return 0;
    });

    return finalize(list);
  }

  function extractFromSelection() {
    const sel = window.getSelection();
    const text = sel ? String(sel.toString() || '') : '';
    if (!text.trim()) {
      setStatus('没有选中文字。先用鼠标框选页面上的一段题目，再点这个按钮。', 'warn');
      return;
    }
    const list = parseTextToQuestions(text);
    if (!list.length) {
      setStatus('选中内容里没有解析出题目结构（题干 + 选项，或带 ____ 的填空题）。', 'warn');
      return;
    }
    S.questions = finalize(list);
    S.result = [];
    setStatus(`从选中文字里读到 ${S.questions.length} 道题。`, 'ok');
    render();
    solve();
  }


  Object.assign(Q, { pageKind, hasCodeEditor, KIND_TEXT, noQuestionHint, diagnose, describeEl, finalize, extractAll, extractFromSelection });
})();
