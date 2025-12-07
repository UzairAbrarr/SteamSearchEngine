// Handles page switching
document.addEventListener('DOMContentLoaded', () => {
  const navButtons = Array.from(document.querySelectorAll('.nav-btn'));
  const pages = Array.from(document.querySelectorAll('.page'));

  navButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const pageId = btn.getAttribute('data-page');
      pages.forEach(p => p.classList.toggle('active', p.id === 'page-' + pageId));
      navButtons.forEach(b => b.classList.toggle('active', b === btn));
    });
  });
});



