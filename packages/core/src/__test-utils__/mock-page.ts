import { vi } from 'vitest';

export function createMockLocator(
  overrides?: Partial<Record<string, unknown>>,
) {
  return {
    count: vi.fn(() => Promise.resolve(1)),
    click: vi.fn(),
    fill: vi.fn(),
    selectOption: vi.fn(),
    check: vi.fn(),
    hover: vi.fn(),
    waitFor: vi.fn(),
    isVisible: vi.fn(() => Promise.resolve(true)),
    isHidden: vi.fn(() => Promise.resolve(false)),
    textContent: vi.fn(() => Promise.resolve('text')),
    inputValue: vi.fn(() => Promise.resolve('value')),
    getAttribute: vi.fn(() => Promise.resolve('attr')),
    ariaSnapshot: vi.fn(() => Promise.resolve('')),
    ...overrides,
  } as unknown as import('playwright').Locator;
}

export function createMockPage(
  overrides?: Partial<Record<string, unknown>>,
) {
  return {
    url: vi.fn(() => 'https://example.com'),
    goto: vi.fn(),
    screenshot: vi.fn(() => Promise.resolve(Buffer.from('fake-png'))),
    evaluate: vi.fn(),
    locator: vi.fn(() => createMockLocator()),
    getByRole: vi.fn(() => createMockLocator()),
    getByText: vi.fn(() => createMockLocator()),
    getByLabel: vi.fn(() => createMockLocator()),
    getByPlaceholder: vi.fn(() => createMockLocator()),
    getByTestId: vi.fn(() => createMockLocator()),
    waitForTimeout: vi.fn(),
    content: vi.fn(() => Promise.resolve('<html></html>')),
    title: vi.fn(() => Promise.resolve('Test Page')),
    ...overrides,
  } as unknown as import('playwright').Page;
}
