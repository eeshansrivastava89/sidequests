/**
 * Notification engine for Sidequests.
 *
 * Evaluates notification rules after each scan cycle and fires native
 * notifications via node-notifier. Deduplicates notifications using
 * the Activity table so we don't re-notify about the same state.
 *
 * Notification types (v1):
 * - CI failure: project CI went from passing → failing
 * - Stale threshold: project crossed 30/60/90 day inactivity
 * - Unpushed commits aging: commits ahead > 0 and days inactive > 7
 */

import { db } from "./db";
import type { MergedProject } from "./merge";

import { createRequire } from "node:module";
const require = createRequire(import.meta.url);

// Lazy-load node-notifier — it's optional (might not work on all platforms)
let _notifier: typeof import("node-notifier") | null = null;
function getNotifier() {
  if (_notifier) return _notifier;
  try {
    _notifier = require("node-notifier");
    return _notifier;
  } catch {
    // node-notifier not available — notifications silently disabled
    return null;
  }
}

// ── Types ───────────────────────────────────────────────

export interface NotificationRule {
  id: string;       // Unique dedup key (e.g. "ci-failure:project-abc")
  type: string;     // "ci-failure" | "stale-threshold" | "unpushed-aging"
  title: string;
  message: string;
  projectId: string;
  projectName: string;
}

export interface NotificationResult {
  sent: string[];   // Rule IDs that were sent
  skipped: string[]; // Rule IDs that were skipped (already notified or quiet hours)
}

// ── Quiet Hours ─────────────────────────────────────────

interface QuietHours {
  enabled: boolean;
  start: string; // "22:00"
  end: string;   // "08:00"
}

function parseQuietHours(value: string | null | undefined): QuietHours | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value);
    if (parsed && typeof parsed === "object" && parsed.enabled) {
      return {
        enabled: !!parsed.enabled,
        start: String(parsed.start ?? "22:00"),
        end: String(parsed.end ?? "08:00"),
      };
    }
    return null;
  } catch {
    return null;
  }
}

export function isInQuietHours(quiet: QuietHours | null, now: Date = new Date()): boolean {
  if (!quiet || !quiet.enabled) return false;

  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const [startH, startM] = quiet.start.split(":").map(Number);
  const [endH, endM] = quiet.end.split(":").map(Number);
  const startMinutes = startH * 60 + startM;
  const endMinutes = endH * 60 + endM;

  if (startMinutes <= endMinutes) {
    // Same day range (e.g. 09:00–17:00)
    return currentMinutes >= startMinutes && currentMinutes < endMinutes;
  } else {
    // Overnight range (e.g. 22:00–08:00)
    return currentMinutes >= startMinutes || currentMinutes < endMinutes;
  }
}

// ── Deduplication ────────────────────────────────────────

/**
 * Check if a notification was already sent for this dedup key.
 * We store sent notifications as Activity rows with type "notification"
 * and a specific payload structure.
 */
async function wasAlreadyNotified(dedupKey: string): Promise<boolean> {
  // Check recent notifications (within last 24h — same state shouldn't re-notify)
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const count = await db.activity.count({
    where: {
      type: "notification",
      payloadJson: { contains: dedupKey },
      createdAt: { gte: oneDayAgo },
    },
  });
  return count > 0;
}

/**
 * Record that a notification was sent.
 */
async function recordNotification(rule: NotificationRule): Promise<void> {
  await db.activity.create({
    data: {
      projectId: rule.projectId,
      type: "notification",
      payloadJson: JSON.stringify({
        dedupKey: rule.id,
        notificationType: rule.type,
        title: rule.title,
        message: rule.message,
      }),
    },
  });
}

// ── Notification Rules ──────────────────────────────────

/**
 * Evaluate all notification rules for a list of merged projects.
 * Compares current state against previous state to detect transitions.
 */
export async function evaluateNotificationRules(
  projects: MergedProject[],
  previousProjects?: MergedProject[],
): Promise<NotificationRule[]> {
  const rules: NotificationRule[] = [];
  const previousMap = new Map(
    (previousProjects ?? []).map((p) => [p.id, p]),
  );

  // Need previous GitHub state for CI transition detection
  // Load previous GitHub data from DB
  const githubRows = await db.gitHub.findMany({
    select: { projectId: true, ciStatus: true },
  });
  const prevCiStatus = new Map(githubRows.map((g) => [g.projectId, g.ciStatus]));

  for (const project of projects) {
    // Skip archived/snoozed projects
    if (project.status === "archived" || project.snoozedUntil) {
      const snoozeExpiry = project.snoozedUntil ? new Date(project.snoozedUntil) : null;
      if (snoozeExpiry && snoozeExpiry > new Date()) continue;
    }

    const daysInactive = project.lastCommitDate
      ? Math.floor((Date.now() - new Date(project.lastCommitDate).getTime()) / (1000 * 60 * 60 * 24))
      : 999;

    // ── Rule 1: CI failure transition ──
    if (project.ciStatus === "failure") {
      const prev = prevCiStatus.get(project.id);
      // Only notify on transition (was passing/none → now failing)
      if (prev && prev !== "failure") {
        rules.push({
          id: `ci-failure:${project.id}`,
          type: "ci-failure",
          title: "CI Failing",
          message: `${project.name}: CI is failing (was ${prev})`,
          projectId: project.id,
          projectName: project.name,
        });
      }
    }

    // ── Rule 2: Stale threshold crossing ──
    if (daysInactive >= 30 && project.status !== "archived") {
      const prev = previousMap.get(project.id);
      const prevDays = prev?.lastCommitDate
        ? Math.floor((Date.now() - new Date(prev.lastCommitDate).getTime()) / (1000 * 60 * 60 * 24))
        : 0;

      // Notify on threshold crossings: 30, 60, 90 days
      const thresholds = [30, 60, 90];
      for (const threshold of thresholds) {
        if (daysInactive >= threshold && prevDays < threshold) {
          rules.push({
            id: `stale-threshold:${project.id}:${threshold}d`,
            type: "stale-threshold",
            title: `${threshold}d Inactive`,
            message: `${project.name}: No commits in ${daysInactive} days`,
            projectId: project.id,
            projectName: project.name,
          });
          break; // Only fire the most severe threshold
        }
      }
    }

    // ── Rule 3: Unpushed commits aging ──
    if (project.ahead > 0 && daysInactive > 7) {
      const prev = previousMap.get(project.id);
      const prevDays = prev?.lastCommitDate
        ? Math.floor((Date.now() - new Date(prev.lastCommitDate).getTime()) / (1000 * 60 * 60 * 24))
        : 0;
      const prevAhead = prev?.ahead ?? 0;

      // Notify when both conditions are newly true (or worsening)
      if (prevDays <= 7 || prevAhead === 0) {
        rules.push({
          id: `unpushed-aging:${project.id}`,
          type: "unpushed-aging",
          title: "Unpushed Commits",
          message: `${project.name}: ${project.ahead} unpushed commits, ${daysInactive}d inactive`,
          projectId: project.id,
          projectName: project.name,
        });
      }
    }
  }

  return rules;
}

// ── Send Notifications ───────────────────────────────────

/**
 * Evaluate and send notifications for a list of projects.
 * Handles deduplication and quiet hours.
 */
export async function sendNotifications(
  projects: MergedProject[],
  previousProjects?: MergedProject[],
): Promise<NotificationResult> {
  const sent: string[] = [];
  const skipped: string[] = [];

  // Check quiet hours
  const quietPref = await db.userPreference.findUnique({
    where: { key: "notification.quietHours" },
  });
  const quiet = parseQuietHours(quietPref?.value);
  if (isInQuietHours(quiet)) {
    // During quiet hours, skip all notifications
    return { sent: [], skipped: ["quiet-hours"] };
  }

  // Evaluate rules
  const rules = await evaluateNotificationRules(projects, previousProjects);

  // Dedup and send
  const notifier = getNotifier();
  for (const rule of rules) {
    const alreadyNotified = await wasAlreadyNotified(rule.id);
    if (alreadyNotified) {
      skipped.push(rule.id);
      continue;
    }

    if (notifier) {
      notifier.notify({
        title: `Sidequests: ${rule.title}`,
        message: rule.message,
        sound: true,
      });
    }

    await recordNotification(rule);
    sent.push(rule.id);
  }

  return { sent, skipped };
}