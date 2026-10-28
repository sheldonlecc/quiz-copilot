/* ============================================================
 * 答题助手 QuizCopilot — 小机器人说话
 * 文件：content/82-chat.js
 * 说明：闲着的时候偶尔冒一句：问候、用法提示、随口问一句。
 *       只在它真的闲着（待机、没表情、气泡空着）时才说，
 *       说话频率可在设置页调（关 / 少 / 正常）。
 * ============================================================ */
(() => {
  const Q = (window.__QC = window.__QC || {});
  const S = Q.S;

  const LAST_KEY = 'qcChatCount';
  const GAP = { 1: 150000, 2: 70000 };   // 少 / 正常 两档的基础间隔
  const COOLDOWN = 20 * 60 * 1000;       // 同一句 20 分钟内不重复

  const GREET = {
    morning: ['早上好，今天几门？', '早，先来一题热热身？'],
    noon: ['中午了，别边吃边做题', '下午还有课吗？'],
    afternoon: ['下午容易困，要不要开个番茄？', '这个点适合啃硬骨头'],
    evening: ['晚上好，今天进度怎么样？', '晚上效率高，但也别熬太晚'],
    late: ['这个点了还在写？', '夜深了，做完这页就睡吧']
  };

  const TIP = [
    '右键我可以换皮肤、开番茄钟',
    '选中一段话，我会滚过去给你解释',
    '连做模式在右键菜单里，最后一页我不替你交卷',
    '做题点我一下就行，不用先开面板',
    '番茄钟可以绑任务，统计里能看到时间花在哪',
    '嫌我烦的话，设置里能把话痨关掉',
    '把我拖到顺手的位置，下次还在那儿',
    '题目在 iframe 里我读不到，得单独开一页'
  ];

  const ASK = [
    '今天这科难吗？',
    '要不要先定个 25 分钟？',
    '做了这么久，喝口水吧',
    '你更喜欢我安静点，还是多说两句？',
    '这页题多吗？'
  ];

  const IDLE = [
    '我在这儿，需要就叫我',
    '这页字有点多…',
    '歇会儿眼睛吧',
    '有不会的可以选中问我'
  ];

  let nextAt = 0;
  let lastBucket = '';
  let lastSpoken = {};   // 台词 -> 时间戳
  let count = 0;
  let timer = null;

  function level() {
    const v = Number(S.chatLevel);
    return v === 0 || v === 1 || v === 2 ? v : 2;
  }

  function bucketOf(h) {
    if (h < 6) return 'late';
    if (h < 12) return 'morning';
    if (h < 14) return 'noon';
    if (h < 18) return 'afternoon';
    if (h < 23) return 'evening';
    return 'late';
  }

  function pick(list) {
    if (!list || !list.length) return '';
    const now = Date.now();
    const fresh = list.filter((t) => !lastSpoken[t] || now - lastSpoken[t] > COOLDOWN);
    const pool = fresh.length ? fresh : list;
    const text = pool[Math.floor(Math.random() * pool.length)];
    lastSpoken[text] = now;
    return text;
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
    nextAt = Date.now() + base + Math.random() * base * 0.6;
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
      const g = pick(GREET[b] || GREET.afternoon);
      if (g) {
        speak(g, 5200);
        schedule();
        return;
      }
    }

    const roll = Math.random();
    let line = '';
    if (count < 3) line = pick(TIP);
    else if (roll < 0.38) line = pick(TIP);
    else if (roll < 0.72) line = pick(ASK);
    else line = pick(IDLE);

    speak(line, 5200);
    schedule();
  }

  function init() {
    if (timer) clearInterval(timer);
    // 打开页面先安静一会儿，别一进来就说话
    nextAt = Date.now() + 20000 + Math.random() * 20000;
    timer = setInterval(tick, 12000);
    try {
      chrome.storage.local.get({ [LAST_KEY]: 0 }, (v) => { count = Number(v[LAST_KEY]) || 0; });
    } catch (e) {}
  }

  Q.chat = {
    init,
    tick,
    level,
    lines: { GREET, TIP, ASK, IDLE }
  };
})();
