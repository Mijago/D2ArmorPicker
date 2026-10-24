import { isEqual as _isEqual } from "lodash";

/**
 * Detects whether the current device is likely a mobile / tablet.
 * Uses the User-Agent Client Hints API when available, then falls
 * back to the legacy `userAgent` string.
 */
function isMobileDevice(): boolean {
  // Modern: UA Client Hints (Chromium 89+)
  if ((navigator as any).userAgentData?.mobile) {
    return true;
  }
  // Legacy fallback
  return /Android|iPhone|iPad|iPod|Mobile|Tablet/i.test(navigator.userAgent);
}

export function calculateCPUConcurrency(): number {
  const logicalCores = navigator?.hardwareConcurrency || 4;
  const estimatedPhysicalCores = isMobileDevice() ? logicalCores : Math.ceil(logicalCores / 2);
  // Reserve at least 1 core for the main thread, but ensure we use at least 3 cores for calculations on desktop
  return Math.max(3, estimatedPhysicalCores - 1);
}

export function getDifferences<T extends object>(
  object1: T,
  object2: T
): {
  changes: {
    [key in keyof T]?: {
      from: string;
      to: string;
    };
  };
} {
  let differences: {
    [key in keyof T]?: {
      from: string;
      to: string;
    };
  } = {};

  // Loop through each key and compare the values
  Object.keys(object1).forEach((key) => {
    const typedKey = key as keyof T; // Type assertion for strict key typing
    if (!_isEqual(object1[typedKey], object2[typedKey])) {
      differences[typedKey] = {
        from: JSON.stringify(object1[typedKey]),
        to: JSON.stringify(object2[typedKey]),
      };
    }
  });

  return { changes: differences };
}

export function getHumanReadableDifferences<T extends object>(object1: T, object2: T): string {
  const diff = getDifferences(object1, object2);
  const changes = diff.changes;

  if (Object.keys(changes).length === 0) {
    return "No changes";
  }

  const changeStrings = Object.entries(changes)
    .map(([key, change]) => {
      const c = change as { from: string; to: string } | undefined;
      if (c) {
        // Remove quotes from JSON stringified values for cleaner display
        const from = c.from.replace(/^"(.*)"$/, "$1");
        const to = c.to.replace(/^"(.*)"$/, "$1");
        return `${key}: ${from} -> ${to}`;
      }
      return "";
    })
    .filter((str) => str.length > 0);

  if (changeStrings.length === 1) {
    return changeStrings[0];
  }

  return changeStrings.join("\n");
}
