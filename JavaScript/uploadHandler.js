// uploadHandler.js 

// Robust barrel (chunked) uploader with duplicate checking and accurate progress. 

// Works with CSV (quoted) and JSON (array of objects). 

document.addEventListener('DOMContentLoaded', () => { 

  const fileInput = document.getElementById('fileInput'); 

  const uploadBtn = document.getElementById('uploadDatasetBtn'); 

  const uploadInfo = document.getElementById('upload-info'); 

 

  // Global structures 

  window.forwardIndex = window.forwardIndex || []; 

  window.invertedIndex = window.invertedIndex || {}; // barrel -> term -> Set(docId) 

  window.lexicon = window.lexicon || {}; 

  const appKeySet = new Set(window.forwardIndex.map(g => g.appid || g.name?.toLowerCase())); 

 

  const STOP_WORDS = new Set([ 

    "a","an","the","and","or","but","is","of","in","to","for","with","on","at","by","from", 

    "up","down","out","about","into","as","then","now","it","its","are","was","were","be", 

    "been","that","this","must","can","will","i","my" 

  ]); 

 

  function simpleCSVSplit(line) { 

    return line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/); 

  } 

 

  function parseHeaders(rawHeaderLine) { 

    const line = rawHeaderLine.replace(/^\uFEFF/, '').trim(); 

    return simpleCSVSplit(line).map(h => (h || '').toLowerCase().trim().replace(/['"]+/g,'')); 

  } 

 

  function ensureInvertedSet(barrel, term) { 

    if (!window.invertedIndex[barrel]) window.invertedIndex[barrel] = {}; 

    if (!(window.invertedIndex[barrel][term] instanceof Set)) { 

      window.invertedIndex[barrel][term] = new Set(); 

    } 

    return window.invertedIndex[barrel][term]; 

  } 

 

  function barrelForTerm(term) { 

    if (!term || term.length === 0) return '_'; 

    const c = term[0]; 

    return (c >= 'a' && c <= 'z') ? c : '_'; 

  } 

 

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

 

  async function processCSVText(text, fileName, chunkSize = 1000) { 

    const lines = text.split(/\r?\n/).filter(l => l.trim()); 

    if (lines.length < 2) return {added:0, totalRows:0}; 

 

    const headers = parseHeaders(lines[0]); 

    const required = ["appid","name","short_description","header_image","metacritic_score","recommendations_total","is_free"]; 

    const colMap = {}; 

    for (const col of required) { 

      const idx = headers.indexOf(col); 

      if (idx === -1) throw new Error(`Missing required column "${col}" in ${fileName}`); 

      colMap[col] = idx; 

    } 

 

    let added = 0; 

    const totalRows = lines.length - 1; 

    for (let i = 1; i < lines.length; i += chunkSize) { 

      const slice = lines.slice(i, Math.min(i + chunkSize, lines.length)); 

      for (const row of slice) { 

        if (!row || row.trim() === '') continue; 

        const parts = simpleCSVSplit(row); 

        const doc = { 

          appid: (parts[colMap.appid] || '').trim().replace(/['"]+/g,''), 

          name: (parts[colMap.name] || '').trim().replace(/['"]+/g,''), 

          shortDescription: (parts[colMap.short_description] || '').trim().replace(/['"]+/g,''), 

          headerImage: (parts[colMap.header_image] || '').trim().replace(/['"]+/g,''), 

          metacriticScore: parseInt((parts[colMap.metacritic_score]||'').trim(),10)||0, 

          recommendationsTotal: parseInt((parts[colMap.recommendations_total]||'').trim(),10)||0, 

          isFree: ((parts[colMap.is_free]||'').trim().toLowerCase()==='true') 

        }; 

        if (indexDocAndAdd(doc)) added++; 

      } 

      uploadInfo.textContent = `Processing ${fileName}: ${Math.min(i+chunkSize-1, totalRows)}/${totalRows} rows`; 

      await new Promise(r => setTimeout(r, 5)); 

    } 

    return {added, totalRows}; 

  } 

 

  async function processJSONText(text, fileName, chunkSize = 1000) { 

    let data; 

    try { data = JSON.parse(text); } catch(e) { throw new Error(`Invalid JSON in ${fileName}`); } 

    if (!Array.isArray(data)) throw new Error(`Expected array in JSON file ${fileName}`); 

 

    let added = 0; 

    const totalRows = data.length; 

    for (let i=0; i<data.length; i+=chunkSize) { 

      const slice = data.slice(i,i+chunkSize); 

      for (const item of slice) { 

        const doc = { 

          appid: (item.appid || item.appId || item.id || '').toString().trim(), 

          name: (item.name || '').toString().trim(), 

          shortDescription: (item.short_description || item.shortDescription || item.description || '').toString().trim(), 

          headerImage: (item.header_image || item.headerImage || '').toString().trim(), 

          metacriticScore: parseInt(item.metacritic_score || item.metacriticScore || 0,10)||0, 

          recommendationsTotal: parseInt(item.recommendations_total || item.recommendationsTotal || 0,10)||0, 

          isFree: String(item.is_free || item.isFree || '').toLowerCase() === 'true' 

        }; 

        if (indexDocAndAdd(doc)) added++; 

      } 

      uploadInfo.textContent = `Processing ${fileName}: ${Math.min(i+chunkSize,totalRows)}/${totalRows} records`; 

      await new Promise(r => setTimeout(r,5)); 

    } 

    return {added, totalRows}; 

  } 

 

  async function processFiles(files) { 

    if (!files || files.length===0) { uploadInfo.textContent='No file selected'; return; } 

    let totalFiles = files.length; 

    let filesDone = 0; 

    let totalAdded = 0; 

 

    for (const f of Array.from(files)) { 

      uploadInfo.textContent = `Processing file ${filesDone+1}/${totalFiles}: ${f.name} ...`; 

      let text; 

      try { text = await f.text(); } catch(e) { console.error('Read error', f.name, e); uploadInfo.textContent=`Failed to read ${f.name}`; filesDone++; continue; } 

      const trimmed = text.trim(); 

      try { 

        let res; 

        if (trimmed.startsWith('[') || trimmed.startsWith('{')) res = await processJSONText(text, f.name); 

        else res = await processCSVText(text, f.name); 

        totalAdded += res.added || 0; 

      } catch(procErr) { 

        console.error('Processing error', f.name, procErr); 

        uploadInfo.textContent = `Error processing ${f.name}: ${procErr.message}`; 

      } 

      filesDone++; 

      uploadInfo.textContent = `Processed ${filesDone}/${totalFiles} files - total added: ${totalAdded}`; 

      await new Promise(r => setTimeout(r,5)); 

    } 

 

    uploadInfo.textContent = `✓ Done! ${filesDone}/${totalFiles} files processed, ${totalAdded} new records added.`; 

    console.log('ForwardIndex:', window.forwardIndex.length, 'Lexicon:', Object.keys(window.lexicon).length, 'Inverted barrels:', Object.keys(window.invertedIndex).length); 

 

    // Dispatch event **after all files are processed** 

    document.dispatchEvent(new Event('datasetUploaded')); 

  } 

 

  fileInput.addEventListener('change', e => { 

    const files = e.target.files; 

    uploadInfo.textContent = (files.length===1)?`Selected: ${files[0].name}`:`Selected ${files.length} files`; 

  }); 

 

  uploadBtn.addEventListener('click', ev => { 

    ev.preventDefault(); 

    processFiles(fileInput.files).catch(err => { 

      console.error('Fatal upload error', err); 

      uploadInfo.textContent = 'Upload failed. See console for details.'; 

    }); 

  }); 

}); 
