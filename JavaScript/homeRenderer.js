document.addEventListener('DOMContentLoaded', () => {
  const container = document.getElementById('home-categories');
  const freeContainer = document.getElementById('freeGamesList');
  const PLACEHOLDER = '/mnt/data/f84e3cff-c908-45f9-8373-2e034c71a892.png';
  const MAX_HOME_PER_CATEGORY = 12;
  const FREE_PAGE_SIZE = 10;

  async function loadDefaultDatasets() {
    const basePath = './PreDefinedJsonsFile/';
    try {
      const [lexRes, invRes, fwd1Res, fwd2Res] = await Promise.all([
        fetch(basePath + 'lexicon.json'), 
        fetch(basePath + 'invertedIndex.json'),
        fetch(basePath + 'forwardIndex_part1.json'),
        fetch(basePath + 'forwardIndex_part2.json')
      ]);
      window.lexicon = await lexRes.json();
      window.invertedIndex = await invRes.json();
      const fwd1 = await fwd1Res.json();
      const fwd2 = await fwd2Res.json();

      // Pre-normalize forwardIndex
      window.forwardIndex = [...fwd1, ...fwd2].map((doc, idx) => normalizeDoc({ ...doc, docId: idx }));
      window.appKeySet = new Set(window.forwardIndex.map(g => (g.appid || g.name || '').toLowerCase()));
      document.dispatchEvent(new Event('datasetUploaded'));
    } catch (e) {
      console.error('Failed to load default datasets', e);
      container.innerHTML = '<p class="small">Failed to load default dataset.</p>';
    }
  }
  loadDefaultDatasets();

  const definitions = [
    { name: 'Popular', filter: g => g.recommendationsTotal >= 5000 },
    { name: 'Free Games', filter: g => g.isFree === true },
    { name: 'Top Metacritic', filter: g => g.metacriticScore >= 80 },
    { name: 'Sports', filter: g => /sports/i.test((g.name||'') + ' ' + (g.shortDescription||'')) },
    { name: 'Vehicle', filter: g => /vehicle|car|bike|cycle|racing/i.test((g.name||'') + ' ' + (g.shortDescription||'')) },
    { name: 'Horror', filter: g => /horror|zombi|zombie|scary|ghost/i.test((g.name||'') + ' ' + (g.shortDescription||'')) }
  ];

  function normalizeDoc(raw) {
    if (!raw) return null;
    return {
      docId: raw.docId,
      appid: String(raw.appid || raw.appId || raw.id || '').trim(),
      name: String(raw.name || raw.title || '').trim(),
      shortDescription: String(raw.short_description || raw.shortDescription || raw.description || '').trim(),
      headerImage: String(raw.header_image || raw.headerImage || raw.image || raw.header || '').trim(),
      metacriticScore: parseInt(raw.metacritic_score || raw.metacriticScore || 0, 10) || 0,
      recommendationsTotal: parseInt(raw.recommendations_total || raw.recommendationsTotal || raw.recs || 0, 10) || 0,
      isFree: String(raw.is_free || raw.isFree || '').toLowerCase() === 'true' || Number(raw.is_free || raw.isFree || 0) === 1
    };
  }

  function escapeHtml(s) {
    return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  // event delegation for hover (faster than individual listeners)
  container.addEventListener('mouseover', e => {
    const hb = e.target.closest('.game-card')?.querySelector('.hover-box');
    if (hb) hb.style.display = 'block';
  });
  container.addEventListener('mouseout', e => {
    const hb = e.target.closest('.game-card')?.querySelector('.hover-box');
    if (hb) hb.style.display = 'none';
  });

  function makeGameCard(g) {
    const wrapper = document.createElement(g.appid ? 'a' : 'div');
    if (g.appid) {
      wrapper.href = `https://store.steampowered.com/app/${encodeURIComponent(g.appid)}`;
      wrapper.target = '_blank';
      wrapper.rel = 'noopener noreferrer';
    }
    wrapper.className = 'game-card';
    const thumb = g.headerImage || PLACEHOLDER;
    const name = escapeHtml(g.name || 'Untitled');
    const short = escapeHtml(g.shortDescription || 'No description available.');
    wrapper.innerHTML = `
      <div class="thumb" style="background-image:url('${thumb}')"></div>
      <div class="meta">
        <div><h4>${name}</h4><p>${short}</p></div>
        <div><span class="price-badge">${g.isFree ? 'Free' : ''}</span></div>
      </div>
      <div class="hover-box" aria-hidden="true"><h4>${name}</h4><p>${short}</p></div>
    `;
    return wrapper;
  }

  function createCarousel(title, items) {
    const section = document.createElement('div');
    section.className = 'home-category';
    section.innerHTML = `<div class="category-head"><h3>${escapeHtml(title)}</h3></div>`;
    const scroller = document.createElement('div');
    scroller.className = 'home-games';
    section.appendChild(scroller);
    return { section, scroller, items };
  }

  function renderHome() {
    container.innerHTML = '';
    const raw = window.forwardIndex || [];
    if (!raw.length) {
      container.innerHTML = '<p class="small">No games uploaded yet.</p>';
      return;
    }

    const carousels = definitions.map(def => {
      const filtered = raw.filter(def.filter).sort((a,b)=> b.recommendationsTotal - a.recommendationsTotal).slice(0, MAX_HOME_PER_CATEGORY);
      if (!filtered.length) return null;
      return createCarousel(def.name.toUpperCase(), filtered);
    }).filter(Boolean);

    // append sections in batches to avoid blocking
    let i = 0;
    function appendBatch() {
      const batch = carousels.slice(i, i+1);
      batch.forEach(c => {
        const frag = document.createDocumentFragment();
        c.items.forEach(item => frag.appendChild(makeGameCard(item)));
        c.scroller.appendChild(frag);
        container.appendChild(c.section);
      });
      i += 1;
      if (i < carousels.length) requestAnimationFrame(appendBatch);
    }
    appendBatch();
  }

  function renderFreeVertical(page = 1, perPage = FREE_PAGE_SIZE) {
    freeContainer.innerHTML = '';
    const raw = window.forwardIndex || [];
    const freeGames = raw.filter(g => g.isFree);
    if (!freeGames.length) return;

    const start = (page-1)*perPage;
    const end = start+perPage;
    const frag = document.createDocumentFragment();
    freeGames.slice(start, end).forEach(g => {
      const card = document.createElement('div');
      card.className = 'free-game-card';
      const thumb = escapeHtml(g.headerImage || PLACEHOLDER);
      const name = escapeHtml(g.name || 'Untitled');
      const desc = escapeHtml(g.shortDescription || 'No description available.');
      card.innerHTML = `<img src="${thumb}" alt="${name}" onerror="this.src='${PLACEHOLDER}'"/><div class="free-info"><h4>${name}</h4><p>${desc}</p></div>`;
      card.addEventListener('click', () => g.appid && window.open(`https://store.steampowered.com/app/${encodeURIComponent(g.appid)}`, '_blank'));
      frag.appendChild(card);
    });
    freeContainer.appendChild(frag);
  }

  document.addEventListener('datasetUploaded', () => {
    renderHome();
    renderFreeVertical();
  });
});
