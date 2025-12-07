
// downloadHandler.js
document.addEventListener('DOMContentLoaded', () => {
  const downloadLex = document.getElementById('downloadLex');
  const downloadForward = document.getElementById('downloadForward');
  const downloadInverted = document.getElementById('downloadInverted');

  function toSerializable(obj) {
    // Convert Sets inside invertedIndex to arrays for JSON
    if (!obj) return obj;
    if (Array.isArray(obj)) return obj;
    if (obj instanceof Set) return Array.from(obj);
    if (typeof obj === 'object') {
      const out = {};
      for (const k of Object.keys(obj)) {
        const v = obj[k];
        if (v instanceof Set) out[k] = Array.from(v);
        else if (typeof v === 'object') out[k] = toSerializable(v);
        else out[k] = v;
      }
      return out;
    }
    return obj;
  }

  function downloadJSON(filename, data) {
    if (!data) return alert('No data to download');
    const serial = toSerializable(data);
    const blob = new Blob([JSON.stringify(serial, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(a.href);
  }

  downloadLex?.addEventListener('click', () => {
    if (!window.lexicon || Object.keys(window.lexicon).length === 0) return alert('No lexicon generated yet. Upload a file first.');
    downloadJSON('lexicon.json', window.lexicon);
  });

  downloadForward?.addEventListener('click', () => {
    if (!window.forwardIndex || window.forwardIndex.length === 0) return alert('No forward index yet. Upload a file first.');
    downloadJSON('forwardIndex.json', window.forwardIndex);
  });

  downloadInverted?.addEventListener('click', () => {
    if (!window.invertedIndex || Object.keys(window.invertedIndex).length === 0) return alert('No inverted index yet. Upload a file first.');
    downloadJSON('invertedIndex.json', window.invertedIndex);
  });
});
