document.addEventListener('DOMContentLoaded', () => {
  const container = document.getElementById('home-categories');
  const freeContainer = document.getElementById('freeGamesList');
  const PLACEHOLDER = '/mnt/data/f84e3cff-c908-45f9-8373-2e034c71a892.png';
  const FREE_PAGE_SIZE = 10;

  // ============================================
  //expected time to load at start is 0.2-0.6 SECONDS! 
  // ============================================
  
  async function loadHomePageData() {
    const basePath = './PreDefinedJsonsFile/';
    try {
      // Load ONLY tiny homeCategories.json (50KB)
      const homeData = await fetch(basePath + 'homeCategories.json').then(r => r.json());
      
      window.homeCategories = homeData.categories;
      window.freeGamesPreview = homeData.freeGames;
      
      // Render immediately
      renderHomePage();
      
      // Load full datasets in background for search
      setTimeout(() => loadFullDatasets(), 1000);
      
    } catch (e) {
      console.error('Failed to load homepage data', e);
      container.innerHTML = '<p class="small">Failed to load homepage.</p>';
    }
  }

  async function loadFullDatasets() {
    if (window.fullDataLoaded) return;
    
    const basePath = './PreDefinedJsonsFile/';
    try {
      console.log('Loading full datasets in background...');
      
      const [lexicon, invertedIndex, fwd1, fwd2] = await Promise.all([
        fetch(basePath + 'lexicon.json').then(r => r.json()),
        fetch(basePath + 'invertedIndex.json').then(r => r.json()),
        fetch(basePath + 'forwardIndex_part1.json').then(r => r.json()),
        fetch(basePath + 'forwardIndex_part2.json').then(r => r.json())
      ]);

      window.lexicon = lexicon;
      window.invertedIndex = invertedIndex;
      window.forwardIndex = [...fwd1, ...fwd2];
      window.freeGames = window.forwardIndex.filter(g => g.isFree);
      window.fullDataLoaded = true;

      console.log('✅ Full datasets ready for search!');
      document.dispatchEvent(new Event('datasetUploaded'));
    } catch (e) {
      console.error('Failed to load full datasets', e);
    }
  }

  function renderHomePage() {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById('page-home')?.classList.add('active');
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    document.querySelector('.nav-btn[data-page="home"]')?.classList.add('active');
    
    renderHome();
    renderFreeVertical();
  }

  // Start loading
  loadHomePageData();

  // ============================================
  // RENDERING FUNCTIONS
  // ============================================

  const esc = s => {
    const d = document.createElement('div');
    d.textContent = s || '';
    return d.innerHTML;
  };

  const makeGameCard = g => {
    const w = document.createElement(g.appid ? 'a' : 'div');
    if (g.appid) {
      w.href = `https://store.steampowered.com/app/${g.appid}`;
      w.target = '_blank';
      w.rel = 'noopener noreferrer';
    }
    w.className = 'game-card';

    const thumb = document.createElement('div');
    thumb.className = 'thumb';
    thumb.style.backgroundImage = `url('${g.headerImage || PLACEHOLDER}')`;

    const meta = document.createElement('div');
    meta.className = 'meta';
    meta.innerHTML = `
      <div>
        <h4>${esc(g.name || 'Untitled')}</h4>
        <p>${esc(g.shortDescription || 'No description available.')}</p>
      </div>
      <div>
        <span class="price-badge">${g.isFree ? 'Free' : ''}</span>
      </div>
    `;

    const hoverBox = document.createElement('div');
    hoverBox.className = 'hover-box';
    hoverBox.setAttribute('aria-hidden', 'true');
    hoverBox.style.display = 'none';
    hoverBox.innerHTML = `
      <h4>${esc(g.name || 'Untitled')}</h4>
      <p>${esc(g.shortDescription || 'No description available.')}</p>
    `;

    w.appendChild(thumb);
    w.appendChild(meta);
    w.appendChild(hoverBox);

    w.addEventListener('mouseenter', () => hoverBox.style.display = 'block');
    w.addEventListener('mouseleave', () => hoverBox.style.display = 'none');

    return w;
  };

  const createCarousel = (title, items) => {
    const section = document.createElement('div');
    section.className = 'home-category';

    const head = document.createElement('div');
    head.className = 'category-head';
    head.innerHTML = `<h3>${esc(title)}</h3><div class="category-controls"></div>`;

    const scroller = document.createElement('div');
    scroller.className = 'home-games';

    const frag = document.createDocumentFragment();
    items.forEach(i => frag.appendChild(makeGameCard(i)));
    scroller.appendChild(frag);

    const dots = document.createElement('div');
    dots.className = 'carousel-dots';

    section.appendChild(head);
    section.appendChild(scroller);
    section.appendChild(dots);

    return section;
  };

  const renderHome = () => {
    container.innerHTML = '';
    const cats = window.homeCategories || {};
    const frag = document.createDocumentFragment();

    Object.keys(cats).forEach(cat => {
      const items = cats[cat];
      if (items && items.length) {
        frag.appendChild(createCarousel(cat.toUpperCase(), items));
      }
    });

    container.appendChild(frag);
  };

  const renderFreeVertical = (page = 1, perPage = FREE_PAGE_SIZE) => {
    freeContainer.innerHTML = '';
    const freeGames = window.freeGamesPreview || window.freeGames || [];
    
    if (!freeGames.length) {
      freeContainer.innerHTML = '<p class="small">No free games.</p>';
      return;
    }

    const start = (page - 1) * perPage;
    const end = start + perPage;
    const frag = document.createDocumentFragment();

    freeGames.slice(start, end).forEach(g => {
      const card = document.createElement('div');
      card.className = 'free-game-card';

      const img = document.createElement('img');
      img.src = g.headerImage || PLACEHOLDER;
      img.alt = g.name || 'Untitled';
      img.onerror = () => img.src = PLACEHOLDER;

      const info = document.createElement('div');
      info.className = 'free-info';
      info.innerHTML = `
        <h4>${esc(g.name || 'Untitled')}</h4>
        <p>${esc(g.shortDescription || 'No description available.')}</p>
      `;

      card.appendChild(img);
      card.appendChild(info);

      if (g.appid) {
        card.style.cursor = 'pointer';
        card.addEventListener('click', () => {
          window.open(`https://store.steampowered.com/app/${g.appid}`, '_blank');
        });
      }

      frag.appendChild(card);
    });

    freeContainer.appendChild(frag);
  };

  document.querySelectorAll('.nav-btn[data-page="freegames"]').forEach(b => {
    b.addEventListener('click', () => renderFreeVertical());
  });
});