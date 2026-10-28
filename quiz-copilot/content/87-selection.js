/* ============================================================
 * 答题助手 QuizCopilot — 划词解释
 * 文件：content/87-selection.js
 * 说明：选中网页上任意一段文字，选区旁边会冒出一个小按钮，
 *       点它才真的调 AI（不自动发请求，免得费钱）。
 * ============================================================ */
(() => {
  const Q = (window.__QC = window.__QC || {});
  const S = Q.S;

  const MIN_LEN = 4;
  const MAX_LEN = 900;

  const CSS = `
  .qc-sel {
    position: fixed; z-index: 2147483647;
    display: flex; align-items: center; gap: 6px;
    padding: 5px 9px 5px 7px;
    border-radius: 8px;
    background: #1b1f28;
    border: 1px solid rgba(127,163,255,.42);
    box-shadow: 0 10px 26px rgba(0,0,0,.55);
    color: #eaf0ff; cursor: pointer;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Microsoft YaHei", sans-serif;
    font-size: 12px; line-height: 1.2;
    opacity: 0; transform: translateY(3px) scale(.94);
    transition: opacity .12s ease, transform .12s ease;
    user-select: none; white-space: nowrap;
  }
  .qc-sel[data-show="1"] { opacity: 1; transform: translateY(0) scale(1); }
  .qc-sel:hover { background: #242a38; border-color: rgba(127,163,255,.7); }
  .qc-sel-badge {
    width: 16px; height: 16px; border-radius: 5px; flex: 0 0 auto;
    background: linear-gradient(135deg, #4f8cff, #7c5cff);
    display: flex; align-items: center; justify-content: center;
    font-size: 8.5px; font-weight: 700; letter-spacing: -.3px; color: #fff;
  }
  `;

  let chip = null;
  let debounceTimer = null;
  let onSel = null;
  let onDown = null;
  let onScroll = null;

  function ensureStyle() {
    if (!S.shadow) return;
    if (S.shadow.querySelector('style[data-qc-style="selection"]')) return;
    const st = document.createElement('style');
    st.setAttribute('data-qc-style', 'selection');
    st.textContent = CSS;
    S.shadow.appendChild(st);
  }

  function ensureChip() {
    if (!S.shadow) return null;
    ensureStyle();
    if (chip && chip.isConnected) return chip;
    const el = document.createElement('div');
    el.className = 'qc-sel';
    el.innerHTML = '<span class="qc-sel-badge">AI</span><span>解释这段</span>';
    el.addEventListener('pointerdown', (e) => {
      // 按住别把选区弄没了，否则点下去时 selection 就空了
      e.preventDefault();
      e.stopPropagation();
    });
    el.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const text = pendingText;
      const rect = pendingRect;
      hide();
      if (text) explain(text, rect);
    });
    S.shadow.appendChild(el);
    chip = el;
    return el;
  }

  let pendingText = '';
  let pendingRect = null;

  function hide() {
    pendingText = '';
    pendingRect = null;
    if (chip) chip.dataset.show = '0';
  }

  function show(text, rect) {
    const el = ensureChip();
    if (!el || !rect) return;
    pendingText = text;
    pendingRect = rect;
    el.dataset.show = '1';

    // 先量宽高再定位，避免超出版心
    const w = el.offsetWidth || 90;
    const h = el.offsetHeight || 26;
    const M = 8;
    let left = rect.left + rect.width / 2 - w / 2;
    let top = rect.top - h - 8;
    if (top < M) top = Math.min(window.innerHeight - h - M, rect.bottom + 8);
    left = Math.max(M, Math.min(left, window.innerWidth - w - M));
    el.style.left = Math.round(left) + 'px';
    el.style.top = Math.round(top) + 'px';
  }

  function insideOwnUI(node) {
    if (!node) return false;
    try {
      const root = node.getRootNode ? node.getRootNode() : null;
      return !!(root && S.shadow && root === S.shadow);
    } catch (e) {
      return false;
    }
  }

  function readSelection() {
    if (S.selExplain === false) return;
    let sel = null;
    try {
      sel = window.getSelection();
    } catch (e) {
      return;
    }
    if (!sel || sel.isCollapsed || !sel.rangeCount) return hide();

    const text = String(sel.toString() || '').replace(/\s+/g, ' ').trim();
    if (text.length < MIN_LEN) return hide();
    if (insideOwnUI(sel.anchorNode) || insideOwnUI(sel.focusNode)) return hide();

    const ae = document.activeElement;
    if (ae && /^(INPUT|TEXTAREA)$/.test(ae.tagName)) return hide();

    let rect = null;
    try {
      const range = sel.getRangeAt(0);
      rect = range.getBoundingClientRect();
      if (!rect || (!rect.width && !rect.height)) {
        const list = range.getClientRects();
        rect = list && list.length ? list[list.length - 1] : null;
      }
    } catch (e) {
      return hide();
    }
    if (!rect) return hide();

    show(text.slice(0, MAX_LEN), rect);
  }

  function onSelectionChange() {
    if (S.selExplain === false) return hide();
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      debounceTimer = null;
      readSelection();
    }, 180);
  }

  async function explain(text, rect) {
    Q.ensureHost();
    const bot = Q.mascot;

    // 先变成球滚到选中的那段话旁边，落地再开始解释
    if (bot && bot.rollTo && rect) {
      try {
        await bot.rollTo(rect);
        bot.say('这段我看看…', 1500, false);
      } catch (e) {}
    }

    S.explain = { src: text, body: '', loading: true, error: '' };
    Q.openPanel();
    Q.render();

    if (bot && bot.getState() === 'idle') {
      bot.setState('thinking');
      bot.say('正在看这段…', 0, false);
    }

    try {
      const resp = await Q.sendBg({ type: 'QC_EXPLAIN', text });
      if (!resp || !resp.ok) throw new Error((resp && resp.error) || '调用失败');
      S.explain = { src: text, body: String(resp.text || '').trim(), loading: false, error: '' };
      if (bot && bot.getState() === 'thinking') {
        bot.setState('done');
        bot.say('解释好了，看面板', 3200, true);
        bot.settleAfter(4200);
      }
    } catch (e) {
      S.explain = { src: text, body: '', loading: false, error: String((e && e.message) || e) };
      if (bot && bot.getState() === 'thinking') {
        bot.setState('error');
        bot.say('解释失败', 3600, true);
        bot.settleAfter(4600);
      }
    }
    Q.render();

    // 解释完了自己滚回原位，别一直挡着正文
    if (bot && bot.rollHome) setTimeout(() => bot.rollHome(), 1600);
  }

  function init() {
    if (Q.ensureHost) Q.ensureHost();
    if (!S.shadow) return;
    if (onSel) return;   // 只挂一次
    onSel = onSelectionChange;
    document.addEventListener('selectionchange', onSel, true);

    onDown = (e) => {
      const path = e.composedPath ? e.composedPath() : [];
      if (chip && path.indexOf(chip) >= 0) return;
      hide();
    };
    document.addEventListener('pointerdown', onDown, true);

    onScroll = () => hide();
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onScroll, true);
  }

  Q.sel = { init, hide, explain, isOn: () => S.selExplain !== false };
})();
