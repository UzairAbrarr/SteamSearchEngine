// homeRenderer.js
// Renders Steam-like horizontal carousels and shows a hover box with description.

document.addEventListener('DOMContentLoaded', () => {
  const container = document.getElementById('home-categories');
  const PLACEHOLDER = '/mnt/data/f84e3cff-c908-45f9-8373-2e034c71a892.png';

  function escapeHtml(s) {
    return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  function makeCard(game) {
    const hasAppid = game && game.appid && String(game.appid).trim().length > 0;
    const link = hasAppid ? `https://store.steampowered.com/app/${encodeURIComponent(game.appid)}` : null;
    const wrapper = document.createElement(hasAppid ? 'a' : 'div');
    if (hasAppid) {
      wrapper.setAttribute('href', link);
      wrapper.setAttribute('target', '_blank');
      wrapper.setAttribute('rel', 'noopener noreferrer');
    }
    wrapper.className = 'game-card';

    const thumbUrl = (game.headerImage && game.headerImage.trim()) ? escapeHtml(game.headerImage) : PLACEHOLDER;

    // full description for hover (use shortDescription fallback)
    const fullDesc = (game.shortDescription || '').trim() || 'No description available.';

    wrapper.innerHTML = `
      <div class="thumb" style="background-image:url('${thumbUrl}')"></div>
      <div class="meta">
        <div>
          <h4>${escapeHtml(game.name || 'Untitled')}</h4>
          <p>${escapeHtml((game.shortDescription || '').substring(0,90))}</p>
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
    head.innerHTML = `<h3>${escapeHtml(title)}</h3><div class="category-controls"></div>`;
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

    // dots logic
    function updateDots() {
      dots.innerHTML = '';
      const cards = scroller.querySelectorAll('.game-card');
      if (!cards.length) return;
      const cardWidth = cards[0].offsetWidth + 12;
      const visible = Math.max(1, Math.floor(scroller.clientWidth / cardWidth));
      const pages = Math.ceil(cards.length / visible);
      for (let p=0;p<pages;p++){
        const b = document.createElement('button');
        b.addEventListener('click', () => {
          scroller.scrollLeft = p * visible * cardWidth;
        });
        dots.appendChild(b);
      }
      const activePage = Math.round(scroller.scrollLeft / (Math.max(1, visible) * cardWidth));
      Array.from(dots.children).forEach((btn,i) => btn.classList.toggle('active', i===activePage));
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

    const definitions = [
      { name: 'Popular', filter: g => Number(g.recommendationsTotal || 0) >= 5000 },
      { name: 'Free Games', filter: g => Boolean(g.isFree) === true },
      { name: 'Top Metacritic', filter: g => Number(g.metacriticScore || 0) >= 80 },
      { name: 'Sports', filter: g => /sports/i.test((g.name||'') + ' ' + (g.shortDescription||'')) },
      { name: 'Vehicle', filter: g => /vehicle|car|bike|cycle|racing/i.test((g.name||'') + ' ' + (g.shortDescription||'')) },
      { name: 'Horror', filter: g => /horror|zombi|zombie|scary|ghost/i.test((g.name||'') + ' ' + (g.shortDescription||'')) }
    ];

    for (const def of definitions) {
      const games = window.forwardIndex.filter(def.filter);
      if (!games || games.length === 0) continue;
      const sorted = games.slice().sort((a,b)=> (b.recommendationsTotal||0)-(a.recommendationsTotal||0)).slice(0,24);
      const section = createCarousel(def.name.toUpperCase(), sorted);
      container.appendChild(section);
    }
  }

  document.addEventListener('datasetUploaded', () => {
    document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
    const home = document.getElementById('page-home'); if (home) home.classList.add('active');
    renderAllCategories();
  });

  // initial render
  renderAllCategories();
});
