import { proxyActivities } from '@temporalio/workflow';
import type * as exportActs from '../activities/export-video.activity.js';

const { processVideoActivity } = proxyActivities<typeof exportActs>({
  startToCloseTimeout: '5 minutes',
  retry: {
    initialInterval: '5s',
    backoffCoefficient: 2,
    maximumInterval: '1m',
    maximumAttempts: 2,
  },
});

/**
 * Workflow: Process a debug video into a polished MP4.
 *
 * Triggered on-demand when a user requests polished video export.
 * Delegates to the processVideoActivity which calls FFmpeg for
 * annotation overlays, dead time trimming, and resolution scaling.
 */
export async function exportVideoWorkflow(
  params: Parameters<typeof exportActs.processVideoActivity>[0],
): Promise<Awaited<ReturnType<typeof exportActs.processVideoActivity>>> {
  return await processVideoActivity(params);
}
