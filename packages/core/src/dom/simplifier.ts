import * as cheerio from 'cheerio';
import type { SimplifiedDom, PageContext } from '../types/dom.js';
import {
  extractInteractiveElements,
  extractSemanticElements,
  isUtilityClass,
} from './extractor.js';

/** Elements that provide no semantic value for LLM context */
const STRIP_ELEMENTS = [
  'script',
  'style',
  'noscript',
  'svg',
  'path',
  'meta',
  'link',
  'head',
  'iframe',
].join(', ');

/** Selectors for hidden elements */
const HIDDEN_SELECTORS = [
  '[hidden]',
  '[aria-hidden="true"]',
  '[style*="display: none"]',
  '[style*="display:none"]',
  '[style*="visibility: hidden"]',
  '[style*="visibility:hidden"]',
].join(', ');

/** Estimate token count from HTML string (4 chars per token heuristic) */
function estimateTokens(html: string): number {
  return Math.ceil(html.length / 4);
}

export interface SimplifyDomOptions {
  maxTokenEstimate?: number;
  includeAriaSnapshot?: string;
}

/**
 * Simplify raw HTML into a token-efficient representation suitable for LLM context.
 *
 * Strips non-semantic elements, hidden content, utility classes, and enforces
 * a token budget with progressive reduction.
 */
export function simplifyDom(
  html: string,
  options?: SimplifyDomOptions,
): SimplifiedDom {
  const maxTokenEstimate = options?.maxTokenEstimate ?? 15000;
  const $ = cheerio.load(html);

  // 1. Strip non-semantic elements
  $(STRIP_ELEMENTS).remove();

  // 2. Remove hidden elements
  $(HIDDEN_SELECTORS).remove();

  // 3. Strip all style attributes
  $('[style]').removeAttr('style');

  // 4. Clean class attributes: keep only non-utility classes
  $('[class]').each((_i, el) => {
    const $el = $(el);
    const classAttr = $el.attr('class') ?? '';
    const semanticClasses = classAttr
      .split(/\s+/)
      .filter((c) => c && !isUtilityClass(c));
    if (semanticClasses.length > 0) {
      $el.attr('class', semanticClasses.join(' '));
    } else {
      $el.removeAttr('class');
    }
  });

  // 5. Remove empty wrappers (iterate until stable)
  let previousCount = -1;
  let currentCount = 0;
  while (previousCount !== currentCount) {
    previousCount = $('div:empty, span:empty').length;
    $('div:empty, span:empty').remove();
    currentCount = $('div:empty, span:empty').length;
  }

  // 6. Remove data attributes EXCEPT data-testid
  $('*').each((_i, el) => {
    const $el = $(el);
    const attribs = (el as unknown as { attribs?: Record<string, string> }).attribs;
    if (!attribs) return;
    for (const key of Object.keys(attribs)) {
      if (key.startsWith('data-') && key !== 'data-testid') {
        $el.removeAttr(key);
      }
    }
  });

  // 7. Extract interactive and semantic elements
  const interactiveElements = extractInteractiveElements($);
  const semanticElements = extractSemanticElements($);

  // 8. Estimate tokens and apply progressive reduction if over budget
  let tokenEstimate = estimateTokens($.html());

  if (tokenEstimate > maxTokenEstimate) {
    // Step A: Remove non-interactive, non-landmark elements
    const interactiveTags = new Set([
      'a', 'button', 'input', 'select', 'textarea',
    ]);
    const landmarkTags = new Set([
      'main', 'nav', 'header', 'footer', 'aside',
      'section', 'article', 'form',
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    ]);

    $('body *').each((_i, el) => {
      const $el = $(el);
      const tag = $el.prop('tagName')?.toLowerCase() ?? '';
      const role = $el.attr('role');
      const isInteractive =
        interactiveTags.has(tag) ||
        role === 'button' ||
        role === 'link' ||
        role === 'tab' ||
        role === 'menuitem' ||
        $el.attr('contenteditable') === 'true';
      const isLandmark =
        landmarkTags.has(tag) ||
        role === 'navigation' ||
        role === 'main' ||
        role === 'banner';

      if (!isInteractive && !isLandmark) {
        // Replace with just text content to preserve context
        const text = $el.text().replace(/\s+/g, ' ').trim();
        if (text) {
          $el.replaceWith(text);
        } else {
          $el.remove();
        }
      }
    });

    tokenEstimate = estimateTokens($.html());
  }

  if (tokenEstimate > maxTokenEstimate) {
    // Step B: Truncate text nodes to 50 chars max
    $('*')
      .contents()
      .filter(function () {
        return this.type === 'text';
      })
      .each(function () {
        const textNode = this as unknown as { data?: string };
        if (textNode.data && textNode.data.length > 50) {
          textNode.data = textNode.data.slice(0, 47) + '...';
        }
      });

    tokenEstimate = estimateTokens($.html());
  }

  if (tokenEstimate > maxTokenEstimate) {
    // Step C: Drop attributes from semantic elements
    for (const elem of semanticElements) {
      elem.attributes = {};
      if (elem.children) {
        for (const child of elem.children) {
          child.attributes = {};
        }
      }
    }

    tokenEstimate = estimateTokens($.html());
  }

  // 9. Build PageContext
  const titleText = $('title').text().trim() || '';
  const mainLandmarks = semanticElements
    .map((el) => el.role ?? el.tag)
    .filter(Boolean);

  const pageContext: PageContext = {
    title: titleText,
    url: '', // URL is set by the caller (crawlPage provides it)
    mainLandmarks: mainLandmarks.length > 0 ? mainLandmarks : undefined,
  };

  return {
    elements: semanticElements,
    interactiveElements,
    pageContext,
    tokenEstimate,
  };
}
