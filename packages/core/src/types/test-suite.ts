export type TestCaseCategory = 'happy_path' | 'edge_case' | 'error_state' | 'boundary';
export type TestCasePriority = 'critical' | 'high' | 'medium' | 'low';

/** Single test case specification produced by AI suite generation (Stage 1). */
export interface TestCaseSpec {
  name: string;
  description: string; // Self-contained test description (feeds into generateTestSteps)
  category: TestCaseCategory;
  priority: TestCasePriority;
  reasoning: string; // Why this test case is needed
}

/** Full suite specification produced by AI suite generation. */
export interface TestSuiteSpec {
  testCases: TestCaseSpec[];
  reasoning: string; // Overall coverage strategy
}
