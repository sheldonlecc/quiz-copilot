/* ============================================================
 * 答题助手 QuizCopilot — background service worker
 * 职责：保管配置、代理 AI 接口调用（绕开页面 CORS）、转发快捷键
 * ============================================================ */

const DEFAULTS = {
  baseUrl: 'https://api.deepseek.com/v1',
  apiKey: '',
  model: 'deepseek-chat',
  autoFill: false,
  showFab: true,
  temperature: 0.2
};

const SYSTEM_PROMPT = [
  '你是一个严谨的答题助手。用户会给你从网页上抓取的题目（可能带有少量噪声），请逐题作答。',
  '',
  '输出要求（必须严格遵守）：',
  '1. 只输出一个 JSON 对象，不要输出 markdown 代码块，不要任何额外的说明文字。',
  '2. JSON 结构固定为：{"answers":[{"index":1,"answer":"A","reason":"简要解析"}]}',
  '3. index 与输入题号一致，不要跳号、不要重排。',
  '4. answer 的取值规则：',
  '   - 单选题：一个选项字母，如 "A"',
  '   - 多选题：多个字母连写，不带空格和标点，如 "ACD"',
  '   - 判断题：只能是 "对" 或 "错"',
  '   - 填空题：直接给出要填入横线处的文字，只写答案本身，不要带序号、不要带解释；',
  '     若一题有多个空，按 ____ 出现的先后顺序作答，几个空的答案之间用 ||| 分隔，如 "北京|||上海"。',
  '     （填空题的 answer 里不要出现选项字母，也不要写"答案是"之类的字样）',
  '   - 匹配题：按题目里「待匹配项」的编号顺序，给出每一项对应的答案文字（必须从「可选答案」里选），',
  '     多个答案之间同样用 ||| 分隔，如 "LinkedIn|||Snapchat|||Instagram"。只写答案文字，不要写序号。',
  '     如果某一项给出的描述是图片文件名（方括号里那种，如 [linkedin]），就按文件名推断它是什么。',
  '5. 每一题都必须给出答案，不允许遗漏、不允许空字符串。实在不确定时给出最可能的答案。',
  '6. reason 用中文，控制在 80 字以内，说明判断的关键依据。',
  '7. 如果题目内容明显残缺或无法理解，answer 填 "A"，reason 写 "题干不完整，建议人工核对"。',
  '8. 计算题、数值填空题：必须先把算式在 reason 里算完，再把算式的最终结果原样写进 answer。',
  '   answer 与 reason 里最后一个「=」或「≈」后面的数值必须完全相同，不能一个写 1.00、另一个写 1.41。',
  '   题目要求保留两位小数时，answer 也保留两位（如 "1.41"）；题目没要求时，按计算结果的自然精度给出。',
  '9. 如果同一题你算了两遍得到不同结果，以最后一次完整计算的结论为准，并只把那个数写进 answer。'
].join('\n');

/* 划词解释用的提示词：不答题，只讲人话 */
const EXPLAIN_PROMPT = [
  '你是一个讲课很清楚的助教。用户会给你从网页上选中一小段文字（可能是教材、题目、代码、英文段落），请你用中文解释它。',
  '',
  '要求：',
  '1. 先用一句话说清“这段在讲什么”，再展开关键点；',
  '2. 遇到专业术语，用类比或生活化的例子讲明白；',
  '3. 如果这段是英文，先给中文意思，再解释难点；',
  '4. 控制在 200 字以内，不要开场客套，不要重复原文；',
  '5. 如果这段文字本身残缺、没有上下文导致无法判断，就直接说明“信息不足”，不要编造。',
  '6. 只输出解释正文，不要用 markdown 标题、不要加“解释：”前缀。'
].join('\n');

/* ---------------- 配置 ---------------- */

async function getConfig() {
  const cfg = await chrome.storage.sync.get(DEFAULTS);
  return { ...DEFAULTS, ...cfg };
}

/* ---------------- 接口调用 ---------------- */

function endpointOf(baseUrl) {
  let b = String(baseUrl || '').trim().replace(/\/+$/, '');
  if (!b) b = DEFAULTS.baseUrl;
  if (/\/chat\/completions$/i.test(b)) return b;
  return b + '/chat/completions';
}

function friendlyHttpError(status, bodyText) {
  const snippet = String(bodyText || '').slice(0, 300);
  if (status === 401 || status === 403) return `API Key 无效或没有该模型权限（${status}）。请到扩展设置里重新填写。`;
  if (status === 402) return '账户余额不足（402）。请到模型服务商后台充值。';
  if (status === 404) return `接口地址不对（404）。请检查 Base URL 是否包含 /v1，以及模型名是否存在。${snippet ? ' 服务端提示：' + snippet : ''}`;
  if (status === 429) return '请求过于频繁或超出额度（429）。等一会儿再试，或换个模型。';
  if (status >= 500) return `模型服务端出错（${status}），稍后重试。`;
  return `请求失败（${status}）：${snippet}`;
}

async function postChat(cfg, body, timeoutMs) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs || 90000);
  try {
    const res = await fetch(endpointOf(cfg.baseUrl), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + (cfg.apiKey || '').trim()
      },
      body: JSON.stringify(body),
      signal: ctrl.signal
    });
    const raw = await res.text();
    if (!res.ok) {
      const err = new Error(friendlyHttpError(res.status, raw));
      err.status = res.status;
      throw err;
    }
    let json;
    try {
      json = JSON.parse(raw);
    } catch (e) {
      throw new Error('接口返回的不是 JSON，Base URL 可能填错了。返回内容开头：' + raw.slice(0, 160));
    }
    return json;
  } finally {
    clearTimeout(timer);
  }
}

async function callChat(userText, opts = {}) {
  const cfg = await getConfig();
  if (!cfg.apiKey || !cfg.apiKey.trim()) {
    throw new Error('还没有填写 API Key。点浏览器右上角的扩展图标，填入 Key 并保存即可。');
  }

  const base = {
    model: cfg.model || DEFAULTS.model,
    temperature: typeof cfg.temperature === 'number' ? cfg.temperature : 0.2,
    messages: [
      { role: 'system', content: opts.system || SYSTEM_PROMPT },
      { role: 'user', content: userText }
    ]
  };

  let json;
  try {
    json = await postChat(cfg, { ...base, response_format: { type: 'json_object' } }, opts.timeout);
  } catch (e) {
    // 有些兼容接口不支持 response_format，去掉后重试一次
    const msg = String(e && e.message || '');
    const retryable = e.status === 400 || /response_format|json_object|unsupported|invalid.*param/i.test(msg);
    if (!retryable) throw e;
    json = await postChat(cfg, base, opts.timeout);
  }

  const content = json?.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error('模型没有返回内容。原始响应：' + JSON.stringify(json).slice(0, 300));
  }
  return { content, usage: json.usage || null, model: json.model || cfg.model };
}

/* 纯文本通道：不要求 JSON，直接拿回复（划词解释、摘要都用它） */
async function callChatPlain(userText, system, timeout) {
  const cfg = await getConfig();
  if (!cfg.apiKey || !cfg.apiKey.trim()) {
    throw new Error('还没有填写 API Key。点浏览器右上角的扩展图标，填入 Key 并保存即可。');
  }
  const json = await postChat(
    cfg,
    {
      model: cfg.model || DEFAULTS.model,
      temperature: 0.3,
      messages: [
        { role: 'system', content: system || EXPLAIN_PROMPT },
        { role: 'user', content: userText }
      ]
    },
    timeout || 60000
  );
  const content = json?.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error('模型没有返回内容。原始响应：' + JSON.stringify(json).slice(0, 300));
  }
  return { content: String(content).trim(), usage: json.usage || null };
}

/* ---------------- 答案解析 ---------------- */

function parseAnswers(content) {
  let s = String(content || '').trim();
  s = s.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();
  if (!s) throw new Error('模型返回了空内容。');

  const attempt = (str) => {
    try {
      return JSON.parse(str);
    } catch (e) {
      return undefined;
    }
  };

  let obj = attempt(s);

  if (obj === undefined) {
    // 从第一层 { 或 [ 开始截取，容忍前后夹杂说明文字
    const iObj = s.indexOf('{');
    const iArr = s.indexOf('[');
    let start = -1;
    if (iArr >= 0 && (iObj < 0 || iArr < iObj)) start = iArr;
    else if (iObj >= 0) start = iObj;

    const candidates = [];
    if (start >= 0) {
      const end = Math.max(s.lastIndexOf('}'), s.lastIndexOf(']'));
      if (end > start) candidates.push(s.slice(start, end + 1));
    }
    candidates.push(s);

    for (const c of candidates) {
      obj = attempt(c);
      if (obj === undefined) obj = attempt(c.replace(/,\s*([}\]])/g, '$1'));
      if (obj !== undefined) break;
    }
  }

  if (obj === undefined) {
    throw new Error('模型返回的内容无法解析成 JSON。原始内容开头：' + s.slice(0, 200));
  }

  let list = Array.isArray(obj) ? obj : obj.answers || obj.data || obj.result || obj.list || null;

  // 兼容 {"1":"A","2":"B"} 这种映射写法
  if (list && !Array.isArray(list) && typeof list === 'object') {
    list = Object.keys(list)
      .filter((k) => /^\d+$/.test(k))
      .map((k) => (typeof list[k] === 'object' ? { index: k, ...list[k] } : { index: k, answer: list[k] }));
  }
  if ((!list || !list.length) && obj && typeof obj === 'object' && !Array.isArray(obj)) {
    const keys = Object.keys(obj).filter((k) => /^\d+$/.test(k));
    if (keys.length) {
      list = keys.map((k) => (typeof obj[k] === 'object' ? { index: k, ...obj[k] } : { index: k, answer: obj[k] }));
    }
  }

  if (!Array.isArray(list) || !list.length) {
    throw new Error('模型返回里没有 answers 数组。原始内容开头：' + s.slice(0, 200));
  }

  return list.map((it, i) => {
    const o = typeof it === 'string' ? { answer: it } : it || {};
    const raw = o.answer ?? o.ans ?? o.value ?? o.result ?? o.fill ?? '';
    // 填空多空时模型可能返回数组，统一转成 ||| 分隔的字符串
    const answer = Array.isArray(raw)
      ? raw.map((x) => String(x).trim()).filter(Boolean).join('|||')
      : String(raw).trim();
    return {
      index: Number(o.index ?? o.id ?? o.no ?? o.question ?? i + 1) || i + 1,
      answer,
      reason: String(o.reason ?? o.explain ?? o.explanation ?? o.analysis ?? '').trim()
    };
  });
}

/* ---------------- 消息路由 ---------------- */

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg || typeof msg !== 'object') return;

  if (msg.type === 'QC_SOLVE') {
    (async () => {
      try {
        const { content, usage, model } = await callChat(msg.text, { timeout: 120000 });
        const answers = parseAnswers(content);
        sendResponse({ ok: true, answers, usage, model });
      } catch (e) {
        sendResponse({ ok: false, error: String(e && e.message || e) });
      }
    })();
    return true;
  }

  if (msg.type === 'QC_OPTIONS') {
    try {
      chrome.runtime.openOptionsPage();
      sendResponse({ ok: true });
    } catch (e) {
      sendResponse({ ok: false, error: String(e) });
    }
    return true;
  }

  if (msg.type === 'QC_EXPLAIN') {
    (async () => {
      try {
        const r = await callChatPlain(msg.text, msg.system, 60000);
        sendResponse({ ok: true, text: r.content, usage: r.usage });
      } catch (e) {
        sendResponse({ ok: false, error: String(e && e.message || e) });
      }
    })();
    return true;
  }

  if (msg.type === 'QC_TEST') {
    (async () => {
      try {
        const r = await callChat('第1题【单选】\n1+1 等于几？\nA. 1\nB. 2\nC. 3\nD. 4', { timeout: 45000 });
        const answers = parseAnswers(r.content);
        sendResponse({ ok: true, answers, model: r.model });
      } catch (e) {
        sendResponse({ ok: false, error: String(e && e.message || e) });
      }
    })();
    return true;
  }

  if (msg.type === 'QC_OPEN_PANEL') {
    const tabId = msg.tabId || sender?.tab?.id;
    if (tabId) {
      chrome.tabs.sendMessage(tabId, { type: 'QC_TOGGLE_PANEL' }).catch(() => {});
    }
  }
});

/* 快捷键：Alt+Q 开合面板；Alt+Shift+Q 一键解题 */
chrome.commands.onCommand.addListener(async (command) => {
  const map = {
    'toggle-panel': 'QC_TOGGLE_PANEL',
    'one-key-solve': 'QC_ONEKEY'
  };
  const type = map[command];
  if (!type) return;

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return;
  try {
    await chrome.tabs.sendMessage(tab.id, { type });
  } catch (e) {
    // 页面里没有 content script（比如 edge:// 内部页面），静默忽略
  }
});

/* 首次安装：打开说明页 */
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    chrome.tabs.create({ url: chrome.runtime.getURL('popup.html') }).catch(() => {});
  }
});
