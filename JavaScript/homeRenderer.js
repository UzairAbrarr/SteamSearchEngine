document.addEventListener('DOMContentLoaded', async () => {
  const container = document.getElementById('home-categories');
  const freeContainer = document.getElementById('freeGamesList');
  const PLACEHOLDER = '/mnt/data/f84e3cff-c908-45f9-8373-2e034c71a892.png';
  const MAX_HOME_PER_CATEGORY = 12;
  const FREE_PAGE_SIZE = 10;

  let forwardIndex = [];

  async function loadDefaultDatasets() {
    const basePath = './PreDefinedJsonsFile/';
    try {
      const [fwd1Res, fwd2Res] = await Promise.all([
        fetch(basePath + 'forwardIndex_part1.json'),
        fetch(basePath + 'forwardIndex_part2.json')
      ]);
      const [fwd1, fwd2] = await Promise.all([fwd1Res.json(), fwd2Res.json()]);

      forwardIndex = [...fwd1, ...fwd2].map((d, idx) => {
        const g = {
          docId: idx,
          appid: String(d.appid || d.appId || d.id || '').trim(),
          name: String(d.name || d.title || '').trim(),
          shortDescription: String(d.short_description || d.shortDescription || d.description || '').trim(),
          headerImage: String(d.header_image || d.headerImage || d.image || d.header || '').trim(),
          metacriticScore: parseInt(d.metacritic_score || d.metacriticScore || 0, 10) || 0,
          recommendationsTotal: parseInt(d.recommendations_total || d.recommendationsTotal || d.recs || 0, 10) || 0,
          isFree: String(d.is_free || d.isFree || '').toLowerCase() === 'true' || Number(d.is_free || d.isFree || 0) === 1
        };
        return g;
      });

      // Precompute categories
      computeCategories();

      document.dispatchEvent(new Event('datasetUploaded'));
    } catch (e) {
      console.error(e);
      container.innerHTML = '<p class="small">Failed to load dataset.</p>';
    }
  }

  // Precompute category lists
  const definitions = [
    { name: 'Popular', filter: g => g.recommendationsTotal >= 5000, list: [] },
    { name: 'Free Games', filter: g => g.isFree === true, list: [] },
    { name: 'Top Metacritic', filter: g => g.metacriticScore >= 80, list: [] },
    { name: 'Sports', filter: g => /sports/i.test((g.name||'') + ' ' + (g.shortDescription||'')), list: [] },
    { name: 'Vehicle', filter: g => /vehicle|car|bike|cycle|racing/i.test((g.name||'') + ' ' + (g.shortDescription||'')), list: [] },
    { name: 'Horror', filter: g => /horror|zombi|zombie|scary|ghost/i.test((g.name||'') + ' ' + (g.shortDescription||'')), list: [] }
  ];

  function computeCategories() {
    definitions.forEach(def => {
      def.list = forwardIndex.filter(def.filter)
        .sort((a,b) => b.recommendationsTotal - a.recommendationsTotal)
        .slice(0, MAX_HOME_PER_CATEGORY);
    });
  }

  function escapeHtml(s) { return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

  function makeGameCard(g) {
    const wrapper = document.createElement(g.appid ? 'a' : 'div');
    if (g.appid) { wrapper.href = `https://store.steampowered.com/app/${g.appid}`; wrapper.target='_blank'; wrapper.rel='noopener noreferrer'; }
    wrapper.className = 'game-card';
    const thumb = g.headerImage || PLACEHOLDER;
    const name = escapeHtml(g.name || 'Untitled');
    const short = escapeHtml(g.shortDescription || 'No description available.');
    wrapper.innerHTML = `
      <div class="thumb" style="background-image:url('${thumb}')"></div>
      <div class="meta"><div><h4>${name}</h4><p>${short}</p></div><div><span class="price-badge">${g.isFree?'Free':''}</span></div></div>
      <div class="hover-box" aria-hidden="true"><h4>${name}</h4><p>${short}</p></div>
    `;
    return wrapper;
  }

  function renderHome() {
    container.innerHTML = '';
    const frag = document.createDocumentFragment();
    definitions.forEach(def => {
      if (!def.list.length) return;
      const section = document.createElement('div');
      section.className = 'home-category';
      section.innerHTML = `<div class="category-head"><h3>${def.name.toUpperCase()}</h3></div>`;
      const scroller = document.createElement('div');
      scroller.className = 'home-games';
      def.list.forEach(g => scroller.appendChild(makeGameCard(g)));
      section.appendChild(scroller);
      frag.appendChild(section);
    });
    container.appendChild(frag);
  }

  function renderFreeVertical(page = 1, perPage = FREE_PAGE_SIZE) {
    freeContainer.innerHTML = '';
    const freeGames = forwardIndex.filter(g => g.isFree);
    const start = (page-1)*perPage, end = start+perPage;
    const frag = document.createDocumentFragment();
    freeGames.slice(start,end).forEach(g => {
      const card = document.createElement('div');
      card.className = 'free-game-card';
      const thumb = escapeHtml(g.headerImage || PLACEHOLDER);
      const name = escapeHtml(g.name || 'Untitled');
      const desc = escapeHtml(g.shortDescription || 'No description available.');
      card.innerHTML = `<img src="${thumb}" alt="${name}" onerror="this.src='${PLACEHOLDER}'"/><div class="free-info"><h4>${name}</h4><p>${desc}</p></div>`;
      card.addEventListener('click', () => g.appid && window.open(`https://store.steampowered.com/app/${g.appid}`,'_blank'));
      frag.appendChild(card);
    });
    freeContainer.appendChild(frag);
  }

  document.addEventListener('datasetUploaded', () => {
    renderHome();
    renderFreeVertical();
  });

  loadDefaultDatasets();
});
