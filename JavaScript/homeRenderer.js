// homeRenderer.js
document.addEventListener('DOMContentLoaded', () => {
  const homeContainer = document.getElementById('home-categories');

  if (!homeContainer) {
    console.error('[homeRenderer] Home container not found!');
    return;
  }

  // Define categories based on simple rules
  const CATEGORY_RULES = {
    "Popular Games": game => game.recommendationsTotal > 1000,
    "Free Games": game => game.isFree,
    "Metacritic Hits": game => game.metacriticScore >= 80,
    "Sports": game => /sports/i.test(game.name + " " + game.shortDescription),
    "Vehicle": game => /car|vehicle|bike|cycle|racing/i.test(game.name + " " + game.shortDescription),
    "Horror": game => /horror|scary|zombie|ghost/i.test(game.name + " " + game.shortDescription)
  };

  // Render a single category
  function renderCategory(title, games) {
    if (!games || games.length === 0) return;

    const catDiv = document.createElement('div');
    catDiv.className = 'home-category';

    const h3 = document.createElement('h3');
    h3.textContent = title;
    catDiv.appendChild(h3);

    const gamesDiv = document.createElement('div');
    gamesDiv.className = 'home-games';

    games.forEach(game => {
      const card = document.createElement('div');
      card.className = 'home-game-card';
      card.title = game.name;

      const img = document.createElement('img');
      img.src = game.headerImage || 'https://via.placeholder.com/150x70?text=No+Image';
      img.alt = game.name;
      card.appendChild(img);

      const nameDiv = document.createElement('div');
      nameDiv.textContent = game.name;
      nameDiv.style.fontSize = '14px';
      nameDiv.style.fontWeight = '600';
      nameDiv.style.marginTop = '4px';
      card.appendChild(nameDiv);

      gamesDiv.appendChild(card);
    });

    catDiv.appendChild(gamesDiv);
    homeContainer.appendChild(catDiv);
  }

  // Clear existing home page
  function clearHome() {
    homeContainer.innerHTML = '';
  }

  // Render all categories from forwardIndex
  async function renderHome() {
    clearHome();

    if (!window.forwardIndex || window.forwardIndex.length === 0) {
      homeContainer.innerHTML = '<p class="small">No games uploaded yet. Upload a dataset to see categories.</p>';
      return;
    }

    // Barrel rendering to avoid freezing UI
    const CHUNK_SIZE = 200; // Adjust based on dataset size
    const totalGames = window.forwardIndex.length;

    for (let i = 0; i < totalGames; i += CHUNK_SIZE) {
      const chunk = window.forwardIndex.slice(i, i + CHUNK_SIZE);

      // For each category, filter games
      for (let [catName, rule] of Object.entries(CATEGORY_RULES)) {
        const filteredGames = chunk.filter(rule);
        if (filteredGames.length > 0) {
          renderCategory(catName, filteredGames);
        }
      }

      await new Promise(r => setTimeout(r, 10)); // Yield to UI
    }
  }

  // Listen for dataset upload completion
  document.addEventListener('datasetUploaded', () => {
    console.log('[homeRenderer] Dataset uploaded, rendering home page...');
    renderHome();
  });

  // Initial render
  renderHome();
});
