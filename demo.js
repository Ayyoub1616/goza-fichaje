(function () {
  'use strict';
  const STORAGE = 'goza-demo-v3';
  const SESSION = 'goza-demo-view';
  const APP = document.getElementById('app');
  const zone = 'Europe/Madrid';
  const defaults = () => ({
    employees: [{ id: 'GOZA-001', name: 'Empleado 001', active: true }, { id: 'GOZA-002', name: 'Empleado 002', active: true }],
    shifts: [], incidents: [], events: []
  });
  let state;
  try { state = JSON.parse(localStorage.getItem(STORAGE)) || defaults(); } catch { state = defaults(); }
  if (!Array.isArray(state.employees) || !Array.isArray(state.shifts) || !Array.isArray(state.incidents)) state = defaults();
  state.events ||= [];
  let mode = sessionStorage.getItem(SESSION) || 'welcome';
  let selectedEmployee = sessionStorage.getItem('goza-demo-employee') || 'GOZA-001';
  let adminTab = 'overview';
  let filters = { from: '', to: '', employee: 'all' };
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const nowISO = () => new Date().toISOString();
  const id = () => typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random();
  const day = (t = new Date()) => new Intl.DateTimeFormat('sv-SE', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(t));
  const fmt = t => t ? new Date(t).toLocaleString('es-ES', { timeZone: zone, dateStyle: 'short', timeStyle: 'short' }) : '—';
  const time = t => new Date(t).toLocaleTimeString('es-ES', { timeZone: zone, hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const totalMs = s => Math.max(0, new Date(s.end || nowISO()) - new Date(s.start) - (s.pauseMs || 0) - (s.pauseStart ? new Date() - new Date(s.pauseStart) : 0));
  const hours = s => (totalMs(s) / 3600000).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const mins = s => Math.floor(totalMs(s) / 60000);
  const employee = id => state.employees.find(e => e.id === id);
  const current = id => state.shifts.find(s => s.employeeId === id && !s.end);
  const save = () => { try { localStorage.setItem(STORAGE, JSON.stringify(state)); return true; } catch { alert('No se puede guardar la demostración en este navegador.'); return false; } };
  const setMode = (next) => { mode = next; sessionStorage.setItem(SESSION, next); render(); };
  const toast = (message) => { const e = document.getElementById('toast'); if (e) { e.textContent = message; e.hidden = false; } };
  const dateLong = new Intl.DateTimeFormat('es-ES', { timeZone: zone, weekday: 'long', day: 'numeric', month: 'long' }).format(new Date());
  const icon = (type) => ({
    clock: '◷', play: '▶', stop: '■', pause: 'Ⅱ', users: '♙', bell: '◉',
    history: '▤', download: '↓', settings: '⚙', back: '‹', check: '✓', logout: '↗'
  }[type] || '•');
  const banner = '<div class="demo-banner"><span class="demo-dot"></span><b>MODO DEMOSTRACIÓN</b><span>Datos guardados solo en este navegador · No válido como registro laboral</span></div>';
  const brand = '<div class="demo-logo"><span class="demo-logo-mark">G</span><div class="demo-word"><strong>GOZA<span>.</span></strong><small>TACOS FRANCESES · ZARAGOZA</small></div></div>';
  function shell(body, aside = '') {
    APP.innerHTML = '<div class="demo-app">' + banner +
      '<header class="demo-header"><div class="demo-header-inner">' + brand +
      '<div class="demo-header-right"><span class="demo-header-tag">CONTROL HORARIO</span>' + (mode !== 'welcome' ? '<button class="demo-ghost" data-action="go-home">Cambiar acceso ↗</button>' : '') + '</div></div></header>' +
      '<main class="demo-content">' + aside + body + '<div id="toast" hidden class="demo-toast" role="status"></div></main>' +
      '<footer class="demo-footer">GOZA · Registro de jornada · Europa/Madrid <span>Versión de prueba · Sin sincronización entre móviles</span></footer></div>';
  }
  function renderWelcome() {
    shell('<section class="demo-welcome">' +
      '<div><div class="demo-kicker">EQUIPO GOZA / ZARAGOZA</div><h1>El control horario,<br><em>más sencillo.</em></h1><p>Una experiencia rápida para fichar la entrada, las pausas y la salida. Prueba cómo funcionaría GOZA desde el móvil.</p>' +
      '<div class="demo-login-grid"><button class="demo-choice" data-action="enter-employee"><span class="demo-choice-icon">◷</span><strong>Soy empleado</strong><small>Fichar entrada, pausa o salida</small><span class="demo-choice-arrow">↗</span></button>' +
      '<button class="demo-choice" data-action="enter-admin"><span class="demo-choice-icon">▦</span><strong>Soy responsable</strong><small>Empleados, horas y avisos</small><span class="demo-choice-arrow">↗</span></button></div>' +
      '<div class="demo-little-notice">Esta es una demo interactiva sin contraseñas. Cuando se active la versión real, el acceso será individual y privado.</div></div>' +
      '<aside class="demo-preview"><div class="demo-preview-heading"><div><small>GOZA · STAFF</small><h3>Todo bajo control.</h3></div><span>● DEMO</span></div><div class="demo-preview-clock" id="previewClock">' + time(new Date()) + '</div><div class="demo-preview-sub">Hora de Zaragoza</div><div class="demo-mini-list"><div><span>✓</span> Entradas y salidas <b>01</b></div><div><span>◷</span> Descansos y pausas <b>02</b></div><div><span>▤</span> Historial y registros <b>03</b></div><div><span>◉</span> Alertas y reportes <b>04</b></div></div><div class="demo-preview-bottom">PENSADO PARA UN EQUIPO PEQUEÑO</div></aside></section>');
  }
  function renderEmployeeSelector() {
    shell('<div class="demo-back"><button class="demo-ghost" data-action="go-home">‹ Volver</button></div>' +
      '<section class="demo-panel demo-select-panel"><div class="demo-eyebrow">ACCESO EMPLEADOS / DEMO</div><h1>¿Quién va a fichar?</h1><p>Selecciona un perfil de prueba. En la versión real, cada trabajador tendrá acceso privado.</p>' +
      '<div class="demo-select-rows">' + state.employees.filter(e => e.active).map(e =>
        '<button class="demo-employee-option" data-employee="' + esc(e.id) + '"><span class="demo-avatar">' + esc(e.name.slice(0, 1).toUpperCase()) + '</span><span><strong>' + esc(e.name) + '</strong><small>' + esc(e.id) + '</small></span><b>→</b></button>'
      ).join('') + '</div></section>');
  }
  function renderEmployee() {
    const e = employee(selectedEmployee);
    if (!e || !e.active) { mode = 'pick'; return renderEmployeeSelector(); }
    const open = current(e.id), isPaused = !!open?.pauseStart;
    const rows = state.shifts.filter(s => s.employeeId === e.id).sort((a, b) => b.start.localeCompare(a.start));
    const todayRows = rows.filter(s => day(s.start) === day());
    const hoursToday = todayRows.reduce((n, s) => n + totalMs(s), 0) / 3600000;
    shell('<div class="demo-toolbar"><button class="demo-ghost" data-action="back-employee">‹ Cambiar empleado</button><span class="demo-mini-tag">PERFIL EMPLEADO</span></div>' +
      '<section class="demo-employee-layout"><div><section class="demo-panel demo-primary-panel"><div class="demo-eyebrow">HOLA, ' + esc(e.name.toUpperCase()) + ' 👋</div>' +
      '<h1>Tu jornada,<br><em>a un toque.</em></h1><div class="demo-clock" id="liveClock">' + time(new Date()) + '</div><div class="demo-dateline">' + esc(dateLong) + '</div>' +
      '<div class="demo-state ' + (open ? isPaused ? 'is-paused' : 'is-active' : '') + '"><span class="demo-state-dot"></span>' + (open ? isPaused ? 'Pausa en curso' : 'Jornada en marcha' : 'Jornada no iniciada') + '</div>' +
      '<div class="demo-clock-actions">' +
      (!open ? '<button class="demo-btn demo-btn-primary" data-clock="in"><span>▶</span> Fichar entrada</button>' :
        '<button class="demo-btn demo-btn-primary" data-clock="' + (isPaused ? 'resume' : 'pause') + '"><span>' + (isPaused ? '↻' : 'Ⅱ') + '</span> ' + (isPaused ? 'Reanudar jornada' : 'Iniciar pausa') + '</button>' +
        '<button class="demo-btn demo-btn-dark" data-clock="out"><span>■</span> Fichar salida</button>') + '</div>' +
      (open ? '<div class="demo-info-line">Entrada: <b>' + fmt(open.start) + '</b>' + (isPaused ? ' · En pausa desde ' + fmt(open.pauseStart) : '') + '</div>' : '<div class="demo-info-line">Pulsa «Fichar entrada» al comenzar tu turno.</div>') +
      '</section></div>' +
      '<aside><section class="demo-panel demo-shift-snapshot"><div class="demo-eyebrow">RESUMEN DEL DÍA</div><div class="demo-stat-number">' + hoursToday.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '<span> h</span></div><p>Tiempo neto estimado hoy</p><div class="demo-subtle-divider"></div><h3>Mis datos</h3><div class="demo-detail-row"><span>Empleado</span><b>' + esc(e.name) + '</b></div><div class="demo-detail-row"><span>Número</span><b>' + esc(e.id) + '</b></div><div class="demo-detail-row"><span>Último fichaje</span><b>' + (rows.length ? fmt(rows[0].start) : '—') + '</b></div></section>' +
      '<section class="demo-panel demo-tip"><div class="demo-eyebrow">¿OLVIDASTE FICHAR?</div><p>Comunícalo al responsable con una incidencia.</p><button class="demo-outline" data-action="open-incident">Comunicar incidencia ↗</button></section></aside></section>' +
      '<section class="demo-panel demo-history"><div class="demo-section-header"><div><div class="demo-eyebrow">HISTORIAL</div><h2>Mis últimos registros</h2></div><span class="demo-mini-tag">Solo este dispositivo</span></div>' +
      '<div class="demo-table-scroll"><table><thead><tr><th>ENTRADA</th><th>SALIDA</th><th>PAUSA</th><th>TIEMPO NETO</th><th>ESTADO</th></tr></thead><tbody>' +
      (rows.length ? rows.slice(0, 20).map(s => '<tr><td>' + fmt(s.start) + '</td><td>' + fmt(s.end) + '</td><td>' + Math.round((s.pauseMs || 0) / 60000) + ' min</td><td><b>' + hours(s) + ' h</b></td><td><span class="demo-status ' + (s.end ? 'finished' : 'ongoing') + '">' + (s.end ? 'Finalizado' : 'Abierto') + '</span></td></tr>').join('') :
        '<tr><td colspan="5" class="demo-empty">Todavía no has realizado ningún fichaje de prueba.</td></tr>') +
      '</tbody></table></div></section>');
  }
  function adminNav() {
    const nav = [['overview', 'Resumen'], ['employees', 'Empleados'], ['records', 'Registros'], ['alerts', 'Incidencias']];
    return '<div class="demo-nav">' + nav.map(([k, t]) => '<button class="' + (adminTab === k ? 'active' : '') + '" data-tab="' + k + '">' + t + '</button>').join('') + '</div>';
  }
  function renderAdmin() {
    const active = state.employees.filter(e => e.active);
    const opened = state.shifts.filter(s => !s.end);
    const alerts = state.shifts.filter(s => !s.end && Date.now() - new Date(s.start) > 12 * 3600000);
    const pending = state.incidents.filter(i => i.status !== 'resuelto');
    const names = id => employee(id)?.name || 'Empleado eliminado';
    let body = '<div class="demo-admin-top"><div><div class="demo-eyebrow">ADMINISTRACIÓN / GOZA TACOS</div><h1>Panel de control<span>.</span></h1><p>Gestiona tu equipo, revisa los fichajes y detecta incidencias.</p></div><span class="demo-admin-tag">● VISTA DEMO</span></div>' + adminNav();
    if (adminTab === 'overview') {
      body += '<section class="demo-kpis"><div class="demo-kpi"><small>EMPLEADOS ACTIVOS</small><strong>' + active.length + '</strong><span>Hasta 10 empleados</span></div><div class="demo-kpi"><small>JORNADAS ABIERTAS</small><strong>' + opened.length + '</strong><span>En este navegador</span></div><div class="demo-kpi"><small>INCIDENCIAS</small><strong>' + pending.length + '</strong><span>Pendientes de revisar</span></div><div class="demo-kpi"><small>AVISOS DE +12 H</small><strong>' + alerts.length + '</strong><span>Requieren revisión</span></div></section>' +
        '<section class="demo-panel demo-history"><div class="demo-section-header"><div><div class="demo-eyebrow">SEGUIMIENTO</div><h2>Quién está trabajando</h2></div><button class="demo-outline" data-action="admin-refresh">Actualizar ↻</button></div>' +
        (opened.length ? '<div class="demo-active-list">' + opened.map(s => '<div class="demo-active-item"><span class="demo-avatar">' + esc(names(s.employeeId).slice(0, 1)) + '</span><div><b>' + esc(names(s.employeeId)) + '</b><small>Entrada: ' + fmt(s.start) + '</small></div><span class="demo-status ongoing">' + (s.pauseStart ? 'En pausa' : 'Trabajando') + '</span></div>').join('') + '</div>' :
          '<div class="demo-empty demo-empty-card">No hay jornadas abiertas. Puedes probar a fichar entrando en el perfil de un empleado.</div>') + '</section>' +
        '<section class="demo-panel demo-info-box"><strong>Prueba completa de la aplicación</strong><p>Añade empleados ficticios, ficha desde el perfil de empleado, vuelve aquí y consulta registros y avisos. La información no se comparte entre dispositivos.</p></section>';
    } else if (adminTab === 'employees') {
      body += '<section class="demo-panel"><div class="demo-section-header"><div><div class="demo-eyebrow">PERSONAL</div><h2>Gestionar empleados</h2></div><span class="demo-mini-tag">' + active.length + ' / 10 activos</span></div>' +
        '<form id="addEmployee" class="demo-add-form"><label>Nombre del empleado<input required id="newName" maxlength="70" placeholder="Nombre y apellidos de prueba" autocomplete="off"></label><label>Número de empleado<input required id="newCode" maxlength="22" pattern="[A-Za-z0-9-]+" placeholder="GOZA-003" autocomplete="off"></label><button class="demo-btn demo-btn-primary" type="submit">+ Añadir</button></form>' +
        '<div class="demo-active-list">' + state.employees.map(e => '<div class="demo-active-item"><span class="demo-avatar">' + esc(e.name.charAt(0).toUpperCase()) + '</span><div><b>' + esc(e.name) + '</b><small>' + esc(e.id) + '</small></div><span class="demo-status ' + (e.active ? 'finished' : '') + '">' + (e.active ? 'Activo' : 'Inactivo') + '</span><button class="demo-small-btn" data-toggle="' + esc(e.id) + '">' + (e.active ? 'Desactivar' : 'Activar') + '</button></div>').join('') + '</div></section>';
    } else if (adminTab === 'records') {
      let rows = state.shifts.slice().sort((a, b) => b.start.localeCompare(a.start));
      rows = rows.filter(s => (!filters.from || day(s.start) >= filters.from) && (!filters.to || day(s.start) <= filters.to) && (filters.employee === 'all' || s.employeeId === filters.employee));
      window.GOZA_DEMO_EXPORT = rows.map(s => ({ name: names(s.employeeId), id: s.employeeId, ...s }));
      body += '<section class="demo-panel demo-history"><div class="demo-section-header"><div><div class="demo-eyebrow">HISTORIAL COMPLETO</div><h2>Registro de fichajes</h2></div><button class="demo-outline" data-action="export">↓ Exportar CSV</button></div><div class="demo-filters"><label>Desde<input type="date" id="fromDate" value="' + esc(filters.from) + '"></label><label>Hasta<input type="date" id="toDate" value="' + esc(filters.to) + '"></label><label>Empleado<select id="employeeFilter"><option value="all">Todos</option>' + state.employees.map(e => '<option value="' + esc(e.id) + '" ' + (filters.employee === e.id ? 'selected' : '') + '>' + esc(e.name) + '</option>').join('') + '</select></label><button class="demo-outline" data-action="filter">Filtrar</button></div>' +
        '<div class="demo-table-scroll"><table><thead><tr><th>EMPLEADO</th><th>ENTRADA</th><th>SALIDA</th><th>PAUSAS</th><th>TIEMPO NETO</th></tr></thead><tbody>' + (rows.length ? rows.map(s => '<tr><td><b>' + esc(names(s.employeeId)) + '</b><br><small>' + esc(s.employeeId) + '</small></td><td>' + fmt(s.start) + '</td><td>' + fmt(s.end) + '</td><td>' + Math.round((s.pauseMs || 0) / 60000) + ' min</td><td>' + hours(s) + ' h</td></tr>').join('') : '<tr><td colspan="5" class="demo-empty">No hay registros con estos filtros.</td></tr>') + '</tbody></table></div></section>';
    } else {
      body += '<section class="demo-panel demo-history"><div class="demo-section-header"><div><div class="demo-eyebrow">ALERTAS E INCIDENCIAS</div><h2>Avisos a revisar</h2></div><span class="demo-mini-tag">' + (alerts.length + pending.length) + ' avisos</span></div>' +
        (alerts.length ? alerts.map(s => '<div class="demo-alert-row">⚠ ' + esc(names(s.employeeId)) + ' lleva más de 12 horas con jornada abierta. Inicio: ' + fmt(s.start) + '</div>').join('') : '<p class="demo-soft-note">No hay jornadas abiertas de más de 12 horas.</p>') +
        (state.incidents.length ? state.incidents.slice().reverse().map(i => '<div class="demo-incident"><div><strong>' + esc(names(i.employeeId)) + '</strong><small>' + fmt(i.createdAt) + '</small><p>' + esc(i.reason) + '</p></div><button class="demo-small-btn" data-resolve="' + esc(i.id) + '">' + (i.status === 'resuelto' ? 'Reabrir' : 'Resolver') + '</button></div>').join('') : '<div class="demo-empty">Aún no hay incidencias registradas.</div>') + '</section>';
    }
    shell(body);
  }
  function clockAction(action) {
    const employeeId = selectedEmployee, open = current(employeeId), stamp = nowISO();
    if (action === 'in') {
      if (open) return toast('Ya tienes una jornada abierta.');
      const s = { id: id(), employeeId, start: stamp, end: null, pauseStart: null, pauseMs: 0 };
      state.shifts.push(s);
      state.events.push({ shiftId: s.id, employeeId, type: 'entrada', at: stamp });
    } else {
      if (!open) return toast('No existe una jornada abierta.');
      if (action === 'pause' && !open.pauseStart) open.pauseStart = stamp;
      else if (action === 'resume' && open.pauseStart) {
        open.pauseMs += new Date(stamp) - new Date(open.pauseStart);
        open.pauseStart = null;
      } else if (action === 'out') {
        if (open.pauseStart) open.pauseMs += new Date(stamp) - new Date(open.pauseStart);
        open.pauseStart = null;
        open.end = stamp;
      } else return toast('Este fichaje no se puede realizar ahora.');
      state.events.push({ shiftId: open.id, employeeId, type: action, at: stamp });
    }
    save(); render(); toast('Fichaje de prueba registrado en este dispositivo.');
  }
  function exportCSV() {
    const rows = window.GOZA_DEMO_EXPORT || [];
    const header = ['Número', 'Empleado', 'Entrada UTC', 'Salida UTC', 'Pausa minutos', 'Tiempo neto horas', 'Estado'];
    const csv = '\ufeff' + [header, ...rows.map(s => [s.id, s.name, s.start, s.end || '', Math.round((s.pauseMs || 0) / 60000), hours(s), s.end ? 'Cerrada' : 'Abierta'])].map(row => row.map(c => '"' + String(c ?? '').replaceAll('"', '""') + '"').join(';')).join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a'); a.href = url; a.download = 'goza-demo-fichajes.csv'; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function bind() {
    document.querySelectorAll('[data-action]').forEach(b => b.onclick = () => {
      const a = b.dataset.action;
      if (a === 'go-home') setMode('welcome');
      if (a === 'enter-employee') setMode('pick');
      if (a === 'enter-admin') setMode('admin');
      if (a === 'back-employee') setMode('pick');
      if (a === 'admin-refresh') render();
      if (a === 'export') exportCSV();
      if (a === 'filter') {
        filters.from = document.getElementById('fromDate').value;
        filters.to = document.getElementById('toDate').value;
        filters.employee = document.getElementById('employeeFilter').value;
        render();
      }
      if (a === 'open-incident') {
        const reason = prompt('Describe el fichaje olvidado y el motivo (solo demostración):');
        if (reason && reason.trim().length >= 8) {
          state.incidents.push({ id: id(), employeeId: selectedEmployee, reason: reason.trim(), createdAt: nowISO(), status: 'pendiente' });
          save(); render(); toast('Incidencia de prueba enviada al panel.');
        }
      }
    });
    document.querySelectorAll('[data-employee]').forEach(b => b.onclick = () => {
      selectedEmployee = b.dataset.employee; sessionStorage.setItem('goza-demo-employee', selectedEmployee); setMode('employee');
    });
    document.querySelectorAll('[data-clock]').forEach(b => b.onclick = () => clockAction(b.dataset.clock));
    document.querySelectorAll('[data-tab]').forEach(b => b.onclick = () => { adminTab = b.dataset.tab; render(); });
    document.getElementById('addEmployee')?.addEventListener('submit', e => {
      e.preventDefault();
      const name = document.getElementById('newName').value.trim();
      const code = document.getElementById('newCode').value.trim().toUpperCase();
      if (state.employees.filter(x => x.active).length >= 10) return toast('La demo admite un máximo de 10 empleados activos.');
      if (state.employees.some(x => x.id.toUpperCase() === code)) return toast('Ese número de empleado ya existe.');
      if (!name || !/^[A-Z0-9-]{2,22}$/.test(code)) return toast('Nombre o código inválido.');
      state.employees.push({ id: code, name, active: true }); save(); render(); toast('Empleado de prueba añadido.');
    });
    document.querySelectorAll('[data-toggle]').forEach(b => b.onclick = () => {
      const e = employee(b.dataset.toggle); if (!e) return;
      if (!e.active && state.employees.filter(x => x.active).length >= 10) return toast('Máximo 10 empleados activos.');
      e.active = !e.active; save(); render();
    });
    document.querySelectorAll('[data-resolve]').forEach(b => b.onclick = () => {
      const i = state.incidents.find(x => x.id === b.dataset.resolve);
      if (i) { i.status = i.status === 'resuelto' ? 'pendiente' : 'resuelto'; save(); render(); }
    });
  }
  function render() {
    if (mode === 'employee') renderEmployee();
    else if (mode === 'admin') renderAdmin();
    else if (mode === 'pick') renderEmployeeSelector();
    else renderWelcome();
    bind();
  }
  render();
  setInterval(() => {
    const e = document.getElementById('liveClock') || document.getElementById('previewClock');
    if (e) e.textContent = time(new Date());
  }, 1000);
})();