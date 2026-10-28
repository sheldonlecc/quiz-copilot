/* ============================================================
 * 答题助手 QuizCopilot — 番茄钟
 * 文件：content/86-pomo.js
 * 说明：倒计时挂在机器人头顶，常显，不用悬停；时长可选，开始/结束都在右键菜单里。
 * ============================================================ */
(() => {
  const Q = (window.__QC = window.__QC || {});
  const S = Q.S;

  const FOCUS_MIN = [15, 25, 45, 60];
  const BREAK_MIN = [5, 10, 15];

  let timer = null;
  let doneUntil = 0;      // 「时间到」还要显示多久
  let doneBreak = false;
  let said5 = false;
  let said1 = false;

  function fmt(ms) {
    const total = Math.max(0, Math.ceil(ms / 1000));
    const m = Math.floor(total / 60);
    const s = total % 60;
    return String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
  }

  function state() {
    const p = S.pomo;
    const now = Date.now();

    if (p && p.end && p.end > now) {
      const left = p.end - now;
      return {
        running: true,
        done: false,
        left: fmt(left),
        label: p.isBreak ? '休息' : '专注',
        isBreak: !!p.isBreak,
        ms: left,
        ratio: p.total ? left / p.total : 0
      };
    }

    if (doneUntil && now < doneUntil) {
      return { running: false, done: true, left: '时间到', label: doneBreak ? '休息' : '专注', isBreak: doneBreak };
    }

    return { running: false, done: false, left: '', label: '专注' };
  }

  function badge() {
    const el = Q.mascot && Q.mascot.getEl && Q.mascot.getEl();
    return el ? el.querySelector('.qc-pomo') : null;
  }

  /* 把当前状态画到头顶那块小牌子上 */
  function paint() {
    const tag = badge();
    if (!tag) return;
    const st = state();
    const t = tag.querySelector('.qc-pomo-t');
    const bar = tag.querySelector('.qc-pomo-bar i');

    if (st.done) {
      tag.dataset.on = '1';
      tag.dataset.mode = 'done';
      if (t) t.textContent = '时间到';
      return;
    }

    if (!st.running) {
      tag.dataset.on = '0';
      delete tag.dataset.mode;
      return;
    }

    tag.dataset.on = '1';
    tag.dataset.mode = st.isBreak ? 'break' : 'focus';
    if (t) t.textContent = st.left;
    if (bar) bar.style.width = Math.max(0, Math.min(100, st.ratio * 100)).toFixed(2) + '%';
  }

  function botSay(text, ms, clickable) {
    if (Q.mascot) Q.mascot.say(text, ms, clickable);
  }

  function start(min, isBreak) {
    const mins = Math.max(1, Math.min(180, Math.round(Number(min) || 25)));
    stop(true);
    doneUntil = 0;
    S.pomo = { end: Date.now() + mins * 60000, total: mins * 60000, isBreak: !!isBreak };
    said5 = false;
    said1 = false;
    paint();
    botSay(`${isBreak ? '休息' : '专注'} ${mins} 分钟，开始`, 2600, false);
    if (Q.mascot) Q.mascot.setMood('happy', 1200);
    if (timer) clearInterval(timer);
    timer = setInterval(tick, 1000);
    return S.pomo;
  }

  function stop(quiet) {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
    const had = !!(S.pomo && S.pomo.end);
    S.pomo = null;
    doneUntil = 0;
    paint();
    if (had && !quiet) botSay('倒计时结束', 1800, false);
  }

  function tick() {
    const p = S.pomo;
    if (!p || !p.end) {
      if (timer) { clearInterval(timer); timer = null; }
      paint();
      return;
    }

    const left = p.end - Date.now();
    if (left <= 0) {
      const wasBreak = !!p.isBreak;
      S.pomo = null;
      if (timer) { clearInterval(timer); timer = null; }

      // 停在「时间到」六秒，让人一眼看见，再淡出
      doneBreak = wasBreak;
      doneUntil = Date.now() + 6000;
      paint();

      if (Q.mascot) {
        Q.mascot.hop();
        Q.mascot.setMood('happy', 4200);
      }
      botSay(wasBreak ? '休息结束，继续吧' : '时间到，起来走走', 0, false);
      setTimeout(() => {
        if (Q.mascot) Q.mascot.say('', 0, false);
      }, 14000);
      setTimeout(() => {
        if (doneUntil && Date.now() >= doneUntil) {
          doneUntil = 0;
          paint();
        }
      }, 6200);
      return;
    }

    paint();

    if (!said5 && left <= 5 * 60000) {
      said5 = true;
      if (!p.isBreak) botSay('还剩 5 分钟', 2200, false);
    }
    if (!said1 && left <= 60000) {
      said1 = true;
      botSay(p.isBreak ? '休息快结束了' : '还剩 1 分钟', 2400, false);
    }
  }

  function init() {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
    paint();
  }

  Q.pomo = {
    start,
    stop,
    state,
    fmt,
    paint,
    init,
    repaint: paint,
    FOCUS_MIN,
    BREAK_MIN,
    isOn: () => !!(S.pomo && S.pomo.end)
  };
})();
