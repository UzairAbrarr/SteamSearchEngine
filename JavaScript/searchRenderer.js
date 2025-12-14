document.addEventListener('DOMContentLoaded', () => {
  console.log('[searchRenderer] starting...');

  const searchPage = document.getElementById('page-search');
  if(!searchPage) return;

  // --- UI Setup ---
  let input, searchBtn, resultsDiv, pagerDiv, timeDiv, suggestDiv, wrapper;

  function ensureSearchUI() {
    input = document.getElementById('searchInput');
    searchBtn = document.getElementById('searchBtn');
    resultsDiv = document.getElementById('searchResults');
    pagerDiv = document.getElementById('searchPager');
    timeDiv = document.getElementById('searchTime');

    if(!resultsDiv){ resultsDiv=document.createElement('div'); resultsDiv.id='searchResults'; searchPage.appendChild(resultsDiv); }
    if(!pagerDiv){ pagerDiv=document.createElement('div'); pagerDiv.id='searchPager'; searchPage.appendChild(pagerDiv); }
    if(!timeDiv){ timeDiv=document.createElement('div'); timeDiv.id='searchTime'; timeDiv.style.cssText='color:#98a6b3;font-size:12px;margin-top:4px;text-align:right;'; searchPage.appendChild(timeDiv); }

    if(!input || !searchBtn){
      wrapper=document.createElement('div');
      wrapper.style.cssText='display:flex;gap:6px;margin-top:10px;position:relative;';

      input=document.createElement('input');
      input.id='searchInput';
      input.type='search';
      input.placeholder='Search games';
      input.style.flex='1';
      wrapper.appendChild(input);

      searchBtn=document.createElement('button');
      searchBtn.id='searchBtn';
      searchBtn.textContent='Search';
      searchBtn.style.cssText='padding:6px 10px;border-radius:4px;border:none;background:#66c0f4;color:#07141d;cursor:pointer;font-weight:600;';
      wrapper.appendChild(searchBtn);

      searchPage.prepend(wrapper);

      // Suggestion dropdown (attached to wrapper)
      suggestDiv=document.createElement('div');
      suggestDiv.id='searchSuggestions';
      suggestDiv.style.cssText='position:absolute;left:0;width:100%;background:#152d3a;border:1px solid #223a50;max-height:300px;overflow-y:auto;display:none;z-index:99;border-radius:4px;';
      wrapper.appendChild(suggestDiv);
    } else {
      wrapper = input.parentElement;
      wrapper.style.position = 'relative';

      suggestDiv = document.getElementById('searchSuggestions') || null;
      if(!suggestDiv){
        suggestDiv=document.createElement('div');
        suggestDiv.id='searchSuggestions';
        suggestDiv.style.cssText='position:absolute;left:0;width:100%;background:#152d3a;border:1px solid #223a50;max-height:300px;overflow-y:auto;display:none;z-index:99;border-radius:4px;';
        wrapper.appendChild(suggestDiv);
      } else {
        // ensure the suggestDiv is inside the wrapper so absolute positioning works
        if(!suggestDiv.parentNode || suggestDiv.parentNode !== wrapper) wrapper.appendChild(suggestDiv);
        suggestDiv.style.cssText='position:absolute;left:0;width:100%;background:#152d3a;border:1px solid #223a50;max-height:300px;overflow-y:auto;display:none;z-index:99;border-radius:4px;';
      }
    }
  }
  ensureSearchUI();

  const PAGE_SIZE=7;
  const PLACEHOLDER='data:image/svg+xml,<svg width="180" height="110" xmlns="http://www.w3.org/2000/svg"><rect width="180" height="110" fill="%23152d3a"/><text x="50%" y="50%" fill="%2398a6b3" font-size="14" font-family="Arial" text-anchor="middle" dominant-baseline="middle">No Image</text></svg>';

  let normalizedForward=[], appidToIndex=new Map(), invIndex=new Map(), barrels={}, currentResults=[], currentPage=1;

  function normalizeDoc(raw){
    if(!raw) return null;
    const name=String(raw.name||raw.title||'').trim();
    const desc=String(raw.short_description||raw.description||'').trim();
    return {
      raw,
      appid:String(raw.appid||raw.id||''),
      name, nameLc:name.toLowerCase(),
      desc, descLc:desc.toLowerCase(),
      headerImage:String(raw.headerImage||raw.image||''),
      metacriticScore:parseInt(raw.metacritic_score||0,10)||0,
      recommendationsTotal:parseInt(raw.recommendationsTotal||0,10)||0,
      isFree:!!raw.isFree
    };
  }

  function buildIndices(){
    normalizedForward=[]; appidToIndex.clear(); invIndex.clear(); barrels={};
    const fwd=window.forwardIndex||[];
    fwd.forEach((doc,i)=>{
      const norm=normalizeDoc(doc);
      normalizedForward.push(norm);
      if(norm.appid) appidToIndex.set(norm.appid,i);

      const tokens=norm.nameLc.split(/\s+/).concat(norm.descLc.split(/\s+/));
      tokens.forEach(tok=>{
        if(!invIndex.has(tok)) invIndex.set(tok,new Set());
        invIndex.get(tok).add(i);

        const first=tok[0];
        if(!barrels[first]) barrels[first]=new Map();
        barrels[first].set(tok, invIndex.get(tok));
      });
    });
    console.log('[searchRenderer] indices ready:', normalizedForward.length, 'docs');
  }
  buildIndices();
  document.addEventListener('datasetUploaded', ()=>buildIndices());

  // --- Render page (original full card + pager logic restored exactly) ---
  function renderPage(page=1){
    currentPage=page;
    resultsDiv.innerHTML='';
    const start=(page-1)*PAGE_SIZE; const end=Math.min(start+PAGE_SIZE,currentResults.length);
    if(currentResults.length===0){ resultsDiv.innerHTML='<p style="color:#98a6b3;text-align:center;">No results found</p>'; pagerDiv.innerHTML=''; return; }

    for(let i=start;i<end;i++){
      const g=currentResults[i];
      const card=document.createElement('div');
      card.style.cssText='display:flex;align-items:flex-start;gap:12px;margin:6px 0;padding:10px;background:#152d3a;border-radius:6px;cursor:pointer;transition:all 0.1s;';
      card.addEventListener('mouseenter',()=>{card.style.background='#1a3a4a'; card.style.transform='translateX(3px)';});
      card.addEventListener('mouseleave',()=>{card.style.background='#152d3a'; card.style.transform='translateX(0)';});
      if(g.appid) card.addEventListener('click',()=>window.open(`https://store.steampowered.com/app/${encodeURIComponent(g.appid)}`,'_blank'));

      const img=document.createElement('img'); img.src=g.headerImage||PLACEHOLDER; img.width=120; img.height=70;
      img.style.cssText='object-fit:cover;border-radius:4px;flex-shrink:0;background:#12232d;';
      img.onerror=function(){ this.onerror=null; this.src=PLACEHOLDER; };

      const info=document.createElement('div'); info.style.flex='1;min-width:0;';
      const title=document.createElement('h4'); title.textContent=g.name||'Untitled'; title.style.cssText='margin:0 0 6px 0;color:#fff;font-size:15px;font-weight:600;';
      const desc=document.createElement('p'); const dtxt=g.desc||'No description available.'; desc.textContent=dtxt.length>140?dtxt.slice(0,140)+'...':dtxt; desc.style.cssText='margin:0;color:#98a6b3;font-size:13px;line-height:1.4;';

      const meta=document.createElement('div'); meta.style.cssText='display:flex;gap:8px;margin-top:6px;font-size:12px;color:#98a6b3;flex-wrap:wrap;';
      if(g.metacriticScore>0){ const m=document.createElement('span'); m.innerHTML=`<strong style="color:#66c0f4;">Metacritic:</strong> ${g.metacriticScore}`; meta.appendChild(m); }
      if(g.recommendationsTotal>0){ const r=document.createElement('span'); r.innerHTML=`<strong style="color:#66c0f4;">Recs:</strong> ${g.recommendationsTotal.toLocaleString()}`; meta.appendChild(r); }
      if(g.isFree){ const f=document.createElement('span'); f.textContent='FREE'; f.style.cssText='background:#66c0f4;color:#07141d;padding:2px 6px;border-radius:3px;font-weight:700;'; meta.appendChild(f); }

      info.appendChild(title); info.appendChild(desc); if(meta.children.length) info.appendChild(meta);
      card.appendChild(img); card.appendChild(info);
      resultsDiv.appendChild(card);
    }

    // pager
    pagerDiv.innerHTML='';
    const totalPages=Math.ceil(currentResults.length/PAGE_SIZE);
    if(totalPages<=1) return;
    const container=document.createElement('div'); container.style.cssText='display:flex;gap:4px;flex-wrap:wrap;justify-content:center;margin-top:12px;';
    function addBtn(p){ const b=document.createElement('button'); b.textContent=p; b.style.cssText=`padding:4px 8px;border-radius:4px;border:1px solid #888;background:${p===currentPage?'#66c0f4':'#152d3a'};color:${p===currentPage?'#07141d':'#ccc'};cursor:pointer;`; if(p!==currentPage) b.addEventListener('click',()=>renderPage(p)); container.appendChild(b); }
    function addDots(){ const d=document.createElement('span'); d.textContent='...'; d.style.color='#ccc'; d.style.padding='0 4px'; container.appendChild(d); }

    if(currentPage>1){ const prev=document.createElement('button'); prev.textContent='← Prev'; prev.style.cssText='padding:4px 8px'; prev.addEventListener('click',()=>renderPage(currentPage-1)); container.appendChild(prev); }
    let startPage=Math.max(1,currentPage-3); let endPage=Math.min(totalPages,currentPage+3);
    if(startPage>1){ addBtn(1); if(startPage>2) addDots(); }
    for(let p=startPage;p<=endPage;p++) addBtn(p);
    if(endPage<totalPages){ if(endPage<totalPages-1) addDots(); addBtn(totalPages); }
    if(currentPage<totalPages){ const next=document.createElement('button'); next.textContent='Next →'; next.style.cssText='padding:4px 8px'; next.addEventListener('click',()=>renderPage(currentPage+1)); container.appendChild(next); }

    pagerDiv.appendChild(container);
  }

  // --- Search logic ---
  function triggerSearch(queryOverride){
    suggestDiv.style.display='none'; // hide suggestions when search is triggered

    const t0=performance.now();
    const q=(queryOverride||input.value||'').trim().toLowerCase();
    if(!q){ currentResults=[]; renderPage(1); if(timeDiv) timeDiv.textContent='0ms'; return; }

    const tokens=q.split(/\s+/).filter(Boolean);
    const candidateSet=new Set();
    tokens.forEach(tok=>{
      if(invIndex.has(tok)) invIndex.get(tok).forEach(idx=>candidateSet.add(idx));
      const barrel=barrels[tok[0]]||new Map();
      for(const [key,setIdx] of barrel.entries()) if(key.startsWith(tok)) setIdx.forEach(idx=>candidateSet.add(idx));
    });

    const scored=[];
    candidateSet.forEach(idx=>{
      const g=normalizedForward[idx];
      let score=0;
      tokens.forEach(tok=>{
        if(g.nameLc===tok) score+=1000;
        else if(g.nameLc.startsWith(tok)) score+=600;
        else if(g.nameLc.includes(tok)) score+=350;
        if(g.descLc.includes(tok)) score+=10;
      });
      score += (g.recommendationsTotal||0)*0.0001;
      score += (g.metacriticScore||0)*0.01;
      scored.push({idx,score});
    });

    scored.sort((a,b)=>b.score-a.score);
    currentResults=scored.map(s=>normalizedForward[s.idx]);
    const t1=performance.now();
    if(timeDiv) timeDiv.textContent=`Search time: ${(t1-t0).toFixed(1)}ms`;
    renderPage(1);
  }

  // --- Suggestions (dropdown with cover image + desc + FREE badge) ---
  function showSuggestions(query){
    const q=query.toLowerCase().trim();
    if(!q){ suggestDiv.style.display='none'; return; }

    const tokens=q.split(/\s+/).filter(Boolean);
    const candidateSet=new Set();
    tokens.forEach(tok=>{
      const barrel=barrels[tok[0]]||new Map();
      for(const [key,setIdx] of barrel.entries()) if(key.startsWith(tok)) setIdx.forEach(idx=>candidateSet.add(idx));
    });

    const suggestions=Array.from(candidateSet)
      .map(idx=>normalizedForward[idx])
      .sort((a,b)=> b.recommendationsTotal - a.recommendationsTotal)
      .slice(0,10);

    suggestDiv.innerHTML='';
    if(suggestions.length===0){ suggestDiv.style.display='none'; return; }

    suggestions.forEach(g=>{
      const div=document.createElement('div');
      div.style.cssText='display:flex;gap:8px;padding:6px 8px;cursor:pointer;border-bottom:1px solid #223a50;align-items:center;transition:background 0.1s;';
      div.addEventListener('mouseenter',()=>div.style.background='#1a3a4a');
      div.addEventListener('mouseleave',()=>div.style.background='transparent');
      div.addEventListener('click',()=>{ input.value=g.name; triggerSearch(); });

      const img=document.createElement('img'); img.src=g.headerImage||PLACEHOLDER; img.width=40; img.height=25;
      img.style.cssText='object-fit:cover;border-radius:3px;flex-shrink:0;background:#12232d;';
      img.onerror=function(){ this.onerror=null; this.src=PLACEHOLDER; };

      const info=document.createElement('div'); info.style.cssText='flex:1;min-width:0;';
      const title=document.createElement('div'); title.textContent=g.name; title.style.cssText='color:#fff;font-weight:600;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;';
      const desc=document.createElement('div'); desc.textContent=g.desc.length>60?g.desc.slice(0,60)+'...':g.desc; desc.style.cssText='color:#98a6b3;font-size:11px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;';
      const badge=document.createElement('span'); badge.textContent=g.isFree?'FREE':''; badge.style.cssText='background:#66c0f4;color:#07141d;padding:1px 4px;border-radius:3px;font-size:10px;font-weight:700;margin-left:4px;';

      info.appendChild(title); info.appendChild(desc); title.appendChild(badge);
      div.appendChild(img); div.appendChild(info);
      suggestDiv.appendChild(div);
    });
    suggestDiv.style.top = input.offsetHeight + 4 + 'px'; // ensure directly under input
    suggestDiv.style.display='block';
  }

  input.addEventListener('input',()=>showSuggestions(input.value));
  searchBtn.addEventListener('click',()=>triggerSearch());
  input.addEventListener('keydown',e=>{ if(e.key==='Enter') triggerSearch(); });

});
