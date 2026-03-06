import type { CheerioAPI } from 'cheerio';
import type { InteractiveElement, SemanticElement } from '../types/dom.js';

const INTERACTIVE_SELECTOR = [
  'a',
  'button',
  'input',
  'select',
  'textarea',
  '[role="button"]',
  '[role="link"]',
  '[role="tab"]',
  '[role="menuitem"]',
  '[contenteditable="true"]',
].join(', ');

const SEMANTIC_SELECTOR = [
  'main',
  'nav',
  'header',
  'footer',
  'aside',
  'section',
  'article',
  'form',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  '[role="navigation"]',
  '[role="main"]',
  '[role="banner"]',
].join(', ');

/** Common Tailwind/utility-class prefixes */
const UTILITY_PREFIXES = [
  'flex',
  'grid',
  'block',
  'inline',
  'hidden',
  'absolute',
  'relative',
  'fixed',
  'sticky',
  'overflow',
  'z-',
  'p-',
  'px-',
  'py-',
  'pt-',
  'pr-',
  'pb-',
  'pl-',
  'm-',
  'mx-',
  'my-',
  'mt-',
  'mr-',
  'mb-',
  'ml-',
  'w-',
  'h-',
  'min-',
  'max-',
  'text-',
  'font-',
  'leading-',
  'tracking-',
  'bg-',
  'border-',
  'rounded-',
  'shadow-',
  'opacity-',
  'transition-',
  'transform',
  'translate-',
  'rotate-',
  'scale-',
  'gap-',
  'space-',
  'divide-',
  'ring-',
  'sr-only',
  'not-sr-only',
  'container',
  'aspect-',
  'object-',
  'cursor-',
  'select-',
  'appearance-',
];

/**
 * Returns true for Tailwind-like utility classes.
 * Matches common prefixes and responsive/state modifiers (e.g., md:, lg:, hover:).
 */
export function isUtilityClass(className: string): boolean {
  // Responsive/state modifiers contain colons: "md:flex", "hover:bg-blue-500"
  if (className.includes(':')) return true;
  // Check against known utility prefixes
  return UTILITY_PREFIXES.some(
    (prefix) => className === prefix || className.startsWith(prefix),
  );
}

function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + '...';
}

function getVisibleText($el: ReturnType<CheerioAPI>, maxLength = 100): string {
  const text = $el.text().replace(/\s+/g, ' ').trim();
  return truncate(text, maxLength);
}

function escapeXPathString(value: string): string {
  if (!value.includes("'")) return `'${value}'`;
  if (!value.includes('"')) return `"${value}"`;
  // Contains both quotes -- use concat
  const parts = value.split("'").map((p) => `'${p}'`);
  return `concat(${parts.join(", \"'\", ")})`;
}

function escapeCssAttrValue(value: string): string {
  return value.replace(/"/g, '\\"');
}

/**
 * Generate a simple XPath for an interactive element.
 * Prefers text content or name/id attributes for readability.
 */
function generateXPath(
  _$: CheerioAPI,
  el: ReturnType<CheerioAPI>,
): string {
  const tag = el.prop('tagName')?.toLowerCase() ?? '*';
  const name = el.attr('name');
  const id = el.attr('id');
  const testId = el.attr('data-testid');
  const text = el.text().replace(/\s+/g, ' ').trim();

  if (id) return `//${tag}[@id='${id}']`;
  if (testId) return `//${tag}[@data-testid='${testId}']`;
  if (name) return `//${tag}[@name='${name}']`;
  if (text && text.length <= 50) {
    return `//${tag}[contains(text(),${escapeXPathString(text)})]`;
  }
  return `//${tag}`;
}

/**
 * Generate a unique CSS selector for an element.
 * Priority: #id > [data-testid] > tag.class:nth-of-type
 */
function generateCssSelector(
  $: CheerioAPI,
  el: ReturnType<CheerioAPI>,
): string {
  const tag = el.prop('tagName')?.toLowerCase() ?? '';
  const id = el.attr('id');
  const testId = el.attr('data-testid');

  if (id) return `#${id}`;
  if (testId) return `[data-testid="${escapeCssAttrValue(testId)}"]`;

  // Build selector from tag and non-utility classes
  const classAttr = el.attr('class') ?? '';
  const classes = classAttr
    .split(/\s+/)
    .filter((c) => c && !isUtilityClass(c));
  const classSelector = classes.length > 0 ? `.${classes.join('.')}` : '';
  const base = `${tag}${classSelector}`;

  // Find nth-of-type for specificity
  const parent = el.parent();
  if (parent.length > 0) {
    const siblings = parent.children(tag);
    if (siblings.length > 1) {
      let index = 0;
      siblings.each((i, sib) => {
        if ($(sib).is(el)) index = i + 1;
      });
      if (index > 0) return `${base}:nth-of-type(${index})`;
    }
  }

  return base;
}

/**
 * Find the label text associated with an element.
 * Checks for: label[for=id], wrapping label element.
 */
function findLabel($: CheerioAPI, el: ReturnType<CheerioAPI>): string | undefined {
  const id = el.attr('id');
  if (id) {
    const labelEl = $(`label[for="${escapeCssAttrValue(id)}"]`);
    if (labelEl.length > 0) {
      const text = labelEl.text().replace(/\s+/g, ' ').trim();
      if (text) return truncate(text, 100);
    }
  }
  // Check wrapping label
  const parentLabel = el.closest('label');
  if (parentLabel.length > 0) {
    const text = parentLabel.text().replace(/\s+/g, ' ').trim();
    if (text) return truncate(text, 100);
  }
  return undefined;
}

/**
 * Get the accessible name for an interactive element.
 * Priority: aria-label > aria-labelledby target > visible text
 */
function getAccessibleName(
  $: CheerioAPI,
  el: ReturnType<CheerioAPI>,
): string | undefined {
  const ariaLabel = el.attr('aria-label');
  if (ariaLabel) return truncate(ariaLabel, 100);

  const labelledBy = el.attr('aria-labelledby');
  if (labelledBy) {
    const targetText = labelledBy
      .split(/\s+/)
      .map((id) => $(`#${id}`).text().trim())
      .filter(Boolean)
      .join(' ');
    if (targetText) return truncate(targetText, 100);
  }

  const text = getVisibleText(el);
  if (text) return text;

  return undefined;
}

/**
 * Extract data-* and aria-* attributes from an element.
 */
function extractDataAndAriaAttributes(
  el: ReturnType<CheerioAPI>,
): Record<string, string> {
  const result: Record<string, string> = {};
  const attribs = (el.get(0) as unknown as { attribs?: Record<string, string> })?.attribs;
  if (!attribs) return result;
  for (const [key, value] of Object.entries(attribs)) {
    if ((key.startsWith('data-') || key.startsWith('aria-')) && value !== undefined) {
      result[key] = value;
    }
  }
  return result;
}

/**
 * Extract all interactive elements from a Cheerio-parsed DOM.
 * Returns elements sorted in DOM order with accessible metadata.
 */
export function extractInteractiveElements(
  $: CheerioAPI,
): InteractiveElement[] {
  const elements: InteractiveElement[] = [];

  $(INTERACTIVE_SELECTOR).each((_i, node) => {
    const el = $(node);
    const tag = el.prop('tagName')?.toLowerCase() ?? '';

    elements.push({
      tag,
      type: tag === 'input' ? (el.attr('type') ?? 'text') : undefined,
      role: el.attr('role') ?? undefined,
      name: getAccessibleName($, el),
      label: findLabel($, el),
      placeholder: el.attr('placeholder') ?? undefined,
      testId: el.attr('data-testid') ?? undefined,
      text: getVisibleText(el) || undefined,
      value: el.attr('value') ?? undefined,
      attributes: extractDataAndAriaAttributes(el),
      xpath: generateXPath($, el),
      cssSelector: generateCssSelector($, el),
    });
  });

  return elements;
}

/**
 * Extract semantic/landmark elements from a Cheerio-parsed DOM.
 * Returns a shallow tree structure (max 2 levels deep).
 */
export function extractSemanticElements(
  $: CheerioAPI,
): SemanticElement[] {
  const topLevel: SemanticElement[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const processed = new Set<any>();

  // First pass: find top-level semantic elements
  $(SEMANTIC_SELECTOR).each((_i, node) => {
    const el = $(node);
    // Skip if this element is nested inside another semantic element we already found
    const parentSemantic = el.parents(SEMANTIC_SELECTOR);
    if (parentSemantic.length > 0 && parentSemantic.toArray().some((p) => processed.has(p))) {
      return;
    }

    processed.add(node);
    const tag = el.prop('tagName')?.toLowerCase() ?? '';

    const element: SemanticElement = {
      tag,
      role: el.attr('role') ?? undefined,
      text: getVisibleText(el) || undefined,
      attributes: extractDataAndAriaAttributes(el),
    };

    // Second level: find child semantic elements (max 1 level deep)
    const children: SemanticElement[] = [];
    el.children(SEMANTIC_SELECTOR).each((_j, childNode) => {
      const childEl = $(childNode);
      processed.add(childNode);
      const childTag = childEl.prop('tagName')?.toLowerCase() ?? '';
      children.push({
        tag: childTag,
        role: childEl.attr('role') ?? undefined,
        text: getVisibleText(childEl) || undefined,
        attributes: extractDataAndAriaAttributes(childEl),
      });
    });

    if (children.length > 0) {
      element.children = children;
    }

    topLevel.push(element);
  });

  return topLevel;
}
