// homeRenderer.js
// Renders compact Steam-like home carousels with limited (famous) games per category.

document.addEventListener('DOMContentLoaded', () => {
  const container = document.getElementById('home-categories');
  const freePage = document.getElementById('page-freegames');
  const PLACEHOLDER = '/mnt/data/f84e3cff-c908-45f9-8373-2e034c71a892.png';
  const MAX_HOME_PER_CATEGORY = 12;   // keep home light
  const FREE_PAGE_SIZE = 20;

  function escapeHtml(s) {
    return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  function makeCard(game) {
    const hasAppid = game && game.appid && String(game.appid).trim().length > 0;
    const link = hasAppid ? https://store.steampowered.com/app/${encodeURIComponent(game.appid)} : null;
    const wrapper = document.createElement(hasAppid ? 'a' : 'div');
    if (hasAppid) {
      wrapper.setAttribute('href', link);
      wrapper.setAttribute('target', '_blank');
      wrapper.setAttribute('rel', 'noopener noreferrer');
    }
    wrapper.className = 'game-card';

    const thumbUrl = (game.headerImage && game.headerImage.trim()) ? escapeHtml(game.headerImage) : PLACEHOLDER;
    const fullDesc = (game.shortDescription || '').trim() || 'No description available.';

    wrapper.innerHTML = `
      <div class="thumb" style="background-image:url('${thumbUrl}')"></div>
      <div class="meta">
        <div>
          <h4>${escapeHtml(game.name || 'Untitled')}</h4>
          <p>${escapeHtml((game.shortDescription || '').substring(0,240))}</p>
        </div>
        <div>
          <span class="price-badge">${game.isFree ? 'Free' : ''}</span>
        </div>
      </div>
      <div class="hover-box" aria-hidden="true">
        <h4>${escapeHtml(game.name || 'Untitled')}</h4>
        <p>${escapeHtml(fullDesc)}</p>
      </div>
    `;
    return wrapper;
  }

  function createCarousel(title, games) {
    const section = document.createElement('div');
    section.className = 'home-category';

    const head = document.createElement('div');
    head.className = 'category-head';
    head.innerHTML = <h3>${escapeHtml(title)}</h3><div class="category-controls"></div>;
    section.appendChild(head);

    const carousel = document.createElement('div');
    carousel.className = 'carousel';
    const scroller = document.createElement('div');
    scroller.className = 'home-games';

    for (const g of games) scroller.appendChild(makeCard(g));

    const dots = document.createElement('div');
    dots.className = 'carousel-dots';

    carousel.appendChild(scroller);
    carousel.appendChild(dots);
    section.appendChild(carousel);

    // simple dots logic (keeps visual tidy)
    function updateDots() {
      dots.innerHTML = '';
      const cards = scroller.querySelectorAll('.game-card');
      if (!cards.length) return;
      const cardWidth = cards[0].offsetWidth + 12;
      const visible = Math.max(1, Math.floor(scroller.clientWidth / cardWidth));
      const pages = Math.ceil(cards.length / visible);
      for (let p = 0; p < pages; p++) {
        const b = document.createElement('button');
        b.addEventListener('click', () => {
          scroller.scrollLeft = p * visible * cardWidth;
        });
        dots.appendChild(b);
      }
      const activePage = Math.round(scroller.scrollLeft / (Math.max(1, visible) * cardWidth));
      Array.from(dots.children).forEach((btn, i) => btn.classList.toggle('active', i === activePage));
    }
    setTimeout(updateDots, 80);
    window.addEventListener('resize', () => setTimeout(updateDots, 60));
    scroller.addEventListener('scroll', () => setTimeout(updateDots, 30));

    return section;
  }

  function renderAllCategories() {
    container.innerHTML = '';
    if (!window.forwardIndex || window.forwardIndex.length === 0) {
      container.innerHTML = '<p class="small">No games uploaded yet. Upload a dataset to see categories.</p>';
      return;
    }

    // Only show the most famous categories on home to keep it light
    const definitions = [
      { name: 'Popular', filter: g => Number(g.recommendationsTotal || 0) >= 5000 },
      { name: 'Top Metacritic', filter: g => Number(g.metacriticScore || 0) >= 80 },
      { name: 'Free Games', filter: g => Boolean(g.isFree) === true }
    ];

    for (const def of definitions) {
      const games = window.forwardIndex.filter(def.filter);
      if (!games || games.length === 0) continue;
      // sort by recommendations, then keep the top N
      const sorted = games.slice().sort((a,b)=> (b.recommendationsTotal||0) - (a.recommendationsTotal||0)).slice(0, MAX_HOME_PER_CATEGORY);
      const section = createCarousel(def.name.toUpperCase(), sorted);
      container.appendChild(section);
    }
  }

  // Free games page render with pagination
  function renderFreeGamesPage(page = 1) {
    if (!freePage) return;
    const freeList = (window.forwardIndex || []).filter(d => d.isFree);
    freePage.innerHTML = '<h2>Free Games</h2>';
    if (!freeList || freeList.length === 0) {
      freePage.innerHTML += '<p class="small">No free games in dataset.</p>';
      return;
    }

    const totalPages = Math.max(1, Math.ceil(freeList.length / FREE_PAGE_SIZE));
    const current = Math.max(1, Math.min(page, totalPages));
    const start = (current - 1) * FREE_PAGE_SIZE;
    const slice = freeList.slice(start, start + FREE_PAGE_SIZE);

    const grid = document.createElement('div');
    grid.style.display = 'grid';
    grid.style.gridTemplateColumns = 'repeat(auto-fill, minmax(180px, 1fr))';
    grid.style.gap = '12px';
    grid.style.marginTop = '12px';

    for (const g of slice) {
      const node = makeCard(g);
      if (node.tagName === 'A') { node.style.textDecoration='none'; node.style.color='inherit'; }
      grid.appendChild(node);
    }

    freePage.appendChild(grid);

    const pagDiv = document.createElement('div');
    pagDiv.style.display = 'flex';
    pagDiv.style.gap = '8px';
    pagDiv.style.marginTop = '12px';
    pagDiv.style.flexWrap = 'wrap';

    for (let i = 1; i <= totalPages; i++) {
      const btn = document.createElement('button');
      btn.textContent = i;
      btn.style.padding = '6px 10px';
      btn.style.borderRadius = '6px';
      btn.style.background = (i === current) ? 'var(--accent)' : '#0f2a3a';
      btn.style.color = (i === current) ? '#07141d' : '#dff3ff';
      btn.onclick = () => renderFreeGamesPage(i);
      pagDiv.appendChild(btn);
    }

    freePage.appendChild(pagDiv);
  }

  // react to dataset upload and page changes
  document.addEventListener('datasetUploaded', () => {
    if (typeof window.setActivePage === 'function') window.setActivePage('home');
    else {
      document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
      document.getElementById('page-home')?.classList.add('active');
    }
    renderAllCategories();
    renderFreeGamesPage(1);
  });

  document.querySelectorAll('.nav-btn[data-page="freegames"]').forEach(b => {
    b.addEventListener('click', () => {
      renderFreeGamesPage(1);
    });
  });

  document.addEventListener('pageChanged', (e) => {
    if (e?.detail?.page === 'freegames') renderFreeGamesPage(1);
    if (e?.detail?.page === 'home') renderAllCategories();
  });

  // initial render
  renderAllCategories();
  renderFreeGamesPage(1);
});