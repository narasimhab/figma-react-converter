/**
 * Detect third-party CSS / icon libraries in HTML and return CDN snippets
 * to inject into the capture iframe when not already linked.
 */

const CDN = {
  tailwind:
    "<script src='https://cdn.tailwindcss.com'></script>",
  fontAwesome:
    "<link rel='stylesheet' href='https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.6.0/css/all.min.css'/>",
  bootstrap:
    "<link rel='stylesheet' href='https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css'/>",
  bootstrapIcons:
    "<link rel='stylesheet' href='https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css'/>",
};

function detectLibraries(html) {
  const s = String(html || "");
  const lower = s.toLowerCase();

  const hasBootstrapLink = /bootstrap[^"']*\.css/i.test(s);
  const hasBiLink = /bootstrap-icons[^"']*\.css/i.test(s);
  const hasFaLink = /font-?awesome[^"']*\.css|fontawesome[^"']*\.css/i.test(s);
  const hasTailwindScript = /cdn\.tailwindcss\.com|tailwindcss/i.test(s);

  const wantsBootstrap =
    /\b(btn-primary|btn-secondary|btn-outline|btn-lg|btn-sm|btn-close)\b/.test(lower) ||
    /\b(container-fluid|container-lg|container-md)\b/.test(lower) ||
    /\b(navbar|navbar-brand|navbar-nav|nav-tabs|nav-pills)\b/.test(lower) ||
    /\b(col-\d|col-sm-|col-md-|col-lg-|col-xl-|col-xxl-)\b/.test(lower) ||
    /\b(card-body|card-header|card-footer|list-group-item)\b/.test(lower) ||
    /\b(modal-dialog|offcanvas|accordion-item|breadcrumb)\b/.test(lower) ||
    /\b(form-control|form-select|input-group)\b/.test(lower) ||
    /\b(alert-primary|alert-success|badge|table-striped)\b/.test(lower) ||
    /\bdata-bs-toggle\b/.test(lower) ||
    /\bbootstrap(\.min)?\.css\b/.test(lower);

  const wantsBootstrapIcons =
    /\bbootstrap-icons\b/.test(lower) ||
    /\bclass="[^"]*\bbi\s/.test(lower) ||
    /\bclass='[^']*\bbi\s/.test(lower) ||
    /\bbi-[a-z0-9-]+\b/.test(lower);

  const wantsFontAwesome =
    /\bfont-?awesome\b/.test(lower) ||
    /\bfa-solid\b/.test(lower) ||
    /\bfa-regular\b/.test(lower) ||
    /\bfa-brands\b/.test(lower) ||
    /\bfa-[a-z0-9-]+\b/.test(lower);

  const wantsTailwind =
    hasTailwindScript ||
    /\b(bg-gradient-to-|from-\[#|to-\[#|rounded-\[)\b/.test(lower) ||
    /\b(flex-col|grid-cols-|gap-\d|px-\d|py-\d|text-slate-|max-w-\[)\b/.test(lower) ||
    /\b(hover:|xl:|lg:|md:)\w/.test(lower);

  const wantsGlyphicons = /\bglyphicon\b/.test(lower);

  return {
    bootstrap: wantsBootstrap && !hasBootstrapLink,
    bootstrapIcons: wantsBootstrapIcons && !hasBiLink,
    fontAwesome: wantsFontAwesome && !hasFaLink,
    tailwind: wantsTailwind && !hasTailwindScript,
    glyphicons: wantsGlyphicons,
    // Already present in source (for logging / UI only)
    linked: {
      bootstrap: hasBootstrapLink,
      bootstrapIcons: hasBiLink,
      fontAwesome: hasFaLink,
      tailwind: hasTailwindScript,
    },
  };
}

/** Default CDN set for bare HTML fragments with no library signals. */
function defaultFragmentLibraries() {
  return { tailwind: true, fontAwesome: true, bootstrap: false, bootstrapIcons: false };
}

function buildCdnHeadTags(libs) {
  const parts = [];
  if (libs.bootstrap) parts.push(CDN.bootstrap);
  if (libs.bootstrapIcons) parts.push(CDN.bootstrapIcons);
  if (libs.fontAwesome) parts.push(CDN.fontAwesome);
  if (libs.tailwind) parts.push(CDN.tailwind);
  return parts.join("");
}

function buildMenuForceCss(showHiddenMenus) {
  let css =
    "*,*::before,*::after{animation:none!important;transition:none!important;}";
  if (!showHiddenMenus) return "<style>" + css + "</style>";

  css +=
    /* Generic + Tailwind-style */
    ".dropdown,.submenu,.flyout,.menu-panel,.nav-dropdown,.has-dropdown>ul," +
    "[class*='dropdown-menu'],[data-dropdown],[role='menu'],[aria-haspopup='true']+ul," +
    ".nav-item:hover .dropdown,.group:hover .dropdown," +
    /* Bootstrap 5 */
    ".dropdown-menu,.dropdown-menu.show,.navbar .dropdown-menu," +
    ".collapse.navbar-collapse,.navbar-collapse.collapse," +
    ".offcanvas.show,.modal.show .modal-dialog," +
    /* Bootstrap 3/4 */
    ".navbar-collapse.in,.navbar-collapse.show," +
    "{display:block!important;visibility:visible!important;opacity:1!important;pointer-events:auto!important;}" +
    ".dropdown-menu{position:relative!important;float:none!important;inset:auto!important;transform:none!important;}" +
    ".collapse:not(.show).navbar-collapse{display:block!important;height:auto!important;overflow:visible!important;}";

  return "<style>" + css + "</style>";
}

function resolveLibrariesForHtml(html, opts) {
  const trimmed = (html || "").trim();
  const hasFullDoc = /^<!doctype|^<html/i.test(trimmed);
  let libs = detectLibraries(trimmed);

  // Bare fragments: if nothing detected, keep Tailwind + FA defaults.
  if (!hasFullDoc && !/^<body/i.test(trimmed)) {
    const any =
      libs.bootstrap ||
      libs.bootstrapIcons ||
      libs.fontAwesome ||
      libs.tailwind ||
      libs.glyphicons;
    if (!any) libs = defaultFragmentLibraries();
  }

  if (opts && opts.forceBootstrap) libs.bootstrap = true;
  if (opts && opts.forceBootstrapIcons) libs.bootstrapIcons = true;
  if (opts && opts.forceFontAwesome) libs.fontAwesome = true;
  if (opts && opts.forceTailwind) libs.tailwind = true;

  return libs;
}

function isIconElement(el) {
  if (!el || el.nodeType !== 1) return false;
  const tag = el.tagName.toLowerCase();
  if (tag === "i" || tag === "svg") return true;
  const cls = el.getAttribute("class") || "";
  if (tag === "span" && /\b(bi-|glyphicon)\b/.test(cls)) return true;
  return false;
}

function iconSetFromClasses(classNames, fontFamily) {
  const cls = String(classNames || "").toLowerCase();
  const fam = String(fontFamily || "").toLowerCase();
  if (/\bbi-/.test(cls) || fam.includes("bootstrap-icons")) return "bootstrap-icons";
  if (/\bglyphicon/.test(cls) || fam.includes("glyphicons")) return "glyphicons";
  if (/\bfa-/.test(cls) || fam.includes("font awesome") || fam.includes("fontawesome")) {
    return "fontawesome";
  }
  return "unknown";
}

module.exports = {
  CDN,
  detectLibraries,
  defaultFragmentLibraries,
  buildCdnHeadTags,
  buildMenuForceCss,
  resolveLibrariesForHtml,
  isIconElement,
  iconSetFromClasses,
};
