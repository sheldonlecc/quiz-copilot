/* ============================================================
 * 答题助手 QuizCopilot — 小机器人说话（调度）
 * 文件：content/82-chat.js
 * 说明：决定「什么时候说、说哪一类」。台词本身在 81-lines.js。
 *       只在它真的闲着（待机、没表情、气泡空着、页面可见）时才说，
 *       说话频率可在设置页调（安静 / 少 / 正常）。
 * ============================================================ */
(() => {
  const Q = (window.__QC = window.__QC || {});
  const S = Q.S;

  const LAST_KEY = 'qcChatCount';
  const GAP = { 1: 120000, 2: 45000 };   // 少 / 正常 两档的基础间隔
  const FIRST_AT = [12000, 26000];       // 刚打开页面先安静一会儿

  const BUCKET = {
    morning: 'greetMorning',
    noon: 'greetNoon',
    afternoon: 'greetAfternoon',
    evening: 'greetEvening',
    late: 'greetLate'
  };

  let nextAt = 0;
  let lastBucket = '';
  let count = 0;
  let timer = null;

  function level() {
    const v = Number(S.chatLevel);
    return v === 0 || v === 1 || v === 2 ? v : 2;
  }

  function pick(name, fb) {
    return Q.lines && Q.lines.pick ? Q.lines.pick(name, fb) : (fb || '');
  }

  function bucketOf(h) {
    if (h < 6) return 'late';
    if (h < 12) return 'morning';
    if (h < 14) return 'noon';
    if (h < 18) return 'afternoon';
    if (h < 23) return 'evening';
    return 'late';
  }

  function bubbleFree() {
    const el = Q.mascot && Q.mascot.getEl && Q.mascot.getEl();
    if (!el) return false;
    const b = el.querySelector('.qc-bot-bubble');
    if (!b) return true;
    return b.dataset.show !== '1';
  }

  function canSpeak() {
    if (level() === 0) return false;
    if (document.visibilityState !== 'visible') return false;
    if (Q.isBusy && Q.isBusy()) return false;

    const bot = Q.mascot;
    if (!bot || bot.getState() !== 'idle') return false;
    const el = bot.getEl && bot.getEl();
    if (!el || el.dataset.mood || el.dataset.busy === '1') return false;
    if (!bubbleFree()) return false;
    return true;
  }

  function schedule() {
    const base = GAP[level()] || GAP[2];
    nextAt = Date.now() + base + Math.random() * base * 0.5;
  }

  function speak(text, ms) {
    if (!text) return;
    if (Q.mascot) Q.mascot.say(text, ms || 5200, false);
    count++;
    try { chrome.storage.local.set({ [LAST_KEY]: count }); } catch (e) {}
  }

  function tick() {
    if (!canSpeak()) return;
    if (Date.now() < nextAt) return;

    // 换了一个时段，先打个招呼
    const b = bucketOf(new Date().getHours());
    if (b !== lastBucket) {
      lastBucket = b;
      const g = pick(BUCKET[b], '');
      if (g) {
        speak(g, 5200);
        schedule();
        return;
      }
    }

    const roll = Math.random();
    let name = 'idle';
    if (count < 3) name = 'tip';
    else if (roll < 0.34) name = 'tip';
    else if (roll < 0.72) name = 'ask';
    else name = 'idle';

    speak(pick(name, '我在这儿，需要就叫我'), 5200);
    schedule();
  }

  function init() {
    if (timer) clearInterval(timer);
    // 打开页面先安静一会儿，别一进来就说话
    nextAt = Date.now() + FIRST_AT[0] + Math.random() * (FIRST_AT[1] - FIRST_AT[0]);
    timer = setInterval(tick, 9000);
    try {
      chrome.storage.local.get({ [LAST_KEY]: 0 }, (v) => { count = Number(v[LAST_KEY]) || 0; });
    } catch (e) {}
  }

  Q.chat = {
    init,
    tick,
    level,
    gap: GAP
  };
})();
