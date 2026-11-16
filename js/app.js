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
    if (routeKey !== lastRoute && section === 'clientes' && id) Views.state.clientTab = 'resumen';

    let html;
    switch (section) {
      case 'clientes': html = id ? Views.renderClient(id) : Views.renderClients(); break;
      case 'agenda': html = Views.renderAgenda(); break;
      case 'pagos': html = Views.renderPayments(); break;
      case 'ajustes': html = Views.renderSettings(); break;
      default: html = Views.renderPanel();
    }
    const scroll = routeKey === lastRoute ? window.scrollY : 0;
    main.innerHTML = html;
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

  /** Marca (nombre e iniciales del entrenador), título y punto de avisos. */
  function updateChrome() {
    const name = Store.settings.trainerName || 'EntrenaPro';
    document.getElementById('brand-title').textContent = name;
    document.getElementById('brand-logo').textContent = U.initials(name);
    const labels = { panel: 'Panel', clientes: 'Clientes', agenda: 'Agenda', pagos: 'Pagos', ajustes: 'Ajustes' };
    document.title = `${labels[parseRoute().section] || 'Panel'} · ${name}`;
    document.getElementById('alert-dot').hidden = !Views.computeAlerts().length;
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
  });

  main.addEventListener('change', (e) => {
    const el = e.target;
    if (el.dataset.actionChange) {
      const fn = Views.actions[el.dataset.actionChange];
      if (fn) fn(el.dataset, el);
    } else if (el.id === 'import-file') {
      Views.importFile(el.files[0]);
      el.value = '';
    }
  });

  main.addEventListener('input', (e) => {
    if (e.target.id === 'client-search') Views.onClientSearch(e.target.value);
  });

  main.addEventListener('submit', (e) => {
    if (e.target.id === 'settings-form') {
      e.preventDefault();
      Views.saveSettings(e.target);
    }
  });

  window.addEventListener('hashchange', render);

  // Sincroniza cambios hechos en otra pestaña.
  window.addEventListener('storage', (e) => {
    if (e.key && e.key.startsWith('entrenapro:')) { Store.load(); applyTheme(); render(); }
  });

  window.App = { render, applyTheme };

  document.querySelectorAll('[data-icon]').forEach((el) => { el.innerHTML = U.icon(el.dataset.icon); });

  Store.load();
  applyTheme();
  render();
})();
