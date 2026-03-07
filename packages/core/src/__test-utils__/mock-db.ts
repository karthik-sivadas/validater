import { vi } from 'vitest';

export function createMockDb() {
  const mockChain = {
    values: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue([]),
    returning: vi.fn().mockResolvedValue([]),
    onConflictDoNothing: vi.fn().mockReturnThis(),
    onConflictDoUpdate: vi.fn().mockReturnThis(),
  };

  return {
    insert: vi.fn(() => mockChain),
    update: vi.fn(() => mockChain),
    delete: vi.fn(() => mockChain),
    select: vi.fn(() => mockChain),
  } as unknown as import('@validater/db').Database;
}
