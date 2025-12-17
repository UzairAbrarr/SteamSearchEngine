// uploadHandler.js

//Without this, JS might run before HTML exists, only run once the document means web page loaded
document.addEventListener('DOMContentLoaded', () => {

  //get the html elements,const because we dont want to change them throughout the program
  const fileInput = document.getElementById('fileInput');
  const uploadBtn = document.getElementById('uploadDatasetBtn');
  const uploadInfo = document.getElementById('upload-info');

  //defensive coding if already exist resue otherwise create it
  //window work like global so that every file can access these things
  window.forwardIndex = window.forwardIndex || [];
  window.invertedIndex = window.invertedIndex || {};
  window.lexicon = window.lexicon || {};

  //set -> unique values only
  //we use set because o(1) lookup faster than array search
  //avoid duplication so that we dont index same game twice
  const appKeySet = new Set(window.forwardIndex.map(g => (g.appid || g.name || '').toString().toLowerCase()));

  //This is used to reduce noise and index siize
  //tokens are normalized all are in lowercase
  //cointain words that dont help in search just there for formality
  const STOP_WORDS = new Set([
    "a","an","the","and","or","but","is","of","in","to","for","with","on","at","by","from",
    "up","down","out","about","into","as","then","now","it","its","are","was","were","be",
    "been","that","this","must","can","will","i","my"
  ]);

  //split the csv using comma splitter logic but ignores the commas inside the games title or other fields
  function simpleCSVSplit(line){ return line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/); }

  //DIfferent csvs contain differ data such that we normalize it so we can search accordingly
  function parseHeaders(line){ return simpleCSVSplit(line.replace(/^\uFEFF/, '').trim()).map(h => h.toLowerCase().trim().replace(/['"]+/g,'')); }
  
  //old data might contain arrays but this ensure that all the data must map to the set
  function ensureInvertedSet(barrel, term){
    if(!window.invertedIndex[barrel]) window.invertedIndex[barrel]={}; 
    const cur = window.invertedIndex[barrel][term]; 
    if(cur instanceof Set) return cur; 
    if(Array.isArray(cur)){ 
      const s = new Set(cur.map(x=>String(x))); 
      window.invertedIndex[barrel][term] = s; 
      return s; 
    } 
    const s = new Set(); 
    window.invertedIndex[barrel][term] = s; 
    return s; 
  }

  //partitioning using first letter like a mini hash bucket type thing 
  //Hash partitioning concept, dynamic barrels
  function barrelForTerm(term){ 
    if(!term || term.length===0) return '_'; 
    const c = term[0]; 
    return (c >= 'a' && c <= 'z') ? c : '_'; 
  }

  //Indexing a document 
  function indexDocAndAdd(doc) {
    //validation means a document must have identity
    const rawAppid = (doc.appid || '').toString().trim();
    const name = (doc.name || '').toString().trim();
    if (!rawAppid && !name) return false;
    const key = rawAppid || name.toLowerCase();

    //avoid duplicaation in the data
    if (appKeySet.has(key)) return false;

    //Assigning a doc id
    const docId = window.forwardIndex.length;
    doc.docId = docId;
    window.forwardIndex.push(doc);
    appKeySet.add(key);

    //case normalizations, remove punctuations etc
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

  //uses await non blocking ui as the requirement of the program that when uploading file ui should work normally
  //use chunk size so that we can avoid freeze app (large files friendly)
  async function processCSVText(text, fileName, chunkSize = 2000) {
    const lines = text.split(/\r?\n/);//split new lines or empty lines

    //some csv's start with empty lines such that we skip them 
    let headerIndex = 0;
    while (headerIndex < lines.length && lines[headerIndex].trim() === '') headerIndex++;

    // if file is empty then stop
    if (headerIndex >= lines.length) return { added: 0, totalRows: 0 };

    //parsing headers 
    const headers = parseHeaders(lines[headerIndex]);

    //set of required coloumn that must be present in the dataset
    const required = ["appid","name","short_description","header_image","metacritic_score","recommendations_total","is_free"];
    
    //this code makes the dataset independent of order becasue many csv's may have differnet order
    const colMap = {};
    for (const col of required) {
      const idx = headers.indexOf(col);
      if (idx === -1) throw new Error(`Missing required column "${col}" in ${fileName}`);
      colMap[col] = idx;
    }

    //this works as a counter that adding how mnay rows actually
    let added = 0;
    const totalRows = lines.length - headerIndex - 1;

    //use chunk size to load at once
    for (let i = headerIndex + 1; i < lines.length; i += chunkSize) {
      const slice = lines.slice(i, Math.min(i + chunkSize, lines.length));
     //there is a chance maybe last chunk is smaller 
      for (const row of slice) {
        if (!row || row.trim() === '') continue;
        const parts = simpleCSVSplit(row);
        if (!parts || parts.length === 0) continue;

        //build document by avoind crashes normalizing the data and handle missing values
        const doc = {
          appid: (parts[colMap.appid] || '').trim().replace(/['"]+/g,''),
          name: (parts[colMap.name] || '').trim().replace(/['"]+/g,''),
          shortDescription: (parts[colMap.short_description] || '').trim().replace(/['"]+/g,''),
          headerImage: (parts[colMap.header_image] || '').trim().replace(/['"]+/g,''),
          metacriticScore: parseInt((parts[colMap.metacritic_score] || '').trim(), 10) || 0,
          recommendationsTotal: parseInt((parts[colMap.recommendations_total] || '').trim(), 10) || 0,
          isFree: ((parts[colMap.is_free] || '').trim().toLowerCase() === 'true') // because csv booleans are strings
        };
        if (indexDocAndAdd(doc)) added++;
      }
      //ui update such that user immersion doesnot break when loading the file
      uploadInfo.textContent = `Processing ${fileName}: ${Math.min(i - headerIndex + slice.length, totalRows)}/${totalRows} rows`;
      await new Promise(r => setTimeout(r, 8));
    }
    return { added, totalRows };
  }

  //same logic as csv files just one thing that headers are not there in json
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

  /*Validate files
    Loop files
    Read text
    Detect CSV or JSON
    Call correct processor
    Track totals
    Update UI
    Fire custom event*/
  async function processFiles(files) {

    //trim as json files start { or [
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
      try { text = await f.text(); } catch (e) { 
        console.error('Read error', f.name, e); 
        uploadInfo.textContent = `Failed to read ${f.name}`; 
        filesDone++; 
        continue; 
      }

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
