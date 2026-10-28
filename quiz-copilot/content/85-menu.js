/* ============================================================
 * 答题助手 QuizCopilot — 小机器人的右键菜单
 * 文件：content/85-menu.js
 * 说明：单击已经被「一键解题」占死，右键是第二个入口；
 *       菜单在 Shadow DOM 里自绘，样式可控，也不需要额外权限。
 * ============================================================ */
(() => {
  const Q = (window.__QC = window.__QC || {});
  const S = Q.S;

  const CSS = `
  .qc-menu {
    position: fixed; z-index: 2147483647;
    min-width: 182px; padding: 5px;
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
  .qc-menu-row.danger:hover:not(:disabled) { background: rgba(248,113,113,.16); color: #ffd0d0; }
  .qc-menu-k { flex: 1 1 auto; min-width: 0; }
  .qc-menu-v {
    flex: 0 0 auto; font-size: 11px; color: #7f8a9c;
    font-family: ui-monospace, Consolas, monospace;
  }
  .qc-menu-row:hover:not(:disabled) .qc-menu-v { color: #9dc0ff; }
  .qc-menu-on { color: #6ee7a8; font-size: 11px; }
  .qc-menu-sep { height: 1px; margin: 4px 6px; background: rgba(255,255,255,.08); }
  .qc-menu-chips { display: flex; align-items: center; gap: 4px; padding: 2px 9px 5px; }
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
  .qc-menu-hd {
    padding: 4px 9px 6px; font-size: 10.5px; color: #626b7a;
    letter-spacing: .4px; display: flex; align-items: center; gap: 5px;
  }
  .qc-menu-dot { width: 5px; height: 5px; border-radius: 50%; background: #6ee7a8; flex: 0 0 auto; }
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

  function row(act, key, value, opts) {
    const o = opts || {};
    const dis = o.disabled ? ' disabled' : '';
    let tail = '';
    if (o.on) tail = '<span class="qc-menu-on">开</span>';
    else if (value) tail = `<span class="qc-menu-v">${Q.esc ? Q.esc(value) : value}</span>`;
    return (
      `<button class="qc-menu-row${o.danger ? ' danger' : ''}" data-act="${act}"${dis} role="menuitem">` +
      `<span class="qc-menu-k">${key}</span>${tail}</button>`
    );
  }

  function sep() {
    return '<div class="qc-menu-sep" role="separator"></div>';
  }

  /* 时长做成小方块，点一下就开，不用一层层翻子菜单 */
  function chipRow(label, list, isBreak) {
    const btns = list
      .map((m) => `<button class="qc-menu-chip" data-pomo="${m}" data-break="${isBreak ? 1 : 0}">${m}</button>`)
      .join('');
    return `<div class="qc-menu-chips"><span class="qc-menu-chip-k">${label}</span>${btns}</div>`;
  }

  function build() {
    const pomo = Q.pomo && Q.pomo.state ? Q.pomo.state() : null;
    const parts = [];

    if (pomo && pomo.running) {
      parts.push(
        `<div class="qc-menu-hd"><span class="qc-menu-dot"></span>${pomo.label} · ${pomo.left}</div>`
      );
    }

    parts.push(row('solve', '一键解题', 'Alt+Shift+Q'));
    parts.push(row('fill', '填入页面', '', { disabled: !(S.questions && S.questions.some((q) => q.answer)) }));
    parts.push(row('panel', '打开面板', 'Alt+Q'));
    parts.push(sep());

    parts.push(row('explain', '划词解释', '', { on: S.selExplain !== false }));
    if (pomo && pomo.running) {
      parts.push(row('pomo-stop', pomo.label + '中 · 结束', pomo.left));
    } else {
      parts.push(chipRow('专注', (Q.pomo && Q.pomo.FOCUS_MIN) || [15, 25, 45, 60], false));
      parts.push(chipRow('休息', (Q.pomo && Q.pomo.BREAK_MIN) || [5, 10, 15], true));
    }
    parts.push(sep());

    parts.push(row('auto', '自动填', '', { on: !!S.autoFill }));
    const skinName = (Q.mascot && Q.mascot.SKINS && Q.mascot.getEl())
      ? (Q.mascot.getEl().dataset.skin || 'blue')
      : 'blue';
    const skinCn = { blue: '经典蓝', mint: '薄荷绿', peach: '蜜桃粉', ink: '石墨灰' };
    parts.push(row('skin', '换皮肤', skinCn[skinName] || '经典蓝'));
    parts.push(sep());
    parts.push(row('hide', '隐藏小机器人', '设置里可开', { danger: true }));

    return parts.join('');
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

    el.querySelectorAll('[data-act]').forEach((b) => {
      b.addEventListener('click', (e) => {
        e.stopPropagation();
        const act = b.getAttribute('data-act');
        close();
        onAct(act);
      });
    });

    el.querySelectorAll('[data-pomo]').forEach((b) => {
      b.addEventListener('click', (e) => {
        e.stopPropagation();
        const min = Number(b.getAttribute('data-pomo'));
        const isBreak = b.getAttribute('data-break') === '1';
        close();
        if (Q.pomo) Q.pomo.start(min, isBreak);
      });
    });

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

  function onAct(act) {
    const bot = Q.mascot;
    if (act === 'solve') {
      if (Q.oneKeyFlow) Q.oneKeyFlow({ from: 'menu', redo: true });
      return;
    }
    if (act === 'fill') {
      if (Q.fillAll) Q.fillAll();
      return;
    }
    if (act === 'panel') {
      if (Q.openPanel) Q.openPanel();
      if (Q.render) Q.render();
      return;
    }
    if (act === 'explain') {
      S.selExplain = S.selExplain === false;
      try { chrome.storage.sync.set({ selExplain: S.selExplain }); } catch (e) {}
      if (!S.selExplain && Q.sel && Q.sel.hide) Q.sel.hide();
      if (bot) bot.say(S.selExplain ? '选一段字，我来讲' : '划词解释关掉了', 1800, false);
      return;
    }
    if (act === 'auto') {
      S.autoFill = !S.autoFill;
      try { chrome.storage.sync.set({ autoFill: S.autoFill }); } catch (e) {}
      if (Q.render) Q.render();
      if (bot) bot.say(S.autoFill ? '自动填：开' : '自动填：关', 1600, false);
      return;
    }
    if (act === 'pomo-stop') {
      if (Q.pomo) Q.pomo.stop(true);
      return;
    }
    if (act === 'skin') {
      if (!bot || !bot.nextSkin) return;
      const next = bot.nextSkin();
      bot.setSkin(next);
      try { chrome.storage.sync.set({ botSkin: next }); } catch (e) {}
      const cn = { blue: '经典蓝', mint: '薄荷绿', peach: '蜜桃粉', ink: '石墨灰' };
      bot.say('换成' + (cn[next] || next), 1500, false);
      return;
    }
    if (act === 'hide') {
      try { chrome.storage.sync.set({ showFab: false }); } catch (e) {}
      if (Q.closePanel) Q.closePanel();
      return;
    }
  }

  Q.menu = { mount: () => {}, open, close, isOpen: () => !!menuEl };
})();
