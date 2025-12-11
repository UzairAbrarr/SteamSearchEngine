document.addEventListener('DOMContentLoaded', () => {
  const navButtons = Array.from(document.querySelectorAll('.nav-btn'));
  const pages = Array.from(document.querySelectorAll('.page'));

  function activatePage(pageId) {
    pages.forEach(p => {
      p.classList.toggle('active', p.id === 'page-' + pageId);
    });

    navButtons.forEach(b => {
      b.classList.toggle('active', b.getAttribute('data-page') === pageId);
    });
  }

  navButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const pageId = btn.getAttribute('data-page');
      activatePage(pageId);

      document.dispatchEvent(
        new CustomEvent('pageChanged', {
          detail: { page: pageId }
        })
      );
    });
  });

  window.setActivePage = function(pageId) {
    activatePage(pageId);
    document.dispatchEvent(
      new CustomEvent('pageChanged', {
        detail: { page: pageId }
      })
    );
  };
});
