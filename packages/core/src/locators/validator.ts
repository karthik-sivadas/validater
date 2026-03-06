import type { Page } from 'playwright';
import type {
  TestStep,
  LocatorStrategy,
  LocatorType,
} from '../types/index.js';
import type {
  LocatorVerification,
  ValidationResult,
} from '../types/generation.js';

/**
 * Map a LocatorStrategy to a Playwright locator and check if the element exists.
 *
 * Supports all 7 locator types:
 * - role: page.getByRole() with optional accessible name
 * - text: page.getByText()
 * - label: page.getByLabel()
 * - placeholder: page.getByPlaceholder()
 * - testId: page.getByTestId()
 * - css: page.locator()
 * - xpath: page.locator(`xpath=...`)
 *
 * Returns found/count/isUnique. Invalid selectors return found: false (no throw).
 */
export async function verifyLocator(
  page: Page,
  locator: LocatorStrategy,
): Promise<LocatorVerification> {
  try {
    const pwLocator = mapLocatorToPlaywright(page, locator);
    const count = await pwLocator.count();

    return {
      locator,
      found: count > 0,
      count,
      isUnique: count === 1,
    };
  } catch {
    // Invalid selectors (malformed CSS, bad XPath, etc.) should not throw
    return {
      locator,
      found: false,
      count: 0,
      isUnique: false,
    };
  }
}

/**
 * Verify ALL locators in a test step against a live page.
 *
 * Checks every locator in step.target.locators, determines if the primary
 * locator (at primaryLocatorIndex) is valid, and reports overall validity
 * (true if at least one locator found the element).
 */
export async function verifyStepLocators(
  page: Page,
  step: TestStep,
): Promise<ValidationResult> {
  const locatorResults: LocatorVerification[] = await Promise.all(
    step.target.locators.map((locator) => verifyLocator(page, locator)),
  );

  const primaryIndex = step.target.primaryLocatorIndex;
  const primaryResult = locatorResults[primaryIndex];
  const primaryLocatorValid = primaryResult?.found ?? false;

  const isValid = locatorResults.some((r) => r.found);

  return {
    stepId: step.id,
    stepOrder: step.order,
    locatorResults,
    primaryLocatorValid,
    isValid,
  };
}

/**
 * Map a LocatorStrategy to a Playwright Locator object.
 *
 * For role-type locators, parses the value as either "roleName" or
 * "roleName: accessible name" format.
 */
function mapLocatorToPlaywright(page: Page, locator: LocatorStrategy) {
  const locatorTypeMap: Record<LocatorType, () => ReturnType<Page['locator']>> =
    {
      role: () => {
        // Parse "roleName" or "roleName: accessible name"
        const colonIndex = locator.value.indexOf(':');
        if (colonIndex !== -1) {
          const role = locator.value.slice(0, colonIndex).trim();
          const name = locator.value.slice(colonIndex + 1).trim();
          return page.getByRole(role as Parameters<Page['getByRole']>[0], {
            name,
          });
        }
        return page.getByRole(
          locator.value.trim() as Parameters<Page['getByRole']>[0],
        );
      },
      text: () => page.getByText(locator.value),
      label: () => page.getByLabel(locator.value),
      placeholder: () => page.getByPlaceholder(locator.value),
      testId: () => page.getByTestId(locator.value),
      css: () => page.locator(locator.value),
      xpath: () => page.locator(`xpath=${locator.value}`),
    };

  return locatorTypeMap[locator.type]();
}
