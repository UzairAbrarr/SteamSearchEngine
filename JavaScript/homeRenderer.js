document.addEventListener('DOMContentLoaded', () => {
  const container = document.getElementById('home-categories');
  const freeContainer = document.getElementById('freeGamesList');
  const PLACEHOLDER = '/mnt/data/f84e3cff-c908-45f9-8373-2e034c71a892.png';
  const MAX_HOME_PER_CATEGORY = 12;
  const FREE_PAGE_SIZE = 10;

  // --- Load final datasets quickly ---
  async function loadFinalDatasets() {
    const basePath = './PreDefinedJsonsFile/';
    try {
      const [lexicon, invertedIndex, fwd1, fwd2] = await Promise.all([
        fetch(basePath+'lexicon.json').then(r=>r.json()),
        fetch(basePath+'invertedIndex.json').then(r=>r.json()),
        fetch(basePath+'forwardIndex_part1.json').then(r=>r.json()),
        fetch(basePath+'forwardIndex_part2.json').then(r=>r.json())
      ]);

      window.lexicon = lexicon;
      window.invertedIndex = invertedIndex;
      window.forwardIndex = [...fwd1, ...fwd2];

      // Precompute structures
      window.appKeySet = new Set(window.forwardIndex.map(g=>(g.appid||g.name||'').toLowerCase()));
      window.freeGames = window.forwardIndex.filter(g=>g.isFree);
      
      // Precompute top-N for categories
      const topN = (arr,key,N)=>arr.slice().sort((a,b)=>b[key]-a[key]).slice(0,N);
      window.categoryCache = {
        Popular: topN(window.forwardIndex,'recommendationsTotal',MAX_HOME_PER_CATEGORY),
        TopMetacritic: topN(window.forwardIndex,'metacriticScore',MAX_HOME_PER_CATEGORY),
        FreeGames: window.freeGames.slice(0,MAX_HOME_PER_CATEGORY),
        Sports: window.forwardIndex.filter(g=>/sports/i.test((g.name||'')+' '+(g.shortDescription||''))).slice(0,MAX_HOME_PER_CATEGORY),
        Vehicle: window.forwardIndex.filter(g=>/vehicle|car|bike|cycle|racing/i.test((g.name||'')+' '+(g.shortDescription||''))).slice(0,MAX_HOME_PER_CATEGORY),
        Horror: window.forwardIndex.filter(g=>/horror|zombi|zombie|scary|ghost/i.test((g.name||'')+' '+(g.shortDescription||''))).slice(0,MAX_HOME_PER_CATEGORY)
      };

      document.dispatchEvent(new Event('datasetUploaded'));
    } catch(e) {
      console.error('Failed to load datasets', e);
      container.innerHTML = '<p class="small">Failed to load dataset.</p>';
    }
  }
  loadFinalDatasets();

  // --- Minimal rendering helpers ---
  const escapeHtml = s => String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

  const makeGameCard = g=>{
    const wrapper = document.createElement(g.appid?'a':'div');
    if(g.appid){ wrapper.href=`https://store.steampowered.com/app/${encodeURIComponent(g.appid)}`; wrapper.target='_blank'; wrapper.rel='noopener noreferrer'; }
    wrapper.className='game-card';
    wrapper.innerHTML=`
      <div class="thumb" style="background-image:url('${escapeHtml(g.headerImage||PLACEHOLDER)}')"></div>
      <div class="meta"><div><h4>${escapeHtml(g.name||'Untitled')}</h4><p>${escapeHtml(g.shortDescription||'No description available.')}</p></div>
      <div><span class="price-badge">${g.isFree?'Free':''}</span></div></div>
      <div class="hover-box" aria-hidden="true"><h4>${escapeHtml(g.name||'Untitled')}</h4><p>${escapeHtml(g.shortDescription||'No description available.')}</p></div>
    `;
    wrapper.addEventListener('mouseenter',()=>{ const hb=wrapper.querySelector('.hover-box'); if(hb) hb.style.display='block'; });
    wrapper.addEventListener('mouseleave',()=>{ const hb=wrapper.querySelector('.hover-box'); if(hb) hb.style.display='none'; });
    return wrapper;
  };

  const createCarousel = (title, items)=>{
    const section = document.createElement('div');
    section.className='home-category';
    section.innerHTML=`<div class="category-head"><h3>${escapeHtml(title)}</h3><div class="category-controls"></div></div>`;
    const scroller=document.createElement('div'); scroller.className='home-games';
    const frag=document.createDocumentFragment();
    items.forEach(i=>frag.appendChild(makeGameCard(i)));
    scroller.appendChild(frag);
    const dots=document.createElement('div'); dots.className='carousel-dots';
    section.appendChild(scroller); section.appendChild(dots);
    return section;
  };

  const renderHome = ()=>{
    container.innerHTML='';
    const cache = window.categoryCache||{};
    Object.keys(cache).forEach(cat=>{
      const items=cache[cat];
      if(items && items.length) container.appendChild(createCarousel(cat.toUpperCase(), items));
    });
  };

  const renderFreeVertical = (page=1, perPage=FREE_PAGE_SIZE)=>{
    freeContainer.innerHTML='';
    const freeGames = window.freeGames||[];
    if(!freeGames.length){ freeContainer.innerHTML='<p class="small">No free games.</p>'; return; }
    const start=(page-1)*perPage; const end=start+perPage;
    const frag=document.createDocumentFragment();
    freeGames.slice(start,end).forEach(g=>{
      const card=document.createElement('div'); card.className='free-game-card';
      card.innerHTML=`<img src="${escapeHtml(g.headerImage||PLACEHOLDER)}" alt="${escapeHtml(g.name||'Untitled')}" onerror="this.src='${PLACEHOLDER}'" /><div class="free-info"><h4>${escapeHtml(g.name||'Untitled')}</h4><p>${escapeHtml(g.shortDescription||'No description available.')}</p></div>`;
      card.addEventListener('click',()=>{ if(g.appid) window.open(`https://store.steampowered.com/app/${encodeURIComponent(g.appid)}`,'_blank'); });
      frag.appendChild(card);
    });
    freeContainer.appendChild(frag);
    // pager can stay if needed, simplified
  };

  document.addEventListener('datasetUploaded',()=>{
    document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
    document.getElementById('page-home')?.classList.add('active');
    document.querySelectorAll('.nav-btn').forEach(b=>b.classList.remove('active'));
    document.querySelector('.nav-btn[data-page="home"]')?.classList.add('active');
    renderHome();
    renderFreeVertical();
  });

  document.querySelectorAll('.nav-btn[data-page="freegames"]').forEach(b=>{
    b.addEventListener('click',()=>renderFreeVertical());
  });
});
