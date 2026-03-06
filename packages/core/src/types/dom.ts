export interface CrawlOptions {
  url: string;
  viewport?: { width: number; height: number };
  waitUntil?: 'load' | 'domcontentloaded' | 'networkidle';
  timeout?: number; // default 30000
}

export interface CrawlResult {
  html: string;
  ariaSnapshot: string;
  title: string;
  url: string;
  viewport: { width: number; height: number };
}

export interface SemanticElement {
  tag: string;
  role?: string;
  text?: string;
  attributes: Record<string, string>;
  children?: SemanticElement[];
}

export interface InteractiveElement {
  tag: string;
  type?: string; // input type
  role?: string;
  name?: string; // accessible name
  label?: string;
  placeholder?: string;
  testId?: string;
  text?: string;
  value?: string;
  attributes: Record<string, string>;
  xpath: string;
  cssSelector: string;
}

export interface PageContext {
  title: string;
  url: string;
  language?: string;
  mainLandmarks?: string[];
}

export interface SimplifiedDom {
  html: string;
  elements: SemanticElement[];
  interactiveElements: InteractiveElement[];
  pageContext: PageContext;
  tokenEstimate: number;
}
