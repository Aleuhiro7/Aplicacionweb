/* Arranque, enrutado por hash y delegación de eventos. */
(function () {
  'use strict';

  const main = document.getElementById('app');
  const shell = document.querySelector('.layout');
  let lastRoute = '';

  function parseRoute() {
    const parts = (location.hash.replace(/^#\/?/, '') || 'panel').split('/');
    return { section: parts[0], id: parts[1] };
  }

  function render() {
    const { section, id } = parseRoute();
    const routeKey = section + '/' + (id || '');
    if (routeKey !== lastRoute && section === 'clientes' && id && !Views.state.keepTab) Views.state.clientTab = 'resumen';
    Views.state.keepTab = false;
    if (section !== 'biblioteca') Views.state.pick = null; // salir de la biblioteca cancela la elección de ejercicio

    let html;
    switch (section) {
      case 'clientes': html = id ? Views.renderClient(id) : Views.renderClients(); break;
      case 'pagos': html = Views.renderPayments(); break;
      case 'biblioteca': html = Views.renderLibrary(); break;
      case 'alimentos': html = Views.renderFoods(); break;
      case 'formularios': html = Views.renderForms(); break;
      case 'ajustes': html = Views.renderSettings(); break;
      default: html = Views.renderPanel();
    }
    const scroll = routeKey === lastRoute ? window.scrollY : 0;
    main.innerHTML = html;
    if (window.Photos) Photos.hydrate(main);
    window.scrollTo(0, scroll);
    if (routeKey !== lastRoute) main.focus({ preventScroll: true });
    lastRoute = routeKey;

    updateChrome();
    document.querySelectorAll('.sidebar a[data-nav]').forEach((a) => {
      a.classList.toggle('active', a.dataset.nav === (section || 'panel'));
      if (a.dataset.nav === section) a.setAttribute('aria-current', 'page');
      else a.removeAttribute('aria-current');
    });
  }

  /** Título de la pestaña. */
  function updateChrome() {
    const labels = { panel: 'Panel', clientes: 'Clientes', pagos: 'Pagos', biblioteca: 'Biblioteca', alimentos: 'Alimentos', formularios: 'Formularios', ajustes: 'Ajustes' };
    document.title = `${labels[parseRoute().section] || 'Panel'} · David Orihuela Entrenador Online`;
  }

  function applyTheme() {
    const theme = Store.settings.theme;
    if (theme === 'light' || theme === 'dark') document.documentElement.dataset.theme = theme;
    else delete document.documentElement.dataset.theme;
  }

  /* ---------- Delegación de eventos ---------- */
  shell.addEventListener('click', (e) => {
    const actionEl = e.target.closest('[data-action]');
    if (actionEl) {
      const fn = Views.actions[actionEl.dataset.action];
      if (fn) {
        e.preventDefault();
        e.stopPropagation();
        fn(actionEl.dataset, actionEl);
      }
      return;
    }
    if (e.target.closest('a, button, input, select, label')) return;
    const row = e.target.closest('[data-href]');
    if (row) location.hash = row.dataset.href;
  });

  main.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    const row = e.target.closest('[data-href]');
    if (row && e.target === row) location.hash = row.dataset.href;
    if (e.target.matches('label[for="import-file"]')) document.getElementById('import-file').click();
    if (e.target.matches('label[for="photo-input"]')) document.getElementById('photo-input').click();
  });

  main.addEventListener('change', (e) => {
    const el = e.target;
    if (el.dataset.actionChange) {
      const fn = Views.actions[el.dataset.actionChange];
      if (fn) fn(el.dataset, el);
    } else if (el.id === 'photo-input') {
      Views.uploadPhotos(el);
    } else if (el.id === 'import-file') {
      Views.importFile(el.files[0]);
      el.value = '';
    }
  });

  main.addEventListener('input', (e) => {
    if (e.target.id === 'client-search') Views.onClientSearch(e.target.value);
    if (e.target.id === 'library-search') Views.onLibrarySearch(e.target.value);
    if (e.target.id === 'food-search') Views.onFoodSearch(e.target.value);
  });

  main.addEventListener('submit', (e) => {
    if (e.target.id === 'questionnaire-form') {
      e.preventDefault();
      Views.saveQuestionnaire(e.target);
      return;
    }
    if (e.target.classList.contains('diet-form')) {
      e.preventDefault();
      Views.submitDietForm(e.target);
      return;
    }
    if (e.target.classList.contains('task-form')) {
      e.preventDefault();
      Views.submitTaskForm(e.target);
      return;
    }
    if (e.target.classList.contains('pay-form')) {
      e.preventDefault();
      Views.submitPayForm(e.target);
      return;
    }
    if (e.target.id === 'settings-form') {
      e.preventDefault();
      Views.saveSettings(e.target);
    }
  });

  /* ---------- Menú lateral en móvil (se abre desde la derecha) ---------- */
  function setMenu(open) {
    document.body.classList.toggle('menu-open', open);
    document.querySelector('.menu-btn')?.setAttribute('aria-expanded', String(open));
  }
  document.addEventListener('click', (e) => {
    const t = e.target.closest('[data-menu]');
    if (t) { setMenu(t.dataset.menu === 'open'); return; }
    if (e.target.closest('.sidebar a')) setMenu(false);
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') setMenu(false); });

  window.addEventListener('hashchange', () => { setMenu(false); render(); });

  // Sincroniza cambios hechos en otra pestaña.
  window.addEventListener('storage', (e) => {
    if (e.key && e.key.startsWith('entrenapro:')) { Store.load(); applyTheme(); render(); }
  });

  window.App = { render, applyTheme };

  document.querySelectorAll('[data-icon]').forEach((el) => { el.innerHTML = U.icon(el.dataset.icon); });

  Store.load();
  applyTheme();
  render();
  Views.notifyDue();

  /* Mantiene el saludo al día si la app se queda abierta o se vuelve a ella más tarde. */
  function refreshGreeting() {
    const el = document.querySelector('[data-greeting]');
    if (!el) return;
    const busy = document.getElementById('modal').open || document.querySelector('.pay-form');
    if (el.dataset.day !== U.today() && !busy) { render(); Views.notifyDue(); return; }
    const text = Views.greetingText();
    if (el.textContent !== text) el.textContent = text;
  }
  setInterval(refreshGreeting, 60 * 1000);
  // Respuestas de cuestionarios enviados por enlace: se comprueban cada pocos minutos y al volver a la app.
  setInterval(() => { if (!document.hidden) Views.checkQuestionnaireLinks(); }, 3 * 60 * 1000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) Views.checkQuestionnaireLinks(); });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) refreshGreeting(); });
  window.addEventListener('focus', refreshGreeting);

  /* Actualización automática: si la web publicada tiene una versión más nueva que la que
   * muestra el navegador (copia guardada), se recarga con la nueva sin perder los datos. */
  const currentVersion = (document.querySelector('script[src*="app.js?v="]')?.getAttribute('src') || '').split('v=')[1] || '';
  async function checkForUpdate() {
    if (location.protocol === 'file:' || !currentVersion) return;
    try {
      const res = await fetch(`${location.pathname}?nocache=${Date.now()}`, { cache: 'no-store' });
      if (!res.ok) return;
      const html = await res.text();
      const m = html.match(/app\.js\?v=([\w.\-]+)/);
      if (m && m[1] !== currentVersion) {
        const busy = document.getElementById('modal').open;
        if (busy) return;
        location.replace(`${location.pathname}?v=${encodeURIComponent(m[1])}${location.hash}`);
      }
    } catch (e) { /* sin conexión: se comprueba la próxima vez */ }
  }
  setTimeout(checkForUpdate, 1500);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) checkForUpdate(); });
})();
