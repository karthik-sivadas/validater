import { vi, describe, it, expect } from 'vitest';
import { createMockPage, createMockLocator } from '@validater/core/__test-utils__';
import { mapLocatorToPlaywright } from '../mapper.js';
import type { LocatorStrategy } from '../../types/index.js';

function locator(type: LocatorStrategy['type'], value: string): LocatorStrategy {
  return { type, value, confidence: 0.9, reasoning: 'test' };
}

describe('mapLocatorToPlaywright', () => {
  it('maps role type to page.getByRole()', () => {
    const page = createMockPage();
    mapLocatorToPlaywright(page, locator('role', 'button'));
    expect(page.getByRole).toHaveBeenCalledWith('button');
  });

  it('maps role with accessible name to page.getByRole() with name option', () => {
    const page = createMockPage();
    mapLocatorToPlaywright(page, locator('role', 'button: Submit'));
    expect(page.getByRole).toHaveBeenCalledWith('button', { name: 'Submit' });
  });

  it('maps text type to page.getByText()', () => {
    const page = createMockPage();
    mapLocatorToPlaywright(page, locator('text', 'Sign in'));
    expect(page.getByText).toHaveBeenCalledWith('Sign in');
  });

  it('maps label type to page.getByLabel()', () => {
    const page = createMockPage();
    mapLocatorToPlaywright(page, locator('label', 'Email'));
    expect(page.getByLabel).toHaveBeenCalledWith('Email');
  });

  it('maps placeholder type to page.getByPlaceholder()', () => {
    const page = createMockPage();
    mapLocatorToPlaywright(page, locator('placeholder', 'Enter email'));
    expect(page.getByPlaceholder).toHaveBeenCalledWith('Enter email');
  });

  it('maps testId type to page.getByTestId()', () => {
    const page = createMockPage();
    mapLocatorToPlaywright(page, locator('testId', 'submit-btn'));
    expect(page.getByTestId).toHaveBeenCalledWith('submit-btn');
  });

  it('maps css type to page.locator()', () => {
    const page = createMockPage();
    mapLocatorToPlaywright(page, locator('css', '.submit-button'));
    expect(page.locator).toHaveBeenCalledWith('.submit-button');
  });

  it('maps xpath type to page.locator() with xpath= prefix', () => {
    const page = createMockPage();
    mapLocatorToPlaywright(page, locator('xpath', '//button[@id="submit"]'));
    expect(page.locator).toHaveBeenCalledWith('xpath=//button[@id="submit"]');
  });

  it('returns the locator result from the page method', () => {
    const mockLocator = createMockLocator();
    const page = createMockPage({ getByText: vi.fn(() => mockLocator) });
    const result = mapLocatorToPlaywright(page, locator('text', 'Hello'));
    expect(result).toBe(mockLocator);
  });

  it('handles role type with extra whitespace', () => {
    const page = createMockPage();
    mapLocatorToPlaywright(page, locator('role', '  button  :  Submit  '));
    expect(page.getByRole).toHaveBeenCalledWith('button', { name: 'Submit' });
  });

  it('handles role type without accessible name (no colon)', () => {
    const page = createMockPage();
    mapLocatorToPlaywright(page, locator('role', 'link'));
    expect(page.getByRole).toHaveBeenCalledWith('link');
  });
});
