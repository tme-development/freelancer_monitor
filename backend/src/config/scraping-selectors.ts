/**
 * Centralised CSS selectors and extraction config for Freelancermap pages.
 * When Freelancermap changes its UI, update ONLY this file.
 */
export const SELECTORS = {
  login: {
    loginButton: 'button[data-testid="login-button"]',
    emailInput: 'input#login',
    passwordInput: 'input#password',
    submitButton: 'button[data-testid="next-button"]',
  },
  list: {
    projectCard: 'div.project-card',
    titleLink: 'a[data-testid="title"]',
    company: 'div.project-info > div.mg-b-display-m.line-height-base:first-child',
    skillBadge: 'a[data-id="project-card-keyword-link"]',
    city: '[data-testid="city"] a[data-id="project-card-city"]',
    country: '[data-testid="city"] a[data-id="project-card-country"]',
    remote: '[data-testid="remoteInPercent"]',
    type: '[data-testid="type"]',
    duration: '[data-testid="duration"]',
    startMonth: '[data-testid="beginningMonth"]',
    startText: '[data-testid="beginningText"]',
    created: '[data-testid="created"]',
    /** Desktop paginator root (`class="paginator desktop"`). */
    paginatorDesktopRoot: 'div.paginator.desktop',
    /** Mobile paginator root (`class="paginator mobile"`). */
    paginatorMobileRoot: 'div.paginator.mobile',
    /** Next control when another page exists (still needs tabindex/visibility checks in evaluate). */
    paginatorNextEnabled: 'div.paginator-item.next:not(.disabled)',
    /** Convenience: desktop-only clickable next (prefer {@link listPaginationStateEvaluateScript}). */
    paginatorNext: 'div.paginator.desktop div.paginator-item.next:not(.disabled)',
    paginatorItems: 'div.paginator.desktop div.paginator-item:not(.prev):not(.next)',
  },
  detail: {
    projectShowScript:
      'script.js-react-on-rails-component[data-component-name="ProjectShow"]',
  },
} as const;

export type ListPaginationState = {
  hasNext: boolean;
  clickSelector: string | null;
  pagenr: string;
};

/**
 * Browser evaluate script: returns JSON.stringify({ hasNext, clickSelector, pagenr }).
 * Uses the first visible paginator (desktop, then mobile) with a visible, enabled next control
 * (not .disabled, not tabindex="-1").
 */
export function listPaginationStateEvaluateScript(): string {
  const desktop = JSON.stringify(SELECTORS.list.paginatorDesktopRoot);
  const mobile = JSON.stringify(SELECTORS.list.paginatorMobileRoot);
  const nextSel = JSON.stringify(SELECTORS.list.paginatorNextEnabled);
  return `
(() => {
  function isVisible(el) {
    if (!el) return false;
    if (typeof el.checkVisibility === 'function') {
      try {
        return el.checkVisibility({ checkOpacity: true, contentVisibilityAuto: true });
      } catch (e) {}
    }
    const s = getComputedStyle(el);
    if (s.display === 'none' || s.visibility === 'hidden') return false;
    return el.offsetParent !== null || s.position === 'fixed';
  }
  const roots = [${desktop}, ${mobile}];
  const nextSelector = ${nextSel};
  let clickSelector = null;
  let hasNext = false;
  for (const rootSel of roots) {
    const root = document.querySelector(rootSel);
    if (!root || !isVisible(root)) continue;
    const nextEl = root.querySelector(nextSelector);
    if (!nextEl || !isVisible(nextEl)) continue;
    if (nextEl.getAttribute('tabindex') === '-1') continue;
    hasNext = true;
    clickSelector = rootSel + ' ' + nextSelector;
    break;
  }
  const pagenr = new URLSearchParams(window.location.search).get('pagenr') || '1';
  return JSON.stringify({ hasNext, clickSelector, pagenr });
})()
`;
}
