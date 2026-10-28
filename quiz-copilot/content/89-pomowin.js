/* ============================================================
 * 答题助手 QuizCopilot — 番茄窗（专注 / 任务 / 统计）
 * 文件：content/89-pomowin.js
 * 说明：和答题面板共用右上角同一个位置，开一个就关另一个——
 *       一个窗口只干一件事，不把功能堆在菜单里。
 * ============================================================ */
(() => {
  const Q = (window.__QC = window.__QC || {});
  const S = Q.S;

  const esc = (s) => (Q.esc ? Q.esc(s) : String(s == null ? '' : s));
  const RING_R = 58;
  const RING_C = 2 * Math.PI * RING_R;   // ≈ 364.4

  let win = null;
  let tab = 'focus';       // focus | tasks | stats
  let range = 'today';     // today | week | month
  let lastSig = '';
  let ticker = null;

  const CSS = `
  .qc-pw {
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
  .qc-pw-hd {
    display: flex; align-items: center; gap: 8px;
    cursor: grab;
    padding: 11px 12px 9px;
    border-bottom: 1px solid rgba(255,255,255,.07);
    flex: 0 0 auto;
  }
  .qc-pw-hd b { font-size: 13px; font-weight: 600; }
  .qc-pw-hd .sub { font-size: 11px; color: #6f7787; }
  .qc-pw-x {
    margin-left: auto; width: 22px; height: 22px; flex: 0 0 auto;
    border: none; border-radius: 6px; background: transparent;
    color: #8b93a3; font-size: 16px; line-height: 1; cursor: pointer;
  }
  .qc-pw-x:hover { background: rgba(255,255,255,.08); color: #e8eaef; }

  .qc-pw-tabs { display: flex; gap: 2px; padding: 8px 10px 0; flex: 0 0 auto; }
  .qc-pw-tab {
    flex: 1 1 0; padding: 6px 0; border: none; border-radius: 7px 7px 0 0;
    background: transparent; color: #8b93a3; font: inherit; font-size: 12px;
    cursor: pointer; border-bottom: 2px solid transparent;
  }
  .qc-pw-tab:hover { color: #cfd6e2; background: rgba(255,255,255,.04); }
  .qc-pw-tab.on { color: #9dc0ff; border-bottom-color: #4f8cff; font-weight: 600; }

  .qc-pw[data-dragging="1"] { user-select: none; }
  .qc-pw-body { padding: 12px 14px 14px; overflow: auto; flex: 1 1 auto; }

  /* ---- 专注 ---- */
  .qc-pw-ring { position: relative; width: 168px; height: 168px; margin: 4px auto 2px; }
  .qc-pw-ring svg { width: 100%; height: 100%; transform: rotate(-90deg); }
  .qc-pw-ring circle { fill: none; stroke-width: 9; stroke-linecap: round; }
  .qc-pw-ring .bg { stroke: rgba(255,255,255,.07); }
  .qc-pw-ring .fg { stroke: #4f8cff; transition: stroke-dashoffset .5s linear, stroke .2s; }
  .qc-pw-ring.break .fg { stroke: #34d399; }
  .qc-pw-ring.done .fg { stroke: #fbbf24; }
  .qc-pw-mid {
    position: absolute; inset: 0; display: flex; flex-direction: column;
    align-items: center; justify-content: center; gap: 2px;
  }
  .qc-pw-time {
    font-family: ui-monospace, Consolas, monospace;
    font-size: 30px; font-weight: 700; letter-spacing: 1px; color: #f2f6ff;
  }
  .qc-pw-sub { font-size: 11.5px; color: #7f8a9c; max-width: 130px; text-align: center;
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

  .qc-pw-field { margin-top: 12px; }
  .qc-pw-lab { font-size: 11px; color: #7f8a9c; margin-bottom: 5px; }
  .qc-pw-sel {
    width: 100%; padding: 7px 9px; border-radius: 8px;
    background: #1a1d25; border: 1px solid rgba(255,255,255,.11);
    color: #e6e8eb; font: inherit; font-size: 12.5px; outline: none;
  }
  .qc-pw-sel:focus { border-color: rgba(79,140,255,.6); }

  .qc-pw-chips { display: flex; align-items: center; gap: 5px; margin-top: 12px; }
  .qc-pw-chip {
    flex: 1 1 0; padding: 5px 0; border-radius: 7px; cursor: pointer;
    font: inherit; font-size: 12px; color: #cfd6e2;
    background: rgba(255,255,255,.05); border: 1px solid rgba(255,255,255,.1);
  }
  .qc-pw-chip:hover { background: rgba(79,140,255,.22); border-color: rgba(79,140,255,.5); color: #fff; }
  .qc-pw-chip.on { background: rgba(79,140,255,.28); border-color: rgba(120,165,255,.65); color: #fff; }
  .qc-pw-num {
    width: 48px; flex: 0 0 auto; padding: 5px 4px; text-align: center;
    border-radius: 7px; background: #1a1d25;
    border: 1px solid rgba(255,255,255,.12);
    color: #e8ecf3; font: inherit; font-size: 12px; outline: none;
  }
  .qc-pw-num:focus { border-color: rgba(79,140,255,.6); }
  .qc-pw-unit { font-size: 11px; color: #7f8a9c; flex: 0 0 auto; }

  .qc-pw-actions { display: flex; gap: 8px; margin-top: 14px; }
  .qc-pw-go {
    flex: 1 1 auto; padding: 10px 0; border-radius: 9px; border: none;
    background: linear-gradient(135deg,#3b7bff,#5b5bf0); color: #fff;
    font: inherit; font-size: 13px; font-weight: 600; cursor: pointer;
  }
  .qc-pw-go:hover { filter: brightness(1.1); }
  .qc-pw-go.stop { background: linear-gradient(135deg,#f87171,#c02a2a); }
  .qc-pw-break {
    flex: 0 0 86px; padding: 10px 0; border-radius: 9px;
    background: rgba(52,211,153,.14); color: #6ee7a8;
    border: 1px solid rgba(52,211,153,.32);
    font: inherit; font-size: 12.5px; cursor: pointer;
  }
  .qc-pw-break:hover { background: rgba(52,211,153,.24); }
  .qc-pw-break:disabled { opacity: .5; cursor: default; }

  /* ---- 任务 ---- */
  .qc-pw-add { display: flex; gap: 6px; margin-bottom: 10px; }
  .qc-pw-add input {
    flex: 1 1 auto; min-width: 0; padding: 7px 9px; border-radius: 8px;
    background: #1a1d25; border: 1px solid rgba(255,255,255,.11);
    color: #e6e8eb; font: inherit; font-size: 12.5px; outline: none;
  }
  .qc-pw-add input:focus { border-color: rgba(79,140,255,.6); }
  .qc-pw-add select {
    flex: 0 0 76px; padding: 7px 6px; border-radius: 8px;
    background: #1a1d25; border: 1px solid rgba(255,255,255,.11);
    color: #e6e8eb; font: inherit; font-size: 12px; outline: none;
  }
  .qc-pw-add button {
    flex: 0 0 42px; border-radius: 8px; cursor: pointer;
    background: rgba(79,140,255,.18); border: 1px solid rgba(79,140,255,.4);
    color: #9dc0ff; font: inherit; font-size: 12.5px;
  }
  .qc-pw-add button:hover { background: rgba(79,140,255,.3); color: #fff; }

  .qc-pw-list { list-style: none; margin: 0; padding: 0; }
  .qc-pw-item {
    display: flex; align-items: center; gap: 8px;
    padding: 8px 8px; border-radius: 8px; cursor: pointer;
    border: 1px solid transparent;
  }
  .qc-pw-item:hover { background: rgba(255,255,255,.05); }
  .qc-pw-item.on { background: rgba(79,140,255,.12); border-color: rgba(79,140,255,.35); }
  .qc-pw-dot { width: 8px; height: 8px; border-radius: 50%; flex: 0 0 auto; }
  .qc-pw-t { flex: 1 1 auto; min-width: 0; font-size: 12.5px;
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .qc-pw-em { flex: 0 0 auto; font-size: 11px; color: #7f8a9c; font-style: normal; }
  .qc-pw-del {
    flex: 0 0 auto; width: 20px; height: 20px; border: none; border-radius: 5px;
    background: transparent; color: #6f7787; cursor: pointer; font-size: 14px; line-height: 1;
  }
  .qc-pw-del:hover { background: rgba(248,113,113,.18); color: #fca5a5; }
  .qc-pw-empty {
    text-align: center; color: #6f7787; font-size: 12px; padding: 28px 10px; line-height: 1.8;
  }

  /* ---- 统计 ---- */
  .qc-pw-range { display: flex; gap: 4px; margin-bottom: 12px; }
  .qc-pw-range button {
    flex: 1 1 0; padding: 5px 0; border-radius: 7px; cursor: pointer;
    font: inherit; font-size: 12px; color: #9aa3b2;
    background: rgba(255,255,255,.04); border: 1px solid rgba(255,255,255,.09);
  }
  .qc-pw-range button.on { background: rgba(79,140,255,.24); border-color: rgba(120,165,255,.55); color: #fff; }

  .qc-pw-sum { display: flex; align-items: baseline; gap: 6px; margin-bottom: 12px; }
  .qc-pw-sum b { font-size: 26px; font-weight: 700; color: #f2f6ff; letter-spacing: -.5px; }
  .qc-pw-sum span { font-size: 12px; color: #7f8a9c; }

  .qc-pw-pie { display: flex; align-items: center; gap: 14px; }
  .qc-pw-donut {
    position: relative; width: 118px; height: 118px; flex: 0 0 auto;
    border-radius: 50%;
  }
  .qc-pw-hole {
    position: absolute; inset: 24px; border-radius: 50%;
    background: #15171e; display: flex; flex-direction: column;
    align-items: center; justify-content: center; gap: 1px;
  }
  .qc-pw-hole b { font-size: 17px; color: #f2f6ff; }
  .qc-pw-hole span { font-size: 10px; color: #7f8a9c; }
  .qc-pw-legend { list-style: none; margin: 0; padding: 0; flex: 1 1 auto; min-width: 0; }
  .qc-pw-legend li { display: flex; align-items: center; gap: 6px; padding: 3px 0; font-size: 12px; }
  .qc-pw-legend i { width: 8px; height: 8px; border-radius: 2px; flex: 0 0 auto; }
  .qc-pw-legend .n { flex: 1 1 auto; min-width: 0; color: #cfd6e2;
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .qc-pw-legend .v { flex: 0 0 auto; color: #7f8a9c; font-size: 11px; }

  .qc-pw-bars { display: flex; align-items: flex-end; gap: 6px; height: 72px; margin-top: 16px; }
  .qc-pw-bar { flex: 1 1 0; display: flex; flex-direction: column; justify-content: flex-end;
    align-items: center; gap: 4px; height: 100%; }
  .qc-pw-bar i { display: block; width: 100%; border-radius: 4px 4px 2px 2px;
    background: linear-gradient(180deg,#5b96ff,#3b6df0); min-height: 3px; }
  .qc-pw-bar em { font-size: 9.5px; color: #6f7787; font-style: normal; }
  `;

  function ensureStyle() {
    if (!S.shadow) return;
    if (S.shadow.querySelector('style[data-qc-style="pomowin"]')) return;
    const st = document.createElement('style');
    st.setAttribute('data-qc-style', 'pomowin');
    st.textContent = CSS;
    S.shadow.appendChild(st);
  }

  function open() {
    if (Q.ensureHost) Q.ensureHost();
    if (!S.shadow) return;
    if (win && win.isConnected) { refresh(); return; }
    ensureStyle();
    if (Q.closePanel) Q.closePanel();   // 一个位置只放一个窗口

    const el = document.createElement('div');
    el.className = 'qc-pw';
    el.style.cssText = 'position:fixed;right:20px;top:76px;z-index:2147483647;';
    S.shadow.appendChild(el);
    win = el;
    refresh();
    if (Q.applySavedPos) Q.applySavedPos(win, 'qcPomoPos');

    if (ticker) clearInterval(ticker);
    ticker = setInterval(() => {
      if (!win) return;
      const st = Q.pomo ? Q.pomo.state() : null;
      if (!st || tab !== 'focus') return;
      const sig = (st.running ? 'r' : 'i') + '|' + (st.isBreak ? 'b' : 'f');
      if (sig !== lastSig) { lastSig = sig; refresh(); return; }
      paintRing(st);
    }, 500);
  }

  function close() {
    if (ticker) { clearInterval(ticker); ticker = null; }
    if (win) { win.remove(); win = null; }
  }

  function toggle() {
    if (win && win.isConnected) close();
    else open();
  }

  /* 只更新环和时间，不重建 DOM（否则输入框会掉焦点） */
  function paintRing(st) {
    if (!win) return;
    const time = win.querySelector('.qc-pw-time');
    const fg = win.querySelector('.qc-pw-ring .fg');
    const ring = win.querySelector('.qc-pw-ring');
    if (!time || !fg || !ring) return;

    fg.style.strokeDashoffset = String(RING_C * (1 - (st.ratio == null ? 1 : st.ratio)));
    ring.classList.toggle('break', !!st.isBreak && st.running);
    ring.classList.toggle('done', !!st.done);

    if (st.done) time.textContent = '时间到';
    else if (st.running) time.textContent = st.left;
    else {
      const v = Number(win.dataset.mins || 25);
      time.textContent = String(v).padStart(2, '0') + ':00';
    }
  }

  function taskOptions(selected) {
    const tasks = Q.pomo ? Q.pomo.tasks() : [];
    let html = `<option value=""${!selected ? ' selected' : ''}>未分类</option>`;
    tasks.forEach((t) => {
      const c = Q.pomo.catOf(t.catId);
      html += `<option value="${esc(t.id)}"${t.id === selected ? ' selected' : ''}>${esc(c.name)} · ${esc(t.title)}</option>`;
    });
    return html;
  }

  function focusHTML() {
    const pomo = Q.pomo || {};
    const st = pomo.state ? pomo.state() : { running: false, ratio: 1 };
    const cur = pomo.curTask ? pomo.curTask() : '';
    const mins = Number(S.pomoCustom) || 25;
    const running = st.running;
    const taskName = st.task ? st.task.title : '未分类';

    const ringCls = 'qc-pw-ring' + (running && st.isBreak ? ' break' : '') + (st.done ? ' done' : '');
    const ringVal = running ? st.left : String(mins).padStart(2, '0') + ':00';
    const sub = st.done ? '休息一下' : running ? taskName : '准备开始';

    return `
      <div class="${ringCls}">
        <svg viewBox="0 0 132 132">
          <circle class="bg" cx="66" cy="66" r="${RING_R}"></circle>
          <circle class="fg" cx="66" cy="66" r="${RING_R}"
            stroke-dasharray="${RING_C.toFixed(2)}"
            stroke-dashoffset="${(RING_C * (1 - (st.ratio == null ? 1 : st.ratio))).toFixed(2)}"></circle>
        </svg>
        <div class="qc-pw-mid">
          <b class="qc-pw-time">${esc(ringVal)}</b>
          <span class="qc-pw-sub">${esc(sub)}</span>
        </div>
      </div>

      <div class="qc-pw-field">
        <div class="qc-pw-lab">这一轮做哪件事</div>
        <select class="qc-pw-sel" data-role="task" ${running ? 'disabled' : ''}>
          ${taskOptions(cur)}
        </select>
      </div>

      <div class="qc-pw-chips" data-role="chips" ${running ? 'style="display:none"' : ''}>
        ${(pomo.FOCUS_MIN || [15, 25, 45, 60])
          .map((m) => `<button class="qc-pw-chip${m === mins ? ' on' : ''}" data-mins="${m}">${m}</button>`)
          .join('')}
        <input class="qc-pw-num" data-role="mins" type="text" inputmode="numeric" maxlength="3" value="${mins}">
        <span class="qc-pw-unit">分</span>
      </div>

      <div class="qc-pw-actions">
        ${
          running
            ? `<button class="qc-pw-go stop" data-act="stop">停止${esc(st.label)}</button>`
            : `<button class="qc-pw-go" data-act="start">开始专注</button>
               <button class="qc-pw-break" data-act="break">休息</button>`
        }
      </div>
    `;
  }

  function tasksHTML() {
    const list = Q.pomo ? Q.pomo.tasks() : [];
    const cats = Q.pomo ? Q.pomo.cats() : [];
    const cur = Q.pomo ? Q.pomo.curTask() : '';

    const opts = cats.map((c) => `<option value="${esc(c.id)}">${esc(c.name)}</option>`).join('');
    const add = `
      <div class="qc-pw-add">
        <input data-role="task-title" type="text" maxlength="40" placeholder="加个任务，回车添加">
        <select data-role="task-cat">${opts}</select>
        <button data-act="add-task">加</button>
      </div>`;

    if (!list.length) {
      return add + `<div class="qc-pw-empty">还没有任务。<br>加一个，然后开番茄时就能记到它头上。</div>`;
    }

    const items = list
      .map((t) => {
        const c = Q.pomo.catOf(t.catId);
        return `<li class="qc-pw-item${t.id === cur ? ' on' : ''}" data-task="${esc(t.id)}">
          <i class="qc-pw-dot" style="background:${esc(c.color)}"></i>
          <span class="qc-pw-t">${esc(t.title)}</span>
          <em class="qc-pw-em">${t.done || 0} 番茄</em>
          <button class="qc-pw-del" data-del="${esc(t.id)}" title="删除">×</button>
        </li>`;
      })
      .join('');

    return add + `<ul class="qc-pw-list">${items}</ul>`;
  }

  function statsHTML() {
    const st = Q.pomo ? Q.pomo.stats(range) : { total: 0, count: 0, byCat: {}, byDay: [] };
    const cats = Q.pomo ? Q.pomo.cats() : [];

    const segs = cats
      .map((c) => ({ cat: c, minutes: st.byCat[c.id] || 0 }))
      .filter((x) => x.minutes > 0)
      .sort((a, b) => b.minutes - a.minutes);

    let acc = 0;
    const stops = segs.map((s) => {
      const from = (acc / st.total) * 100;
      acc += s.minutes;
      const to = (acc / st.total) * 100;
      return `${s.cat.color} ${from.toFixed(2)}% ${to.toFixed(2)}%`;
    });
    const bg = st.total ? `conic-gradient(${stops.join(',')})` : 'conic-gradient(#252a35 0 100%)';

    const legend = segs.length
      ? `<ul class="qc-pw-legend">${segs
          .map(
            (s) =>
              `<li><i style="background:${esc(s.cat.color)}"></i>` +
              `<span class="n">${esc(s.cat.name)}</span>` +
              `<span class="v">${s.minutes} 分 · ${Math.round((s.minutes / st.total) * 100)}%</span></li>`
          )
          .join('')}</ul>`
      : `<ul class="qc-pw-legend"><li><span class="n" style="color:#6f7787">这个时间段还没有记录</span></li></ul>`;

    const maxDay = Math.max(1, ...st.byDay.map((d) => d.minutes));
    const WD = ['日', '一', '二', '三', '四', '五', '六'];
    const bars = st.byDay
      .map((d) => {
        const h = d.minutes ? Math.max(6, Math.round((d.minutes / maxDay) * 56)) : 3;
        return `<div class="qc-pw-bar" title="${d.minutes} 分钟">
          <i style="height:${h}px;${d.minutes ? '' : 'background:rgba(255,255,255,.09)'}"></i>
          <em>${WD[d.date.getDay()]}</em>
        </div>`;
      })
      .join('');

    return `
      <div class="qc-pw-range">
        <button data-range="today" class="${range === 'today' ? 'on' : ''}">今日</button>
        <button data-range="week" class="${range === 'week' ? 'on' : ''}">本周</button>
        <button data-range="month" class="${range === 'month' ? 'on' : ''}">本月</button>
      </div>

      <div class="qc-pw-sum"><b>${st.total}</b><span>分钟 · ${st.count} 个番茄</span></div>

      <div class="qc-pw-pie">
        <div class="qc-pw-donut" style="background:${bg}">
          <div class="qc-pw-hole"><b>${st.count}</b><span>番茄</span></div>
        </div>
        ${legend}
      </div>

      <div class="qc-pw-bars">${bars}</div>
    `;
  }

  function refresh() {
    if (!win) return;
    const st = Q.pomo ? Q.pomo.state() : { running: false };
    lastSig = (st.running ? 'r' : 'i') + '|' + (st.isBreak ? 'b' : 'f');

    const body = tab === 'focus' ? focusHTML() : tab === 'tasks' ? tasksHTML() : statsHTML();
    win.innerHTML = `
      <div class="qc-pw-hd">
        <b>番茄钟</b>
        <span class="sub">${tab === 'focus' ? '专注一件事' : tab === 'tasks' ? '任务清单' : '时间花在哪'}</span>
        <button class="qc-pw-x" data-act="close" title="关闭">×</button>
      </div>
      <div class="qc-pw-tabs">
        <button class="qc-pw-tab${tab === 'focus' ? ' on' : ''}" data-tab="focus">专注</button>
        <button class="qc-pw-tab${tab === 'tasks' ? ' on' : ''}" data-tab="tasks">任务</button>
        <button class="qc-pw-tab${tab === 'stats' ? ' on' : ''}" data-tab="stats">统计</button>
      </div>
      <div class="qc-pw-body">${body}</div>
    `;

    const mins = Number(S.pomoCustom) || 25;
    win.dataset.mins = String(mins);
    bind();

    if (Q.makeDraggable) {
      const hd = win.querySelector('.qc-pw-hd');
      if (hd) Q.makeDraggable(win, hd, 'qcPomoPos');
    }
  }

  function setMins(v) {
    const n = Math.max(1, Math.min(180, Math.round(Number(v)) || 25));
    S.pomoCustom = n;
    try { chrome.storage.sync.set({ pomoCustom: n }); } catch (e) {}
    win.dataset.mins = String(n);
    const time = win.querySelector('.qc-pw-time');
    if (time && !(Q.pomo && Q.pomo.state().running)) time.textContent = String(n).padStart(2, '0') + ':00';
    win.querySelectorAll('[data-mins]').forEach((b) => {
      b.classList.toggle('on', Number(b.getAttribute('data-mins')) === n);
    });
    return n;
  }

  function bind() {
    const el = win;
    if (!el) return;

    el.querySelectorAll('[data-tab]').forEach((b) => {
      b.addEventListener('click', () => {
        tab = b.getAttribute('data-tab');
        refresh();
      });
    });

    const closeBtn = el.querySelector('[data-act="close"]');
    if (closeBtn) closeBtn.addEventListener('click', close);

    el.querySelectorAll('[data-range]').forEach((b) => {
      b.addEventListener('click', () => {
        range = b.getAttribute('data-range');
        refresh();
      });
    });

    el.querySelectorAll('[data-mins]').forEach((b) => {
      b.addEventListener('click', () => {
        const n = setMins(b.getAttribute('data-mins'));
        const inp = el.querySelector('[data-role="mins"]');
        if (inp) inp.value = String(n);
      });
    });

    const numInp = el.querySelector('[data-role="mins"]');
    if (numInp) {
      numInp.addEventListener('input', () => {
        numInp.value = numInp.value.replace(/[^\d]/g, '').slice(0, 3);
      });
      numInp.addEventListener('change', () => {
        setMins(numInp.value);
        numInp.value = String(S.pomoCustom);
      });
    }

    const sel = el.querySelector('[data-role="task"]');
    if (sel) {
      sel.addEventListener('change', () => {
        Q.pomo.setTask(sel.value);
      });
    }

    el.querySelectorAll('[data-act="start"], [data-act="break"], [data-act="stop"]').forEach((b) => {
      b.addEventListener('click', () => {
        const act = b.getAttribute('data-act');
        if (act === 'stop') {
          Q.pomo.stop();
          refresh();
          return;
        }
        const inp = el.querySelector('[data-role="mins"]');
        const mins = Math.max(1, Math.min(180, Number(inp ? inp.value : S.pomoCustom) || 25));
        S.pomoCustom = mins;
        try { chrome.storage.sync.set({ pomoCustom: mins }); } catch (e) {}
        const selTask = el.querySelector('[data-role="task"]');
        const taskId = act === 'break' ? '' : (selTask ? selTask.value : '');
        Q.pomo.start(mins, act === 'break', taskId);
        refresh();
      });
    });

    const addBtn = el.querySelector('[data-act="add-task"]');
    const titleInp = el.querySelector('[data-role="task-title"]');
    const catSel = el.querySelector('[data-role="task-cat"]');

    function addTask() {
      if (!titleInp) return;
      const v = titleInp.value.trim();
      if (!v) return;
      Q.pomo.addTask(v, catSel ? catSel.value : '');
      titleInp.value = '';
      refresh();
      const again = win.querySelector('[data-role="task-title"]');
      if (again) again.focus();
    }

    if (addBtn) addBtn.addEventListener('click', addTask);
    if (titleInp) {
      titleInp.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          addTask();
        }
      });
    }

    el.querySelectorAll('[data-task]').forEach((li) => {
      li.addEventListener('click', (e) => {
        if (e.target && e.target.closest && e.target.closest('[data-del]')) return;
        Q.pomo.setTask(li.getAttribute('data-task'));
        tab = 'focus';
        refresh();
      });
    });

    el.querySelectorAll('[data-del]').forEach((b) => {
      b.addEventListener('click', (e) => {
        e.stopPropagation();
        Q.pomo.delTask(b.getAttribute('data-del'));
        refresh();
      });
    });
  }

  Q.pomoWin = {
    open,
    close,
    toggle,
    refresh,
    tick: () => {
      if (!win) return;
      paintRing(Q.pomo.state());
    },
    isOpen: () => !!(win && win.isConnected),
    setTab: (t) => { tab = t; if (win) refresh(); }
  };
})();
