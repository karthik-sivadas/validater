import { describe, it, expect } from 'vitest';
import * as cheerio from 'cheerio';
import {
  extractInteractiveElements,
  extractSemanticElements,
  isUtilityClass,
} from '../extractor.js';

describe('isUtilityClass', () => {
  it.each(['flex', 'p-4', 'text-sm', 'bg-blue-500', 'rounded-lg', 'shadow-md', 'grid', 'hidden'])(
    'returns true for utility class "%s"',
    (cls) => {
      expect(isUtilityClass(cls)).toBe(true);
    },
  );

  it.each(['login-button', 'main-nav', 'sidebar', 'card-title', 'user-avatar'])(
    'returns false for semantic class "%s"',
    (cls) => {
      expect(isUtilityClass(cls)).toBe(false);
    },
  );

  it('returns true for responsive/state modifiers (contains colon)', () => {
    expect(isUtilityClass('md:flex')).toBe(true);
    expect(isUtilityClass('hover:bg-blue-500')).toBe(true);
    expect(isUtilityClass('lg:hidden')).toBe(true);
  });

  it('returns true for exact prefix matches', () => {
    expect(isUtilityClass('container')).toBe(true);
    expect(isUtilityClass('transform')).toBe(true);
    expect(isUtilityClass('sr-only')).toBe(true);
  });
});

describe('extractInteractiveElements', () => {
  it('finds buttons', () => {
    const $ = cheerio.load('<html><body><button>Click me</button></body></html>');
    const elements = extractInteractiveElements($);
    expect(elements).toHaveLength(1);
    expect(elements[0]!.tag).toBe('button');
    expect(elements[0]!.text).toContain('Click me');
  });

  it('finds inputs', () => {
    const $ = cheerio.load('<html><body><input type="email" placeholder="Email" /></body></html>');
    const elements = extractInteractiveElements($);
    expect(elements).toHaveLength(1);
    expect(elements[0]!.tag).toBe('input');
    expect(elements[0]!.type).toBe('email');
    expect(elements[0]!.placeholder).toBe('Email');
  });

  it('finds links', () => {
    const $ = cheerio.load('<html><body><a href="/home">Home</a></body></html>');
    const elements = extractInteractiveElements($);
    expect(elements).toHaveLength(1);
    expect(elements[0]!.tag).toBe('a');
    expect(elements[0]!.text).toContain('Home');
  });

  it('finds selects and textareas', () => {
    const $ = cheerio.load(
      '<html><body><select><option>A</option></select><textarea>Text</textarea></body></html>',
    );
    const elements = extractInteractiveElements($);
    expect(elements).toHaveLength(2);
    expect(elements.map((e) => e.tag)).toContain('select');
    expect(elements.map((e) => e.tag)).toContain('textarea');
  });

  it('finds elements with role="button"', () => {
    const $ = cheerio.load('<html><body><div role="button">Action</div></body></html>');
    const elements = extractInteractiveElements($);
    expect(elements).toHaveLength(1);
    expect(elements[0]!.role).toBe('button');
  });

  it('includes data-testid when present', () => {
    const $ = cheerio.load('<html><body><button data-testid="submit-btn">Submit</button></body></html>');
    const elements = extractInteractiveElements($);
    expect(elements[0]!.testId).toBe('submit-btn');
  });

  it('generates xpath and cssSelector for each element', () => {
    const $ = cheerio.load('<html><body><button id="my-btn">Click</button></body></html>');
    const elements = extractInteractiveElements($);
    expect(elements[0]!.xpath).toContain('button');
    expect(elements[0]!.cssSelector).toBeDefined();
  });

  it('finds associated label for inputs', () => {
    const $ = cheerio.load(
      '<html><body><label for="email">Email</label><input id="email" type="text" /></body></html>',
    );
    const elements = extractInteractiveElements($);
    const input = elements.find((e) => e.tag === 'input');
    expect(input?.label).toBe('Email');
  });

  it('returns empty array for no interactive elements', () => {
    const $ = cheerio.load('<html><body><p>Just text</p></body></html>');
    const elements = extractInteractiveElements($);
    expect(elements).toHaveLength(0);
  });
});

describe('extractSemanticElements', () => {
  it('finds headings', () => {
    const $ = cheerio.load('<html><body><h1>Title</h1><h2>Subtitle</h2></body></html>');
    const elements = extractSemanticElements($);
    expect(elements.map((e) => e.tag)).toContain('h1');
    expect(elements.map((e) => e.tag)).toContain('h2');
  });

  it('finds landmark elements (main, nav, header, footer)', () => {
    const $ = cheerio.load(
      '<html><body><header>Top</header><main>Content</main><nav>Links</nav><footer>Bottom</footer></body></html>',
    );
    const elements = extractSemanticElements($);
    const tags = elements.map((e) => e.tag);
    expect(tags).toContain('header');
    expect(tags).toContain('main');
    expect(tags).toContain('nav');
    expect(tags).toContain('footer');
  });

  it('finds form elements', () => {
    const $ = cheerio.load('<html><body><form><input type="text" /></form></body></html>');
    const elements = extractSemanticElements($);
    expect(elements.map((e) => e.tag)).toContain('form');
  });

  it('finds elements with role="navigation"', () => {
    const $ = cheerio.load('<html><body><div role="navigation">Nav</div></body></html>');
    const elements = extractSemanticElements($);
    expect(elements.some((e) => e.role === 'navigation')).toBe(true);
  });

  it('returns empty array for no semantic elements', () => {
    const $ = cheerio.load('<html><body><div><span>text</span></div></body></html>');
    const elements = extractSemanticElements($);
    expect(elements).toHaveLength(0);
  });
});
