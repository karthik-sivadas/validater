/**
 * User prompt templates for AI test generation.
 *
 * These functions build the user-facing messages that combine DOM context,
 * ARIA snapshots, and test descriptions into structured prompts for the AI.
 */

/**
 * Build the user prompt for test step generation.
 *
 * Combines the simplified DOM, ARIA snapshot, and test description into
 * a structured prompt with clear sections.
 */
export function buildUserPrompt(
  simplifiedDomHtml: string,
  ariaSnapshot: string,
  testDescription: string,
): string {
  return `## Target Page Structure

### Simplified DOM
\`\`\`html
${simplifiedDomHtml}
\`\`\`

### Accessibility Tree (ARIA Snapshot)
\`\`\`
${ariaSnapshot}
\`\`\`

## Test Description
${testDescription}

## Instructions
Generate test steps that accomplish the described test. Ground every locator in the DOM and ARIA snapshot above. Prefer semantic locators (role, text, label) over structural ones (css, xpath). Provide at least 2 locator strategies per target element for fallback resilience.`;
}

/**
 * Build a validation/self-healing prompt for failed locators.
 *
 * Given a step with failed locators and the verification results,
 * asks the AI to suggest alternative locators. Used in Plan 02-04
 * for self-healing but defined here to co-locate all prompt logic.
 */
export function buildValidationPrompt(
  step: {
    order: number;
    action: string;
    description: string;
    target: {
      elementDescription: string;
      locators: Array<{ type: string; value: string; confidence: number; reasoning: string }>;
    };
  },
  verificationResults: {
    failedLocators: Array<{ type: string; value: string; error: string }>;
    currentDomHtml: string;
    currentAriaSnapshot: string;
  },
): string {
  const failedList = verificationResults.failedLocators
    .map((f) => `- ${f.type}: "${f.value}" -- Error: ${f.error}`)
    .join('\n');

  return `## Self-Healing Request

A test step has locators that no longer match the current page state. Suggest replacement locators grounded in the updated DOM and ARIA snapshot.

### Original Step
- **Order:** ${step.order}
- **Action:** ${step.action}
- **Description:** ${step.description}
- **Target:** ${step.target.elementDescription}

### Failed Locators
${failedList}

### Original Locators
${step.target.locators
  .map((l) => `- ${l.type}: "${l.value}" (confidence: ${l.confidence}) -- ${l.reasoning}`)
  .join('\n')}

### Current Page Structure

#### Simplified DOM
\`\`\`html
${verificationResults.currentDomHtml}
\`\`\`

#### Accessibility Tree (ARIA Snapshot)
\`\`\`
${verificationResults.currentAriaSnapshot}
\`\`\`

### Instructions
Analyze the current DOM and ARIA snapshot to find the element that best matches the original target description: "${step.target.elementDescription}". Generate new locator strategies that reference actual elements in the current page state. Maintain the same priority order (role > text > label > placeholder > testId > css > xpath) and confidence scoring guidelines.`;
}
