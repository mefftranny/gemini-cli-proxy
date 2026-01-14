/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import * as path from "node:path";
import * as os from "node:os";

export const GEMINI_DIR = ".gemini";
export const CREDENTIAL_FILENAME = "oauth_creds.json";
export const GOOGLE_ACCOUNTS_FILENAME = "accounts.json";
export const PROJECT_CACHE_FILENAME = "project_cache.json";

/**
 * Get the path to the cached credentials file
 * @returns The absolute path to the credentials file
 */
export function getCachedCredentialPath(): string {
    return path.join(os.homedir(), GEMINI_DIR, CREDENTIAL_FILENAME);
}

/**
 * Get the path to the Google accounts cache file
 * @returns The absolute path to the Google accounts file
 */
export function getGoogleAccountsCachePath(): string {
    return path.join(os.homedir(), GEMINI_DIR, GOOGLE_ACCOUNTS_FILENAME);
}

/**
 * Get the path to the project cache file
 * @returns The absolute path to the project cache file
 */
export function getProjectCachePath(): string {
    return path.join(os.homedir(), GEMINI_DIR, PROJECT_CACHE_FILENAME);
}
