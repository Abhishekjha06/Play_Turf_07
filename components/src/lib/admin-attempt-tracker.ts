/**
 * Admin password attempt tracker with lockout mechanism
 * Prevents brute force attacks by locking account after 2 failed attempts for 5 minutes
 */

interface AttemptRecord {
    attempts: number;
    firstAttemptTime: number;
    lockedUntil: number;
}

const STORAGE_KEY = "playturf:admin-attempts";
const MAX_ATTEMPTS = 2;
const LOCKOUT_DURATION = 5 * 60 * 1000; // 5 minutes in ms

/**
 * Get all attempt records from localStorage
 */
function getAttemptRecords(): Record<string, AttemptRecord> {
    try {
        const data = localStorage.getItem(STORAGE_KEY);
        return data ? JSON.parse(data) : {};
    } catch {
        return {};
    }
}

/**
 * Save attempt records to localStorage
 */
function saveAttemptRecords(records: Record<string, AttemptRecord>) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
    } catch {
        console.warn("Failed to save attempt records to localStorage");
    }
}

/**
 * Check if admin account is currently locked
 */
export function isLocked(email: string): boolean {
    const records = getAttemptRecords();
    const record = records[email];

    if (!record) return false;

    const now = Date.now();
    if (now > record.lockedUntil) {
        // Lockout expired, clean it up
        delete records[email];
        saveAttemptRecords(records);
        return false;
    }

    return record.attempts >= MAX_ATTEMPTS;
}

/**
 * Get remaining attempts before lockout (0, 1, or 2)
 */
export function getRemainingAttempts(email: string): number {
    if (isLocked(email)) return 0;

    const records = getAttemptRecords();
    const record = records[email];

    if (!record) return MAX_ATTEMPTS;

    const now = Date.now();
    const timeSinceFirstAttempt = now - record.firstAttemptTime;

    // Reset if older than lockout duration
    if (timeSinceFirstAttempt > LOCKOUT_DURATION) {
        delete records[email];
        saveAttemptRecords(records);
        return MAX_ATTEMPTS;
    }

    return Math.max(0, MAX_ATTEMPTS - record.attempts);
}

/**
 * Get milliseconds until account is unlocked (0 if not locked)
 */
export function getTimeUntilUnlocked(email: string): number {
    if (!isLocked(email)) return 0;

    const records = getAttemptRecords();
    const record = records[email];

    if (!record) return 0;

    const remaining = record.lockedUntil - Date.now();
    return Math.max(0, remaining);
}

/**
 * Track a failed login attempt
 */
export function trackFailedAttempt(email: string): void {
    const records = getAttemptRecords();
    const now = Date.now();

    if (!records[email]) {
        records[email] = {
            attempts: 1,
            firstAttemptTime: now,
            lockedUntil: now + LOCKOUT_DURATION,
        };
    } else {
        const record = records[email];

        // Check if old enough to reset
        if (now - record.firstAttemptTime > LOCKOUT_DURATION) {
            records[email] = {
                attempts: 1,
                firstAttemptTime: now,
                lockedUntil: now + LOCKOUT_DURATION,
            };
        } else {
            // Increment attempt counter
            record.attempts += 1;
            record.lockedUntil = now + LOCKOUT_DURATION;
        }
    }

    saveAttemptRecords(records);
}

/**
 * Clear failed attempts for an account (successful login or admin reset)
 */
export function clearAttempts(email: string): void {
    const records = getAttemptRecords();
    delete records[email];
    saveAttemptRecords(records);
}

/**
 * Get list of all locked accounts
 */
export function getLockedAccounts(): string[] {
    const records = getAttemptRecords();
    const locked: string[] = [];

    for (const [email, record] of Object.entries(records)) {
        const now = Date.now();
        if (now <= record.lockedUntil && record.attempts >= MAX_ATTEMPTS) {
            locked.push(email);
        } else if (now > record.lockedUntil) {
            // Auto-cleanup expired records
            delete records[email];
        }
    }

    saveAttemptRecords(records);
    return locked;
}

/**
 * Reset lockout for an account (admin action)
 */
export function resetLockout(email: string): void {
    clearAttempts(email);
}

/**
 * Format milliseconds to human-readable time (e.g., "2m 34s")
 */
export function formatTimeRemaining(ms: number): string {
    const totalSeconds = Math.ceil(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;

    if (minutes > 0) {
        return `${minutes}m ${seconds}s`;
    }
    return `${seconds}s`;
}
