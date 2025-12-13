document.addEventListener('DOMContentLoaded', () => {
  const container = document.getElementById('home-categories');
  const freeContainer = document.getElementById('freeGamesList');
  const PLACEHOLDER = '/mnt/data/f84e3cff-c908-45f9-8373-2e034c71a892.png';
  const MAX_HOME_PER_CATEGORY = 12;
  const FREE_PAGE_SIZE = 10;

  const categoryDefinitions = [
    { name: 'Popular', filter: g => Number(g.recommendationsTotal||0)>=5000 },
    { name: 'Free Games', filter: g => g.isFree },
    { name: 'Top Metacritic', filter: g => Number(g.metacriticScore||0)>=80 },
    { name: 'Sports', filter: g => /sports/i.test(g.categoryTags) },
    { name: 'Vehicle', filter: g => /vehicle|car|bike|cycle|racing/i.test(g.categoryTags) },
    { name: 'Horror', filter: g => /horror|zombi|zombie|scary|ghost/i.test(g.categoryTags) }
  ];

  function getField(doc, keys) {
    for (const k of keys) if (doc[k] !== undefined) return doc[k];
    return '';
  }

  function normalizeDoc(raw) {
    if (!raw) return null;
    const name = String(getField(raw,['name','title'])||'').trim();
    const shortDescription = String(getField(raw,['short_description','shortDescription','description'])||'').trim();
    const combinedText = (name+' '+shortDescription).toLowerCase();
    return {
      appid: String(getField(raw,['appid','appId','id'])||'').trim(),
      name,
      shortDescription,
      headerImage: String(getField(raw,['header_image','headerImage','image','header'])||'').trim(),
      metacriticScore: parseInt(getField(raw,['metacritic_score','metacriticScore'])||0,10)||0,
      recommendationsTotal: parseInt(getField(raw,['recommendations_total','recommendationsTotal','recs'])||0,10)||0,
      isFree: (String(getField(raw,['is_free','isFree'])||'').toLowerCase()==='true' || Number(getField(raw,['is_free','isFree'])||0)===1),
      categoryTags: combinedText
    };
  }

  function makeGameCard(g) {
    const wrapper = document.createElement(g.appid?'a':'div');
    if(g.appid){
      wrapper.href = `https://store.steampowered.com/app/${encodeURIComponent(g.appid)}`;
      wrapper.target = '_blank';
      wrapper.rel = 'noopener noreferrer';
    }
    wrapper.className='game-card';
    const thumb = g.headerImage || PLACEHOLDER;
    const name = g.name||'Untitled';
    const short = g.shortDescription||'No description available.';
    wrapper.innerHTML = `
      <div class="thumb" style="background-image:url('${thumb}')"></div>
      <div class="meta">
        <div><h4>${name}</h4><p>${short}</p></div>
        <div><span class="price-badge">${g.isFree?'Free':''}</span></div>
      </div>
      <div class="hover-box" aria-hidden="true"><h4>${name}</h4><p>${short}</p></div>
    `;
    wrapper.addEventListener('mouseenter',()=>{ wrapper.querySelector('.hover-box').style.display='block'; });
    wrapper.addEventListener('mouseleave',()=>{ wrapper.querySelector('.hover-box').style.display='none'; });
    return wrapper;
  }

  let categorizedGames = {};

  function categorizeGames() {
    const raw = window.forwardIndex || [];
    const norm = raw.map(normalizeDoc);
    categorizedGames = {};
    categoryDefinitions.forEach(def => {
      categorizedGames[def.name] = norm.filter(def.filter)
        .sort((a,b)=> (b.recommendationsTotal||0)-(a.recommendationsTotal||0))
        .slice(0, MAX_HOME_PER_CATEGORY);
    });
    categorizedGames.freeGamesFull = norm.filter(g=>g.isFree);
  }

  // ---------------- Virtualized carousel ----------------
  function createVirtualCarousel(title, items) {
    const section = document.createElement('div');
    section.className='home-category';
    section.innerHTML = `<div class="category-head"><h3>${title}</h3><div class="category-controls"></div></div>`;
    const scroller = document.createElement('div'); scroller.className='home-games';
    section.appendChild(scroller);

    const dots = document.createElement('div'); dots.className='carousel-dots'; section.appendChild(dots);

    let cardWidth = 220; // default width + margin buffer
    const buffer = 2; // number of cards before/after viewport
    const visibleCards = () => Math.max(1, Math.floor(scroller.clientWidth / cardWidth));
    const totalPages = () => Math.ceil(items.length / visibleCards());

    function renderVisibleCards() {
      const scrollLeft = scroller.scrollLeft;
      const firstVisibleIndex = Math.floor(scrollLeft / cardWidth);
      const start = Math.max(0, firstVisibleIndex - buffer);
      const end = Math.min(items.length, firstVisibleIndex + visibleCards() + buffer);

      scroller.innerHTML=''; // clear only the scroller
      const frag = document.createDocumentFragment();
      for(let i=start;i<end;i++){ frag.appendChild(makeGameCard(items[i])); }
      scroller.appendChild(frag);
      updateDots();
    }

    function updateDots(){
      dots.innerHTML='';
      const visible = visibleCards();
      const pages = totalPages();
      for(let p=0;p<pages;p++){
        const b=document.createElement('button');
        b.addEventListener('click',()=> scroller.scrollLeft = p*visible*cardWidth);
        dots.appendChild(b);
      }
      const active = Math.round(scroller.scrollLeft/(visible*cardWidth));
      Array.from(dots.children).forEach((btn,i)=>btn.classList.toggle('active',i===active));
    }

    scroller.addEventListener('scroll',()=> requestAnimationFrame(renderVisibleCards));
    window.addEventListener('resize',()=> requestAnimationFrame(renderVisibleCards));

    renderVisibleCards();
    return section;
  }
  // -------------------------------------------------------

  function renderHome() {
    container.innerHTML='';
    categoryDefinitions.forEach(def => {
      const games = categorizedGames[def.name] || [];
      if(!games.length) return;
      container.appendChild(createVirtualCarousel(def.name.toUpperCase(), games));
    });
  }

  function renderFreeVertical(page=1, perPage=FREE_PAGE_SIZE) {
    freeContainer.innerHTML='';
    const freeGames = categorizedGames.freeGamesFull || [];
    if(!freeGames.length){ freeContainer.innerHTML='<p class="small">No free games.</p>'; return; }
    const start = (page-1)*perPage; const end = start+perPage;
    const frag = document.createDocumentFragment();
    freeGames.slice(start,end).forEach(g=>{
      const card = document.createElement('div'); card.className='free-game-card';
      card.innerHTML = `<img src="${g.headerImage||PLACEHOLDER}" onerror="this.src='${PLACEHOLDER}'" />
                        <div class="free-info"><h4>${g.name}</h4><p>${g.shortDescription}</p></div>`;
      card.addEventListener('click',()=> g.appid && window.open(`https://store.steampowered.com/app/${encodeURIComponent(g.appid)}`,'_blank'));
      frag.appendChild(card);
    });
    freeContainer.appendChild(frag);

    const totalPages = Math.ceil(freeGames.length/perPage);
    if(totalPages<=1) return;
    const pager = document.createElement('div'); pager.className='free-pager';
    const pageWindow=10;
    let startPage = Math.floor((page-1)/pageWindow)*pageWindow+1;
    let endPage = Math.min(startPage+pageWindow-1,totalPages);

    if(startPage>1){ const prev = document.createElement('button'); prev.textContent='<'; prev.addEventListener('click',()=>renderFreeVertical(startPage-1,perPage)); pager.appendChild(prev); }
    for(let i=startPage;i<=endPage;i++){ const btn=document.createElement('button'); btn.textContent=i; btn.classList.toggle('active',i===page); btn.addEventListener('click',()=>renderFreeVertical(i,perPage)); pager.appendChild(btn);}
    if(endPage<totalPages){ const next = document.createElement('button'); next.textContent='>'; next.addEventListener('click',()=>renderFreeVertical(endPage+1,perPage)); pager.appendChild(next);}
    freeContainer.appendChild(pager);
  }

  document.addEventListener('datasetUploaded',()=>{
    categorizeGames();
    if(typeof window.setActivePage==='function') window.setActivePage('home');
    renderHome();
    renderFreeVertical();
  });

  document.querySelectorAll('.nav-btn[data-page="freegames"]').forEach(b=>b.addEventListener('click',()=>renderFreeVertical()));
  if(window.forwardIndex && window.forwardIndex.length){ categorizeGames(); renderHome(); renderFreeVertical(); }
});
