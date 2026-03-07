import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AccessibilityPanel } from '../accessibility-panel';

// ---------------------------------------------------------------------------
// Mock data factories
// ---------------------------------------------------------------------------

function makeViolation(overrides: Partial<{
  id: string;
  impact: string | null;
  description: string;
  help: string;
  helpUrl: string;
  tags: string[];
  nodeCount: number;
}> = {}) {
  const impact = 'impact' in overrides ? overrides.impact : 'serious';
  return {
    id: overrides.id ?? 'color-contrast',
    impact: impact ?? null,
    description: overrides.description ?? 'Elements must have sufficient color contrast',
    help: overrides.help ?? 'Fix contrast ratio',
    helpUrl: overrides.helpUrl ?? 'https://dequeuniversity.com/rules/axe/4.x/color-contrast',
    tags: overrides.tags ?? ['wcag2aa'],
    nodes: [
      {
        target: ['button.submit'],
        html: '<button class="submit">Submit</button>',
        impact: impact ?? null,
        failureSummary: 'Fix contrast ratio',
      },
    ],
    nodeCount: overrides.nodeCount ?? 1,
  };
}

function makeData(overrides: Partial<{
  violationCount: number;
  passCount: number;
  incompleteCount: number;
  inapplicableCount: number;
  violations: ReturnType<typeof makeViolation>[];
}> = {}) {
  const violations = overrides.violations ?? [makeViolation()];
  return {
    violationCount: overrides.violationCount ?? violations.length,
    passCount: overrides.passCount ?? 10,
    incompleteCount: overrides.incompleteCount ?? 0,
    inapplicableCount: overrides.inapplicableCount ?? 5,
    violations,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('AccessibilityPanel', () => {
  it('renders nothing when data is null', () => {
    const { container } = render(<AccessibilityPanel data={null} />);
    expect(container.innerHTML).toBe('');
  });

  it('displays violation count badge when violations exist', () => {
    render(<AccessibilityPanel data={makeData({ violationCount: 3 })} />);
    expect(screen.getByText(/3 violations/)).toBeInTheDocument();
  });

  it('displays singular "violation" for count of 1', () => {
    render(<AccessibilityPanel data={makeData({ violationCount: 1, violations: [makeViolation()] })} />);
    expect(screen.getByText('1 violation')).toBeInTheDocument();
  });

  it('displays "No violations" badge when no violations exist', () => {
    render(
      <AccessibilityPanel
        data={makeData({ violationCount: 0, violations: [] })}
      />,
    );
    expect(screen.getByText('No violations')).toBeInTheDocument();
  });

  it('shows severity badges for each impact level', () => {
    const violations = [
      makeViolation({ id: 'v1', impact: 'critical' }),
      makeViolation({ id: 'v2', impact: 'serious' }),
      makeViolation({ id: 'v3', impact: 'moderate' }),
      makeViolation({ id: 'v4', impact: 'minor' }),
    ];
    render(
      <AccessibilityPanel
        data={makeData({ violationCount: 4, violations })}
      />,
    );
    expect(screen.getByText('1 critical')).toBeInTheDocument();
    expect(screen.getByText('1 serious')).toBeInTheDocument();
    expect(screen.getByText('1 moderate')).toBeInTheDocument();
    expect(screen.getByText('1 minor')).toBeInTheDocument();
  });

  it('renders violation description and help text', () => {
    render(<AccessibilityPanel data={makeData()} />);
    expect(screen.getByText('Elements must have sufficient color contrast')).toBeInTheDocument();
    expect(screen.getByText('Fix contrast ratio')).toBeInTheDocument();
  });

  it('renders help URL as a link', () => {
    render(<AccessibilityPanel data={makeData()} />);
    const link = screen.getByText('Learn more');
    expect(link).toHaveAttribute('href', 'https://dequeuniversity.com/rules/axe/4.x/color-contrast');
    expect(link).toHaveAttribute('target', '_blank');
  });

  it('shows affected element count', () => {
    render(
      <AccessibilityPanel
        data={makeData({
          violations: [makeViolation({ nodeCount: 3 })],
        })}
      />,
    );
    expect(screen.getByText('3 affected elements')).toBeInTheDocument();
  });

  it('shows singular "element" for nodeCount of 1', () => {
    render(
      <AccessibilityPanel
        data={makeData({
          violations: [makeViolation({ nodeCount: 1 })],
        })}
      />,
    );
    expect(screen.getByText('1 affected element')).toBeInTheDocument();
  });

  it('displays pass count', () => {
    render(<AccessibilityPanel data={makeData({ passCount: 42 })} />);
    expect(screen.getByText('42 passed')).toBeInTheDocument();
  });

  it('displays incomplete count when > 0', () => {
    render(<AccessibilityPanel data={makeData({ incompleteCount: 3 })} />);
    expect(screen.getByText('3 incomplete')).toBeInTheDocument();
  });

  it('hides incomplete count when 0', () => {
    render(<AccessibilityPanel data={makeData({ incompleteCount: 0 })} />);
    expect(screen.queryByText(/incomplete/)).not.toBeInTheDocument();
  });

  it('shows only first 5 violations and a toggle button when > 5', async () => {
    const violations = Array.from({ length: 8 }, (_, i) =>
      makeViolation({ id: `v${i}`, help: `Violation ${i}` }),
    );
    render(
      <AccessibilityPanel
        data={makeData({ violationCount: 8, violations })}
      />,
    );

    // Only first 5 are visible
    expect(screen.getByText('Violation 0')).toBeInTheDocument();
    expect(screen.getByText('Violation 4')).toBeInTheDocument();
    expect(screen.queryByText('Violation 5')).not.toBeInTheDocument();

    // Toggle button is shown
    expect(screen.getByText('Show 3 more violations')).toBeInTheDocument();
  });

  it('expands to show all violations when toggle is clicked', async () => {
    const user = userEvent.setup();
    const violations = Array.from({ length: 7 }, (_, i) =>
      makeViolation({ id: `v${i}`, help: `Violation ${i}` }),
    );
    render(
      <AccessibilityPanel
        data={makeData({ violationCount: 7, violations })}
      />,
    );

    await user.click(screen.getByText('Show 2 more violations'));
    expect(screen.getByText('Violation 6')).toBeInTheDocument();
    expect(screen.getByText('Show fewer')).toBeInTheDocument();
  });

  it('does not show toggle button when <= 5 violations', () => {
    const violations = Array.from({ length: 3 }, (_, i) =>
      makeViolation({ id: `v${i}` }),
    );
    render(
      <AccessibilityPanel
        data={makeData({ violationCount: 3, violations })}
      />,
    );
    expect(screen.queryByText(/Show .* more/)).not.toBeInTheDocument();
  });

  it('handles violation with null impact gracefully', () => {
    const violations = [makeViolation({ id: 'v-null', impact: null })];
    render(
      <AccessibilityPanel
        data={makeData({ violationCount: 1, violations })}
      />,
    );
    expect(screen.getByText('unknown')).toBeInTheDocument();
  });
});
