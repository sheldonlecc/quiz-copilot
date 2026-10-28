/* ============================================================
 * 答题助手 QuizCopilot — 番茄钟
 * 文件：content/86-pomo.js
 * 说明：挂在小机器人身上的倒计时。开始/停止都在右键菜单里，
 *       平时不占屏幕，鼠标移到它身上才报剩余时间。
 * ============================================================ */
(() => {
  const Q = (window.__QC = window.__QC || {});
  const S = Q.S;

  let timer = null;
  let hoverBound = null;
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
    if (!p || !p.end) return { running: false, left: '', label: '专注' };
    const left = p.end - Date.now();
    return {
      running: left > 0,
      left: fmt(Math.max(0, left)),
      label: p.isBreak ? '休息' : '专注',
      ms: Math.max(0, left)
    };
  }

  function botSay(text, ms, clickable) {
    if (Q.mascot) Q.mascot.say(text, ms, clickable);
  }

  function bindHover() {
    const el = Q.mascot && Q.mascot.getEl && Q.mascot.getEl();
    if (!el) return;
    unbindHover();
    hoverBound = () => {
      const st = state();
      if (!st.running) return;
      // 鼠标一靠近就报一次剩余时间，不长期占着气泡
      botSay(`${st.label} ${st.left}`, 1600, false);
    };
    el.addEventListener('mouseenter', hoverBound);
  }

  function unbindHover() {
    if (hoverBound && Q.mascot && Q.mascot.getEl) {
      const el = Q.mascot.getEl();
      if (el) el.removeEventListener('mouseenter', hoverBound);
    }
    hoverBound = null;
  }

  function start(min, isBreak) {
    stop(true);
    const mins = Math.max(1, Math.round(min || 25));
    S.pomo = { end: Date.now() + mins * 60000, total: mins * 60000, isBreak: !!isBreak };
    said5 = false;
    said1 = false;
    botSay(`${isBreak ? '休息' : '专注'} ${mins} 分钟，开始`, 2600, false);
    if (Q.mascot) Q.mascot.setMood('happy', 1200);
    bindHover();
    timer = setInterval(tick, 1000);
    return S.pomo;
  }

  function stop(quiet) {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
    unbindHover();
    const had = !!(S.pomo && S.pomo.end);
    S.pomo = null;
    if (had && !quiet) botSay('倒计时结束', 1800, false);
  }

  function tick() {
    const st = state();
    if (!st.running) {
      const wasBreak = S.pomo && S.pomo.isBreak;
      stop(true);
      if (Q.mascot) {
        Q.mascot.hop();
        Q.mascot.setMood('happy', 4200);
      }
      botSay(wasBreak ? '休息结束，继续吧' : '时间到，起来走走', 0, false);
      setTimeout(() => {
        if (Q.mascot) Q.mascot.say('', 0, false);
      }, 14000);
      return;
    }

    if (!said5 && st.ms <= 5 * 60000) {
      said5 = true;
      if (!S.pomo.isBreak) botSay('还剩 5 分钟', 2200, false);
    }
    if (!said1 && st.ms <= 60000) {
      said1 = true;
      botSay(S.pomo && S.pomo.isBreak ? '休息快结束了' : '还剩 1 分钟', 2400, false);
    }
  }

  function init() {
    // 页面重新加载后计时状态就没了，这里只负责清理残留
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
  }

  Q.pomo = { start, stop, state, fmt, init, isOn: () => !!(S.pomo && S.pomo.end) };
})();
