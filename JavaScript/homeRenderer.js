// homeRenderer.js
// Renders Steam-like horizontal carousels for categories.
// Uses event 'datasetUploaded' dispatched by uploadHandler.

document.addEventListener('DOMContentLoaded', () => {
  const container = document.getElementById('home-categories');
  const PLACEHOLDER = '/mnt/data/f84e3cff-c908-45f9-8373-2e034c71a892.png'; // your uploaded placeholder asset

  function makeCard(game) {
    const div = document.createElement('div');
    div.className = 'game-card';

    const thumbUrl = game.headerImage && game.headerImage.trim() ? escapeHtml(game.headerImage) : PLACEHOLDER;

    div.innerHTML = `
      <div class="thumb" style="background-image:url('${thumbUrl}')" ></div>
      <div class="meta">
        <div>
          <h4>${escapeHtml(game.name || 'Untitled')}</h4>
          <p>${escapeHtml((game.shortDescription || '').substring(0,90))}</p>
        </div>
        <div>
          <span class="price-badge">${game.isFree ? 'Free' : ('$' + (game.recommendationsTotal ? '' : '...'))}</span>
        </div>
      </div>
    `;
    return div;
  }

  function escapeHtml(s) {
    return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  function createCarousel(title, games, idx) {
    const section = document.createElement('div');
    section.className = 'home-category';

    const head = document.createElement('div');
    head.className = 'category-head';
    head.innerHTML = `<h3>${escapeHtml(title)}</h3>
      <div class="category-controls">
        <div class="cat-arrow left" data-target="${idx}">&lsaquo;</div>
        <div class="cat-arrow right" data-target="${idx}">&rsaquo;</div>
      </div>`;
    section.appendChild(head);

    const carousel = document.createElement('div');
    carousel.className = 'carousel';

    const scroller = document.createElement('div');
    scroller.className = 'home-games';
    scroller.setAttribute('data-cat-index', idx);

    // create cards
    for (const g of games) {
      scroller.appendChild(makeCard(g));
    }

    // dots
    const dots = document.createElement('div');
    dots.className = 'carousel-dots';

    // calculate pages by width: estimate visible per page based on container width later
    section.appendChild(carousel);
    carousel.appendChild(scroller);
    carousel.appendChild(dots);

    // arrow handlers
    const left = head.querySelector('.cat-arrow.left');
    const right = head.querySelector('.cat-arrow.right');
    left.addEventListener('click', () => scrollCarousel(scroller, -1));
    right.addEventListener('click', () => scrollCarousel(scroller, 1));

    // update dots on scroll
    function updateDots() {
      // compute page count based on card width and scroller visible width
      const cards = scroller.querySelectorAll('.game-card');
      if (!cards.length) return;
      const cardWidth = cards[0].offsetWidth + 12; // includes gap
      const visible = Math.max(1, Math.floor(scroller.clientWidth / cardWidth));
      const pages = Math.ceil(cards.length / visible);
      dots.innerHTML = '';
      for (let p = 0; p < pages; p++) {
        const b = document.createElement('button');
        b.addEventListener('click', () => {
          scroller.scrollLeft = p * visible * cardWidth;
        });
        dots.appendChild(b);
      }
      // set active dot
      const scrollLeft = scroller.scrollLeft;
      const activePage = Math.round(scrollLeft / (visible * cardWidth));
      const buttons = dots.querySelectorAll('button');
      buttons.forEach((bb,i)=> bb.classList.toggle('active', i === activePage));
    }

    // when images load sizes may change -> update dots after short delay
    setTimeout(updateDots, 80);
    window.addEventListener('resize', () => setTimeout(updateDots, 60));
    scroller.addEventListener('scroll', () => setTimeout(updateDots, 30));

    return section;
  }

  function scrollCarousel(scroller, direction) {
    // scroll by 80% of visible width
    const amount = Math.floor(scroller.clientWidth * 0.8);
    scroller.scrollBy({ left: direction * amount, behavior: 'smooth' });
  }

  function renderAllCategories() {
    container.innerHTML = '';
    if (!window.forwardIndex || window.forwardIndex.length === 0) {
      container.innerHTML = '<p class="small">No games uploaded yet. Upload a dataset to see categories.</p>';
      return;
    }

    // category definitions (you can adjust thresholds)
    const definitions = [
      { name: 'Popular', filter: g => Number(g.recommendationsTotal || 0) >= 5000 },
      { name: 'Free Games', filter: g => Boolean(g.isFree) === true },
      { name: 'Top Metacritic', filter: g => Number(g.metacriticScore || 0) >= 80 },
      { name: 'Sports', filter: g => /sports/i.test((g.name||'') + ' ' + (g.shortDescription||'')) },
      { name: 'Vehicle', filter: g => /vehicle|car|bike|cycle|racing/i.test((g.name||'') + ' ' + (g.shortDescription||'')) },
      { name: 'Horror', filter: g => /horror|zombi|zombie|scary|ghost/i.test((g.name||'') + ' ' + (g.shortDescription||'')) }
    ];

    // for each definition gather up to 20 items
    for (const def of definitions) {
      const games = window.forwardIndex.filter(def.filter);
      if (!games || games.length === 0) continue;
      // take top 12 sorted by recommendations (fallback)
      const sorted = games.slice().sort((a,b) => (b.recommendationsTotal||0) - (a.recommendationsTotal||0)).slice(0, 24);
      const section = createCarousel(def.name.toUpperCase(), sorted, Math.random().toString(36).slice(2,8));
      container.appendChild(section);
    }
  }

  // escape helper already above; event hook
  document.addEventListener('datasetUploaded', () => {
    // switch to home page (keeps your nav logic intact)
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    const home = document.getElementById('page-home');
    if (home) home.classList.add('active');

    renderAllCategories();
  });

  // initial render if data exists
  renderAllCategories();
});
