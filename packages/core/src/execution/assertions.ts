import type { Page, Locator } from 'playwright';
import type { TestStep } from '../types/index.js';

/**
 * Error thrown when an assertion check fails.
 * Contains the assertion type, expected value, and actual value for structured error reporting.
 */
export class AssertionError extends Error {
  public readonly assertionType: string;
  public readonly expected: string;
  public readonly actual: string;

  constructor(assertionType: string, expected: string, actual: string) {
    super(`Assertion failed [${assertionType}]: expected "${expected}", got "${actual}"`);
    this.name = 'AssertionError';
    this.assertionType = assertionType;
    this.expected = expected;
    this.actual = actual;
  }
}

/**
 * Check an assertion against the current page/locator state.
 *
 * Page-level assertions (url) operate on page.url() directly.
 * Locator-level assertions (visible, hidden, text, value, count, attribute)
 * require a resolved Playwright Locator.
 *
 * Throws AssertionError on assertion failure with expected/actual values.
 * Returns void on success.
 */
export async function checkAssertion(
  page: Page,
  step: TestStep,
  locator?: Locator,
): Promise<void> {
  const assertion = step.assertion;
  if (!assertion) return;

  const { type, expected } = assertion;

  // Page-level assertion: url
  if (type === 'url') {
    const currentUrl = page.url();
    if (!currentUrl.includes(expected)) {
      throw new AssertionError('url', expected, currentUrl);
    }
    return;
  }

  // Locator-level assertions require a locator
  if (!locator) {
    throw new Error(`Assertion type "${type}" requires a locator, but none was resolved`);
  }

  switch (type) {
    case 'visible': {
      const isVisible = await locator.isVisible();
      if (!isVisible) {
        throw new AssertionError('visible', 'visible', 'not visible');
      }
      break;
    }

    case 'hidden': {
      const isHidden = await locator.isHidden();
      if (!isHidden) {
        throw new AssertionError('hidden', 'hidden', 'visible');
      }
      break;
    }

    case 'text': {
      const textContent = await locator.textContent() ?? '';
      if (!textContent.includes(expected)) {
        throw new AssertionError('text', expected, textContent);
      }
      break;
    }

    case 'value': {
      const inputValue = await locator.inputValue();
      if (inputValue !== expected) {
        throw new AssertionError('value', expected, inputValue);
      }
      break;
    }

    case 'count': {
      const count = await locator.count();
      const expectedCount = parseInt(expected, 10);
      if (count !== expectedCount) {
        throw new AssertionError('count', expected, String(count));
      }
      break;
    }

    case 'attribute': {
      // Parse expected as "attrName=expectedValue"
      const eqIndex = expected.indexOf('=');
      if (eqIndex === -1) {
        throw new Error(`Invalid attribute assertion format: "${expected}". Expected "attrName=expectedValue"`);
      }
      const attrName = expected.slice(0, eqIndex);
      const expectedValue = expected.slice(eqIndex + 1);
      const actualValue = await locator.getAttribute(attrName) ?? '';
      if (actualValue !== expectedValue) {
        throw new AssertionError('attribute', `${attrName}=${expectedValue}`, `${attrName}=${actualValue}`);
      }
      break;
    }
  }
}
