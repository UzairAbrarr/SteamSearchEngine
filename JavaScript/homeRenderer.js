document.addEventListener('DOMContentLoaded', () => {
  const container = document.getElementById('home-categories');
  const freeContainer = document.getElementById('freeGamesList');
  const PLACEHOLDER = '/mnt/data/f84e3cff-c908-45f9-8373-2e034c71a892.png';
  const MAX_HOME_PER_CATEGORY = 12;
  const FREE_PAGE_SIZE = 10;

  // --- Load default datasets from local folder ---
  async function loadDefaultDatasets() {
    const basePath = './PreDefinedJsonsFile/'; // relative to HTML
    try {
      const lexRes = await fetch(basePath + 'lexicon.json');
      window.lexicon = await lexRes.json();

      const invRes = await fetch(basePath + 'invertedIndex.json');
      window.invertedIndex = await invRes.json();

      const fwd1Res = await fetch(basePath + 'forwardIndex_part1.json');
      const fwd2Res = await fetch(basePath + 'forwardIndex_part2.json');
      const fwd1 = await fwd1Res.json();
      const fwd2 = await fwd2Res.json();

      window.forwardIndex = [...fwd1, ...fwd2].map((doc, idx) => ({ ...doc, docId: idx }));
      window.appKeySet = new Set(window.forwardIndex.map(g => (g.appid || g.name || '').toString().toLowerCase()));

      // trigger rendering
      document.dispatchEvent(new Event('datasetUploaded'));
    } catch (e) {
      console.error('Failed to load default datasets', e);
      container.innerHTML = '<p class="small">Failed to load default dataset.</p>';
    }
  }

  // --- Normalization & Helpers ---
  const definitions = [
    { name: 'Popular', filter: g => Number(g.recommendationsTotal || 0) >= 5000 },
    { name: 'Free Games', filter: g => Boolean(g.isFree) === true },
    { name: 'Top Metacritic', filter: g => Number(g.metacriticScore || 0) >= 80 },
    { name: 'Sports', filter: g => /sports/i.test((g.name||'') + ' ' + (g.shortDescription||'')) },
    { name: 'Vehicle', filter: g => /vehicle|car|bike|cycle|racing/i.test((g.name||'') + ' ' + (g.shortDescription||'')) },
    { name: 'Horror', filter: g => /horror|zombi|zombie|scary|ghost/i.test((g.name||'') + ' ' + (g.shortDescription||'')) }
  ];

  function getField(doc, keys) { for (const k of keys) if (doc[k] !== undefined) return doc[k]; return ''; }
  function normalizeDoc(raw) { 
    if (!raw) return null;
    return {
      appid: String(getField(raw, ['appid','appId','id']) || '').trim(),
      name: String(getField(raw, ['name','title']) || '').trim(),
      shortDescription: String(getField(raw, ['short_description','shortDescription','description']) || '').trim(),
      headerImage: String(getField(raw, ['header_image','headerImage','image','header']) || '').trim(),
      metacriticScore: parseInt(getField(raw, ['metacritic_score','metacriticScore']) || 0, 10) || 0,
      recommendationsTotal: parseInt(getField(raw, ['recommendations_total','recommendationsTotal','recs']) || 0, 10) || 0,
      isFree: (String(getField(raw, ['is_free','isFree']) || '').toLowerCase() === 'true' || Number(getField(raw, ['is_free','isFree']) || 0) === 1)
    };
  }
  function escapeHtml(s) { return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

  function makeGameCard(obj) {
    const g = normalizeDoc(obj);
    const wrapper = document.createElement(g.appid ? 'a' : 'div');
    if (g.appid) {
      wrapper.setAttribute('href', `https://store.steampowered.com/app/${encodeURIComponent(g.appid)}`);
      wrapper.setAttribute('target', '_blank');
      wrapper.setAttribute('rel', 'noopener noreferrer');
    }
    wrapper.className = 'game-card';
    const thumb = g.headerImage || PLACEHOLDER;
    const name = escapeHtml(g.name || 'Untitled');
    const short = escapeHtml(g.shortDescription || 'No description available.');
    wrapper.innerHTML = `
      <div class="thumb" style="background-image:url('${escapeHtml(thumb)}')"></div>
      <div class="meta">
        <div>
          <h4>${name}</h4>
          <p>${short}</p>
        </div>
        <div>
          <span class="price-badge">${g.isFree ? 'Free' : ''}</span>
        </div>
      </div>
      <div class="hover-box" aria-hidden="true">
        <h4>${name}</h4>
        <p>${short}</p>
      </div>
    `;
    wrapper.addEventListener('mouseenter', () => {
      const hb = wrapper.querySelector('.hover-box'); if(hb) hb.style.display='block';
    });
    wrapper.addEventListener('mouseleave', () => {
      const hb = wrapper.querySelector('.hover-box'); if(hb) hb.style.display='none';
    });
    return wrapper;
  }

  function createCarousel(title, items) {
    const section = document.createElement('div');
    section.className = 'home-category';
    section.innerHTML = `<div class="category-head"><h3>${escapeHtml(title)}</h3><div class="category-controls"></div></div>`;
    const scroller = document.createElement('div');
    scroller.className = 'home-games';
    const fragment = document.createDocumentFragment();
    items.forEach(i => fragment.appendChild(makeGameCard(i)));
    scroller.appendChild(fragment);
    const dots = document.createElement('div'); dots.className = 'carousel-dots';
    section.appendChild(scroller); section.appendChild(dots);

    function updateDots() {
      dots.innerHTML = '';
      const cards = scroller.querySelectorAll('.game-card');
      if (!cards.length) return;
      const cardWidth = cards[0].offsetWidth + 12;
      const visible = Math.max(1, Math.floor(scroller.clientWidth / cardWidth));
      const pages = Math.ceil(cards.length / Math.max(1, visible));
      for (let p = 0; p < pages; p++) {
        const b = document.createElement('button');
        b.addEventListener('click', () => scroller.scrollLeft = p * visible * cardWidth);
        dots.appendChild(b);
      }
      const activePage = Math.round(scroller.scrollLeft / (Math.max(1, visible) * cardWidth));
      Array.from(dots.children).forEach((btn,i)=>btn.classList.toggle('active', i===activePage));
    }

    setTimeout(updateDots, 80);
    window.addEventListener('resize',()=>setTimeout(updateDots,60));
    scroller.addEventListener('scroll',()=>setTimeout(updateDots,30));

    return section;
  }

  function renderHome() {
    container.innerHTML = '';
    const raw = window.forwardIndex || [];
    if (!raw.length) {
      container.innerHTML = '<p class="small">No games uploaded yet.</p>';
      return;
    }
    const norm = raw.map(normalizeDoc);
    definitions.forEach(def => {
      const games = norm.filter(def.filter);
      if (!games.length) return;
      const sorted = games.slice().sort((a,b)=> (b.recommendationsTotal||0)-(a.recommendationsTotal||0)).slice(0, MAX_HOME_PER_CATEGORY);
      container.appendChild(createCarousel(def.name.toUpperCase(), sorted));
    });
  }

  function renderFreeVertical(page = 1, perPage = FREE_PAGE_SIZE) {
    freeContainer.innerHTML = '';
    const raw = window.forwardIndex || [];
    const norm = raw.map(normalizeDoc);
    const freeGames = norm.filter(g => g.isFree);
    if (!freeGames.length) {
      freeContainer.innerHTML = '<p class="small">No free games in dataset.</p>';
      return;
    }
    const start = (page-1)*perPage; const end=start+perPage;
    const fragment = document.createDocumentFragment();
    freeGames.slice(start,end).forEach(g=>{
      const card=document.createElement('div'); card.className='free-game-card';
      const thumb=escapeHtml(g.headerImage||PLACEHOLDER);
      const name=escapeHtml(g.name||'Untitled'); const desc=escapeHtml(g.shortDescription||'No description available.');
      card.innerHTML=`<img src="${thumb}" alt="${name}" onerror="this.src='${PLACEHOLDER}'" />
        <div class="free-info"><h4>${name}</h4><p>${desc}</p></div>`;
      card.addEventListener('click',()=>{ if(g.appid) window.open(`https://store.steampowered.com/app/${encodeURIComponent(g.appid)}`,'_blank'); });
      fragment.appendChild(card);
    });
    freeContainer.appendChild(fragment);

    const totalPages=Math.ceil(freeGames.length/perPage);
    if(totalPages<=1) return;
    const pager=document.createElement('div'); pager.className='free-pager';
    const pageWindow=10;
    let startPage=Math.floor((page-1)/pageWindow)*pageWindow+1;
    let endPage=Math.min(startPage+pageWindow-1,totalPages);
    if(startPage>1){ const prev=document.createElement('button'); prev.textContent='<'; prev.addEventListener('click',()=>renderFreeVertical(startPage-1,perPage)); pager.appendChild(prev); }
    for(let i=startPage;i<=endPage;i++){ const btn=document.createElement('button'); btn.textContent=i; btn.classList.toggle('active',i===page); btn.addEventListener('click',()=>renderFreeVertical(i,perPage)); pager.appendChild(btn); }
    if(endPage<totalPages){ const next=document.createElement('button'); next.textContent='>'; next.addEventListener('click',()=>renderFreeVertical(endPage+1,perPage)); pager.appendChild(next); }
    freeContainer.appendChild(pager);
  }

  // --- Event binding ---
  document.addEventListener('datasetUploaded', () => {
    renderHome();
    renderFreeVertical();
  });

  // --- Trigger initial load ---
  loadDefaultDatasets();
});
