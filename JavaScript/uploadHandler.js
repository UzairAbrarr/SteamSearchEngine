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
  function ensureInvertedSet(barrel, term){ if(!window.invertedIndex[barrel]) window.invertedIndex[barrel]={}; const cur=window.invertedIndex[barrel][term]; if(cur instanceof Set) return cur; if(Array.isArray(cur)){ const s=new Set(cur.map(x=>String(x))); window.invertedIndex[barrel][term]=s; return s; } const s=new Set(); window.invertedIndex[barrel][term]=s; return s; }
  function barrelForTerm(term){ if(!term||term.length===0) return '_'; const c=term[0].toLowerCase(); return (c>='a'&&c<='z')?c:'_'; }

  function indexDocAndAdd(doc){
    const key=(doc.appid||doc.name||'').toString().toLowerCase().trim();
    if(!key||appKeySet.has(key)) return false;
    const docId=window.forwardIndex.length;
    doc.docId=docId;
    window.forwardIndex.push(doc);
    appKeySet.add(key);

    const text=((doc.name||'')+' '+(doc.shortDescription||'')).toLowerCase().replace(/-/g,' ').replace(/[^\w\s]/g,' ');
    const words=text.split(/\s+/).filter(w=>w&&!STOP_WORDS.has(w));
    for(const w of words){
      window.lexicon[w]=true;
      ensureInvertedSet(barrelForTerm(w), w).add(String(docId));
    }
    return true;
  }

  async function processCSVText(text, fileName, chunkSize=5000){
    const lines=text.split(/\r?\n/);
    let headerIndex=0;
    while(headerIndex<lines.length&&!lines[headerIndex].trim()) headerIndex++;
    if(headerIndex>=lines.length) return {added:0,totalRows:0};

    const headers=parseHeaders(lines[headerIndex]);
    const required=["appid","name","short_description","header_image","metacritic_score","recommendations_total","is_free"];
    const colMap={};
    for(const col of required){
      const idx=headers.indexOf(col);
      if(idx===-1) throw new Error(`Missing column "${col}" in ${fileName}`);
      colMap[col]=idx;
    }

    let added=0;
    const totalRows=lines.length-headerIndex-1;
    for(let i=headerIndex+1;i<lines.length;i+=chunkSize){
      const slice=lines.slice(i,Math.min(i+chunkSize,lines.length));
      for(const row of slice){
        if(!row.trim()) continue;
        const parts=simpleCSVSplit(row);
        if(!parts.length) continue;
        const doc={
          appid:(parts[colMap.appid]||'').trim().replace(/['"]+/g,''),
          name:(parts[colMap.name]||'').trim().replace(/['"]+/g,''),
          shortDescription:(parts[colMap.short_description]||'').trim().replace(/['"]+/g,''),
          headerImage:(parts[colMap.header_image]||'').trim().replace(/['"]+/g,''),
          metacriticScore:parseInt((parts[colMap.metacritic_score]||'').trim(),10)||0,
          recommendationsTotal:parseInt((parts[colMap.recommendations_total]||'').trim(),10)||0,
          isFree:((parts[colMap.is_free]||'').trim().toLowerCase()==='true')
        };
        if(indexDocAndAdd(doc)) added++;
      }
      uploadInfo.textContent=`Processing ${fileName}: ${Math.min(i-headerIndex+slice.length,totalRows)}/${totalRows} rows`;
      await new Promise(r=>setTimeout(r,1));
    }
    return {added,totalRows};
  }

  async function processJSONText(data, fileName, chunkSize=5000){
    if(typeof data==='string'){
      try{data=JSON.parse(data);} catch(e){throw new Error(`Invalid JSON in ${fileName}`);}
    }
    if(!Array.isArray(data)) throw new Error(`Expected array in JSON file ${fileName}`);
    let added=0;
    for(let i=0;i<data.length;i+=chunkSize){
      const slice=data.slice(i,i+chunkSize);
      for(const item of slice){
        const doc={
          appid:(item.appid||item.appId||item.id||'').toString().trim(),
          name:(item.name||'').toString().trim(),
          shortDescription:(item.short_description||item.shortDescription||item.description||'').toString().trim(),
          headerImage:(item.header_image||item.headerImage||'').toString().trim(),
          metacriticScore:parseInt(item.metacritic_score||item.metacriticScore||0,10)||0,
          recommendationsTotal:parseInt(item.recommendations_total||item.recommendationsTotal||0,10)||0,
          isFree:String(item.is_free||item.isFree||'').toLowerCase()==='true'
        };
        if(indexDocAndAdd(doc)) added++;
      }
      uploadInfo.textContent=`Processing ${fileName}: ${Math.min(i+slice.length,data.length)}/${data.length} records`;
      await new Promise(r=>setTimeout(r,1));
    }
    return {added,totalRows:data.length};
  }

  async function processFile(file){
    let text;
    try{text=await file.text();} catch(e){uploadInfo.textContent=`Failed to read ${file.name}`; return {added:0};}
    const trimmed=text.trim();
    return trimmed.startsWith('[')||trimmed.startsWith('{') ? processJSONText(trimmed,file.name) : processCSVText(trimmed,file.name);
  }

  async function processFiles(files){
    if(!files||files.length===0){uploadInfo.textContent='No file selected'; return;}
    let totalAdded=0;
    for(let i=0;i<files.length;i++){
      uploadInfo.textContent=`Processing file ${i+1}/${files.length}: ${files[i].name} ...`;
      try{
        const res=await processFile(files[i]);
        totalAdded+=res.added||0;
      } catch(e){
        console.error(e);
        uploadInfo.textContent=`Error processing ${files[i].name}: ${e.message}`;
      }
    }
    uploadInfo.textContent=`✓ Done! ${files.length} files processed, ${totalAdded} new records added.`;
    document.dispatchEvent(new Event('datasetUploaded'));
    if(typeof window.setActivePage==='function') window.setActivePage('home');
  }

  fileInput.addEventListener('change',e=>{
    const files=e.target.files;
    uploadInfo.textContent=!files.length?'No file selected':files.length===1?`Selected: ${files[0].name}`:`Selected ${files.length} files`;
  });

  uploadBtn.addEventListener('click',ev=>{
    ev.preventDefault();
    const files=fileInput.files;
    if(!files||files.length===0){
      alert('Please select at least one file first!');
      uploadInfo.textContent='Please select at least one file first!';
      return;
    }
    processFiles(files).catch(err=>{console.error(err); uploadInfo.textContent='Upload failed. See console for details.';});
  });
});
