/* ============================================================
 * 答题助手 QuizCopilot — 小机器人的右键菜单
 * 文件：content/85-menu.js
 * 说明：菜单只管「马上要做的事」，复杂的东西都挪进各自的窗口/设置页。
 *       开关类点完不关菜单，可以连着改好几项。
 * ============================================================ */
(() => {
  const Q = (window.__QC = window.__QC || {});
  const S = Q.S;

  const PAGE_LIMITS = [30, 50, 100];

  const CSS = `
  .qc-menu {
    position: fixed; z-index: 2147483647;
    min-width: 210px; max-width: 280px; padding: 6px;
    background: #1b1f28;
    border: 1px solid rgba(255,255,255,.12);
    border-radius: 11px;
    box-shadow: 0 18px 44px rgba(0,0,0,.62), 0 2px 8px rgba(0,0,0,.4);
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Microsoft YaHei", sans-serif;
    font-size: 12.5px; color: #d7dbe2;
    opacity: 0; transform: scale(.96);
    transform-origin: 100% 100%;
    transition: opacity .12s ease, transform .12s ease;
    user-select: none;
  }
  .qc-menu[data-show="1"] { opacity: 1; transform: scale(1); }

  .qc-menu-row {
    display: flex; align-items: center; gap: 8px;
    width: 100%; padding: 7px 9px;
    border: none; border-radius: 7px; background: transparent;
    font: inherit; color: inherit; text-align: left; cursor: pointer;
    transition: background .1s;
  }
  .qc-menu-row:hover:not(:disabled) { background: rgba(255,255,255,.08); }
  .qc-menu-row:disabled { opacity: .38; cursor: default; }
  .qc-menu-row.danger { color: #e5a3a3; }
  .qc-menu-row.danger:hover:not(:disabled) { background: rgba(248,113,113,.16); color: #ffd0d0; }
  .qc-menu-row.primary {
    padding: 9px 10px;
    background: linear-gradient(135deg, rgba(59,123,255,.3), rgba(91,91,240,.24));
    border: 1px solid rgba(116,150,255,.36);
    color: #f2f6ff; font-weight: 600;
  }
  .qc-menu-row.primary:hover:not(:disabled) {
    background: linear-gradient(135deg, rgba(72,137,255,.42), rgba(108,108,255,.34));
  }

  .qc-menu-k { flex: 1 1 auto; min-width: 0; }
  .qc-menu-v {
    flex: 0 0 auto; font-size: 11px; color: #7f8a9c;
    font-family: ui-monospace, Consolas, monospace;
  }
  .qc-menu-row:hover:not(:disabled) .qc-menu-v { color: #9dc0ff; }
  .qc-menu-row.primary .qc-menu-v { color: rgba(226,236,255,.78); }
  .qc-menu-row.primary:hover .qc-menu-v { color: #fff; }

  .qc-menu-sw {
    width: 26px; height: 14px; border-radius: 7px; flex: 0 0 auto;
    background: #333845; position: relative; transition: background .16s;
  }
  .qc-menu-sw i {
    position: absolute; top: 2px; left: 2px;
    width: 10px; height: 10px; border-radius: 50%;
    background: #8b93a3; transition: left .16s, background .16s;
  }
  .qc-menu-sw.on { background: rgba(79,140,255,.62); }
  .qc-menu-sw.on i { left: 14px; background: #eaf2ff; }

  .qc-menu-sec {
    padding: 8px 9px 3px; font-size: 10px; font-weight: 600;
    letter-spacing: .9px; color: #7b8494;
  }
  .qc-menu-sep { height: 1px; margin: 5px 6px; background: rgba(255,255,255,.08); }

  .qc-menu-chips { display: flex; align-items: center; gap: 4px; padding: 1px 9px 5px; }
  .qc-menu-chip-k { font-size: 10.5px; color: #7f8a9c; flex: 0 0 auto; width: 26px; }
  .qc-menu-chip {
    flex: 1 1 0; min-width: 0; padding: 4px 0;
    border-radius: 6px; cursor: pointer;
    font: inherit; font-size: 11.5px; color: #cfd6e2;
    background: rgba(255,255,255,.05);
    border: 1px solid rgba(255,255,255,.1);
    transition: background .1s, border-color .1s, color .1s;
  }
  .qc-menu-chip:hover {
    background: rgba(79,140,255,.24);
    border-color: rgba(79,140,255,.55);
    color: #fff;
  }
  .qc-menu-chip.on {
    background: rgba(79,140,255,.3);
    border-color: rgba(120,165,255,.7);
    color: #fff; font-weight: 600;
  }
  .qc-menu-hd {
    padding: 3px 9px 5px; font-size: 10.5px; color: #7f8a9c;
    display: flex; align-items: center; gap: 5px;
  }
  .qc-menu-dot { width: 5px; height: 5px; border-radius: 50%; background: #6ee7a8; flex: 0 0 auto; }
  .qc-menu-dot.pause { background: #fbbf24; }
  `;

  let menuEl = null;
  let downHandler = null;
  let keyHandler = null;

  function ensureStyle() {
    if (!S.shadow) return;
    if (S.shadow.querySelector('style[data-qc-style="menu"]')) return;
    const st = document.createElement('style');
    st.setAttribute('data-qc-style', 'menu');
    st.textContent = CSS;
    S.shadow.appendChild(st);
  }

  const esc = (s) => (Q.esc ? Q.esc(s) : String(s == null ? '' : s));

  function row(act, label, value, opts) {
    const o = opts || {};
    const dis = o.disabled ? ' disabled' : '';
    let tail = '';
    if (o.toggle) tail = `<span class="qc-menu-sw${o.on ? ' on' : ''}"><i></i></span>`;
    else if (value) tail = `<span class="qc-menu-v">${esc(value)}</span>`;
    return (
      `<button class="qc-menu-row${o.primary ? ' primary' : ''}${o.danger ? ' danger' : ''}"` +
      ` data-act="${act}"${dis} role="menuitem">` +
      `<span class="qc-menu-k">${esc(label)}</span>${tail}</button>`
    );
  }

  function sec(title) {
    return `<div class="qc-menu-sec">${esc(title)}</div>`;
  }

  function sep() {
    return '<div class="qc-menu-sep" role="separator"></div>';
  }

  function chipRow(label, list, current, act) {
    const btns = list
      .map(
        (v) =>
          `<button class="qc-menu-chip${v === current ? ' on' : ''}" data-chip="${act}" data-v="${v}">${v}</button>`
      )
      .join('');
    return `<div class="qc-menu-chips"><span class="qc-menu-chip-k">${esc(label)}</span>${btns}</div>`;
  }

  function limits() {
    const cur = Number(S.pageLimit) || 30;
    return PAGE_LIMITS.indexOf(cur) >= 0 ? PAGE_LIMITS : PAGE_LIMITS.concat([cur]).sort((a, b) => a - b);
  }

  function build() {
    const pomo = Q.pomo && Q.pomo.state ? Q.pomo.state() : null;
    const chain = Q.chain && Q.chain.info ? Q.chain.info() : null;
    const running = !!(chain && chain.on);
    const parts = [];

    if (running) {
      parts.push(`<div class="qc-menu-hd"><span class="qc-menu-dot"></span>正在连做 · 第 ${chain.pages} 页</div>`);
    }

    /* 一、马上要做的事 */
    parts.push(row('solve', running ? '重新做这一页' : '一键解题', 'Alt+Shift+Q', { primary: true }));
    parts.push(row('panel', '打开面板', 'Alt+Q'));

    /* 二、两个开关 */
    parts.push(sep());
    parts.push(sec('自动化'));
    parts.push(row('auto', '自动填', '', { toggle: true, on: !!S.autoFill }));
    parts.push(row('autopage', '自动翻页', '', { toggle: true, on: !!S.autoPage }));
    if (S.autoPage) parts.push(chipRow('页数', limits(), Number(S.pageLimit) || 30, 'limit'));

    /* 三、窗口与设置 */
    parts.push(sep());
    parts.push(
      row(
        'pomo',
        '番茄钟',
        pomo && pomo.running ? `${pomo.label} ${pomo.left}` : '打开'
      )
    );
    parts.push(row('options', '更多设置', '皮肤 / 划词…'));
    parts.push(row('hide', '隐藏小机器人', '', { danger: true }));

    return parts.join('');
  }

  function bind() {
    const el = menuEl;
    if (!el) return;

    el.querySelectorAll('[data-act]').forEach((b) => {
      b.addEventListener('click', (e) => {
        e.stopPropagation();
        const keep = onAct(b.getAttribute('data-act'));
        if (keep) refresh();
        else close();
      });
    });

    el.querySelectorAll('[data-chip="limit"]').forEach((b) => {
      b.addEventListener('click', (e) => {
        e.stopPropagation();
        const n = Number(b.getAttribute('data-v'));
        if (Q.setPageLimit) Q.setPageLimit(n);
        else {
          S.pageLimit = n;
          try { chrome.storage.sync.set({ pageLimit: n }); } catch (err) {}
        }
        refresh();
      });
    });
  }

  /* 重画内容但不关菜单；高度变了就往上顶，别让菜单在脚下乱跳 */
  function refresh() {
    if (!menuEl) return;
    const oldH = menuEl.getBoundingClientRect().height;
    const top = parseFloat(menuEl.style.top) || 0;
    menuEl.innerHTML = build();
    bind();
    const newH = menuEl.getBoundingClientRect().height;
    if (Math.abs(newH - oldH) > 0.5) {
      let nt = top + oldH - newH;
      if (nt < 8) nt = 8;
      if (nt + newH > window.innerHeight - 8) nt = Math.max(8, window.innerHeight - newH - 8);
      menuEl.style.top = Math.round(nt) + 'px';
    }
  }

  function open() {
    if (!S.shadow) return;
    if (menuEl) { close(); return; }

    ensureStyle();
    const bot = Q.mascot && Q.mascot.getEl ? Q.mascot.getEl() : null;
    const r = bot
      ? bot.getBoundingClientRect()
      : { left: window.innerWidth - 70, right: window.innerWidth - 20, top: window.innerHeight - 74, bottom: window.innerHeight - 20 };

    const el = document.createElement('div');
    el.className = 'qc-menu';
    el.setAttribute('role', 'menu');
    el.innerHTML = build();
    S.shadow.appendChild(el);
    menuEl = el;
    bind();

    const mr = el.getBoundingClientRect();
    const M = 8;
    let left = r.left - mr.width - 8;
    if (left < M) left = r.right + 8;
    if (left + mr.width > window.innerWidth - M) left = window.innerWidth - mr.width - M;
    let top = r.bottom - mr.height;
    if (top < M) top = M;
    if (top + mr.height > window.innerHeight - M) top = Math.max(M, window.innerHeight - mr.height - M);

    el.style.left = Math.max(M, left) + 'px';
    el.style.top = top + 'px';
    el.style.transformOrigin = left < r.left ? '100% 100%' : '0 100%';

    requestAnimationFrame(() => {
      if (menuEl) menuEl.dataset.show = '1';
    });

    downHandler = (e) => {
      const path = e.composedPath ? e.composedPath() : [];
      if (path.indexOf(el) >= 0) return;
      close();
    };
    keyHandler = (e) => {
      if (e.key === 'Escape') close();
    };
    setTimeout(() => {
      window.addEventListener('pointerdown', downHandler, true);
      window.addEventListener('keydown', keyHandler, true);
    }, 0);
  }

  function close() {
    if (downHandler) {
      window.removeEventListener('pointerdown', downHandler, true);
      downHandler = null;
    }
    if (keyHandler) {
      window.removeEventListener('keydown', keyHandler, true);
      keyHandler = null;
    }
    if (menuEl) {
      menuEl.remove();
      menuEl = null;
    }
  }

  /* 返回 true = 菜单留着，方便连着改 */
  function onAct(act) {
    const bot = Q.mascot;

    if (act === 'solve') {
      if (Q.oneKeyFlow) Q.oneKeyFlow({ from: 'menu', redo: true });
      return false;
    }
    if (act === 'panel') {
      if (Q.openPanel) Q.openPanel();
      if (Q.render) Q.render();
      return false;
    }

    if (act === 'auto') {
      if (Q.setAutoFill) Q.setAutoFill(!S.autoFill);
      else S.autoFill = !S.autoFill;
      if (Q.render) Q.render();
      if (bot) bot.say(S.autoFill ? '自动填：开' : '自动填：关（自动翻页也跟着关了）', 1800, false);
      return true;
    }

    if (act === 'autopage') {
      if (Q.setAutoPage) Q.setAutoPage(!S.autoPage);
      else S.autoPage = !S.autoPage;
      if (Q.render) Q.render();
      if (bot) bot.say(S.autoPage ? '连做模式：开，点我就一路做到底' : '自动翻页：关', 2000, false);
      return true;
    }

    if (act === 'pomo') {
      if (Q.pomoWin) Q.pomoWin.open();
      return false;
    }

    if (act === 'options') {
      try {
        chrome.runtime.sendMessage({ type: 'QC_OPTIONS' });
      } catch (e) {}
      return false;
    }

    if (act === 'hide') {
      try { chrome.storage.sync.set({ showFab: false }); } catch (e) {}
      if (Q.closePanel) Q.closePanel();
      if (Q.pomoWin) Q.pomoWin.close();
      return false;
    }

    return false;
  }

  Q.menu = { mount: () => {}, open, close, refresh, isOpen: () => !!menuEl };
})();
