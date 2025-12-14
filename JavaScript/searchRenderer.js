// searchRenderer.js
document.addEventListener('DOMContentLoaded', async () => {
  console.log('[searchRenderer] Starting Fame-Biased Engine (Image Fix)...');

  // --- Load Vectors (Optional) ---
  let wordVectors = {};
  try {
    const mod = await import('./WordVectors.js');
    wordVectors = mod.default || {};
  } catch (err) {
    console.warn('[searchRenderer] Semantic search disabled (Vectors missing).');
  }

  // ====== 1. CONFIGURATION ======

  // CONCEPT MAPPING (Unchanged)
  const CONCEPT_MAP = {
    "vehicle": ["car", "cars", "truck", "bus", "racing", "drive", "driving", "simulator", "automobil", "motor"],
    "car": ["vehicle", "racing", "drive", "drift", "rally", "motorsport", "auto", "speed", "forza", "gran", "turismo", "need", "wanted", "heat", "carbon"],
    "racing": ["car", "vehicle", "speed", "f1", "formula", "rally", "drift", "moto", "bike", "forza", "assetto", "crew"],
    
    "fps": ["shooter", "gun", "weapon", "war", "combat", "sniper", "strike", "counter", "cod", "call", "duty", "battlefield", "global", "offensive", "csgo", "apex", "valorant", "doom", "halo", "left", "dead"],
    "shooter": ["fps", "gun", "shooting", "kill", "warfare", "sniper"],
    
    "rpg": ["role", "playing", "adventure", "quest", "fantasy", "dragon", "witcher", "souls", "elden", "ring", "skyrim", "fallout", "baldur", "persona", "final", "fantasy"],
    "horror": ["scary", "zombie", "dead", "survival", "resident", "evil", "silent", "fear", "outlast", "amnesia", "phasmophobia"],
    "soccer": ["football", "fifa", "pes", "manager", "sport", "fc"],
    "strategy": ["rts", "tactical", "war", "civilization", "city", "build", "manage", "empire", "age", "empires", "total", "war"]
  };

  // SCORING WEIGHTS (Unchanged)
  const S_EXACT_PHRASE = 1000; 
  const S_TITLE_TOKEN  = 200;  
  const S_DESC_TOKEN   = 50;   
  const S_CONCEPT_TITLE= 150;  
  const S_SEMANTIC     = 100;  
  const POPULARITY_POWER = 50; 

  // --- Helpers ---
  function getVector(text) {
    if (!wordVectors) return null;
    const tokens = String(text).toLowerCase().split(/[^a-z0-9]+/);
    const vecs = [];
    for (const t of tokens) {
      if (t.length > 2 && wordVectors[t]) vecs.push(wordVectors[t]);
    }
    if (vecs.length === 0) return null;
    const dim = vecs[0].length;
    const avg = new Array(dim).fill(0);
    for (const v of vecs) for (let i = 0; i < dim; i++) avg[i] += v[i];
    for (let i = 0; i < dim; i++) avg[i] /= vecs.length;
    return avg;
  }

  function cosineSim(a, b) {
    if (!a || !b) return 0;
    let dot=0, ma=0, mb=0;
    for(let i=0; i<a.length; i++) { dot+=a[i]*b[i]; ma+=a[i]*a[i]; mb+=b[i]*b[i]; }
    return ma===0||mb===0 ? 0 : dot/(Math.sqrt(ma)*Math.sqrt(mb));
  }

  // --- UI Setup ---
  const searchPage = document.getElementById('page-search');
  if (!searchPage) return;

  let input, searchBtn, resultsDiv, pagerDiv, timeDiv, suggestDiv;
  const PLACEHOLDER = 'data:image/svg+xml,<svg width="180" height="110" xmlns="http://www.w3.org/2000/svg"><rect width="180" height="110" fill="%23152d3a"/><text x="50%" y="50%" fill="%2398a6b3" font-size="14" font-family="Arial" text-anchor="middle" dominant-baseline="middle">No Image</text></svg>';

  function ensureSearchUI() {
    input = document.getElementById('searchInput');
    searchBtn = document.getElementById('searchBtn');
    resultsDiv = document.getElementById('searchResults');
    pagerDiv = document.getElementById('searchPager');
    timeDiv = document.getElementById('searchTime');

    if (!resultsDiv) { resultsDiv = document.createElement('div'); resultsDiv.id = 'searchResults'; searchPage.appendChild(resultsDiv); }
    if (!pagerDiv) { pagerDiv = document.createElement('div'); pagerDiv.id = 'searchPager'; searchPage.appendChild(pagerDiv); }
    if (!timeDiv) { timeDiv = document.createElement('div'); timeDiv.id = 'searchTime'; timeDiv.style.cssText = 'color:#98a6b3;font-size:12px;margin-top:4px;text-align:right;'; searchPage.appendChild(timeDiv); }

    let wrapper;
    if (!input) {
      wrapper = document.createElement('div');
      wrapper.style.cssText = 'display:flex;gap:6px;margin-top:10px;position:relative;';
      input = document.createElement('input'); input.id = 'searchInput'; input.type = 'search'; input.placeholder = 'Search games (e.g. Forza, FPS, Car)'; input.style.flex = '1';
      searchBtn = document.createElement('button'); searchBtn.id = 'searchBtn'; searchBtn.textContent = 'Search'; searchBtn.style.cssText = 'padding:6px 10px;border-radius:4px;border:none;background:#66c0f4;color:#07141d;cursor:pointer;font-weight:600;';
      wrapper.appendChild(input); wrapper.appendChild(searchBtn);
      searchPage.prepend(wrapper);
    } else {
      wrapper = input.parentElement; wrapper.style.position = 'relative';
    }

    suggestDiv = document.getElementById('searchSuggestions');
    if (!suggestDiv) {
      suggestDiv = document.createElement('div');
      suggestDiv.id = 'searchSuggestions';
      suggestDiv.style.cssText = 'position:absolute;left:0;width:100%;background:#152d3a;border:1px solid #223a50;max-height:300px;overflow-y:auto;display:none;z-index:99;border-radius:4px;';
      wrapper.appendChild(suggestDiv);
    }
  }
  ensureSearchUI();

  // --- Data ---
  let docs = [];
  let currentResults = [], currentPage = 1, PAGE_SIZE = 7;

  function buildIndices() {
    docs = [];
    const rawData = window.forwardIndex || [];
    
    let maxRec = 1;
    rawData.forEach(d => { if((d.recommendationsTotal||0) > maxRec) maxRec = d.recommendationsTotal; });
    const logMaxRec = Math.log10(maxRec + 1);

    rawData.forEach((raw, idx) => {
      const name = String(raw.name || raw.title || '').trim();
      const desc = String(raw.short_description || raw.description || '').trim();
      const rec = parseInt(raw.recommendationsTotal || 0);
      const meta = parseInt(raw.metacritic_score || 0);
      
      const pop = ((Math.log10(rec + 1) / logMaxRec) * 0.85) + ((meta / 100) * 0.15);

      const vectorText = name + " " + desc; 
      const vec = getVector(vectorText);

      // --- FIX: Robust Image Detection ---
      // Checks all common property names for images in Steam datasets
      const rawImg = raw.header_image || raw.headerImage || raw.image || raw.img || raw.capsule_image || raw.capsule_imagev5;

      docs.push({
        idx, raw, name, desc,
        nameLc: name.toLowerCase(),
        descLc: desc.toLowerCase(),
        pop: pop,
        vec: vec,
        img: rawImg, // Use the fixed image variable
        meta: meta, rec: rec, isFree: !!raw.isFree
      });
    });
    console.log('[searchRenderer] Index built. Total Docs:', docs.length);
  }
  buildIndices();
  document.addEventListener('datasetUploaded', buildIndices);


  // ====== 2. THE LOGIC (Unchanged) ======
  function triggerSearch(queryOverride) {
    suggestDiv.style.display = 'none';
    const t0 = performance.now();
    const query = (queryOverride || input.value || '').trim().toLowerCase();

    if (!query) {
      currentResults = []; renderPage(1);
      if(timeDiv) timeDiv.textContent = '0ms';
      return;
    }

    const queryTokens = query.split(/\s+/).filter(t => t.length > 0);
    const queryVec = getVector(query);

    const expansionSet = new Set();
    queryTokens.forEach(t => {
      if (CONCEPT_MAP[t]) {
        CONCEPT_MAP[t].forEach(syn => expansionSet.add(syn));
      }
    });

    const results = [];
    
    for (let i = 0; i < docs.length; i++) {
      const doc = docs[i];
      let score = 0;

      // Exact Phrase
      if (doc.nameLc.includes(query)) {
        score += S_EXACT_PHRASE;
        if (doc.nameLc.startsWith(query)) score += 500; 
      } 
      
      // Token Match
      queryTokens.forEach(qt => {
        if (doc.nameLc.includes(qt)) score += S_TITLE_TOKEN;
        else if (doc.descLc.includes(qt)) score += S_DESC_TOKEN;
      });

      // Concept Match
      expansionSet.forEach(term => {
        if (doc.nameLc.includes(term)) {
           score += S_CONCEPT_TITLE;
        } else if (doc.descLc.includes(term)) {
           score += S_DESC_TOKEN;
        }
      });

      // Semantic Fallback
      if (queryVec && doc.vec) {
        const sim = cosineSim(queryVec, doc.vec);
        if (sim > 0.12) score += (sim * S_SEMANTIC);
      }

      // Fame Factor
      if (score > 10) {
        score += (doc.pop * POPULARITY_POWER * 100); 
        results.push({ doc: doc, score: score });
      }
    }

    results.sort((a, b) => b.score - a.score);
    currentResults = results.map(r => r.doc);

    const t1 = performance.now();
    if (timeDiv) timeDiv.textContent = `Found ${currentResults.length} results in ${(t1 - t0).toFixed(1)}ms`;
    renderPage(1);
  }


  // ====== 3. RENDER (Unchanged Logic, Image Fix Applied) ======
  function renderPage(page = 1) {
    currentPage = page;
    resultsDiv.innerHTML = '';
    const start = (page - 1) * PAGE_SIZE; 
    const end = Math.min(start + PAGE_SIZE, currentResults.length);
    
    if (currentResults.length === 0) { 
      resultsDiv.innerHTML = '<p style="color:#98a6b3;text-align:center;padding:20px;">No results found</p>'; 
      pagerDiv.innerHTML = ''; 
      return; 
    }

    for (let i = start; i < end; i++) {
      const g = currentResults[i];
      const card = document.createElement('div');
      card.style.cssText = 'display:flex;align-items:flex-start;gap:12px;margin:6px 0;padding:10px;background:#152d3a;border-radius:6px;cursor:pointer;transition:all 0.1s;';
      card.onmouseenter = () => card.style.background = '#1a3a4a';
      card.onmouseleave = () => card.style.background = '#152d3a';
      if (g.raw.appid) card.onclick = () => window.open(`https://store.steampowered.com/app/${g.raw.appid}`, '_blank');

      // Image Handling
      const img = document.createElement('img'); 
      img.src = g.img || PLACEHOLDER; 
      img.width = 120; img.height = 70;
      img.style.cssText = 'object-fit:cover;border-radius:4px;flex-shrink:0;background:#12232d;';
      
      // If image fails to load, swap to placeholder
      img.onerror = function(){ this.src = PLACEHOLDER; };

      const info = document.createElement('div'); info.style.flex = '1';
      info.innerHTML = `
        <h4 style="margin:0 0 6px 0;color:#fff;font-size:15px;font-weight:600;">${g.name}</h4>
        <div style="color:#98a6b3;font-size:13px;height:36px;overflow:hidden;line-height:1.4;">${g.desc ? g.desc.slice(0,100)+'...' : 'No description.'}</div>
        <div style="display:flex;gap:10px;margin-top:6px;font-size:11px;color:#66c0f4;">
          ${g.meta > 0 ? `<span>Metacritic: ${g.meta}</span>` : ''}
          ${g.rec > 0 ? `<span>Recs: ${g.rec.toLocaleString()}</span>` : ''}
          ${g.isFree ? `<span style="background:#66c0f4;color:#07141d;padding:0 4px;border-radius:2px;font-weight:bold;">FREE</span>` : ''}
        </div>
      `;
      card.appendChild(img); card.appendChild(info);
      resultsDiv.appendChild(card);
    }
    
    pagerDiv.innerHTML = '';
    const totalPages = Math.ceil(currentResults.length / PAGE_SIZE);
    if (totalPages > 1) {
      const c = document.createElement('div'); c.style.cssText = 'display:flex;gap:4px;justify-content:center;margin-top:10px;';
      const mkBtn = (txt, p) => {
        const b = document.createElement('button'); b.textContent = txt;
        b.style.cssText = `padding:4px 8px;background:${p===currentPage?'#66c0f4':'#152d3a'};color:${p===currentPage?'#07141d':'#ccc'};border:1px solid #444;cursor:pointer;border-radius:3px;`;
        b.onclick = () => renderPage(p);
        c.appendChild(b);
      };
      if (currentPage > 1) mkBtn('<', currentPage-1);
      let s = Math.max(1, currentPage - 2), e = Math.min(totalPages, currentPage + 2);
      for(let i=s; i<=e; i++) mkBtn(i, i);
      if (currentPage < totalPages) mkBtn('>', currentPage+1);
      pagerDiv.appendChild(c);
    }
  }

  function showSuggestions(q) {
    const query = q.trim().toLowerCase();
    if (!query) { suggestDiv.style.display = 'none'; return; }

    let matches = docs.filter(d => d.nameLc.includes(query));
    matches.sort((a,b) => b.pop - a.pop);
    
    const top = matches.slice(0, 8);
    
    suggestDiv.innerHTML = '';
    if (top.length === 0) { suggestDiv.style.display = 'none'; return; }
    
    top.forEach(g => {
      const r = document.createElement('div');
      r.style.cssText = 'padding:8px;border-bottom:1px solid #223a50;cursor:pointer;color:#ccc;font-size:13px;display:flex;align-items:center;gap:8px;';
      r.onmouseenter = () => { r.style.background = '#1a3a4a'; r.style.color = '#fff'; };
      r.onmouseleave = () => { r.style.background = 'transparent'; r.style.color = '#ccc'; };
      r.onclick = () => { input.value = g.name; triggerSearch(); };
      r.innerHTML = `<img src="${g.img||PLACEHOLDER}" width="30" height="20" style="object-fit:cover;"> ${g.name}`;
      suggestDiv.appendChild(r);
    });
    suggestDiv.style.display = 'block';
    suggestDiv.style.top = input.offsetHeight + 'px';
  }

  input.addEventListener('input', () => showSuggestions(input.value));
  input.addEventListener('keydown', (e) => { if(e.key==='Enter') triggerSearch(); });
  searchBtn.addEventListener('click', () => triggerSearch());
});