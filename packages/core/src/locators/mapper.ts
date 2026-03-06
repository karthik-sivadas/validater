import type { Page, Locator } from 'playwright';
import type { LocatorStrategy, LocatorType } from '../types/index.js';

/**
 * Map a LocatorStrategy to a Playwright Locator object.
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
 * For role-type locators, parses the value as either "roleName" or
 * "roleName: accessible name" format.
 */
export function mapLocatorToPlaywright(page: Page, locator: LocatorStrategy): Locator {
  const locatorTypeMap: Record<LocatorType, () => Locator> = {
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
