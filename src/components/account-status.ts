// Dashboard cookies are host-only. Query the dashboard from the browser so its
// same-site session cookie is included, even when the marketing HTML is cached.
export const ACCOUNT_STATUS_SCRIPT = /* javascript */ `
(() => {
  var actions = document.querySelector('[data-account-actions]');
  if (!actions) return;
  var login = actions.querySelector('[data-account-login]');
  var dashboard = actions.querySelector('[data-account-dashboard]');
  var logout = actions.querySelector('[data-confirm-logout]');
  var dashboardUrl = actions.getAttribute('data-dashboard-url');
  var siteAuthenticated = actions.getAttribute('data-site-authenticated') === 'true';
  var dashboardAuthenticated = false;
  var pending = false;
  async function authenticated(url) {
    try {
      var response = await fetch(url, { credentials: 'include', cache: 'no-store', signal: AbortSignal.timeout(5000) });
      if (!response.ok) return null;
      var status = await response.json();
      return typeof status.authenticated === 'boolean' ? status.authenticated : null;
    } catch (_) { return null; }
  }
  async function refresh() {
    if (pending) return;
    pending = true;
    try {
      var statuses = await Promise.all([authenticated('/api/session'), authenticated(new URL('/public/session', dashboardUrl).href)]);
      if (statuses[0] !== null) siteAuthenticated = statuses[0];
      if (statuses[1] !== null) dashboardAuthenticated = statuses[1];
      var signedIn = siteAuthenticated || dashboardAuthenticated;
      login.hidden = signedIn;
      dashboard.hidden = !signedIn;
      dashboard.href = dashboardAuthenticated ? dashboardUrl : '/sso/start';
      logout.hidden = !siteAuthenticated;
    } finally { pending = false; }
  }
  window.addEventListener('pageshow', refresh);
  document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible') refresh(); });
})();
`
