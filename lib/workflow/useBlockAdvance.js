// lib/workflow/useBlockAdvance.js
import { runHook } from './runner';

/**
 * Returns an async function that fires the onExit hook for the current block
 * and the onEnter hook for the next block.
 *
 * `runHook` with `advance: true` in the UploadBlock onExit descriptor calls
 * `advanceProject` internally and fires the next block's onEnter. So all the
 * producer needs to do is call `runHook({ hookName: 'onExit' })`.
 */
export function useBlockAdvance({ db, project, block, actorId, onAdvanced }) {
  return async () => {
    try {
      await runHook({ db, project, block, hookName: 'onExit', actorId });
      onAdvanced?.();
    } catch (err) {
      console.error('[useBlockAdvance] failed:', err);
    }
  };
}
