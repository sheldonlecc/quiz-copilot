/* ============================================================
 * 答题助手 QuizCopilot — 番茄钟（计时 + 任务/分类/专注记录）
 * 文件：content/86-pomo.js
 * 说明：倒计时挂在机器人头顶；番茄窗（89-pomowin.js）负责界面。
 *       任务、分类、历史记录都存 storage.local，跨页面不会丢。
 * ============================================================ */
(() => {
  const Q = (window.__QC = window.__QC || {});
  const S = Q.S;

  const FOCUS_MIN = [15, 25, 45, 60];
  const BREAK_MIN = [5, 10, 15];

  const MIN_LOG_MS = 60000;      // 不足 1 分钟不计入（用户手动停掉的那一段）
  const POMO_KEY = 'qcPomo';     // 正在跑的计时存这儿，换页 / 刷新都不会丢

  const DEFAULT_CATS = [
    { id: 'study', name: '学习', color: '#4f8cff' },
    { id: 'work', name: '工作', color: '#34d399' },
    { id: 'read', name: '阅读', color: '#fbbf24' },
    { id: 'other', name: '其他', color: '#a78bfa' }
  ];

  let timer = null;
  let doneUntil = 0;
  let doneBreak = false;
  let said5 = false;
  let said1 = false;

  const data = { cats: DEFAULT_CATS.slice(), tasks: [], sessions: [] };
  let curTask = '';
  let loaded = false;

  const DAY = 86400000;

  /* ---------- 存储 ---------- */
  function persist() {
    try {
      chrome.storage.local.set({
        qcCats: data.cats,
        qcTasks: data.tasks,
        qcSessions: data.sessions.slice(-2000)
      });
    } catch (e) {}
  }

  function load(cb) {
    try {
      chrome.storage.local.get({ qcCats: null, qcTasks: [], qcSessions: [] }, (v) => {
        data.cats = Array.isArray(v.qcCats) && v.qcCats.length ? v.qcCats : DEFAULT_CATS.slice();
        data.tasks = Array.isArray(v.qcTasks) ? v.qcTasks : [];
        data.sessions = Array.isArray(v.qcSessions) ? v.qcSessions : [];
        loaded = true;
        if (cb) cb();
      });
    } catch (e) {
      loaded = true;
      if (cb) cb();
    }
  }

  function catOf(id) {
    return data.cats.find((c) => c.id === id) || data.cats[data.cats.length - 1] || DEFAULT_CATS[3];
  }

  function taskOf(id) {
    return data.tasks.find((t) => t.id === id) || null;
  }

  function addTask(title, catId) {
    const t = String(title || '').trim().slice(0, 40);
    if (!t) return null;
    const item = {
      id: 't' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
      title: t,
      catId: catId || data.cats[0].id,
      done: 0,
      createdAt: Date.now()
    };
    data.tasks.unshift(item);
    persist();
    return item;
  }

  function delTask(id) {
    const i = data.tasks.findIndex((t) => t.id === id);
    if (i < 0) return;
    data.tasks.splice(i, 1);
    if (curTask === id) curTask = '';
    persist();
  }

  function setTask(id) {
    curTask = id || '';
    return curTask;
  }

  /* ---------- 统计 ---------- */
  function startOf(range) {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    if (range === 'week') {
      const wd = (d.getDay() + 6) % 7;   // 周一算一周开始
      d.setDate(d.getDate() - wd);
    } else if (range === 'month') {
      d.setDate(1);
    }
    return d.getTime();
  }

  function stats(range) {
    const from = startOf(range || 'today');
    const list = data.sessions.filter((s) => s.start >= from);
    const total = list.reduce((a, b) => a + b.minutes, 0);
    // 中途停下的也算时长，但不该算成「一个番茄」
    const full = list.filter((s) => !s.partial);
    const byCat = {};
    list.forEach((s) => {
      byCat[s.catId] = (byCat[s.catId] || 0) + s.minutes;
    });

    const byDay = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const t0 = d.getTime();
      const t1 = t0 + DAY;
      const minutes = data.sessions
        .filter((s) => s.start >= t0 && s.start < t1)
        .reduce((a, b) => a + b.minutes, 0);
      byDay.push({ date: d, minutes });
    }

    return {
      total,
      count: full.length,          // 完整走完的番茄数
      partial: list.length - full.length,   // 中途停下的段数
      segments: list.length,
      byCat,
      byDay,
      list
    };
  }

  /* ---------- 计时 ---------- */
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
        ratio: p.total ? left / p.total : 0,
        total: p.total,
        task: p.taskId ? taskOf(p.taskId) : null
      };
    }

    if (doneUntil && now < doneUntil) {
      return {
        running: false,
        done: true,
        left: '时间到',
        label: doneBreak ? '休息' : '专注',
        isBreak: doneBreak,
        ratio: 0
      };
    }

    return { running: false, done: false, left: '', label: '专注', ratio: 1 };
  }

  function badge() {
    const el = Q.mascot && Q.mascot.getEl && Q.mascot.getEl();
    return el ? el.querySelector('.qc-pomo') : null;
  }

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
      if (Q.pomoWin) Q.pomoWin.tick();
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
    if (Q.pomoWin) Q.pomoWin.tick();
  }

  /* 台词统一从 81-lines 取 */
  const PL = (name, fb) => (Q.lines && Q.lines.pick ? Q.lines.pick(name, fb) : (fb || ''));

  function botSay(text, ms, clickable) {
    if (Q.mascot) Q.mascot.say(text, ms, clickable);
  }

  function start(min, isBreak, taskId) {
    const mins = Math.max(1, Math.min(180, Math.round(Number(min) || 25)));
    if (taskId !== undefined) curTask = taskId || '';
    stop(true);
    doneUntil = 0;
    S.pomo = {
      end: Date.now() + mins * 60000,
      total: mins * 60000,
      isBreak: !!isBreak,
      taskId: isBreak ? '' : curTask,
      startedAt: Date.now()
    };
    said5 = false;
    said1 = false;
    saveTimer();
    paint();
    if (Q.pomoWin) Q.pomoWin.refresh();
    botSay(`${PL(isBreak ? 'pomoBreak' : 'pomoStart', isBreak ? '休息一下' : '开始专注')} · ${mins} 分钟`, 2600, false);
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
    const p = S.pomo;
    const had = !!(p && p.end);
    // 手动停止也要把已经专注的那段时间记上（不足 1 分钟由 logSession 自己跳过）
    if (had) {
      logSession(p, true);
      clearTimer();
    }
    S.pomo = null;
    doneUntil = 0;
    paint();
    if (Q.pomoWin) Q.pomoWin.refresh();
    if (had && !quiet) botSay(PL('pomoStop', '倒计时结束'), 1800, false);
  }

  /* 计时状态落盘：整页跳转会把 content script 整个销毁，光靠内存里的 S.pomo 会连人带账一起没 */
  function saveTimer() {
    try {
      if (!S.pomo || !S.pomo.end) {
        chrome.storage.local.remove(POMO_KEY);
        return;
      }
      chrome.storage.local.set({ [POMO_KEY]: { ...S.pomo } });
    } catch (e) {}
  }

  function clearTimer() {
    try { chrome.storage.local.remove(POMO_KEY); } catch (e) {}
  }

  /* 记一段专注。endedEarly=true 表示用户中途点停止（也算时长，但不算一个番茄） */
  function logSession(p, endedEarly) {
    if (!p || p.isBreak) return;

    const total = Number(p.total) || 0;
    const startedAt = Number(p.startedAt) || (Date.now() - total);
    // 以「真正经过了多久」为准，不是计划时长
    const elapsed = Math.max(0, Math.min(total, Date.now() - startedAt));
    if (elapsed < MIN_LOG_MS) return;   // 不满 1 分钟就不记

    const id = 'p' + startedAt;
    // 多标签页、跨页恢复都可能重复触发，同一个 startedAt 只记一次
    if (data.sessions.some((s) => s.id === id)) return;

    const minutes = Math.max(1, Math.round(elapsed / 60000));

    data.sessions.push({
      id,
      taskId: p.taskId || '',
      catId: p.taskId ? (taskOf(p.taskId) || {}).catId || 'other' : 'other',
      start: startedAt,
      minutes,
      partial: !!endedEarly,
      planned: Math.round(total / 60000)
    });
    data.sessions = data.sessions.slice(-2000);

    // 只有完整走完的才算一个番茄，5 分钟的残段不该顶掉一个
    if (!endedEarly) {
      const t = p.taskId ? taskOf(p.taskId) : null;
      if (t) t.done = (t.done || 0) + 1;
    }

    persist();
    if (Q.pomoWin) Q.pomoWin.refresh();
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
      logSession(p, false);   // 走完了：算一个完整番茄
      clearTimer();
      S.pomo = null;
      if (timer) { clearInterval(timer); timer = null; }

      doneBreak = wasBreak;
      doneUntil = Date.now() + 6000;
      paint();
      if (Q.pomoWin) Q.pomoWin.refresh();

      if (Q.mascot) {
        Q.mascot.hop();
        Q.mascot.setMood('happy', 4200);
      }
      botSay(PL(wasBreak ? 'pomoBreakDone' : 'pomoDone', wasBreak ? '休息结束，继续吧' : '时间到，起来走走'), 0, false);
      setTimeout(() => {
        if (Q.mascot) Q.mascot.say('', 0, false);
      }, 14000);
      setTimeout(() => {
        if (doneUntil && Date.now() >= doneUntil) {
          doneUntil = 0;
          paint();
          if (Q.pomoWin) Q.pomoWin.refresh();
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

  /* 换页 / 刷新后把计时接上；如果离开期间已经走完，补一笔账再收摊 */
  function restoreTimer() {
    if (S.pomo && S.pomo.end) return;   // 同一页里重复 init，别覆盖正在跑的
    try {
      chrome.storage.local.get({ [POMO_KEY]: null }, (v) => {
        const p = v && v[POMO_KEY];
        if (!p || !p.end || !p.startedAt) return;
        const now = Date.now();

        if (p.end > now) {
          S.pomo = p;
          said5 = false;
          said1 = false;
          if (timer) clearInterval(timer);
          timer = setInterval(tick, 1000);
          paint();
          if (Q.pomoWin) Q.pomoWin.refresh();
          return;
        }

        // 页面上不在了，但时间确实过去了：按走完算
        logSession(p, false);
        clearTimer();
        // 刚结束不久才提示「时间到」，隔了很久回来就别诈尸了
        if (now - p.end < 120000) {
          doneBreak = !!p.isBreak;
          doneUntil = now + 6000;
          paint();
          if (Q.pomoWin) Q.pomoWin.refresh();
          if (!p.isBreak) botSay(PL('pomoDone', '那段专注结束了'), 0, false);
          setTimeout(() => {
            if (doneUntil && Date.now() >= doneUntil) {
              doneUntil = 0;
              paint();
              if (Q.pomoWin) Q.pomoWin.refresh();
            }
          }, 6200);
        }
      });
    } catch (e) {}
  }

  function init() {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
    paint();
    load(() => {
      restoreTimer();
      if (Q.pomoWin && Q.pomoWin.isOpen && Q.pomoWin.isOpen()) Q.pomoWin.refresh();
    });
  }

  Q.pomo = {
    start,
    stop,
    state,
    fmt,
    paint,
    init,
    repaint: paint,
    load,
    cats: () => data.cats,
    catOf,
    tasks: () => data.tasks,
    taskOf,
    addTask,
    delTask,
    setTask,
    curTask: () => curTask,
    stats,
    isLoaded: () => loaded,
    sessions: () => data.sessions,
    restoreTimer,
    saveTimer,
    MIN_LOG_MS,
    FOCUS_MIN,
    BREAK_MIN,
    isOn: () => !!(S.pomo && S.pomo.end)
  };
})();
