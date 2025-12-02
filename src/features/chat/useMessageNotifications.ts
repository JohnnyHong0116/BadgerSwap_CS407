import { useEffect, useRef } from 'react';
import { useToast } from '../../components/ToastProvider';
import { db, doc, onSnapshot } from '../../lib/firebase';
import { useAuth } from '../auth/AuthProvider';
import { ChatThread, subscribeToThreads } from './api';

/* =====================================================================
 * Helper: Get unread count for a specific user on a specific thread
 * ---------------------------------------------------------------------
 * Each thread contains an "unread" object:
 *    unread[userId] = number of unread messages
 *
 * If the unread count is missing, default to 0.
 * ===================================================================== */
function getUnreadCount(thread: ChatThread, userId: string) {
  return thread.unread?.[userId] ?? 0;
}

/* =====================================================================
 * Helper: Format toast notification title
 * ---------------------------------------------------------------------
 * If the thread contains partnerName, show "New message from X".
 * Otherwise display a generic title.
 * ===================================================================== */
function formatTitle(thread: ChatThread) {
  return thread.partnerName ? `New message from ${thread.partnerName}` : 'New message';
}

/* =====================================================================
 * useMessageNotifications
 * ---------------------------------------------------------------------
 * This hook handles:
 *
 *  ✔ Listening to the current user's notification preferences
 *  ✔ Subscribing to all chat threads for that user
 *  ✔ Detecting when unread count increases
 *  ✔ Showing a toast notification for new messages
 *
 * It listens in real time using:
 *    - Firestore user document (notification preferences)
 *    - subscribeToThreads (real-time threads listener)
 *
 * It also tracks:
 *    • previousUnreadRef → stores unread count before the update
 *    • hydratedRef → prevents firing toasts on initial load
 *    • lastEnabledRef → timestamp when notifications were last enabled
 * ===================================================================== */
export function useMessageNotifications() {

  const { user } = useAuth();
  const { showToast } = useToast();

  const previousUnreadRef = useRef<Record<string, number>>({});
  const hydratedRef = useRef(false);
  const unsubscribeThreadsRef = useRef<(() => void) | null>(null);
  const lastEnabledRef = useRef<number>(Date.now());

  /* ====================================================================
   * Main useEffect — Handles all notification logic
   * ==================================================================== */
  useEffect(() => {

    previousUnreadRef.current = {};
    hydratedRef.current = false;

    if (!user?.uid) {
      if (unsubscribeThreadsRef.current) {
        unsubscribeThreadsRef.current();
        unsubscribeThreadsRef.current = null;
      }
      return undefined;
    }

    const userRef = doc(db, 'users', user.uid);

    const unsubscribeUser = onSnapshot(userRef, (snap) => {

      const data = snap.data() as { notificationPreferences?: Record<string, boolean> } | undefined;
      const messagesEnabled = data?.notificationPreferences?.messages ?? true;

      if (!messagesEnabled) {

        if (unsubscribeThreadsRef.current) {
          unsubscribeThreadsRef.current();
          unsubscribeThreadsRef.current = null;
        }

        previousUnreadRef.current = {};
        hydratedRef.current = false;
        return;
      }

      lastEnabledRef.current = Date.now();

      if (unsubscribeThreadsRef.current) return;

      unsubscribeThreadsRef.current = subscribeToThreads(user.uid, (threads) => {

        /* -----------------------------------------------------------
         * INITIAL HYDRATION: no notifications yet
         * ----------------------------------------------------------- */
        if (!hydratedRef.current) {

          threads.forEach((thread) => {
            const key = thread.threadId || thread.id;
            if (!key) return;
            previousUnreadRef.current[key] = getUnreadCount(thread, user.uid);
          });

          hydratedRef.current = true;
          return;
        }

        /* -----------------------------------------------------------
         * LIVE UPDATES: compare unread counts
         * ----------------------------------------------------------- */
        threads.forEach((thread) => {

          const key = thread.threadId || thread.id;
          if (!key) return;

          const unread = getUnreadCount(thread, user.uid);
          const previous = previousUnreadRef.current[key] ?? 0;

          const lastMessageTimestamp = thread.timestamp?.toMillis?.();

          /* ============================================================
           * ⭐ NEW RULE FOR WITHDRAWN MESSAGES
           *
           * If the message was withdrawn, thread.lastMessage === ""
           * → We MUST NOT fire a toast.
           * ============================================================ */
          const isWithdrawnMessage = !thread.lastMessage || thread.lastMessage.trim() === "";

          /* ============================================================
           * Conditions for showing a toast:
           *   1. unread increased
           *   2. lastMessage exists and is not withdrawn
           *   3. timestamp >= notifications enabled time
           * ============================================================ */
          if (
              unread > previous &&
              !isWithdrawnMessage &&                                // ⭐ BLOCK withdrawn messages
              (!lastMessageTimestamp || lastMessageTimestamp >= lastEnabledRef.current)
          ) {
            showToast({
              title: formatTitle(thread),
              message: thread.lastMessage,
            });
          }

          previousUnreadRef.current[key] = unread;
        });
      });
    });

    /* ====================================================================
     * Cleanup on unmount or when user changes
     * ==================================================================== */
    return () => {
      unsubscribeUser();

      if (unsubscribeThreadsRef.current) {
        unsubscribeThreadsRef.current();
        unsubscribeThreadsRef.current = null;
      }
    };

  }, [showToast, user?.uid]);
}