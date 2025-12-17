document.addEventListener('DOMContentLoaded', () => {
  const container = document.getElementById('home-categories');
  const freeContainer = document.getElementById('freeGamesList');
  const PLACEHOLDER = '/mnt/data/f84e3cff-c908-45f9-8373-2e034c71a892.png';
  const MAX_HOME_PER_CATEGORY = 12;
  const FREE_PAGE_SIZE = 10;

  // --- OPTIMIZED: Load datasets without unnecessary processing ---
  async function loadFinalDatasets() {
    const basePath = './PreDefinedJsonsFile/';
    try {
      const [lexicon, invertedIndex, fwd1, fwd2] = await Promise.all([
        fetch(basePath + 'lexicon.json').then(r => r.json()),
        fetch(basePath + 'invertedIndex.json').then(r => r.json()),
        fetch(basePath + 'forwardIndex_part1.json').then(r => r.json()),
        fetch(basePath + 'forwardIndex_part2.json').then(r => r.json())
      ]);

      // Store raw data
      window.lexicon = lexicon;
      window.invertedIndex = invertedIndex;
      window.forwardIndex = [...fwd1, ...fwd2];

      // ONLY precompute what's absolutely needed for home page
      window.freeGames = window.forwardIndex.filter(g => g.isFree);

      // Dispatch early so UI can start rendering
      document.dispatchEvent(new Event('datasetUploaded'));
    } catch (e) {
      console.error('Failed to load datasets', e);
      container.innerHTML = '<p class="small">Failed to load dataset.</p>';
    }
  }
  loadFinalDatasets();

  // --- OPTIMIZED: Build category cache ONLY when needed ---
  function getCategoryCache() {
    if (window.categoryCache) return window.categoryCache;

    const topN = (arr, key, n) => {
      return arr
        .map(g => ({ g, val: g[key] || 0 }))
        .sort((a, b) => b.val - a.val)
        .slice(0, n)
        .map(item => item.g);
    };

    const filterByKeywords = (keywords, limit) => {
      const regex = new RegExp(keywords, 'i');
      const results = [];
      for (let i = 0; i < window.forwardIndex.length && results.length < limit; i++) {
        const g = window.forwardIndex[i];
        const text = (g.name || '') + ' ' + (g.shortDescription || '');
        if (regex.test(text)) results.push(g);
      }
      return results;
    };

    window.categoryCache = {
      Popular: topN(window.forwardIndex, 'recommendationsTotal', MAX_HOME_PER_CATEGORY),
      TopMetacritic: topN(window.forwardIndex, 'metacriticScore', MAX_HOME_PER_CATEGORY),
      FreeGames: window.freeGames.slice(0, MAX_HOME_PER_CATEGORY),
      Sports: filterByKeywords('sports', MAX_HOME_PER_CATEGORY),
      Vehicle: filterByKeywords('vehicle|car|bike|cycle|racing', MAX_HOME_PER_CATEGORY),
      Horror: filterByKeywords('horror|zombi|zombie|scary|ghost', MAX_HOME_PER_CATEGORY)
    };

    return window.categoryCache;
  }

  // --- Minimal rendering helpers ---
  const escapeHtml = s => {
    const div = document.createElement('div');
    div.textContent = s || '';
    return div.innerHTML;
  };

  const makeGameCard = g => {
    const wrapper = document.createElement(g.appid ? 'a' : 'div');
    if (g.appid) {
      wrapper.href = `https://store.steampowered.com/app/${g.appid}`;
      wrapper.target = '_blank';
      wrapper.rel = 'noopener noreferrer';
    }
    wrapper.className = 'game-card';

    const thumb = document.createElement('div');
    thumb.className = 'thumb';
    thumb.style.backgroundImage = `url('${g.headerImage || PLACEHOLDER}')`;

    const meta = document.createElement('div');
    meta.className = 'meta';
    meta.innerHTML = `
      <div>
        <h4>${escapeHtml(g.name || 'Untitled')}</h4>
        <p>${escapeHtml(g.shortDescription || 'No description available.')}</p>
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
      <h4>${escapeHtml(g.name || 'Untitled')}</h4>
      <p>${escapeHtml(g.shortDescription || 'No description available.')}</p>
    `;

    wrapper.appendChild(thumb);
    wrapper.appendChild(meta);
    wrapper.appendChild(hoverBox);

    wrapper.addEventListener('mouseenter', () => hoverBox.style.display = 'block');
    wrapper.addEventListener('mouseleave', () => hoverBox.style.display = 'none');

    return wrapper;
  };

  const createCarousel = (title, items) => {
    const section = document.createElement('div');
    section.className = 'home-category';

    const head = document.createElement('div');
    head.className = 'category-head';
    head.innerHTML = `<h3>${escapeHtml(title)}</h3><div class="category-controls"></div>`;

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
    const cache = getCategoryCache(); // Build cache on-demand
    const frag = document.createDocumentFragment();

    Object.keys(cache).forEach(cat => {
      const items = cache[cat];
      if (items && items.length) {
        frag.appendChild(createCarousel(cat.toUpperCase(), items));
      }
    });

    container.appendChild(frag);
  };

  const renderFreeVertical = (page = 1, perPage = FREE_PAGE_SIZE) => {
    freeContainer.innerHTML = '';
    const freeGames = window.freeGames || [];
    
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
        <h4>${escapeHtml(g.name || 'Untitled')}</h4>
        <p>${escapeHtml(g.shortDescription || 'No description available.')}</p>
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

  document.addEventListener('datasetUploaded', () => {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById('page-home')?.classList.add('active');
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    document.querySelector('.nav-btn[data-page="home"]')?.classList.add('active');
    
    renderHome();
    renderFreeVertical();
  });

  document.querySelectorAll('.nav-btn[data-page="freegames"]').forEach(b => {
    b.addEventListener('click', () => renderFreeVertical());
  });
});