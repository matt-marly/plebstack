// Accessibility checks shared by the live runs: axe against WCAG 2.2 AA, reflow and clipped text, and a focus
// that is always visible.

import AxeBuilder from '@axe-core/playwright';

const TAGS = ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'];

// Every violation as one line: the rule, then the first element it names.
export async function axeViolations(page) {
  // Colours are measured at rest, not halfway through a fade; only endless loops are left running.
  await page.waitForFunction(() => document.getAnimations()
    .every(animation => animation.playState !== 'running' || animation.effect?.getTiming().iterations === Infinity), undefined, { timeout: 10_000 });
  const { violations } = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  return violations.map(found => {
    const first = found.nodes[0];
    const why = first?.any[0]?.message ?? first?.all[0]?.message ?? '';
    return `${found.id}: ${found.nodes.length} × ${first?.target.join(' ')} ${first?.html.slice(0, 80)} (${why || found.help})`;
  });
}

// No sideways scroll, and no text cut off by a box that hides its overflow. Visually hidden text is meant to be cut.
export async function reflowIssues(page) {
  return page.evaluate(() => {
    const found = [];
    const root = document.scrollingElement ?? document.documentElement;
    if (root.scrollWidth > root.clientWidth) found.push(`page scrolls sideways: ${root.scrollWidth} > ${root.clientWidth}`);
    for (const element of document.querySelectorAll('body *')) {
      if (element.closest('.visually-hidden, [aria-hidden="true"], [inert], svg')) continue;
      const style = getComputedStyle(element);
      if (style.display === 'none' || style.visibility === 'hidden') continue;
      const hides = [style.overflowX, style.overflowY].some(value => value === 'hidden' || value === 'clip');
      const ellipsis = style.textOverflow === 'ellipsis';
      if (!hides && !ellipsis) continue;
      if (!element.textContent.trim()) continue;
      if (element.scrollWidth > element.clientWidth + 1 || (hides && element.scrollHeight > element.clientHeight + 1)) {
        found.push(`clipped: ${element.tagName.toLowerCase()}.${element.getAttribute('class') ?? ''} "${element.textContent.trim().slice(0, 40)}"`);
      }
    }
    return found;
  });
}

// What has focus, and whether it shows a ring a sighted keyboard user can see.
export async function focused(page) {
  return page.evaluate(() => {
    const element = document.activeElement;
    if (!element || element === document.body) return { name: '', tag: 'body', ring: false, inView: false };
    const style = getComputedStyle(element);
    const box = element.getBoundingClientRect();
    const ring = (style.outlineStyle !== 'none' && parseFloat(style.outlineWidth) >= 2) || style.boxShadow !== 'none';
    const name = element.getAttribute('aria-label') || element.textContent.trim().replace(/\s+/g, ' ').slice(0, 60);
    return {
      name, tag: element.tagName.toLowerCase(), ring, lime: style.outlineColor === 'rgb(200, 241, 53)',
      inView: box.bottom > 0 && box.top < innerHeight && box.width > 0,
    };
  });
}
