/* ============================================================
 * 答题助手 QuizCopilot — 选择题提取（radio / checkbox）
 * 文件：content/10-choice.js
 * 说明：挂在 window.__QC 上，与其它模块共享；content script 的隔离环境，页面看不到
 * ============================================================ */
(() => {
  const Q = (window.__QC = window.__QC || {});
  const { HOST_ID, LETTERS, VER, S, norm, squash, oneLine, isVisible, esc, allDocs, countFrames, commonAncestor, OPT_CTRL_SEL, nearestOptionBox, BLANK_MARK, TYPE_CN } = Q;
  function optionText(inp) {
    const label = (inp.labels && inp.labels[0]) || inp.closest('label');
    let t = '';
    if (label) t = label.innerText || label.textContent || '';
    if (!oneLine(t)) {
      const p = inp.parentElement;
      const pt = p ? p.innerText || '' : '';
      if (oneLine(pt) && oneLine(pt).length < 200) t = pt;
    }
    if (!oneLine(t)) {
      let n = inp.nextSibling;
      let guard = 0;
      while (n && guard++ < 6 && !oneLine(n.textContent)) n = n.nextSibling;
      if (n) t = n.textContent || '';
    }
    return oneLine(t);
  }

  const TRUE_RE = /^(对|正确|是|√|✓|T|True|Yes|Y)$/i;
  const FALSE_RE = /^(错|错误|否|×|✗|X|F|False|No|N)$/i;

  function detectType(list, opts) {
    const usesRadio = list[0] && list[0].type === 'radio';
    if (!usesRadio) {
      // 个别站点用 checkbox 做单选/判断，选项数很少时按判断处理
      if (opts.length === 2 && opts.every((o) => TRUE_RE.test(o.text) || FALSE_RE.test(o.text))) return 'judge';
      return 'multi';
    }
    if (opts.length === 2 && opts.every((o) => TRUE_RE.test(o.text) || FALSE_RE.test(o.text))) return 'judge';
    return 'single';
  }

  const RE_OPT_LINE = /^[\(（]?\s*[A-Ha-j]\s*[\)）\.、．:：]/;

  /* 答卷页面的模板文字，不属于题干 */
  const NOISE_LINE = new RegExp(
    '^(' +
      'question\\s*(text|\\d+)|' +
      'answer saved|not yet answered|not answered|answered|' +
      'marked out of[\\s\\d.,]*|flag question|clear my choice|' +
      'select one or more|select one|select all that apply|choose one|' +
      'next page|previous page|back|hide|submit|check|finish attempt|' +
      'time left[\\s\\d:]*|' +
      'your answer|correct answer|correct|incorrect|partially correct|' +
      '未作答|已回答|已保存|正确答案|你的答案|标记此题|清除我的选择' +
    ')[\\s:：.。,，、]*$',
    'i'
  );

  const NOISE_INLINE = /(clear my choice|answer saved|flag question|清除我的选择|标记此题)/gi;

  /* 题干过长时，头尾都要保留——真正的问句通常在最后 */
  function clampStem(s, max) {
    const t = String(s || '');
    const limit = max || 2400;
    if (t.length <= limit) return t;
    const head = t.slice(0, Math.floor(limit * 0.62));
    const tail = t.slice(-Math.floor(limit * 0.33));
    return head + '\n…（中间省略）…\n' + tail;
  }

  /* 清理候选题干：去掉选项行、模板文字、分隔线 */
  function cleanStemText(t, optSet) {
    return String(t || '')
      .split('\n')
      .map((x) => x.trim())
      .filter(Boolean)
      .filter((l) => !RE_OPT_LINE.test(l))
      .filter((l) => !NOISE_LINE.test(l))
      // 纯下划线是空位标记，必须保留；只过滤 --- *** 这类分隔线
      .filter((l) => /^_+$/.test(l) || !/^[\-—*·•\s]+$/.test(l))
      .filter((l) => !(optSet && optSet.has(l)))
      .join('\n')
      .replace(NOISE_INLINE, '')
      .replace(/[ \t]{2,}/g, ' ')
      .trim();
  }

  /* 题干提取：从选项容器逐层往上，每层都"扣掉选项区域"再清理，
     取第一个像题干的；都不像就取最长的 */
  function extractStem(root, opts, groupSize) {
    const doc = root.ownerDocument || document;
    const optBlob = squash(root.innerText || '');
    const optSet = new Set(
      (opts || []).map((o) => oneLine(o.text)).filter((x) => x && x.length >= 2)
    );
    const cands = [];
    let el = root;

    for (let depth = 0; depth < 6 && el; depth++) {
      if (el === doc.body || el === doc.documentElement) break;
      const cnt = el.querySelectorAll('input[type="radio"],input[type="checkbox"]').length;
      if (cnt > groupSize) break; // 再往上就跨到别的题了

      let t = squash(el.innerText || '');
      // el === root 时整块就是选项，不能扣（否则会把自己扣空）
      if (el !== root && optBlob) t = t.split(optBlob).join('\n');

      const joined = cleanStemText(t, optSet);
      if (joined.length >= 4) cands.push(joined);

      el = el.parentElement;
    }

    if (cands.length) {
      const good = cands.find((c) => c.length >= 12);
      return clampStem(good || cands.sort((a, b) => b.length - a.length)[0]);
    }

    // 兜底 1：看紧邻的前一个兄弟节点（常见的 .title + .options 结构）
    let sib = root.previousElementSibling;
    let guard = 0;
    while (sib && guard++ < 4) {
      const t = squash(sib.innerText || '');
      if (t.length >= 4) return clampStem(t);
      sib = sib.previousElementSibling;
    }

    // 兜底 2：从第一个选项控件本身往前走（选项没有独立包裹层、多题共享容器的情况）
    const first = opts[0] && opts[0].input;
    const anchor = first
      ? (first.labels && first.labels[0]) || first.closest('label') || first
      : null;
    let p = anchor ? anchor.previousElementSibling : null;
    let g2 = 0;
    while (p && g2++ < 6) {
      if (p.querySelector('input[type="radio"],input[type="checkbox"]')) {
        p = p.previousElementSibling;
        continue;
      }
      const t = squash(p.innerText || '');
      const head = t.split('\n')[0].trim();
      if (t.length >= 4 && !RE_OPT_LINE.test(head)) return clampStem(t);
      p = p.previousElementSibling;
    }

    return '';
  }

  /* 容器本身像不像一道题（Moodle 用 .que/.qtext/.formulation，通用站点用 .question 等） */
  function inQuestionContainer(el) {
    let p = el;
    for (let i = 0; i < 6 && p; i++) {
      const cls = typeof p.className === 'string' ? p.className : '';
      if (/(^|[\s_-])(que|question|qtext|formulation|problem|exam-item)([\s_-]|$)/i.test(cls)) return true;
      const id = p.id || '';
      if (/(question|quiz)/i.test(id)) return true;
      p = p.parentElement;
    }
    return false;
  }

  /* 闸门：这一组 checkbox/radio 到底是不是一道题。
     课程页的「完成状态」勾选框、收藏、批量选择都会被误抓成多选题，靠它拦住。 */
  function looksLikeQuizChoice(stem, opts, list) {
    const s = oneLine(stem || '');
    const filled = opts.filter((o) => o.text && o.text.trim());
    if (filled.length < 2) return false;

    const uniq = new Set(filled.map((o) => oneLine(o.text)));
    if (uniq.size < 2) return false; // 选项全都一样，肯定不是题

    // 判断题：两个选项就是「正确/错误」「对/错」
    if (
      opts.length === 2 &&
      opts.every((o) => TRUE_RE.test(oneLine(o.text)) || FALSE_RE.test(oneLine(o.text)))
    ) {
      return true;
    }

    // 选项本身带字母/序号前缀（a. / B) / ① ）
    const lettered = opts.filter((o) =>
      /^[\s(（]*[A-Ha-j1-9①-⑩][\s]*[\.、．\)）:：]/.test(o.raw || '')
    ).length;
    if (lettered >= 2) return true;

    // 题干有题号
    if (/^\s*(第\s*\d{1,3}\s*题|question\s*\d+|\d{1,3}\s*[\.、．\)）])/i.test(s)) return true;

    // 题干是问句
    if (/[?？]\s*$/.test(s)) return true;

    // 常见题干提示语
    if (/(select one|select all|choose|which of the following|true or false|单选|多选|判断|下列|以下|选出|哪一)/i.test(s)) {
      return true;
    }

    // 容器结构像题目（Moodle 的 .que / .qtext / .formulation 等）
    if (list && list[0] && inQuestionContainer(list[0])) return true;

    return false;
  }

  function extractFromInputs() {
    const inputs = [];
    for (const doc of allDocs()) {
      let list = [];
      try {
        list = doc.querySelectorAll('input[type="radio"], input[type="checkbox"]');
      } catch (e) {
        continue;
      }
      for (const i of list) {
        if (!i.closest('#' + HOST_ID)) inputs.push(i);
      }
    }
    if (inputs.length < 2) return [];

    // 第一轮：按 name 分组（标准表单，同名即同题）
    const byName = new Map();
    const weak = []; // 名字唯一或没有名字的控件，稍后按就近容器合并
    for (const inp of inputs) {
      const nm = (inp.getAttribute('name') || '').trim();
      if (!nm) {
        weak.push(inp);
        continue;
      }
      if (!byName.has(nm)) byName.set(nm, []);
      byName.get(nm).push(inp);
    }

    const groupList = [];
    for (const list of byName.values()) {
      if (list.length >= 2) groupList.push(list);
      else weak.push(list[0]);
    }

    // 第二轮：Moodle 这类系统给每个选项单独起名（q4:1_choice0/1/2...），
    // 单靠 name 会把每个选项拆成一题，这里按"就近容器"并回同一题
    if (weak.length) {
      const boxKey = new WeakMap();
      let seq = 0;
      const byBox = new Map();
      for (const inp of weak) {
        const box = nearestOptionBox(inp);
        if (!boxKey.has(box)) boxKey.set(box, ++seq);
        const k = 'b:' + boxKey.get(box);
        if (!byBox.has(k)) byBox.set(k, []);
        byBox.get(k).push(inp);
      }
      for (const list of byBox.values()) groupList.push(list);
    }

    const out = [];
    const seenStem = new Set();

    for (const list of groupList) {
      if (!list.length) continue;
      const root = commonAncestor(list) || nearestOptionBox(list[0]);
      if (!root || root === document.body || root === document.documentElement) continue;
      if (!isVisible(root)) continue;

      const opts = list.map((inp, i) => {
        const raw = optionText(inp);
        const text = raw.replace(/^[\(（]?\s*[A-Ha-j]\s*[\)）\.、．:：]\s*/, '').trim();
        return {
          letter: LETTERS[i] || String(i + 1),
          text,
          raw,
          input: inp,
          checked: !!inp.checked
        };
      });

      const stem = extractStem(root, opts, list.length);
      const allEmpty = opts.every((o) => !o.text);
      if (!stem && allEmpty) continue;
      if (stem.length < 4 && allEmpty) continue;

      // 关键闸门：不是所有 checkbox 群都是题目。
      // 课程页的「完成状态」勾选框、收藏、批量选择都会被误抓成多选题。
      if (!looksLikeQuizChoice(stem, opts, list)) continue;

      const key = oneLine(stem).slice(0, 80);
      if (key && seenStem.has(key)) continue;
      if (key) seenStem.add(key);

      out.push({
        source: 'input',
        type: detectType(list, opts),
        stem: stem || '（未识别到题干，请根据选项判断）',
        options: opts,
        root
      });
    }

    // 按页面顺序排序
    out.sort((a, b) => {
      if (!a.root || !b.root || a.root === b.root) return 0;
      if (a.root.ownerDocument !== b.root.ownerDocument) return 0; // 跨文档不比较
      const rel = a.root.compareDocumentPosition(b.root);
      if (rel & 1) return 0; // DISCONNECTED
      if (rel & 4) return -1; // FOLLOWING
      if (rel & 2) return 1; // PRECEDING
      return 0;
    });

    return out;
  }


  Object.assign(Q, { optionText, TRUE_RE, FALSE_RE, detectType, RE_OPT_LINE, NOISE_LINE, NOISE_INLINE, clampStem, cleanStemText, extractStem, inQuestionContainer, looksLikeQuizChoice, extractFromInputs });
})();
