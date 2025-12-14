// uploadHandler.js
document.addEventListener('DOMContentLoaded', () => {
  const fileInput = document.getElementById('fileInput');
  const uploadBtn = document.getElementById('uploadDatasetBtn');
  const uploadInfo = document.getElementById('upload-info');

  window.forwardIndex = window.forwardIndex || [];
  window.invertedIndex = window.invertedIndex || {};
  window.lexicon = window.lexicon || {};
  const appKeySet = new Set(window.forwardIndex.map(g => (g.appid || g.name || '').toString().toLowerCase()));

  const STOP_WORDS = new Set([
    "a","an","the","and","or","but","is","of","in","to","for","with","on","at","by","from",
    "up","down","out","about","into","as","then","now","it","its","are","was","were","be",
    "been","that","this","must","can","will","i","my"
  ]);

  function simpleCSVSplit(line){ return line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/); }
  function parseHeaders(line){ return simpleCSVSplit(line.replace(/^\uFEFF/, '').trim()).map(h => h.toLowerCase().trim().replace(/['"]+/g,'')); }
  function ensureInvertedSet(barrel, term){ if(!window.invertedIndex[barrel]) window.invertedIndex[barrel]={}; const cur = window.invertedIndex[barrel][term]; if(cur instanceof Set) return cur; if(Array.isArray(cur)){ const s=new Set(cur.map(x=>String(x))); window.invertedIndex[barrel][term]=s; return s; } const s=new Set(); window.invertedIndex[barrel][term]=s; return s; }
  function barrelForTerm(term){ if(!term || term.length===0) return '_'; const c = term[0]; return (c >= 'a' && c <= 'z') ? c : '_'; }

  function indexDocAndAdd(doc) {
    const rawAppid = (doc.appid || '').toString().trim();
    const name = (doc.name || '').toString().trim();
    if (!rawAppid && !name) return false;
    const key = rawAppid || name.toLowerCase();
    if (appKeySet.has(key)) return false;
    const docId = window.forwardIndex.length;
    doc.docId = docId;
    window.forwardIndex.push(doc);
    appKeySet.add(key);

    const combined = ((name || '') + ' ' + (doc.shortDescription || '')).toLowerCase().replace(/-/g,' ').replace(/[^\w\s]/g,' ');
    const words = combined.split(/\s+/).filter(w => w && !STOP_WORDS.has(w));
    for (const w of words) {
      window.lexicon[w] = true;
      const barrel = barrelForTerm(w);
      const s = ensureInvertedSet(barrel, w);
      s.add(String(docId));
    }
    return true;
  }

  async function processCSVText(text, fileName, chunkSize = 2000) {
    const lines = text.split(/\r?\n/);
    let headerIndex = 0;
    while (headerIndex < lines.length && lines[headerIndex].trim() === '') headerIndex++;
    if (headerIndex >= lines.length) return { added: 0, totalRows: 0 };

    const headers = parseHeaders(lines[headerIndex]);
    const required = ["appid","name","short_description","header_image","metacritic_score","recommendations_total","is_free"];
    const colMap = {};
    for (const col of required) {
      const idx = headers.indexOf(col);
      if (idx === -1) throw new Error(`Missing required column "${col}" in ${fileName}`);
      colMap[col] = idx;
    }

    let added = 0;
    const totalRows = lines.length - headerIndex - 1;
    for (let i = headerIndex + 1; i < lines.length; i += chunkSize) {
      const slice = lines.slice(i, Math.min(i + chunkSize, lines.length));
      for (const row of slice) {
        if (!row || row.trim() === '') continue;
        const parts = simpleCSVSplit(row);
        if (!parts || parts.length === 0) continue;
        const doc = {
          appid: (parts[colMap.appid] || '').trim().replace(/['"]+/g,''),
          name: (parts[colMap.name] || '').trim().replace(/['"]+/g,''),
          shortDescription: (parts[colMap.short_description] || '').trim().replace(/['"]+/g,''),
          headerImage: (parts[colMap.header_image] || '').trim().replace(/['"]+/g,''),
          metacriticScore: parseInt((parts[colMap.metacritic_score] || '').trim(), 10) || 0,
          recommendationsTotal: parseInt((parts[colMap.recommendations_total] || '').trim(), 10) || 0,
          isFree: ((parts[colMap.is_free] || '').trim().toLowerCase() === 'true')
        };
        if (indexDocAndAdd(doc)) added++;
      }
      uploadInfo.textContent = `Processing ${fileName}: ${Math.min(i - headerIndex + slice.length, totalRows)}/${totalRows} rows`;
      await new Promise(r => setTimeout(r, 8));
    }
    return { added, totalRows };
  }

  async function processJSONText(text, fileName, chunkSize = 2000) {
    let data;
    try { data = JSON.parse(text); } catch (e) { throw new Error(`Invalid JSON in ${fileName}`); }
    if (!Array.isArray(data)) throw new Error(`Expected array in JSON file ${fileName}`);
    let added = 0;
    for (let i = 0; i < data.length; i += chunkSize) {
      const slice = data.slice(i, i + chunkSize);
      for (const item of slice) {
        const doc = {
          appid: (item.appid || item.appId || item.id || '').toString().trim(),
          name: (item.name || '').toString().trim(),
          shortDescription: (item.short_description || item.shortDescription || item.description || '').toString().trim(),
          headerImage: (item.header_image || item.headerImage || '').toString().trim(),
          metacriticScore: parseInt(item.metacritic_score || item.metacriticScore || 0, 10) || 0,
          recommendationsTotal: parseInt(item.recommendations_total || item.recommendationsTotal || 0, 10) || 0,
          isFree: String(item.is_free || item.isFree || '').toLowerCase() === 'true'
        };
        if (indexDocAndAdd(doc)) added++;
      }
      uploadInfo.textContent = `Processing ${fileName}: ${Math.min(i + slice.length, data.length)}/${data.length} records`;
      await new Promise(r => setTimeout(r, 8));
    }
    return { added, totalRows: data.length };
  }

  async function processFiles(files) {
    if (!files || files.length === 0) {
      uploadInfo.textContent = 'No file selected';
      return;
    }

    let totalFiles = files.length;
    let filesDone = 0;
    let totalAdded = 0;

    for (const f of Array.from(files)) {
      uploadInfo.textContent = `Processing file ${filesDone + 1}/${totalFiles}: ${f.name} ...`;
      let text;
      try { text = await f.text(); } catch (e) { console.error('Read error', f.name, e); uploadInfo.textContent = `Failed to read ${f.name}`; filesDone++; continue; }

      const trimmed = text.trim();
      try {
        let res;
        if (trimmed.startsWith('[') || trimmed.startsWith('{')) res = await processJSONText(text, f.name);
        else res = await processCSVText(text, f.name);
        totalAdded += res.added || 0;
      } catch (procErr) {
        console.error('Processing error', f.name, procErr);
        uploadInfo.textContent = `Error processing ${f.name}: ${procErr.message}`;
      }

      filesDone++;
      uploadInfo.textContent = `Processed ${filesDone}/${totalFiles} files - total added: ${totalAdded}`;
      await new Promise(r => setTimeout(r, 8));
    }

    uploadInfo.textContent = `✓ Done! ${filesDone}/${totalFiles} files processed, ${totalAdded} new records added.`;
    if (typeof window.setActivePage === 'function') window.setActivePage('home');
    else {
      document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
      const home = document.getElementById('page-home'); if(home) home.classList.add('active');
      document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
      const btn = document.querySelector('.nav-btn[data-page="home"]'); if(btn) btn.classList.add('active');
    }
    document.dispatchEvent(new Event('datasetUploaded'));
  }

  // --- START: Auto-load predefined indexes from Drive ---
  async function loadPredefinedIndexes() {
    const urls = {
      lexicon: 'https://drive.google.com/uc?export=download&id=18WorxEFHAF_wc1Pd-ea1dO4q-zZX2sr_',
      forwardIndex: 'https://drive.google.com/uc?export=download&id=1t2ApDLX_6iX7aGxfNYnkc0PEPQKqP59t',
      invertedIndex: 'https://drive.google.com/uc?export=download&id=1KRjWkeD9FVHpcdpmu9sz4jRNDGwAloW-'
    };

    try {
      // load lexicon
      const lexRes = await fetch(urls.lexicon);
      const lexJson = await lexRes.json();
      window.lexicon = lexJson;

      // load inverted index
      const invRes = await fetch(urls.invertedIndex);
      const invJson = await invRes.json();
      window.invertedIndex = invJson;

      // load forward index
      const fwdRes = await fetch(urls.forwardIndex);
      const fwdJson = await fwdRes.json();
      window.forwardIndex = fwdJson.map((doc, idx) => ({ ...doc, docId: idx }));
      
      // rebuild appKeySet
      for (const g of window.forwardIndex) appKeySet.add((g.appid || g.name || '').toString().toLowerCase());

      // trigger dataset uploaded event so home renders
      document.dispatchEvent(new Event('datasetUploaded'));
    } catch(e) {
      console.error('Error loading predefined indexes', e);
      uploadInfo.textContent = 'Failed to load predefined dataset.';
    }
  }

  loadPredefinedIndexes();
  // --- END: Auto-load predefined indexes ---

  fileInput.addEventListener('change', (e) => {
    const files = e.target.files;
    uploadInfo.textContent = (!files || files.length === 0) ? 'No file selected' : (files.length === 1 ? `Selected: ${files[0].name}` : `Selected ${files.length} files`);
  });

  uploadBtn.addEventListener('click', (ev) => {
    ev.preventDefault();
    const files = fileInput.files;
    if (!files || files.length === 0) {
      uploadInfo.textContent = 'Please select at least one file first!';
      alert('Please select at least one file first!');
      return;
    }
    processFiles(files).catch(err => {
      console.error('Fatal upload error', err);
      uploadInfo.textContent = 'Upload failed. See console for details.';
    });
  });
});
