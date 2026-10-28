/* ============================================================
 * 答题助手 QuizCopilot — 衣橱（帽子 / 耳朵 / 领结）
 * 文件：content/84-wardrobe.js
 * 说明：和答题面板、番茄窗共用右上角同一个位置，开一个自动关另外两个。
 *       上半屏是放大的实时预览，下半屏点一下就穿到右下角那个真身上。
 *       配件的 DOM 和样式都在 80-mascot.js 里，这里只负责挑。
 * ============================================================ */
(() => {
  const Q = (window.__QC = window.__QC || {});
  const S = Q.S;
  const esc = (s) => (Q.esc ? Q.esc(s) : String(s == null ? '' : s));

  const KIND_CN = { hat: '帽子', ears: '耳朵', neck: '领结' };
  const POS_KEY = 'qcWardrobePos';

  let win = null;

  const CSS = `
  .qc-wd {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Microsoft YaHei", sans-serif;
    font-size: 13px; line-height: 1.5; color: #e8eaef;
    width: 400px; max-width: calc(100vw - 40px);
    max-height: calc(100vh - 120px);
    display: flex; flex-direction: column;
    background: #15171e;
    border: 1px solid rgba(255,255,255,.09);
    border-radius: 14px;
    box-shadow: 0 20px 56px rgba(0,0,0,.6), 0 2px 10px rgba(0,0,0,.4);
    overflow: hidden;
  }
  .qc-wd-hd {
    display: flex; align-items: center; gap: 8px;
    cursor: grab; padding: 11px 12px 9px;
    border-bottom: 1px solid rgba(255,255,255,.07);
    flex: 0 0 auto;
  }
  .qc-wd-hd b { font-size: 13px; font-weight: 600; }
  .qc-wd-hd .sub { font-size: 11px; color: #6f7787; }
  .qc-wd-x {
    margin-left: auto; width: 22px; height: 22px; flex: 0 0 auto;
    border: none; border-radius: 6px; background: transparent;
    color: #8b93a3; font-size: 16px; line-height: 1; cursor: pointer;
  }
  .qc-wd-x:hover { background: rgba(255,255,255,.08); color: #e8eaef; }
  .qc-wd[data-dragging="1"] { user-select: none; }

  /* 预览台：底部一条光，机器人站在上面 */
  .qc-wd-stage {
    position: relative; flex: 0 0 auto;
    height: 136px; padding-bottom: 8px;
    display: flex; align-items: flex-end; justify-content: center;
    overflow: hidden;
    background:
      radial-gradient(ellipse 62% 58% at 50% 80%, rgba(79,140,255,.18), transparent 72%),
      linear-gradient(180deg, rgba(255,255,255,.022), transparent 60%);
    border-bottom: 1px solid rgba(255,255,255,.07);
  }
  .qc-bot.qc-wd-bot {
    position: relative; left: auto; right: auto; top: auto; bottom: auto;
    transform: scale(2.3); transform-origin: 50% 100%;
    pointer-events: none; z-index: 0;
  }

  .qc-wd-body { padding: 10px 14px 12px; overflow: auto; flex: 1 1 auto; }
  .qc-wd-grp { margin-bottom: 9px; }
  .qc-wd-lab {
    font-size: 10.5px; color: #7b8494; letter-spacing: .8px;
    margin-bottom: 6px;
  }
  .qc-wd-row { display: flex; flex-wrap: wrap; gap: 6px; }
  .qc-wd-chip {
    padding: 4px 10px; border-radius: 7px; cursor: pointer;
    font: inherit; font-size: 12px; color: #cfd6e2;
    background: rgba(255,255,255,.05); border: 1px solid rgba(255,255,255,.1);
    transition: background .15s, border-color .15s, color .15s;
  }
  .qc-wd-chip:hover { background: rgba(79,140,255,.2); border-color: rgba(79,140,255,.45); color: #fff; }
  .qc-wd-chip.on {
    background: rgba(79,140,255,.3); border-color: rgba(120,165,255,.7);
    color: #fff; font-weight: 600;
  }

  .qc-wd-foot { display: flex; gap: 8px; margin-top: 12px; }
  .qc-wd-btn {
    flex: 1 1 0; padding: 8px 0; border-radius: 8px; cursor: pointer;
    font: inherit; font-size: 12.5px; color: #cfd6e2;
    background: rgba(255,255,255,.055); border: 1px solid rgba(255,255,255,.11);
  }
  .qc-wd-btn:hover { background: rgba(79,140,255,.2); border-color: rgba(79,140,255,.45); color: #fff; }
  .qc-wd-btn[data-act="clear"]:hover {
    background: rgba(248,113,113,.16); border-color: rgba(248,113,113,.42); color: #fca5a5;
  }
  `;

  function ensureStyle() {
    if (!S.shadow) return;
    if (S.shadow.querySelector('style[data-qc-style="wardrobe"]')) return;
    const st = document.createElement('style');
    st.setAttribute('data-qc-style', 'wardrobe');
    st.textContent = CSS;
    S.shadow.appendChild(st);
  }

  function groupsHTML(wear) {
    const W = Q.mascot;
    if (!W || !W.WEAR_ITEMS) return '';
    return ['hat', 'ears', 'neck']
      .map((kind) => {
        const items = (W.WEAR_ITEMS[kind] || [])
          .map((v) => {
            const label = (W.WEAR_CN[kind] || {})[v] || v;
            const on = v === wear[kind] ? ' on' : '';
            return `<button class="qc-wd-chip${on}" data-kind="${kind}" data-v="${esc(v)}">${esc(label)}</button>`;
          })
          .join('');
        return `<div class="qc-wd-grp"><div class="qc-wd-lab">${KIND_CN[kind]}</div><div class="qc-wd-row">${items}</div></div>`;
      })
      .join('');
  }

  function refresh() {
    if (!win) return;
    const W = Q.mascot;
    const wear = W && W.getWear ? W.getWear() : { hat: 'none', ears: 'none', neck: 'none' };

    win.innerHTML = `
      <div class="qc-wd-hd">
        <b>衣橱</b>
        <span class="sub">穿戴好会记住</span>
        <button class="qc-wd-x" data-act="close" title="关闭">×</button>
      </div>
      <div class="qc-wd-stage">
        <div class="qc-bot qc-wd-bot" data-hat="${esc(wear.hat)}" data-ears="${esc(wear.ears)}" data-neck="${esc(wear.neck)}">${W ? W.BOT_INNER : ''}</div>
      </div>
      <div class="qc-wd-body">
        ${groupsHTML(wear)}
        <div class="qc-wd-foot">
          <button class="qc-wd-btn" data-act="random">随机一套</button>
          <button class="qc-wd-btn" data-act="clear">全部摘掉</button>
        </div>
      </div>
    `;

    bind();

    if (Q.makeDraggable) {
      const hd = win.querySelector('.qc-wd-hd');
      if (hd) Q.makeDraggable(win, hd, POS_KEY);
    }
  }

  /* 换上一套：真身 + 预览 + 选中态一起变，不重建 DOM（重建会让配件动画重播） */
  function apply(wear) {
    const W = Q.mascot;
    if (!W || !W.setWear) return;
    const nw = W.setWear(wear);

    const pv = win && win.querySelector('.qc-wd-bot');
    if (pv) {
      pv.dataset.hat = nw.hat;
      pv.dataset.ears = nw.ears;
      pv.dataset.neck = nw.neck;
    }
    if (win) {
      win.querySelectorAll('[data-kind]').forEach((b) => {
        const k = b.getAttribute('data-kind');
        b.classList.toggle('on', b.getAttribute('data-v') === nw[k]);
      });
    }
  }

  function bind() {
    if (!win) return;

    const closeBtn = win.querySelector('[data-act="close"]');
    if (closeBtn) closeBtn.addEventListener('click', close);

    win.querySelectorAll('[data-kind]').forEach((b) => {
      b.addEventListener('click', () => {
        const kind = b.getAttribute('data-kind');
        const v = b.getAttribute('data-v');
        const next = Object.assign({}, Q.mascot.getWear(), { [kind]: v });
        apply(next);
      });
    });

    const rand = win.querySelector('[data-act="random"]');
    if (rand) {
      rand.addEventListener('click', () => {
        if (!Q.mascot.randomWear) return;
        apply(Q.mascot.randomWear());
      });
    }

    const clr = win.querySelector('[data-act="clear"]');
    if (clr) {
      clr.addEventListener('click', () => {
        apply({ hat: 'none', ears: 'none', neck: 'none' });
      });
    }
  }

  function open() {
    if (Q.ensureHost) Q.ensureHost();
    if (!S.shadow) return;
    if (win && win.isConnected) { refresh(); return; }
    ensureStyle();

    // 一个位置只放一个窗口
    if (Q.closePanel) Q.closePanel();
    if (Q.pomoWin) Q.pomoWin.close();

    const el = document.createElement('div');
    el.className = 'qc-wd';
    el.style.cssText = 'position:fixed;right:20px;top:76px;z-index:2147483647;';
    S.shadow.appendChild(el);
    win = el;
    refresh();
    if (Q.applySavedPos) Q.applySavedPos(win, POS_KEY);
  }

  function close() {
    if (win) { win.remove(); win = null; }
  }

  function toggle() {
    if (win && win.isConnected) close();
    else open();
  }

  Q.wardrobe = {
    open,
    close,
    toggle,
    refresh,
    isOpen: () => !!(win && win.isConnected),
    CSS
  };
})();
