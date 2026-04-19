/**
 * ╔══════════════════════════════════════════╗
 * ║   CIRCL DEV TOOLS — Case Navigator       ║
 * ║   Hover the left edge to open            ║
 * ╚══════════════════════════════════════════╝
 *
 * Detects current page, lists all casuísticas
 * from the flows doc. Slides in from the left.
 */
(function () {
  'use strict';

  /* ── Cases database (root-relative paths) ─────────────── */
  const PAGES = {

    login: {
      title: 'LOGIN',
      path: 'auth/login.html',
      cases: [
        { type:'base', label:'Email y contraseña válidos → Dashboard',         href: 'auth/login.html' },
        { type:'alt',  label:'Usuario ya tiene sesión activa → Dashboard',      href: null },
        { type:'err',  label:'Email no registrado',                              href: 'auth/variants/login-not-found.html' },
        { type:'err',  label:'Contraseña incorrecta',                            href: 'auth/variants/login-wrong-password.html' },
        { type:'err',  label:'Email con formato inválido',                       href: 'auth/variants/login-invalid-email.html' },
        { type:'err',  label:'Campos vacíos al enviar',                          href: 'auth/variants/login-empty-fields.html' },
      ],
    },

    'login-google': {
      title: 'LOGIN · GOOGLE',
      path: 'auth/login.html (OAuth)',
      cases: [
        { type:'base', label:'Cuenta Google válida ya registrada → Dashboard',  href: 'auth/login.html' },
        { type:'alt',  label:'Primera vez con esa cuenta → Onboarding',         href: null },
        { type:'alt',  label:'Mismo email registrado con password → Vincula',   href: null },
        { type:'alt',  label:'Usuario cancela el popup → vuelve sin error',     href: null },
        { type:'err',  label:'Cuenta Google inhabilitada / sin permisos',        href: null },
      ],
    },

    register: {
      title: 'REGISTRO',
      path: 'auth/register.html',
      cases: [
        { type:'base', label:'Datos válidos, email nuevo → Revisá tu email',    href: 'auth/register.html' },
        { type:'alt',  label:'Email ya registrado con Google → aviso',          href: null },
        { type:'err',  label:'Email ya registrado con contraseña',               href: 'auth/variants/register-email-exists.html' },
        { type:'err',  label:'Nombre vacío',                                     href: null },
        { type:'err',  label:'Email con formato inválido',                       href: null },
      ],
    },

    'verify-email': {
      title: 'VERIFICACIÓN DE EMAIL',
      path: 'auth/verify-email.html',
      cases: [
        { type:'base', label:'Pantalla "Revisá tu email" post-registro',        href: 'auth/verify-email.html' },
        { type:'alt',  label:'Reenviar email → confirmación de reenvío',        href: 'auth/variants/verify-resent.html' },
        { type:'base', label:'Link válido y vigente → email verificado → Onboarding', href: 'auth/variants/verify-success.html' },
        { type:'err',  label:'Link expirado (>24hs)',                            href: 'auth/variants/verify-expired.html' },
        { type:'err',  label:'Link ya utilizado (email ya verificado)',          href: 'auth/variants/verify-used.html' },
        { type:'err',  label:'Token inválido / URL manipulada',                  href: null },
      ],
    },

    forgot: {
      title: 'RECUPERAR CONTRASEÑA',
      path: 'auth/forgot-password.html',
      cases: [
        { type:'base', label:'Email válido registrado → Confirmación enviada',  href: 'auth/forgot-password.html' },
        { type:'alt',  label:'Email no registrado → misma confirmación',        href: 'auth/variants/forgot-sent.html' },
        { type:'base', label:'Link válido y vigente → nueva contraseña',        href: 'auth/forgot-password.html' },
        { type:'err',  label:'Link expirado',                                    href: 'auth/variants/forgot-expired.html' },
        { type:'err',  label:'Link ya utilizado',                                href: null },
        { type:'err',  label:'Email con formato inválido',                       href: null },
        { type:'err',  label:'Campo vacío al enviar',                            href: null },
      ],
    },

    onboarding: {
      title: 'ONBOARDING',
      path: 'auth/onboarding.html',
      cases: [
        { type:'base', label:'Completa todos los pasos → Dashboard',            href: 'auth/onboarding.html' },
        { type:'alt',  label:'Omite un paso → avanza con datos mínimos',        href: null },
        { type:'alt',  label:'Omite todos → Dashboard vacío con CTAs',          href: 'app/variants/dashboard-empty.html' },
        { type:'alt',  label:'Navega hacia atrás → datos conservados',          href: null },
        { type:'alt',  label:'Cierra el navegador a mitad del flujo',           href: null },
        { type:'err',  label:'Campo de crisis vacío al continuar',               href: null },
        { type:'err',  label:'Agregar contacto sin nombre',                      href: null },
        { type:'err',  label:'Agregar contacto sin cercanía',                    href: null },
        { type:'err',  label:'Superar 10 contactos (límite)',                    href: null },
        { type:'err',  label:'Error guardando datos del paso',                   href: null },
      ],
    },

    dashboard: {
      title: 'DASHBOARD',
      path: 'app/dashboard.html',
      cases: [
        { type:'base', label:'Crisis activas + círculo configurado → completo', href: 'app/dashboard.html' },
        { type:'alt',  label:'Sin crisis activas → empty state con CTA',        href: 'app/variants/dashboard-empty.html' },
      ],
    },

    circle: {
      title: 'MI CÍRCULO',
      path: 'app/circle/index.html',
      cases: [
        { type:'base', label:'Círculo con miembros → orbit + lista',            href: 'app/circle/index.html' },
        { type:'alt',  label:'Círculo vacío → empty state + CTA agregar',       href: 'app/circle/variants/empty.html' },
        // Agregar contacto
        { type:'base', label:'[AGREGAR] Nombre + rol + cercanía completados',   href: 'app/circle/index.html' },
        { type:'alt',  label:'[AGREGAR] Sin foto → iniciales + gradiente',      href: null },
        { type:'alt',  label:'[AGREGAR] Con foto → preview circular',           href: null },
        { type:'alt',  label:'[AGREGAR] Sin email ni teléfono',                 href: null },
        { type:'alt',  label:'[AGREGAR] Anillo saturado → avatar se achica',    href: null },
        { type:'err',  label:'[AGREGAR] Email ya existe en el círculo',         href: null },
        { type:'err',  label:'[AGREGAR] Nombre vacío al enviar',                href: null },
        { type:'err',  label:'[AGREGAR] Cercanía no seleccionada',              href: null },
        { type:'err',  label:'[AGREGAR] Límite de 10 personas alcanzado',       href: 'app/circle/variants/add-limit.html' },
        { type:'err',  label:'[AGREGAR] Foto con formato inválido',             href: null },
        { type:'err',  label:'[AGREGAR] Foto demasiado grande',                 href: null },
        // Ver / editar
        { type:'base', label:'[VER] Contacto con datos completos',              href: 'app/circle/contact.html' },
        { type:'alt',  label:'[VER] Sin foto → iniciales',                      href: null },
        { type:'alt',  label:'[VER] Cambiar cercanía → re-layout orbit',        href: null },
        { type:'alt',  label:'[VER] Cambiar rol → badge actualizado',           href: null },
        { type:'alt',  label:'[VER] Subir / reemplazar foto',                   href: null },
        { type:'err',  label:'[VER] Email de formato inválido al editar',       href: null },
        { type:'err',  label:'[VER] Error al subir nueva foto',                 href: null },
        // Eliminar
        { type:'base', label:'[ELIMINAR] Confirmar → desaparece de lista+orbit',href: 'app/circle/index.html' },
        { type:'alt',  label:'[ELIMINAR] Tiene tareas asignadas → advertencia', href: null },
        { type:'err',  label:'[ELIMINAR] Error al eliminar',                    href: null },
      ],
    },

    contact: {
      title: 'DETALLE DE CONTACTO',
      path: 'app/circle/contact.html',
      cases: [
        { type:'base', label:'Datos completos → muestra info y acciones',       href: 'app/circle/contact.html' },
        { type:'alt',  label:'Sin email → fila vacía',                          href: null },
        { type:'alt',  label:'Sin teléfono → fila vacía',                       href: null },
        { type:'alt',  label:'Cambiar cercanía → orbit re-layout',              href: null },
        { type:'alt',  label:'Cambiar rol → badge actualizado',                 href: null },
        { type:'err',  label:'Email de formato inválido al guardar',            href: null },
        { type:'err',  label:'Error guardando cambios',                         href: null },
      ],
    },

    'crisis-list': {
      title: 'LISTA DE CRISIS',
      path: 'app/crisis/index.html',
      cases: [
        { type:'base', label:'Hay crisis activas y resueltas → lista completa', href: 'app/crisis/index.html' },
        { type:'alt',  label:'Sin crisis → empty state + CTA registrar',        href: 'app/crisis/variants/list-empty.html' },
        { type:'alt',  label:'Solo crisis resueltas → activas vacías',          href: 'app/crisis/variants/list-only-resolved.html' },
      ],
    },

    'crisis-detail': {
      title: 'DETALLE DE CRISIS',
      path: 'app/crisis/detail.html',
      cases: [
        // Tareas
        { type:'base', label:'[TAREA] Agregar con título y asignado',           href: 'app/crisis/detail.html' },
        { type:'alt',  label:'[TAREA] Sin fecha → "Sin fecha"',                 href: null },
        { type:'alt',  label:'[TAREA] Asignada a sí mismo (Valeria)',           href: null },
        { type:'base', label:'[TAREA] Marcar como completada',                  href: 'app/crisis/variants/detail-task-completed.html' },
        { type:'alt',  label:'[TAREA] Reabrir tarea completada',                href: null },
        { type:'alt',  label:'[TAREA] Cambiar asignado → iniciales actualizan', href: null },
        { type:'alt',  label:'[TAREA] Círculo sin miembros → solo "Yo"',        href: null },
        { type:'err',  label:'[TAREA] Título vacío al enviar',                  href: null },
        { type:'err',  label:'[TAREA] Error guardando',                         href: null },
        // Círculo activo
        { type:'base', label:'[CÍRCULO] Agregar persona con rol + cercanía',    href: 'app/crisis/detail.html' },
        { type:'alt',  label:'[CÍRCULO] Persona ya en círculo global → import', href: null },
        { type:'alt',  label:'[CÍRCULO] Círculo global vacío → libre',          href: null },
        { type:'err',  label:'[CÍRCULO] Nombre vacío al enviar',                href: null },
        { type:'err',  label:'[CÍRCULO] Límite de 10 personas alcanzado',       href: null },
        { type:'base', label:'[CÍRCULO] Quitar persona de la crisis',           href: 'app/crisis/detail.html' },
        { type:'alt',  label:'[CÍRCULO] Persona con tareas → advertencia',      href: null },
        // Documentos
        { type:'base', label:'[DOC] Agregar nombre + tipo + archivo válido',    href: 'app/crisis/detail.html' },
        { type:'base', label:'[DOC] Descargar → descarga directa',              href: 'app/crisis/detail.html' },
        { type:'base', label:'[DOC] Eliminar → desaparece de lista',            href: 'app/crisis/detail.html' },
        { type:'err',  label:'[DOC] Archivo demasiado grande',                  href: null },
        { type:'err',  label:'[DOC] Tipo de archivo no soportado',              href: null },
        { type:'err',  label:'[DOC] Sin archivo seleccionado',                  href: null },
        { type:'err',  label:'[DOC] Nombre vacío al enviar',                    href: null },
      ],
    },

    chat: {
      title: 'CHAT',
      path: 'app/chat.html',
      cases: [
        { type:'base', label:'Mensaje enviado con éxito → aparece en hilo',     href: 'app/chat.html' },
        { type:'alt',  label:'Campo vacío → botón enviar deshabilitado',        href: null },
        { type:'alt',  label:'Mensaje muy largo → textarea crece',              href: null },
        { type:'alt',  label:'Conversación sin mensajes previos → empty',       href: null },
      ],
    },

    profile: {
      title: 'PERFIL',
      path: 'app/profile.html',
      cases: [
        { type:'base', label:'Edita un campo y guarda → dato actualizado',      href: 'app/profile.html' },
        { type:'alt',  label:'No hace cambios → vuelve al valor original',      href: null },
        { type:'err',  label:'Email ya en uso por otra cuenta',                  href: null },
        { type:'err',  label:'Email con formato inválido',                       href: null },
        { type:'err',  label:'Error guardando',                                  href: null },
        { type:'base', label:'Contraseña actual correcta + nueva válida',       href: 'app/profile.html' },
        { type:'err',  label:'Contraseña actual incorrecta',                     href: null },
        { type:'err',  label:'Nueva contraseña < 8 caracteres',                  href: null },
        { type:'err',  label:'Nueva igual a la actual',                          href: null },
        { type:'base', label:'Cerrar sesión → redirige al Login',               href: 'app/profile.html' },
        { type:'err',  label:'Error al cerrar sesión',                           href: null },
      ],
    },

  };

  /* ── Page detection ────────────────────────────────────── */
  function detectPage() {
    // Check explicit override first
    if (window.CASE_NAV_PAGE_ID && PAGES[window.CASE_NAV_PAGE_ID]) {
      return window.CASE_NAV_PAGE_ID;
    }
    const p = window.location.pathname.toLowerCase();
    if (/login/.test(p))            return 'login';
    if (/register/.test(p))         return 'register';
    if (/verify-email/.test(p))     return 'verify-email';
    if (/forgot/.test(p))           return 'forgot';
    if (/onboarding/.test(p))       return 'onboarding';
    if (/dashboard/.test(p))        return 'dashboard';
    if (/circle\/index|circle\/variants\/empty|circle\/variants\/add/.test(p)) return 'circle';
    if (/circle\/contact/.test(p))  return 'contact';
    if (/crisis\/index|crisis\/variants\/list/.test(p)) return 'crisis-list';
    if (/crisis\/detail|crisis\/variants\/detail/.test(p)) return 'crisis-detail';
    if (/chat/.test(p))             return 'chat';
    if (/profile/.test(p))          return 'profile';
    return null;
  }

  /* ── URL resolver (project-root-relative → page-relative) ─ */
  function resolveHref(rootRel) {
    if (!rootRel) return null;
    try {
      const raw = window.location.pathname;
      // Normalize Windows file:// paths: strip drive & find Circl/
      const match = raw.match(/[Cc]ircl[\/\\](.*)/);
      const fromPath = match ? match[1].replace(/\\/g, '/') : raw.replace(/^\//, '');
      const fromDir  = fromPath.split('/').slice(0, -1);
      const toParts  = rootRel.replace(/\\/g, '/').split('/');

      // Find common prefix length
      let common = 0;
      for (let i = 0; i < Math.min(fromDir.length, toParts.length - 1); i++) {
        if (fromDir[i] === toParts[i]) common++;
        else break;
      }
      const ups   = fromDir.length - common;
      const downs = toParts.slice(common);
      return '../'.repeat(ups) + downs.join('/');
    } catch (e) {
      return rootRel;
    }
  }

  /* ── Build panel HTML ──────────────────────────────────── */
  function buildPanel(pageId) {
    const page   = PAGES[pageId];
    if (!page) return buildUnknownPanel();

    const counts = page.cases.reduce((acc, c) => {
      acc[c.type] = (acc[c.type] || 0) + 1; return acc;
    }, {});

    const rows = page.cases.map((c, i) => {
      const href = c.href ? resolveHref(c.href) : null;
      const tag  = c.type === 'base' ? '[BASE]' : c.type === 'alt' ? '[ALT] ' : '[ERR] ';
      const cls  = 'cn-case cn-' + c.type + (href ? ' cn-link' : '');
      const num  = String(i + 1).padStart(2, '0');
      if (href) {
        return `<a class="${cls}" href="${href}" title="${c.label}">
  <span class="cn-num">${num}</span><span class="cn-tag">${tag}</span><span class="cn-label">${c.label}</span><span class="cn-arrow">→</span>
</a>`;
      }
      return `<div class="${cls}">
  <span class="cn-num">${num}</span><span class="cn-tag">${tag}</span><span class="cn-label">${c.label}</span>
</div>`;
    }).join('\n');

    const total = page.cases.length;
    const baseC = counts.base || 0;
    const altC  = counts.alt  || 0;
    const errC  = counts.err  || 0;

    return `
<div class="cn-header">
  <div class="cn-logo">CIRCL DEV TOOLS</div>
  <div class="cn-ver">case_navigator v1.0</div>
  <div class="cn-divider">════════════════════════════════</div>
  <div class="cn-page-id">PAGE: ${page.title}</div>
  <div class="cn-path">&gt; ${page.path}</div>
  <div class="cn-divider">────────────────────────────────</div>
  <div class="cn-stats">
    <span class="cn-stat cn-base">[BASE]×${baseC}</span>
    <span class="cn-stat cn-alt">[ALT]×${altC}</span>
    <span class="cn-stat cn-err">[ERR]×${errC}</span>
    <span class="cn-total">total:${total}</span>
  </div>
  <div class="cn-divider">════════════════════════════════</div>
</div>
<div class="cn-cases">
${rows}
</div>
<div class="cn-footer">
  <div class="cn-divider">────────────────────────────────</div>
  <div class="cn-hint">→ con variante disponible</div>
  <div class="cn-hint">hover borde izquierdo para abrir</div>
</div>`;
  }

  function buildUnknownPanel() {
    const allIds = Object.keys(PAGES);
    const links = allIds.map(id => {
      const page = PAGES[id];
      const href = resolveHref(page.path);
      return `<a class="cn-case cn-link" href="${href}"><span class="cn-tag">[NAV] </span><span class="cn-label">${page.title}</span><span class="cn-arrow">→</span></a>`;
    }).join('\n');
    return `
<div class="cn-header">
  <div class="cn-logo">CIRCL DEV TOOLS</div>
  <div class="cn-ver">case_navigator v1.0</div>
  <div class="cn-divider">════════════════════════════════</div>
  <div class="cn-page-id">PAGE: DESCONOCIDA</div>
  <div class="cn-path">&gt; ${window.location.pathname.split('/').pop()}</div>
  <div class="cn-divider">────────────────────────────────</div>
  <div class="cn-hint">Navegación de páginas:</div>
  <div class="cn-divider">════════════════════════════════</div>
</div>
<div class="cn-cases">${links}</div>`;
  }

  /* ── Inject styles ──────────────────────────────────────── */
  const STYLE = `
    #cn-trigger {
      position: fixed; left: 0; top: 0;
      width: 20px; height: 100vh;
      z-index: 99998; cursor: pointer;
      background: transparent;
    }
    #cn-panel {
      position: fixed; left: 0; top: 0;
      width: 340px; height: 100vh;
      background: #0c0c0c;
      border-right: 1px solid #1f1f1f;
      z-index: 99999;
      transform: translateX(-100%);
      transition: transform 0.28s cubic-bezier(0.4,0,0.2,1);
      display: flex; flex-direction: column;
      overflow: hidden;
      font-family: 'Courier New', Consolas, 'Lucida Console', monospace;
      font-size: 11px;
      color: #c8c8c8;
    }
    #cn-panel.open { transform: translateX(0); }
    #cn-panel * { box-sizing: border-box; }

    .cn-header {
      padding: 16px 16px 0;
      flex-shrink: 0;
    }
    .cn-logo {
      color: #00e87a;
      font-size: 12px;
      font-weight: bold;
      letter-spacing: 0.12em;
      margin-bottom: 2px;
    }
    .cn-ver {
      color: #3a3a3a;
      font-size: 10px;
      margin-bottom: 8px;
    }
    .cn-divider {
      color: #1e1e1e;
      font-size: 10px;
      margin: 6px 0;
      white-space: nowrap;
      overflow: hidden;
    }
    .cn-page-id {
      color: #ffffff;
      font-size: 13px;
      font-weight: bold;
      letter-spacing: 0.06em;
      margin-bottom: 2px;
    }
    .cn-path {
      color: #555;
      font-size: 10px;
      margin-bottom: 4px;
    }
    .cn-stats {
      display: flex;
      gap: 10px;
      align-items: center;
      flex-wrap: wrap;
      margin: 4px 0;
    }
    .cn-stat { font-size: 10px; }
    .cn-stat.cn-base { color: #00e87a; }
    .cn-stat.cn-alt  { color: #e8b800; }
    .cn-stat.cn-err  { color: #e84040; }
    .cn-total { color: #444; font-size: 10px; margin-left: auto; }

    .cn-cases {
      flex: 1;
      overflow-y: auto;
      padding: 4px 0 8px;
      scrollbar-width: thin;
      scrollbar-color: #1f1f1f transparent;
    }
    .cn-cases::-webkit-scrollbar { width: 4px; }
    .cn-cases::-webkit-scrollbar-thumb { background: #1f1f1f; }

    .cn-case {
      display: flex;
      align-items: baseline;
      gap: 4px;
      padding: 5px 16px;
      line-height: 1.4;
      text-decoration: none;
      color: inherit;
      transition: background 0.1s;
      cursor: default;
    }
    .cn-case.cn-link { cursor: pointer; }
    .cn-case.cn-link:hover { background: #141414; }
    .cn-case.cn-link:hover .cn-label { color: #fff; }

    .cn-num  { color: #2a2a2a; font-size: 14px; flex-shrink: 0; width: 18px; }
    .cn-tag  { flex-shrink: 0; font-size: 14px; font-weight: bold; width: 46px; }
    .cn-label { flex: 1; color: #888; font-size: 14px; }
    .cn-arrow { color: #333; font-size: 14px; flex-shrink: 0; transition: color 0.1s; }
    .cn-case.cn-link:hover .cn-arrow { color: #00e87a; }

    .cn-base .cn-tag { color: #00e87a; }
    .cn-alt  .cn-tag { color: #e8b800; }
    .cn-err  .cn-tag { color: #e84040; }

    .cn-base.cn-link .cn-label { color: #aaa; }
    .cn-alt.cn-link  .cn-label { color: #aaa; }
    .cn-err.cn-link  .cn-label { color: #aaa; }

    .cn-footer {
      padding: 0 16px 16px;
      flex-shrink: 0;
    }
    .cn-hint {
      color: #2a2a2a;
      font-size: 14px;
      margin-top: 3px;
    }

    /* Current page marker */
    .cn-current-badge {
      position: absolute;
      top: 10px; right: 10px;
      background: #00e87a22;
      color: #00e87a;
      font-size: 9px;
      padding: 2px 6px;
      border-radius: 2px;
      letter-spacing: 0.08em;
    }
  `;

  /* ── Init ───────────────────────────────────────────────── */
  function init() {
    // Inject styles
    const styleEl = document.createElement('style');
    styleEl.textContent = STYLE;
    document.head.appendChild(styleEl);

    // Build elements
    const trigger = document.createElement('div');
    trigger.id = 'cn-trigger';
    document.body.appendChild(trigger);

    const panel = document.createElement('div');
    panel.id = 'cn-panel';
    const pageId = detectPage();
    panel.innerHTML = (pageId ? buildPanel(pageId) : buildUnknownPanel());
    document.body.appendChild(panel);

    // Current page badge
    const badge = document.createElement('div');
    badge.className = 'cn-current-badge';
    badge.textContent = 'LIVE';
    panel.querySelector('.cn-header').style.position = 'relative';
    panel.querySelector('.cn-header').appendChild(badge);

    // Hover logic
    let closeTimer = null;

    trigger.addEventListener('mouseenter', () => {
      clearTimeout(closeTimer);
      panel.classList.add('open');
    });

    panel.addEventListener('mouseleave', () => {
      closeTimer = setTimeout(() => panel.classList.remove('open'), 350);
    });
    panel.addEventListener('mouseenter', () => clearTimeout(closeTimer));

    // Close on Escape
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') panel.classList.remove('open');
    });
  }

  // Run after DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
