// uploadHandler.js
// Robust barrel (chunked) uploader with duplicate checking and accurate progress.
// Works with CSV (quoted) and JSON (array of objects).

//Runs the whole script only after the webpage fully loads
document.addEventListener('DOMContentLoaded', () => {
  
  //Getting references to HTML elements.
  const fileInput = document.getElementById('fileInput');
  const uploadBtn = document.getElementById('uploadDatasetBtn');
  const uploadInfo = document.getElementById('upload-info');

  // Global structures (kept on window so download handler can access them)
  window.forwardIndex = window.forwardIndex || [];
  window.invertedIndex = window.invertedIndex || {}; // barrel -> term -> Set(docId)
  window.lexicon = window.lexicon || {};
  const appKeySet = new Set(); // prevents duplicates across uploads (appid or name key)

  const STOP_WORDS = new Set([
    "a","an","the","and","or","but","is","of","in","to","for","with","on","at","by","from",
    "up","down","out","about","into","as","then","now","it","its","are","was","were","be",
    "been","that","this","must","can","will","i","my"
  ]);

  // safe CSV split that respects quotes (same regex used in your default)
  function simpleCSVSplit(line) {
    return line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);
  }

  // remove BOM and trim header fields
  function parseHeaders(rawHeaderLine) {
    const line = rawHeaderLine.replace(/^\uFEFF/, '').trim();
    return simpleCSVSplit(line).map(h => (h || '').toLowerCase().trim().replace(/['"]+/g,''));
  }

  // ensure invertedIndex[barrel][term] is a Set
  function ensureInvertedSet(barrel, term) {
    if (!window.invertedIndex[barrel] || typeof window.invertedIndex[barrel] !== 'object') {
      window.invertedIndex[barrel] = {};
    }
    const cur = window.invertedIndex[barrel][term];
    if (cur instanceof Set) return cur;
    if (Array.isArray(cur)) {
      const s = new Set(cur.map(x => String(x)));
      window.invertedIndex[barrel][term] = s;
      return s;
    }
    if (cur && typeof cur === 'object') {
      try {
        const vals = Object.values(cur).map(v => String(v));
        const s = new Set(vals);
        window.invertedIndex[barrel][term] = s;
        return s;
      } catch (e) { /* fallthrough */ }
    }
    const s = new Set();
    window.invertedIndex[barrel][term] = s;
    return s;
  }

  function barrelForTerm(term) {
    if (!term || term.length === 0) return '_';
    const c = term[0];
    return (c >= 'a' && c <= 'z') ? c : '_';
  }

  // Index one doc - returns true if added, false if skipped (invalid/duplicate)
  function indexDocAndAdd(doc) {
    // validate minimal fields
    const rawAppid = (doc.appid || '').toString().trim();
    const name = (doc.name || '').toString().trim();

    if (!rawAppid && !name) return false; // skip totally empty

    // key: prefer appid, fallback to normalized name
    const key = rawAppid || name.toLowerCase();
    if (appKeySet.has(key)) return false; // duplicate

    // create docId
    const docId = window.forwardIndex.length;
    doc.docId = docId;

    // store forward index
    window.forwardIndex.push(doc);
    appKeySet.add(key);

    // lexicon + inverted index (split words)
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

  // Process CSV text in chunked manner and return count added
  async function processCSVText(text, fileName, chunkSize = 1000) {
    // normalize line endings and split (support CRLF and LF)
    const lines = text.split(/\r?\n/);
    // skip initial empty lines
    let headerIndex = 0;
    while (headerIndex < lines.length && lines[headerIndex].trim() === '') headerIndex++;
    if (headerIndex >= lines.length) return {added: 0, totalRows: 0};

    const headers = parseHeaders(lines[headerIndex]);
    const required = ["appid","name","short_description","header_image","metacritic_score","recommendations_total","is_free"];
    const colMap = {};
    for (const col of required) {
      const idx = headers.indexOf(col);
      if (idx === -1) {
        throw new Error(`Missing required column "${col}" in ${fileName}`);
      }
      colMap[col] = idx;
    }

    let added = 0;
    const totalRows = lines.length - headerIndex - 1;

    for (let i = headerIndex + 1; i < lines.length; i += chunkSize) {
      const slice = lines.slice(i, Math.min(i + chunkSize, lines.length));
      for (const row of slice) {
        if (!row || row.trim() === '') continue; // ignore blank lines
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

      // update UI after each chunk
      uploadInfo.textContent = `Processing ${fileName}: ${Math.min(i + chunkSize - headerIndex, totalRows)}/${totalRows} rows`;
      // yield to UI so it stays responsive
      await new Promise(r => setTimeout(r, 5));
    }

    return {added, totalRows};
  }

  // Process JSON text in chunks
  async function processJSONText(text, fileName, chunkSize = 1000) {
    let data;
    try { data = JSON.parse(text); } catch (e) { throw new Error(`Invalid JSON in ${fileName}`); }
    if (!Array.isArray(data)) throw new Error(`Expected array in JSON file ${fileName}`);

    let added = 0;
    const totalRows = data.length;

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

      uploadInfo.textContent = `Processing ${fileName}: ${Math.min(i + chunkSize, totalRows)}/${totalRows} records`;
      await new Promise(r => setTimeout(r, 5));
    }

    return {added, totalRows};
  }

  // main loop for processing multiple files
  async function processFiles(files) {
    if (!files || files.length === 0) {
      uploadInfo.textContent = 'No file selected';
      return;
    }

    // keep existing data if user wants append behavior
    // if you want to reset on each upload, uncomment next three lines:
    // window.forwardIndex = [];
    // window.invertedIndex = {};
    // window.lexicon = {};

    let totalFiles = files.length;
    let filesDone = 0;
    let totalAdded = 0;
    let totalRowsOverall = 0;

    for (const f of Array.from(files)) {
      uploadInfo.textContent = `Processing file ${filesDone + 1}/${totalFiles}: ${f.name} ...`;
      let text;
      try { text = await f.text(); } catch (e) { console.error('Read error', f.name, e); uploadInfo.textContent = `Failed to read ${f.name}`; filesDone++; continue; }

      // choose format and process with appropriate function
      const trimmed = text.trim();
      try {
        let res;
        if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
          res = await processJSONText(text, f.name);
        } else {
          res = await processCSVText(text, f.name);
        }
        totalAdded += res.added || 0;
        totalRowsOverall += res.totalRows || 0;
      } catch (procErr) {
        console.error('Processing error', f.name, procErr);
        uploadInfo.textContent = `Error processing ${f.name}: ${procErr.message}`;
        // continue to next file
      }

      filesDone++;
      uploadInfo.textContent = `Processed ${filesDone}/${totalFiles} files - total added: ${totalAdded}`;
      await new Promise(r => setTimeout(r, 5));
    }

    uploadInfo.textContent = `✓ Done! ${filesDone}/${totalFiles} files processed, ${totalAdded} new records added.`;
    console.log('ForwardIndex:', window.forwardIndex.length, 'Lexicon:', Object.keys(window.lexicon).length, 'Inverted barrels:', Object.keys(window.invertedIndex).length);
  }

  // UI bindings
  fileInput.addEventListener('change', (e) => {
    const files = e.target.files;
    if (!files || files.length === 0) {
      uploadInfo.textContent = 'No file selected';
      return;
    }
    uploadInfo.textContent = (files.length === 1) ? `Selected: ${files[0].name}` : `Selected ${files.length} files`;
  });

  uploadBtn.addEventListener('click', (ev) => {
    ev.preventDefault();
    processFiles(fileInput.files).catch(err => {
      console.error('Fatal upload error', err);
      uploadInfo.textContent = 'Upload failed. See console for details.';
    });
  });
});
