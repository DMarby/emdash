import type { Commit } from '@emdash/core/runtimes/git/api';
import { describe, expect, it } from 'vitest';
import { computeCreatePrDefaults, humanizeBranchName } from './pr-defaults';

function makeCommit(overrides: Partial<Commit> = {}): Commit {
  return {
    hash: 'abc123',
    parents: [],
    subject: 'Fix the thing',
    body: 'This fixes the thing.',
    author: 'Someone',
    date: 1783468800000,
    isPushed: false,
    tags: [],
    ...overrides,
  };
}

describe('humanizeBranchName', () => {
  it('replaces hyphens with spaces and capitalizes the first letter', () => {
    expect(humanizeBranchName('add-new-thing')).toBe('Add new thing');
  });

  it('replaces underscores with spaces', () => {
    expect(humanizeBranchName('add_new_thing')).toBe('Add new thing');
  });

  it('replaces a mix of hyphens and underscores', () => {
    expect(humanizeBranchName('PRJ-123_fixes_pack4')).toBe('PRJ 123 fixes pack4');
  });

  it('preserves a slash prefix (matches GitHub web)', () => {
    expect(humanizeBranchName('emdash/openrouter-embedding-3hvp5')).toBe(
      'Emdash/openrouter embedding 3hvp5'
    );
  });

  it('leaves an already-uppercase first letter alone', () => {
    expect(humanizeBranchName('Feature-work')).toBe('Feature work');
  });

  it('handles a leading non-letter gracefully', () => {
    expect(humanizeBranchName('123-thing')).toBe('123 thing');
  });

  it('handles an empty string', () => {
    expect(humanizeBranchName('')).toBe('');
  });
});

describe('computeCreatePrDefaults', () => {
  it('uses the commit subject and body when there is exactly one commit', () => {
    const commits = [makeCommit({ subject: 'Add feature', body: 'Detailed body.' })];
    expect(
      computeCreatePrDefaults({ branchName: 'feature/add-feature', commits, aheadCount: 1 })
    ).toEqual({ title: 'Add feature', body: 'Detailed body.' });
  });

  it('uses the humanized branch name and empty body for multiple commits', () => {
    const commits = [makeCommit(), makeCommit({ hash: 'def456' })];
    expect(
      computeCreatePrDefaults({ branchName: 'add-new-thing', commits, aheadCount: 2 })
    ).toEqual({ title: 'Add new thing', body: '' });
  });

  it('uses the humanized branch name and empty body when there are no commits', () => {
    expect(
      computeCreatePrDefaults({ branchName: 'add-new-thing', commits: [], aheadCount: 0 })
    ).toEqual({ title: 'Add new thing', body: '' });
  });

  it('falls back to the humanized branch name when aheadCount is 1 but no commit is present', () => {
    expect(
      computeCreatePrDefaults({ branchName: 'add-new-thing', commits: [], aheadCount: 1 })
    ).toEqual({ title: 'Add new thing', body: '' });
  });

  it('uses the commit even when the fetched page reports more commits than requested', () => {
    const commits = [makeCommit({ subject: 'Only counted commit', body: '' })];
    expect(
      computeCreatePrDefaults({ branchName: 'feature/thing', commits, aheadCount: 1 })
    ).toEqual({ title: 'Only counted commit', body: '' });
  });
});
