function diffJSON(obj1, obj2) {
  let diffs = [];
  function findDiffs(a, b, path = '') {
    if (typeof a !== typeof b) {
      diffs.push({ path, type: 'type', from: a, to: b });
      return;
    }
    if (typeof a === 'object' && a !== null && b !== null) {
      const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
      for (let key of keys) {
        findDiffs(a[key], b[key], path ? `${path}.${key}` : key);
      }
    } else if (a !== b) {
      if (a === undefined) {
        diffs.push({ path, type: 'added', from: a, to: b });
      } else if (b === undefined) {
        diffs.push({ path, type: 'removed', from: a, to: b });
      } else {
        diffs.push({ path, type: 'changed', from: a, to: b });
      }
    }
  }
  findDiffs(obj1, obj2);
  return diffs;
}

function renderDiffs(diffs) {
  if (diffs.length === 0) {
    return '<span class="no-diff">No differences found!</span>';
  }
  return diffs.map(diff => {
    let colorClass = '';
    let label = '';
    let icon = '';
    
    switch (diff.type) {
      case 'added':
        colorClass = 'diff-added';
        label = 'Added';
        break;
      case 'removed':
        colorClass = 'diff-removed';
        label = 'Removed';
        icon = diff.from === undefined ? '<span class="undefined-icon">✕</span>' : '';
        break;
      case 'changed':
        colorClass = 'diff-changed';
        label = 'Changed';
        icon = (diff.from === undefined || diff.to === undefined) ? '<span class="undefined-icon">✕</span>' : '';
        break;
      case 'type':
        colorClass = 'diff-type';
        label = 'Type Changed';
        icon = (diff.from === undefined || diff.to === undefined) ? '<span class="undefined-icon">✕</span>' : '';
        break;
    }
    return `<div class="diff-row ${colorClass}">${icon}<strong>${label}:</strong> <span class="diff-path">${diff.path}</span><br> <span class="diff-from">${JSON.stringify(diff.from)}</span> <span class="diff-arrow">→</span> <span class="diff-to">${JSON.stringify(diff.to)}</span></div>`;
  }).join('');
}

// Load from localStorage on page load
window.addEventListener('DOMContentLoaded', function() {
  const saved1 = localStorage.getItem('json1');
  const saved2 = localStorage.getItem('json2');
  if (saved1 !== null) document.getElementById('json1').value = saved1;
  if (saved2 !== null) document.getElementById('json2').value = saved2;
});

// Save to localStorage on input
['json1', 'json2'].forEach(id => {
  document.getElementById(id).addEventListener('input', function(e) {
    localStorage.setItem(id, e.target.value);
  });
});

document.getElementById('compareBtn').addEventListener('click', function() {
  const json1Text = document.getElementById('json1').value;
  const json2Text = document.getElementById('json2').value;
  // Save to localStorage on compare
  localStorage.setItem('json1', json1Text);
  localStorage.setItem('json2', json2Text);
  let obj1, obj2;
  let resultBox = document.getElementById('result');
  try {
    obj1 = JSON.parse(json1Text);
  } catch (e) {
    resultBox.innerHTML = '<span class="diff-error">First input is not valid JSON.</span>';
    return;
  }
  try {
    obj2 = JSON.parse(json2Text);
  } catch (e) {
    resultBox.innerHTML = '<span class="diff-error">Second input is not valid JSON.</span>';
    return;
  }
  const diffs = diffJSON(obj1, obj2);
  resultBox.innerHTML = renderDiffs(diffs);
});

// Clear button logic
const clearBtn = document.getElementById('clearBtn');
if (clearBtn) {
  clearBtn.addEventListener('click', function() {
    document.getElementById('json1').value = '';
    document.getElementById('json2').value = '';
    localStorage.removeItem('json1');
    localStorage.removeItem('json2');
    document.getElementById('result').innerHTML = '';
  });
}
