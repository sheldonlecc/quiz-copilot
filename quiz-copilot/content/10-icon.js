/* ============================================================
 * 答题助手 QuizCopilot — 小机器人图标（唯一入口）
 * 文件：content/10-icon.js
 * 说明：凡是需要「图标」的地方都从这里拿，不要再写字或者画别的形状。
 *
 *   Q.icon.svg(20)                  一段 inline SVG（面板标题、划词按钮…）
 *   Q.icon.svg(20, { tile: false }) 不要蓝底方块，只有机器人
 *   Q.icon.svg(20, { mood: 'happy' }) 换个表情：idle / happy / wink / sleep
 *   Q.icon.uri(32)                   data:image/svg+xml,...（给 <img src>）
 *   Q.icon.css(32)                   url("data:...")（给 background-image / mask）
 *   Q.icon.mount(el, 20)             直接塞进一个元素，替换原有内容
 *
 * 图标规格和 icons/*.png 的工具栏图标是同一套比例：蓝色圆角方块 +
 * 白色机器人脑袋（天线 + 一颗绿点），16px 也能认出来。
 * ============================================================ */
(() => {
  const Q = (window.__QC = window.__QC || {});
  let seq = 0;

  /* 和 80-mascot 的比例对齐：头 38×34、眼睛 6×9、间距 8、天线球 6 */
  function eyePair(mood) {
    const fill = '#3f6be6';
    if (mood === 'happy') {
      return '<path d="M11.5 19.7q1.4-2.4 2.8 0M17.7 19.7q1.4-2.4 2.8 0" fill="none"' +
        ' stroke="' + fill + '" stroke-width="1.5" stroke-linecap="round"/>';
    }
    if (mood === 'wink') {
      return '<rect x="11.5" y="17.1" width="2.7" height="4.1" rx="1.35" fill="' + fill + '"/>' +
        '<path d="M17.7 19.4q1.4-2.1 2.8 0" fill="none" stroke="' + fill +
        '" stroke-width="1.5" stroke-linecap="round"/>';
    }
    if (mood === 'sleep') {
      return '<path d="M11.5 19.2h2.7M17.6 19.2h2.7" stroke="' + fill +
        '" stroke-width="1.4" stroke-linecap="round"/>';
    }
    return '<rect x="11.5" y="17.1" width="2.7" height="4.1" rx="1.35" fill="' + fill + '"/>' +
      '<rect x="17.6" y="17.1" width="2.7" height="4.1" rx="1.35" fill="' + fill + '"/>';
  }

  function svg(size, opts) {
    const o = opts || {};
    const s = Math.max(8, Math.round(Number(size) || 20));
    const mood = o.mood || 'idle';
    const tile = o.tile !== false;
    const id = 'qcg' + (++seq);
    const cls = o.cls ? ' class="' + o.cls + '"' : '';

    const defs = tile
      ? '<defs><linearGradient id="' + id + '" x1="0" y1="0" x2="1" y2="1">' +
        '<stop offset="0" stop-color="#4f8cff"/><stop offset="1" stop-color="#7c5cff"/>' +
        '</linearGradient></defs>' +
        '<rect x=".5" y=".5" width="31" height="31" rx="9" fill="url(#' + id + ')"/>'
      : '';

    return '<svg' + cls + ' width="' + s + '" height="' + s + '" viewBox="0 0 32 32"' +
      ' fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">' +
      defs +
      /* 天线：一根杆 + 一颗绿点 */
      '<rect x="15.45" y="8.6" width="1.1" height="4" rx=".55" fill="#fff" opacity=".85"/>' +
      '<circle cx="16" cy="6.7" r="1.75" fill="#9df0bb"/>' +
      /* 脑袋 */
      '<rect x="7.5" y="12" width="17" height="14.2" rx="5" fill="#fff"/>' +
      /* 眼睛 */
      eyePair(mood) +
      '</svg>';
  }

  function uri(size, opts) {
    return 'data:image/svg+xml,' + encodeURIComponent(svg(size, opts));
  }

  function css(size, opts) {
    return 'url("' + uri(size, opts) + '")';
  }

  function mount(el, size, opts) {
    if (!el) return null;
    el.innerHTML = svg(size, opts);
    el.dataset.qcIcon = '1';
    return el.firstChild;
  }

  Q.icon = { svg, uri, css, mount, moods: ['idle', 'happy', 'wink', 'sleep'] };
})();
