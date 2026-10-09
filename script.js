let viewMode = 'split';
let currentOps = null;
let currentLeft = null;
let currentRight = null;

function pretty(obj) {
  return JSON.stringify(obj, null, 2);
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function diffLines(leftLines, rightLines) {
  const n = leftLines.length;
  const m = rightLines.length;
  const dp = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));

  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      if (leftLines[i] === rightLines[j]) {
        dp[i][j] = dp[i + 1][j + 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i + 1][j], dp[i][j + 1]);
      }
    }
  }

  const ops = [];
  let i = 0;
  let j = 0;
  let leftNo = 1;
  let rightNo = 1;

  while (i < n && j < m) {
    if (leftLines[i] === rightLines[j]) {
      ops.push({
        type: 'equal',
        left: leftLines[i],
        right: rightLines[j],
        leftNo: leftNo++,
        rightNo: rightNo++
      });
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      ops.push({
        type: 'remove',
        left: leftLines[i],
        leftNo: leftNo++
      });
      i++;
    } else {
      ops.push({
        type: 'add',
        right: rightLines[j],
        rightNo: rightNo++
      });
      j++;
    }
  }

  while (i < n) {
    ops.push({
      type: 'remove',
      left: leftLines[i],
      leftNo: leftNo++
    });
    i++;
  }

  while (j < m) {
    ops.push({
      type: 'add',
      right: rightLines[j],
      rightNo: rightNo++
    });
    j++;
  }

  return ops;
}

function countChanges(ops) {
  let added = 0;
  let removed = 0;
  for (const op of ops) {
    if (op.type === 'add') added++;
    else if (op.type === 'remove') removed++;
  }
  return { added, removed };
}

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function buildChangedObject(left, right) {
  if (Object.is(left, right)) return undefined;

  if (isPlainObject(left) && isPlainObject(right)) {
    const out = {};
    let hasChange = false;
    const keys = new Set([...Object.keys(left), ...Object.keys(right)]);
    for (const key of keys) {
      if (!(key in right)) {
        out[key] = null;
        hasChange = true;
      } else if (!(key in left)) {
        out[key] = right[key];
        hasChange = true;
      } else {
        const child = buildChangedObject(left[key], right[key]);
        if (child !== undefined) {
          out[key] = child;
          hasChange = true;
        }
      }
    }
    return hasChange ? out : undefined;
  }

  if (Array.isArray(left) && Array.isArray(right)) {
    if (JSON.stringify(left) === JSON.stringify(right)) return undefined;
    return right;
  }

  return right;
}

function buildExportPayload(left, right) {
  const changed = buildChangedObject(left, right);
  return changed === undefined ? {} : changed;
}

function getExportJsonText() {
  if (currentLeft === null || currentRight === null) return null;
  return JSON.stringify(buildExportPayload(currentLeft, currentRight), null, 2);
}

function downloadExportJson() {
  const text = getExportJsonText();
  if (text == null) return;
  const blob = new Blob([text], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'diff-export.json';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function copyTextFallback(text) {
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.setAttribute('readonly', '');
  ta.style.position = 'fixed';
  ta.style.left = '-9999px';
  document.body.appendChild(ta);
  ta.select();
  try {
    document.execCommand('copy');
  } finally {
    ta.remove();
  }
}

async function copyExportJson(btn) {
  const text = getExportJsonText();
  if (text == null) return;
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
    } else {
      copyTextFallback(text);
    }
  } catch (e) {
    copyTextFallback(text);
  }
  if (btn) {
    const original = btn.textContent;
    btn.textContent = 'Copied!';
    btn.disabled = true;
    setTimeout(() => {
      btn.textContent = original;
      btn.disabled = false;
    }, 1500);
  }
}

function buildSplitRows(ops) {
  const rows = [];
  let i = 0;
  while (i < ops.length) {
    const op = ops[i];
    if (op.type === 'equal') {
      rows.push({
        left: { kind: 'equal', text: op.left, no: op.leftNo },
        right: { kind: 'equal', text: op.right, no: op.rightNo }
      });
      i++;
      continue;
    }

    const removes = [];
    const adds = [];
    while (i < ops.length && (ops[i].type === 'remove' || ops[i].type === 'add')) {
      if (ops[i].type === 'remove') removes.push(ops[i]);
      else adds.push(ops[i]);
      i++;
    }

    const len = Math.max(removes.length, adds.length);
    for (let k = 0; k < len; k++) {
      const rem = removes[k];
      const add = adds[k];
      rows.push({
        left: rem
          ? { kind: 'remove', text: rem.left, no: rem.leftNo }
          : { kind: 'empty', text: '', no: '' },
        right: add
          ? { kind: 'add', text: add.right, no: add.rightNo }
          : { kind: 'empty', text: '', no: '' }
      });
    }
  }
  return rows;
}

function renderHeader(added, removed) {
  return `
    <div class="diff-header">
      <div class="diff-header-left">
        <span class="diff-filename">comparison.json</span>
        <span class="diff-stats">
          <span class="diff-stat-add">+${added}</span>
          <span class="diff-stat-remove">−${removed}</span>
        </span>
      </div>
      <div class="diff-header-actions">
        <div class="diff-export-actions">
          <button type="button" class="diff-export-btn" data-export="copy">Copy JSON</button>
          <button type="button" class="diff-export-btn" data-export="download">Download JSON</button>
        </div>
        <div class="diff-view-toggle" role="group" aria-label="Diff view">
          <button type="button" class="diff-toggle-btn${viewMode === 'unified' ? ' active' : ''}" data-view="unified">Unified</button>
          <button type="button" class="diff-toggle-btn${viewMode === 'split' ? ' active' : ''}" data-view="split">Split</button>
        </div>
      </div>
    </div>
  `;
}

function renderUnified(ops) {
  const lines = ops.map(op => {
    if (op.type === 'equal') {
      return `<tr class="diff-line diff-line-equal">
        <td class="diff-gutter diff-gutter-old">${op.leftNo}</td>
        <td class="diff-gutter diff-gutter-new">${op.rightNo}</td>
        <td class="diff-sign"> </td>
        <td class="diff-code-cell"><span class="diff-code">${escapeHtml(op.left)}</span></td>
      </tr>`;
    }
    if (op.type === 'remove') {
      return `<tr class="diff-line diff-line-remove">
        <td class="diff-gutter diff-gutter-old">${op.leftNo}</td>
        <td class="diff-gutter diff-gutter-new"></td>
        <td class="diff-sign">-</td>
        <td class="diff-code-cell"><span class="diff-code">${escapeHtml(op.left)}</span></td>
      </tr>`;
    }
    return `<tr class="diff-line diff-line-add">
      <td class="diff-gutter diff-gutter-old"></td>
      <td class="diff-gutter diff-gutter-new">${op.rightNo}</td>
      <td class="diff-sign">+</td>
      <td class="diff-code-cell"><span class="diff-code">${escapeHtml(op.right)}</span></td>
    </tr>`;
  }).join('');

  return `<div class="diff-body diff-unified"><table class="diff-table"><tbody>${lines}</tbody></table></div>`;
}

function renderSplitCell(side, which) {
  const kind = side.kind;
  const sign = kind === 'remove' ? '-' : kind === 'add' ? '+' : kind === 'equal' ? ' ' : '';
  const no = side.no === '' || side.no == null ? '' : side.no;
  const text = side.text || '';
  const prefix = which === 'left' ? 'diff-split-left' : 'diff-split-right';
  return `
    <td class="${prefix}-gutter diff-side-${kind}">${no}</td>
    <td class="${prefix}-sign diff-side-${kind}">${sign}</td>
    <td class="${prefix}-code diff-side-${kind}"><span class="diff-code">${escapeHtml(text)}</span></td>
  `;
}

function renderSplit(ops) {
  const rows = buildSplitRows(ops);
  const lines = rows.map(row => {
    return `<tr class="diff-split-row">${renderSplitCell(row.left, 'left')}${renderSplitCell(row.right, 'right')}</tr>`;
  }).join('');

  return `<div class="diff-body diff-split">
    <table class="diff-split-table">
      <colgroup>
        <col class="diff-col-gutter">
        <col class="diff-col-sign">
        <col class="diff-col-code">
        <col class="diff-col-gutter">
        <col class="diff-col-sign">
        <col class="diff-col-code">
      </colgroup>
      <tbody>${lines}</tbody>
    </table>
  </div>`;
}

function renderDiff(ops) {
  if (!ops || ops.length === 0) {
    return '<span class="no-diff">No differences found!</span>';
  }

  const { added, removed } = countChanges(ops);
  if (added === 0 && removed === 0) {
    return '<span class="no-diff">No differences found!</span>';
  }

  const body = viewMode === 'unified' ? renderUnified(ops) : renderSplit(ops);
  return `<div class="diff-view">${renderHeader(added, removed)}${body}</div>`;
}

function paintResult() {
  const resultBox = document.getElementById('result');
  if (currentOps === null) {
    return;
  }
  resultBox.innerHTML = renderDiff(currentOps);
}

window.addEventListener('DOMContentLoaded', function() {
  const saved1 = localStorage.getItem('json1');
  const saved2 = localStorage.getItem('json2');
  if (saved1 !== null) document.getElementById('json1').value = saved1;
  if (saved2 !== null) document.getElementById('json2').value = saved2;
});

['json1', 'json2'].forEach(id => {
  document.getElementById(id).addEventListener('input', function(e) {
    localStorage.setItem(id, e.target.value);
  });
});

document.getElementById('result').addEventListener('click', function(e) {
  if (!currentOps) return;

  const exportBtn = e.target.closest('.diff-export-btn');
  if (exportBtn) {
    const action = exportBtn.getAttribute('data-export');
    if (action === 'copy') {
      copyExportJson(exportBtn);
    } else if (action === 'download') {
      downloadExportJson();
    }
    return;
  }

  const btn = e.target.closest('.diff-toggle-btn');
  if (!btn) return;
  const next = btn.getAttribute('data-view');
  if (next !== 'unified' && next !== 'split') return;
  if (next === viewMode) return;
  viewMode = next;
  paintResult();
});

document.getElementById('compareBtn').addEventListener('click', function() {
  const json1Text = document.getElementById('json1').value;
  const json2Text = document.getElementById('json2').value;
  localStorage.setItem('json1', json1Text);
  localStorage.setItem('json2', json2Text);
  let obj1, obj2;
  const resultBox = document.getElementById('result');
  try {
    obj1 = JSON.parse(json1Text);
  } catch (e) {
    currentOps = null;
    currentLeft = null;
    currentRight = null;
    resultBox.innerHTML = '<span class="diff-error">First input is not valid JSON.</span>';
    return;
  }
  try {
    obj2 = JSON.parse(json2Text);
  } catch (e) {
    currentOps = null;
    currentLeft = null;
    currentRight = null;
    resultBox.innerHTML = '<span class="diff-error">Second input is not valid JSON.</span>';
    return;
  }

  const leftLines = pretty(obj1).split('\n');
  const rightLines = pretty(obj2).split('\n');
  currentLeft = obj1;
  currentRight = obj2;
  currentOps = diffLines(leftLines, rightLines);
  paintResult();
});

const clearBtn = document.getElementById('clearBtn');
if (clearBtn) {
  clearBtn.addEventListener('click', function() {
    document.getElementById('json1').value = '';
    document.getElementById('json2').value = '';
    localStorage.removeItem('json1');
    localStorage.removeItem('json2');
    currentOps = null;
    currentLeft = null;
    currentRight = null;
    document.getElementById('result').innerHTML = '';
  });
}
