let viewMode = 'split';
let currentOps = null;

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
      <div class="diff-view-toggle" role="group" aria-label="Diff view">
        <button type="button" class="diff-toggle-btn${viewMode === 'unified' ? ' active' : ''}" data-view="unified">Unified</button>
        <button type="button" class="diff-toggle-btn${viewMode === 'split' ? ' active' : ''}" data-view="split">Split</button>
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
        <td class="diff-code">${escapeHtml(op.left)}</td>
      </tr>`;
    }
    if (op.type === 'remove') {
      return `<tr class="diff-line diff-line-remove">
        <td class="diff-gutter diff-gutter-old">${op.leftNo}</td>
        <td class="diff-gutter diff-gutter-new"></td>
        <td class="diff-sign">-</td>
        <td class="diff-code">${escapeHtml(op.left)}</td>
      </tr>`;
    }
    return `<tr class="diff-line diff-line-add">
      <td class="diff-gutter diff-gutter-old"></td>
      <td class="diff-gutter diff-gutter-new">${op.rightNo}</td>
      <td class="diff-sign">+</td>
      <td class="diff-code">${escapeHtml(op.right)}</td>
    </tr>`;
  }).join('');

  return `<div class="diff-body diff-unified"><table class="diff-table"><tbody>${lines}</tbody></table></div>`;
}

function renderSplit(ops) {
  const rows = buildSplitRows(ops);
  const lines = rows.map(row => {
    const leftClass = `diff-side-cell diff-side-${row.left.kind}`;
    const rightClass = `diff-side-cell diff-side-${row.right.kind}`;
    const leftSign = row.left.kind === 'remove' ? '-' : row.left.kind === 'equal' ? ' ' : '';
    const rightSign = row.right.kind === 'add' ? '+' : row.right.kind === 'equal' ? ' ' : '';
    return `<tr class="diff-split-row">
      <td class="${leftClass}">
        <span class="diff-gutter">${row.left.no}</span>
        <span class="diff-sign">${leftSign}</span>
        <span class="diff-code">${escapeHtml(row.left.text)}</span>
      </td>
      <td class="${rightClass}">
        <span class="diff-gutter">${row.right.no}</span>
        <span class="diff-sign">${rightSign}</span>
        <span class="diff-code">${escapeHtml(row.right.text)}</span>
      </td>
    </tr>`;
  }).join('');

  return `<div class="diff-body diff-split"><table class="diff-split-table"><tbody>${lines}</tbody></table></div>`;
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
  const btn = e.target.closest('.diff-toggle-btn');
  if (!btn || !currentOps) return;
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
    resultBox.innerHTML = '<span class="diff-error">First input is not valid JSON.</span>';
    return;
  }
  try {
    obj2 = JSON.parse(json2Text);
  } catch (e) {
    currentOps = null;
    resultBox.innerHTML = '<span class="diff-error">Second input is not valid JSON.</span>';
    return;
  }

  const leftLines = pretty(obj1).split('\n');
  const rightLines = pretty(obj2).split('\n');
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
    document.getElementById('result').innerHTML = '';
  });
}
