/* ============================================================
 * 答题助手 QuizCopilot — 面板 UI：渲染与交互
 * 文件：content/70-panel.js
 * 说明：挂在 window.__QC 上，与其它模块共享；content script 的隔离环境，页面看不到
 * ============================================================ */
(() => {
  const Q = (window.__QC = window.__QC || {});
  const { HOST_ID, LETTERS, VER, S, norm, squash, oneLine, isVisible, esc, allDocs, countFrames, commonAncestor, OPT_CTRL_SEL, nearestOptionBox, BLANK_MARK, TYPE_CN, optionText, TRUE_RE, FALSE_RE, detectType, RE_OPT_LINE, NOISE_LINE, NOISE_INLINE, clampStem, cleanStemText, extractStem, inQuestionContainer, looksLikeQuizChoice, extractFromInputs, RE_QSTART, RE_OPT, parseTextToQuestions, NOT_QUIZ_SIG, NOT_QUIZ_CN, ANSWER_LABEL, PERSONAL_ID, checkFillable, isQuizFillable, nearbyLabelText, collectCandidates, looksLikeQuestion, blankContainer, stemWithBlanks, extractBlanks, SELECT_SKIP, rowDescriptor, stemOfContainer, matchContainer, extractMatches, pageKind, KIND_TEXT, noQuestionHint, diagnose, describeEl, finalize, extractAll, extractFromSelection, buildPrompt, solve, sendBg, targetOptions, clickInput, splitBlankAnswer, setNativeValue, answerDisplay, pickSelectOption, setSelectValue, fillBlank, fillOne, buildTextIndex, findClickableByText, fillAll, CSS } = Q;
  function ensureHost() {
    if (S.hostEl && S.hostEl.isConnected) return;
    const host = document.createElement('div');
    host.id = HOST_ID;
    host.style.cssText = 'all:initial;position:fixed;inset:0;width:0;height:0;z-index:2147483647;';
    document.documentElement.appendChild(host);
    const shadow = host.attachShadow({ mode: 'open' });
    const style = document.createElement('style');
    style.textContent = CSS;
    shadow.appendChild(style);
    S.hostEl = host;
    S.shadow = shadow;
  }


  const clampNum = (v, a, b) => Math.max(a, Math.min(b, v));

  /* ---------- 浮窗拖动：拖标题栏移动，位置记在本地 ---------- */
  function makeDraggable(box, handle, key) {
    if (!box || !handle || handle.dataset.dragBound === '1') return;
    handle.dataset.dragBound = '1';
    handle.style.cursor = 'grab';
    handle.style.touchAction = 'none';

    let drag = null;

    handle.addEventListener('pointerdown', (e) => {
      if (e.button != null && e.button !== 0) return;
      if (e.target.closest && e.target.closest('button, a, input, select')) return;
      const r = box.getBoundingClientRect();
      drag = { id: e.pointerId, ox: e.clientX - r.left, oy: e.clientY - r.top };
      box.style.right = 'auto';
      box.style.left = r.left + 'px';
      box.style.top = r.top + 'px';
      box.dataset.dragging = '1';
      try { handle.setPointerCapture(e.pointerId); } catch (err) {}
      e.preventDefault();
    });

    handle.addEventListener('pointermove', (e) => {
      if (!drag || e.pointerId !== drag.id) return;
      const w = box.offsetWidth;
      const h = box.offsetHeight;
      box.style.left = clampNum(e.clientX - drag.ox, 0, Math.max(0, window.innerWidth - w)) + 'px';
      box.style.top = clampNum(e.clientY - drag.oy, 0, Math.max(0, window.innerHeight - Math.min(h, 80))) + 'px';
    });

    const end = (e) => {
      if (!drag) return;
      drag = null;
      delete box.dataset.dragging;
      try { handle.releasePointerCapture(e.pointerId); } catch (err) {}
      if (!key) return;
      const r = box.getBoundingClientRect();
      try {
        chrome.storage.local.set({ [key]: { left: Math.round(r.left), top: Math.round(r.top) } });
      } catch (err) {}
    };
    handle.addEventListener('pointerup', end);
    handle.addEventListener('pointercancel', end);
  }

  function applySavedPos(box, key) {
    if (!box || !key) return;
    try {
      chrome.storage.local.get({ [key]: null }, (v) => {
        const p = v && v[key];
        if (!p || typeof p.left !== 'number' || typeof p.top !== 'number') return;
        if (!box.isConnected) return;
        const w = box.offsetWidth || 400;
        const h = box.offsetHeight || 320;
        box.style.right = 'auto';
        box.style.left = clampNum(p.left, 0, Math.max(0, window.innerWidth - w)) + 'px';
        box.style.top = clampNum(p.top, 0, Math.max(0, window.innerHeight - Math.min(h, 80))) + 'px';
      });
    } catch (e) {}
  }

  function openPanel() {
    ensureHost();
    // 右上角只放一个窗口：开面板就收起番茄窗
    if (Q.pomoWin && Q.pomoWin.isOpen && Q.pomoWin.isOpen()) Q.pomoWin.close();
    if (S.panelEl && S.panelEl.isConnected) {
      S.panelEl.style.display = 'flex';
      render();
      return;
    }
    const wrap = document.createElement('div');
    wrap.className = 'qc-wrap';
    wrap.style.cssText = 'position:fixed;right:20px;top:76px;z-index:2147483647;';
    S.shadow.appendChild(wrap);
    S.panelEl = wrap;
    render();
    applySavedPos(wrap, 'qcPanelPos');
  }

  function closePanel() {
    if (S.panelEl) {
      S.panelEl.remove();
      S.panelEl = null;
    }
  }

  function togglePanel() {
    if (S.panelEl && S.panelEl.isConnected) closePanel();
    else openPanel();
  }

  function setStatus(text, kind) {
    S.status = text || '';
    S.statusKind = kind || '';
  }

  function render() {
    if (!S.panelEl) return;
    const qs = S.questions;
    const busy = S.busy;

    const oldList = S.panelEl.querySelector('.qc-list');
    const oldScroll = oldList ? oldList.scrollTop : 0;

    let cards = '';
    if (S.diag) {
      cards = `<div class="qc-diag">
        <div class="qc-diag-hd">
          <span>诊断结果</span>
          <button class="qc-mini" data-act="copy-diag">复制</button>
          <button class="qc-mini" data-act="close-diag">收起</button>
        </div>
        <pre class="qc-diag-body">${esc(S.diag)}</pre>
      </div>`;
    } else if (!qs.length) {
      cards = `<div class="qc-empty">
        <span class="qc-empty-h">还没有读题</span>
        点上面 <b>① 读取并解答</b>，我会扫描这一页并让 AI 给出答案。<br>
        读不到的话，用鼠标框选题目后点 <b>读取选中文字</b>。
      </div>`;
    } else {
      cards = qs
        .map((q) => {
          const isBlank = q.type === 'blank' || q.type === 'match' || q.type === 'matrix';

          let band = '';
          if (!q.answer) {
            band = `<div class="qc-band empty"><span class="qc-band-k">未作答</span></div>`;
          } else if (q.type === 'essay') {
            const raw = String(q.answer);
            const chars = raw.replace(/\s/g, '').length;
            const need = (Q.essayWordHint ? Q.essayWordHint(q.stem) : '') || q.wordHint || '';
            band = `<div class="qc-essay">
              <div class="qc-essay-meta">
                <b>${chars}</b> 字${need ? `<span class="qc-essay-need">要求 ${esc(need)}</span>` : ''}
                <button class="qc-mini" data-act="copy-full" data-idx="${q.index}">复制全文</button>
              </div>
              <div class="qc-essay-pre">${esc(raw.slice(0, 140))}${raw.length > 140 ? '…' : ''}</div>
            </div>`;
          } else if (q.type === 'matrix') {
            const parts = splitBlankAnswer(q.answer);
            let k = 0;
            const rows = (q.rows || []).map((row) => {
              const vals = row.blanks.map(() => esc(parts[k++] || '—'));
              return `<div class="qc-band-row"><span class="qc-band-n">${esc(row.label)}</span><span class="qc-band-v">${vals.join(' / ')}</span></div>`;
            });
            band = `<div class="qc-band">${rows.join('')}</div>`;
          } else if (isBlank) {
            const parts = splitBlankAnswer(q.answer);
            if (parts.length <= 1) {
              band = `<div class="qc-band"><span class="qc-band-v">${esc(parts[0] || '')}</span></div>`;
            } else {
              band =
                `<div class="qc-band">` +
                parts
                  .map(
                    (v, i) =>
                      `<div class="qc-band-row"><span class="qc-band-n">${i + 1}</span><span class="qc-band-v">${esc(v)}</span></div>`
                  )
                  .join('') +
                `</div>`;
            }
          } else {
            const picked = targetOptions(q)
              .map((o) => o.text)
              .join('、');
            band = `<div class="qc-band"><span class="qc-band-k">${esc(q.answer)}</span>${
              picked ? `<span class="qc-band-v">${esc(picked)}</span>` : ''
            }</div>`;
          }

          return `<div class="qc-card ${q.fillState === 'fail' ? 'fail' : ''}">
            <div class="qc-card-hd">
              <span class="qc-idx">${q.index}</span>
              <span class="qc-type">${TYPE_CN[q.type] || '单选'}</span>
            </div>
            <div class="qc-stem">${esc(q.stem)}</div>
            ${band}
            ${q.conflict ? `<div class="qc-conflict">
              <span>解析算出 <b>${esc(q.conflict.suggest)}</b>，答案却是 <b>${esc(q.conflict.answer)}</b></span>
              <button class="qc-mini" data-act="use-suggest" data-idx="${q.index}">用 ${esc(q.conflict.suggest)}</button>
            </div>` : ''}
            ${q.reason ? `<div class="qc-reason">${esc(q.reason)}</div>` : ''}
            <div class="qc-card-acts">
              <button class="qc-mini" data-act="fill-one" data-idx="${q.index}">填入本题</button>
              <button class="qc-mini" data-act="copy-one" data-idx="${q.index}">复制</button>
            </div>
          </div>`;
        })
        .join('');
    }

    const canFill = !busy && qs.some((q) => q.answer);
    const solveLabel = busy ? '作答中…' : qs.length ? '重新读取' : '读取并解答';

    // 划词解释的结果卡片，排在最前面（它是「临时任务」，不该被题目挤下去）
    const ex = S.explain;
    const expCard = !ex
      ? ''
      : `<div class="qc-exp${ex.error ? ' bad' : ''}">
          <div class="qc-exp-hd">
            <span>划词解释</span>
            <button class="qc-mini" data-act="exp-close">收起</button>
          </div>
          <div class="qc-exp-src">${esc(ex.src)}</div>
          ${
            ex.loading
              ? '<div class="qc-exp-body loading">正在解释…</div>'
              : ex.error
              ? `<div class="qc-exp-body bad">${esc(ex.error)}</div>`
              : `<div class="qc-exp-body">${esc(ex.body)}</div>`
          }
        </div>`;

    S.panelEl.innerHTML = `
      <div class="qc-head">
        <div class="qc-logo">${Q.icon ? Q.icon.svg(21) : ''}</div>
        <div class="qc-title">答题助手<span class="qc-ver">v${esc(VER)}</span></div>
        <div class="qc-count ${qs.length ? '' : 'zero'}">${qs.length ? qs.length + ' 题' : '未读题'}</div>
        <button class="qc-x" data-act="close" title="关闭">×</button>
      </div>

      <div class="qc-acts">
        <button class="qc-step main" data-act="solve" ${busy ? 'disabled' : ''}>
          <span class="qc-step-no">1</span>
          <span class="qc-step-txt">
            <span class="qc-step-main">${solveLabel}</span>
            <span class="qc-step-sub">扫描并算出答案</span>
          </span>
        </button>
        <button class="qc-step" data-act="fill" ${canFill ? '' : 'disabled'}>
          <span class="qc-step-no">2</span>
          <span class="qc-step-txt">
            <span class="qc-step-main">填入页面</span>
            <span class="qc-step-sub">把答案写回网页</span>
          </span>
        </button>
      </div>

      <div class="qc-tools">
        <button class="qc-tool" data-act="copy">复制答案</button>
        <span class="qc-sep"></span>
        <button class="qc-tool" data-act="selection">读取选中文字</button>
        <span class="qc-sep"></span>
        <button class="qc-tool" data-act="diag">诊断</button>
        <button class="qc-tool qc-auto ${S.autoPage ? 'on' : ''}" data-act="toggle-page" title="开着时，点机器人会一页页做到底">
          <span class="qc-track"><i></i></span>自动翻页
        </button>
        <button class="qc-tool qc-auto ${S.autoFill ? 'on' : ''}" data-act="toggle-auto" title="开着时，第 1 步算完会自动执行第 2 步">
          <span class="qc-track"><i></i></span>自动填
        </button>
      </div>

      <div class="qc-list">${expCard}${cards}</div>

      <div class="qc-foot ${S.statusKind || ''}"><i class="qc-dot"></i><span>${esc(S.status || '就绪')}</span></div>
    `;

    S.panelEl.querySelectorAll('[data-act]').forEach((btn) => {
      btn.addEventListener('click', onAct);
    });

    const headEl = S.panelEl.querySelector('.qc-head');
    if (headEl) makeDraggable(S.panelEl, headEl, 'qcPanelPos');

    const newList = S.panelEl.querySelector('.qc-list');
    if (newList && oldScroll) newList.scrollTop = oldScroll;
  }

  function onAct(e) {
    const act = e.currentTarget.getAttribute('data-act');
    const idx = Number(e.currentTarget.getAttribute('data-idx') || 0);

    if (act === 'close') return closePanel();
    if (act === 'exp-close') {
      S.explain = null;
      return render();
    }
    if (act === 'selection') return extractFromSelection();
    if (act === 'diag') {
      S.diag = diagnose();
      setStatus('诊断完成。把下面这段内容复制发给我，就能定位问题。', 'ok');
      render();
      return;
    }
    if (act === 'copy-diag') {
      copyText(S.diag || '');
      return;
    }
    if (act === 'close-diag') {
      S.diag = '';
      render();
      return;
    }
    if (act === 'toggle-auto') {
      if (Q.setAutoFill) Q.setAutoFill(!S.autoFill);
      else {
        S.autoFill = !S.autoFill;
        chrome.storage.sync.set({ autoFill: S.autoFill });
      }
      render();
      return;
    }
    if (act === 'toggle-page') {
      if (Q.setAutoPage) Q.setAutoPage(!S.autoPage);
      else {
        S.autoPage = !S.autoPage;
        chrome.storage.sync.set({ autoPage: S.autoPage });
      }
      render();
      return;
    }
    if (act === 'fill') return fillAll();
    if (act === 'copy') return copyAll();
    if (act === 'solve') {
      S.diag = '';
      S.questions = extractAll();
      S.result = [];
      if (!S.questions.length) {
        setStatus(noQuestionHint(), 'warn');
        render();
        return;
      }
      setStatus(`读到 ${S.questions.length} 道题，正在作答…`, 'busy');
      render();
      return solve();
    }
    if (act === 'use-suggest') {
      const q = S.questions.find((x) => x.index === idx);
      if (!q || !q.conflict) return;
      const val = q.conflict.suggest;
      q.answer = val;
      q.conflict = null;
      const err2 = fillOne(q);
      q.fillState = err2 ? 'fail' : 'ok';
      setStatus(err2 ? `第 ${idx} 题：${err2}` : `第 ${idx} 题已改用 ${val}。`, err2 ? 'warn' : 'ok');
      render();
      return;
    }
    if (act === 'fill-one') {
      const q = S.questions.find((x) => x.index === idx);
      if (!q) return;
      const err = fillOne(q);
      q.fillState = err ? 'fail' : 'ok';
      setStatus(err ? `第 ${idx} 题：${err}` : `第 ${idx} 题已填入。`, err ? 'warn' : 'ok');
      render();
      return;
    }
    if (act === 'copy-full') {
      const q = S.questions.find((x) => x.index === idx);
      if (q) copyText(String(q.answer || ''));
      return;
    }

    if (act === 'copy-one') {
      const q = S.questions.find((x) => x.index === idx);
      if (q) copyText(`第${q.index}题：${answerDisplay(q)}${q.reason ? ' —— ' + q.reason : ''}`);
      return;
    }
  }

  function copyAll() {
    if (!S.questions.length) return;
    const text = S.questions
      .map((q) => `第${q.index}题：${answerDisplay(q)}`)
      .join('\n');
    copyText(text);
  }

  function copyText(text) {
    const done = () => setStatus('已复制到剪贴板。', 'ok');
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(done, () => fallbackCopy(text, done));
        return;
      }
    } catch (e) {}
    fallbackCopy(text, done);
  }

  function fallbackCopy(text, cb) {
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.cssText = 'position:fixed;opacity:0;top:0;left:0;';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
      cb && cb();
    } catch (e) {
      setStatus('复制失败，请手动选择文本。', 'warn');
      if (S.panelEl) render();
    }
  }


  Object.assign(Q, { ensureHost, openPanel, closePanel, togglePanel, setStatus, render, onAct, copyAll, copyText, fallbackCopy, makeDraggable, applySavedPos });
})();
