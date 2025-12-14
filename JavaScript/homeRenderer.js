// homeRenderer.optimized.js
// Fast home renderer using DSA concepts: heaps (top-K), maps, sets, inverted-index lookups,
// and batched DOM rendering (requestAnimationFrame).
document.addEventListener('DOMContentLoaded', () => {
  const container = document.getElementById('home-categories');
  const freeContainer = document.getElementById('freeGamesList');
  const PLACEHOLDER = '/mnt/data/f84e3cff-c908-45f9-8373-2e034c71a892.png';
  const MAX_HOME_PER_CATEGORY = 12;
  const FREE_PAGE_SIZE = 10;
  const BATCH_SIZE = 200; // DOM items appended per animation frame (tune if needed)

  // --- small utilities ---
  const escapeHtml = s => String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  const barrelForTerm = term => {
    if (!term || term.length === 0) return '_';
    const c = term[0].toLowerCase();
    return (c >= 'a' && c <= 'z') ? c : '_';
  };

  // --- minimal binary min-heap to maintain top-K by numeric key ---
  function topKBy(arr, keyFn, k) {
    if (k <= 0) return [];
    const heap = []; // min-heap implemented as array; heap[0] = smallest
    const push = (item, val) => {
      heap.push({item, val});
      let i = heap.length - 1;
      while (i > 0) {
        const p = Math.floor((i - 1) / 2);
        if (heap[p].val <= heap[i].val) break;
        [heap[p], heap[i]] = [heap[i], heap[p]];
        i = p;
      }
    };
    const pop = () => {
      const top = heap[0];
      const last = heap.pop();
      if (heap.length) {
        heap[0] = last;
        let i = 0;
        while (true) {
          const l = 2 * i + 1;
          const r = 2 * i + 2;
          let smallest = i;
          if (l < heap.length && heap[l].val < heap[smallest].val) smallest = l;
          if (r < heap.length && heap[r].val < heap[smallest].val) smallest = r;
          if (smallest === i) break;
          [heap[i], heap[smallest]] = [heap[smallest], heap[i]];
          i = smallest;
        }
      }
      return top;
    };

    for (let i = 0; i < arr.length; i++) {
      const item = arr[i];
      const val = +keyFn(item) || 0;
      if (heap.length < k) {
        push(item, val);
      } else if (val > heap[0].val) {
        // replace min
        heap[0] = {item, val};
        // heapify down
        let idx = 0;
        while (true) {
          const l = 2 * idx + 1;
          const r = 2 * idx + 2;
          let smallest = idx;
          if (l < heap.length && heap[l].val < heap[smallest].val) smallest = l;
          if (r < heap.length && heap[r].val < heap[smallest].val) smallest = r;
          if (smallest === idx) break;
          [heap[idx], heap[smallest]] = [heap[smallest], heap[idx]];
          idx = smallest;
        }
      }
    }
    // extract sorted descending
    const res = [];
    while (heap.length) res.push(pop().item);
    return res.reverse();
  }

  // --- DOM helpers (lightweight) ---
  function makeGameCardHtml(g) {
    const thumb = escapeHtml(g.headerImage || PLACEHOLDER);
    const name = escapeHtml(g.name || 'Untitled');
    const short = escapeHtml(g.shortDescription || 'No description available.');
    const price = g.isFree ? 'Free' : '';
    const href = g.appid ? `href="https://store.steampowered.com/app/${encodeURIComponent(g.appid)}" target="_blank" rel="noopener noreferrer"` : '';
    return `<${g.appid ? 'a' : 'div'} ${href} class="game-card">
      <div class="thumb" style="background-image:url('${thumb}')"></div>
      <div class="meta"><div><h4>${name}</h4><p>${short}</p></div><div><span class="price-badge">${price}</span></div></div>
      <div class="hover-box" aria-hidden="true"><h4>${name}</h4><p>${short}</p></div>
    </${g.appid ? 'a' : 'div'}>`;
  }

  function makeSectionHtml(title, itemsHtml) {
    return `<div class="home-category">
      <div class="category-head"><h3>${escapeHtml(title)}</h3><div class="category-controls"></div></div>
      <div class="home-games">${itemsHtml}</div>
      <div class="carousel-dots"></div>
    </div>`;
  }

  // --- global caches and maps ---
  let forwardIndex = [];       // array of docs (no heavy transforms)
  let docById = new Map();     // docId (string or number) -> doc
  let freeDocs = [];           // array refs to free docs
  let categoryCache = {};      // precomputed arrays for categories
  let invertedIndex = {};      // loaded inverted index (kept as-is)
  let lexicon = {};            // loaded lexicon (kept as-is)

  // --- load final files (parallel) ---
  async function loadFinalDatasets() {
    const base = './PreDefinedJsonsFile/';
    try {
      const [lexR, invR, f1R, f2R] = await Promise.all([
        fetch(base + 'lexicon.json'), fetch(base + 'invertedIndex.json'),
        fetch(base + 'forwardIndex_part1.json'), fetch(base + 'forwardIndex_part2.json')
      ]);
      lexicon = await lexR.json();
      invertedIndex = await invR.json();
      const f1 = await f1R.json();
      const f2 = await f2R.json();

      // forwardIndex is final - don't "normalize" again. Just add docId index for lookup.
      forwardIndex = [...f1, ...f2];
      for (let i = 0; i < forwardIndex.length; ++i) {
        const d = forwardIndex[i];
        // prefer existing docId if present else assign index as string
        const id = (d.docId !== undefined && d.docId !== null) ? String(d.docId) : String(i);
        docById.set(id, d);
        // also set a stable small id for invertedIndex style numeric strings (if you rely on numeric indices)
        d._fastId = id;
      }

      // quick sets / lists
      freeDocs = forwardIndex.filter(g => g && (g.isFree === true || String(g.isFree).toLowerCase() === 'true' || Number(g.isFree || 0) === 1));

      // precompute numeric top-K using heap -> O(n log k)
      categoryCache.Popular = topKBy(forwardIndex, g => g.recommendationsTotal || 0, MAX_HOME_PER_CATEGORY);
      categoryCache.TopMetacritic = topKBy(forwardIndex, g => g.metacriticScore || 0, MAX_HOME_PER_CATEGORY);
      // Free - take top by recommendations so popular free appear first
      categoryCache.FreeGames = topKBy(freeDocs, g => g.recommendationsTotal || 0, MAX_HOME_PER_CATEGORY);

      // keyword categories - use invertedIndex to get docId sets fast (union sets)
      const keywordGroups = {
        Sports: ['sports', 'sport'],
        Vehicle: ['vehicle','car','bike','cycle','racing'],
        Horror: ['horror','zombi','zombie','scary','ghost']
      };

      for (const [cat, keywords] of Object.entries(keywordGroups)) {
        const ids = new Set();
        for (const kw of keywords) {
          const barrel = barrelForTerm(kw);
          const barrelObj = invertedIndex[barrel];
          if (!barrelObj) continue;
          const termSetOrArr = barrelObj[kw];
          if (!termSetOrArr) continue;
          // termSetOrArr might be an array of ids or object; handle common shapes
          if (Array.isArray(termSetOrArr)) {
            for (const id of termSetOrArr) ids.add(String(id));
          } else if (termSetOrArr instanceof Object && typeof termSetOrArr.size === 'number') {
            // unlikely, but if it's a Set-like, iterate
            for (const id of termSetOrArr) ids.add(String(id));
          } else {
            // if it's an object keyed by docId -> true
            for (const id of Object.keys(termSetOrArr)) ids.add(String(id));
          }
        }
        // map ids -> docs, then top-K by recommendations
        const docs = [];
        for (const id of ids) {
          const doc = docById.get(id);
          if (doc) docs.push(doc);
        }
        categoryCache[cat] = topKBy(docs, g => g.recommendationsTotal || 0, MAX_HOME_PER_CATEGORY);
      }

      // done, trigger render
      document.dispatchEvent(new Event('datasetUploaded'));
    } catch (err) {
      console.error('Failed to load final datasets', err);
      container.innerHTML = '<p class="small">Failed to load dataset.</p>';
    }
  }

  // --- batched DOM rendering helpers ---
  function appendSectionHtmlBatched(parent, sectionHtml, startIndex = 0) {
    // append entire section HTML in one go -- fastest method
    parent.insertAdjacentHTML('beforeend', sectionHtml);
  }

  // Render home: only uses categoryCache (no re-filter, no re-sort)
  function renderHome() {
    container.innerHTML = ''; // single wipe
    const categories = [
      { key: 'Popular', label: 'Popular' },
      { key: 'FreeGames', label: 'Free Games' },
      { key: 'TopMetacritic', label: 'Top Metacritic' },
      { key: 'Sports', label: 'Sports' },
      { key: 'Vehicle', label: 'Vehicle' },
      { key: 'Horror', label: 'Horror' }
    ];

    // build HTML strings for all categories (fast string concat), but append in frames
    const sectionsHtml = [];
    for (const c of categories) {
      const items = categoryCache[c.key] || [];
      if (!items.length) continue;
      // create HTML for up to MAX_HOME_PER_CATEGORY items (categoryCache already limited)
      let itemsHtml = '';
      for (let i = 0; i < items.length; ++i) itemsHtml += makeGameCardHtml(items[i]);
      sectionsHtml.push(makeSectionHtml(c.label.toUpperCase(), itemsHtml));
    }

    // append each section using requestAnimationFrame to avoid blocking long inserts on large DOM
    let i = 0;
    function frameAppend() {
      const chunk = sectionsHtml.slice(i, i + 1); // append one section per frame (tunable)
      for (const sHtml of chunk) appendSectionHtmlBatched(container, sHtml);
      i += chunk.length;
      if (i < sectionsHtml.length) requestAnimationFrame(frameAppend);
      else {
        // after DOM ready, lazy-init small UI stuff (carousel dots etc) if needed
        // (keep this minimal)
      }
    }
    frameAppend();
  }

  // Free vertical list: render first page quickly, lazy-load pages on demand
  function renderFreeVertical(page = 1, perPage = FREE_PAGE_SIZE) {
    freeContainer.innerHTML = '';
    if (!freeDocs || freeDocs.length === 0) {
      freeContainer.innerHTML = '<p class="small">No free games in dataset.</p>';
      return;
    }
    const start = (page - 1) * perPage;
    const end = Math.min(start + perPage, freeDocs.length);
    let html = '';
    for (let i = start; i < end; ++i) html += `<div class="free-game-card" data-idx="${i}"><img src="${escapeHtml(freeDocs[i].headerImage || PLACEHOLDER)}" alt="${escapeHtml(freeDocs[i].name||'Untitled')}" onerror="this.src='${PLACEHOLDER}'"/><div class="free-info"><h4>${escapeHtml(freeDocs[i].name||'Untitled')}</h4><p>${escapeHtml(freeDocs[i].shortDescription||'No description available.')}</p></div></div>`;
    freeContainer.insertAdjacentHTML('beforeend', html);

    // simple pager (fast)
    const totalPages = Math.ceil(freeDocs.length / perPage);
    if (totalPages <= 1) return;
    const pager = document.createElement('div');
    pager.className = 'free-pager';
    // show limited pager buttons to avoid heavy DOM
    const pageWindow = 7;
    let startPage = Math.max(1, page - Math.floor(pageWindow / 2));
    let endPage = Math.min(totalPages, startPage + pageWindow - 1);
    if (endPage - startPage + 1 < pageWindow) startPage = Math.max(1, endPage - pageWindow + 1);

    if (page > 1) {
      const p = document.createElement('button'); p.textContent = '<'; p.addEventListener('click', () => renderFreeVertical(page - 1, perPage)); pager.appendChild(p);
    }
    for (let pnum = startPage; pnum <= endPage; ++pnum) {
      const b = document.createElement('button'); b.textContent = pnum; if (pnum === page) b.classList.add('active');
      b.addEventListener('click', () => renderFreeVertical(pnum, perPage));
      pager.appendChild(b);
    }
    if (page < totalPages) {
      const p = document.createElement('button'); p.textContent = '>'; p.addEventListener('click', () => renderFreeVertical(page + 1, perPage)); pager.appendChild(p);
    }
    freeContainer.appendChild(pager);
  }

  // event delegation for click on game cards in home/free lists
  document.body.addEventListener('click', (ev) => {
    // example: handle clicking a free-game-card to open store if appid available
    const fc = ev.target.closest('.free-game-card');
    if (fc) {
      const idx = Number(fc.getAttribute('data-idx'));
      if (!Number.isNaN(idx) && freeDocs[idx] && freeDocs[idx].appid) {
        window.open(`https://store.steampowered.com/app/${encodeURIComponent(freeDocs[idx].appid)}`, '_blank');
      }
    }
  });

  // dataset uploaded -> render
  document.addEventListener('datasetUploaded', () => {
    // switch page UI like upload handler expects
    if (typeof window.setActivePage === 'function') window.setActivePage('home');
    else {
      document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
      document.getElementById('page-home')?.classList.add('active');
      document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
      document.querySelector('.nav-btn[data-page="home"]')?.classList.add('active');
    }
    // render minimal first screen fast
    renderHome();
    renderFreeVertical(1, FREE_PAGE_SIZE);
  });

  // start load
  loadFinalDatasets();
});
