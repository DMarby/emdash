import type { GitBranchRef, GitLogResult } from '@emdash/core/runtimes/git/api';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { JSDOM } from 'jsdom';
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useCreatePrDefaults } from './use-create-pr-defaults';

(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

const mocks = vi.hoisted(() => ({ getLog: vi.fn() }));

vi.mock('@core/features/source-control/api/browser/client', () => ({
  checkoutSelector: (workspaceId: string) => ({ workspaceId }),
  getSourceControlClient: async () => ({ checkout: { getLog: mocks.getLog } }),
}));

const PROJECT_ID = 'project-1';
const WORKSPACE_ID = 'workspace-1';
const BASE: GitBranchRef = { type: 'remote', branch: 'main', remote: { name: 'origin', url: '' } };

function logResult(commits: GitLogResult['commits'], totalCount: number): GitLogResult {
  return { commits, totalCount };
}

function commit(subject: string, body: string): GitLogResult['commits'][number] {
  return {
    hash: 'h',
    parents: [],
    subject,
    body,
    author: 'a',
    date: 1783468800000,
    isPushed: false,
    tags: [],
  };
}

type HarnessProps = {
  base: GitBranchRef | undefined;
  branchName?: string;
  headOid?: string;
};

function Harness({ base, branchName = 'add-new-thing', headOid = 'oid-1' }: HarnessProps) {
  const defaults = useCreatePrDefaults({
    projectId: PROJECT_ID,
    workspaceId: WORKSPACE_ID,
    branchName,
    base,
    headOid,
  });
  return React.createElement('div', {
    'data-testid': 'out',
    'data-has': defaults ? 'yes' : 'no',
    'data-title': defaults?.title ?? '',
    'data-body': defaults?.body ?? '',
  });
}

describe('useCreatePrDefaults', () => {
  let dom: JSDOM;
  let root: Root;
  let container: HTMLDivElement;
  let queryClient: QueryClient;

  beforeEach(() => {
    dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>');
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    vi.stubGlobal('window', dom.window);
    vi.stubGlobal('document', dom.window.document);
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    container = dom.window.document.getElementById('root') as HTMLDivElement;
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    queryClient.clear();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
    dom.window.close();
  });

  async function render(props: HarnessProps): Promise<void> {
    await act(async () => {
      root.render(
        React.createElement(
          QueryClientProvider,
          { client: queryClient },
          React.createElement(Harness, props)
        )
      );
    });
  }

  function out(): HTMLDivElement {
    return container.querySelector('[data-testid="out"]') as HTMLDivElement;
  }

  it('uses the single commit subject and body when the branch is one commit ahead', async () => {
    mocks.getLog.mockResolvedValue({
      success: true,
      data: logResult([commit('Add feature', 'Body text.')], 1),
    });
    await render({ base: BASE });

    await vi.waitFor(() => expect(out().getAttribute('data-has')).toBe('yes'));
    expect(out().getAttribute('data-title')).toBe('Add feature');
    expect(out().getAttribute('data-body')).toBe('Body text.');
  });

  it('uses the humanized branch name and empty body for multiple commits', async () => {
    mocks.getLog.mockResolvedValue({
      success: true,
      data: logResult([commit('newest', ''), commit('older', '')], 2),
    });
    await render({ base: BASE });

    await vi.waitFor(() => expect(out().getAttribute('data-has')).toBe('yes'));
    expect(out().getAttribute('data-title')).toBe('Add new thing');
    expect(out().getAttribute('data-body')).toBe('');
  });

  it('passes limit=1 and the base/head refs to getLog', async () => {
    mocks.getLog.mockResolvedValue({ success: true, data: logResult([commit('x', '')], 1) });
    await render({ base: BASE });

    await vi.waitFor(() => expect(mocks.getLog).toHaveBeenCalledTimes(1));
    expect(mocks.getLog).toHaveBeenCalledWith({
      workspaceId: WORKSPACE_ID,
      options: {
        limit: 1,
        skip: 0,
        base: { kind: 'branch', branch: BASE },
        head: { kind: 'branch', branch: { type: 'local', branch: 'add-new-thing' } },
      },
    });
  });

  it('returns undefined (caller keeps its fallback) when getLog fails', async () => {
    mocks.getLog.mockResolvedValue({ success: false, error: { type: 'git_error' } });
    await render({ base: BASE });

    await vi.waitFor(() => expect(mocks.getLog).toHaveBeenCalledTimes(1));
    expect(out().getAttribute('data-has')).toBe('no');
  });

  it('does not query when there is no base branch', async () => {
    await render({ base: undefined });

    expect(mocks.getLog).not.toHaveBeenCalled();
    expect(out().getAttribute('data-has')).toBe('no');
  });

  it('refetches when the branch tip (headOid) changes', async () => {
    mocks.getLog.mockResolvedValue({ success: true, data: logResult([commit('x', '')], 1) });
    await render({ base: BASE, headOid: 'oid-1' });
    await vi.waitFor(() => expect(mocks.getLog).toHaveBeenCalledTimes(1));

    await render({ base: BASE, headOid: 'oid-2' });
    await vi.waitFor(() => expect(mocks.getLog).toHaveBeenCalledTimes(2));
  });
});
