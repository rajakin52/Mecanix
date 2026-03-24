import { useEffect, useState, useCallback, useRef } from 'react';
import { AppState, Alert } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { apiPost } from './api';

/**
 * Lightweight offline queue for the technician app.
 * Queues timer/clock actions when offline and syncs when back online.
 */

interface QueuedAction {
  id: string;
  endpoint: string;
  method: 'POST' | 'PATCH';
  body?: unknown;
  createdAt: number;
}

let actionQueue: QueuedAction[] = [];
let syncing = false;

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Queue an action for later sync.
 */
export function queueAction(
  endpoint: string,
  method: 'POST' | 'PATCH' = 'POST',
  body?: unknown,
): void {
  actionQueue.push({
    id: generateId(),
    endpoint,
    method,
    body,
    createdAt: Date.now(),
  });
}

/**
 * Process the offline queue — send all pending actions.
 */
export async function syncQueue(): Promise<{ synced: number; failed: number }> {
  if (syncing || actionQueue.length === 0) return { synced: 0, failed: 0 };

  syncing = true;
  let synced = 0;
  let failed = 0;
  const remaining: QueuedAction[] = [];

  for (const action of actionQueue) {
    try {
      await apiPost(action.endpoint, action.body);
      synced++;
    } catch {
      // If action is older than 1 hour, discard
      if (Date.now() - action.createdAt > 3_600_000) {
        failed++;
      } else {
        remaining.push(action);
      }
    }
  }

  actionQueue = remaining;
  syncing = false;

  return { synced, failed };
}

/**
 * Get pending queue count.
 */
export function getQueueCount(): number {
  return actionQueue.length;
}

/**
 * Hook: tracks online/offline state and auto-syncs queue.
 */
export function useNetworkStatus() {
  const [isOnline, setIsOnline] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);
  const syncRef = useRef(false);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      const online = state.isConnected ?? true;
      setIsOnline(online);

      // Auto-sync when coming back online
      if (online && !syncRef.current) {
        syncRef.current = true;
        syncQueue().then((result) => {
          syncRef.current = false;
          setPendingCount(getQueueCount());
          if (result.synced > 0) {
            Alert.alert('Synced', `${result.synced} action(s) synced successfully`);
          }
        });
      }
    });

    return () => unsubscribe();
  }, []);

  // Update pending count periodically
  useEffect(() => {
    const interval = setInterval(() => {
      setPendingCount(getQueueCount());
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  return { isOnline, pendingCount };
}
