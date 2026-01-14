import { OAuth2Client } from "google-auth-library";
import { getLogger, Logger } from "../utils/logger.js";
import chalk from "chalk";

/**
 * Manages OAuth access tokens with caching and proactive refresh logic.
 */
export class TokenManager {
    private static instance: TokenManager;
    private cachedToken: string | null = null;
    private tokenExpiration: number | null = null;
    private refreshPromise: Promise<string> | null = null;
    private readonly logger: Logger;
    private readonly REFRESH_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes

    private constructor() {
        this.logger = getLogger("TOKEN-MANAGER", chalk.cyan);
    }

    /**
     * Singleton pattern - get the global instance
     */
    public static getInstance(): TokenManager {
        if (!TokenManager.instance) {
            TokenManager.instance = new TokenManager();
        }
        return TokenManager.instance;
    }

    /**
     * Gets a valid access token, using cache if available and not expiring soon.
     * @param authClient The OAuth2Client to use for fetching/refreshing tokens.
     * @returns A valid access token.
     */
    public async getAccessToken(authClient: OAuth2Client): Promise<string> {
        const now = Date.now();

        // If we have a cached token that is not expiring soon, return it.
        if (
            this.cachedToken &&
            this.tokenExpiration &&
            this.tokenExpiration > now + this.REFRESH_THRESHOLD_MS
        ) {
            return this.cachedToken;
        }

        // If a refresh is already in progress, wait for it.
        if (this.refreshPromise) {
            this.logger.info("Waiting for existing token refresh...");
            return this.refreshPromise;
        }

        // Start a new refresh.
        this.refreshPromise = (async () => {
            try {
                this.logger.info("Fetching/Refreshing access token...");
                const { token } = await authClient.getAccessToken();

                if (!token) {
                    throw new Error("Failed to retrieve access token");
                }

                this.cachedToken = token;

                // Update expiration from credentials if available, otherwise default to 1 hour.
                const expiryDate = authClient.credentials.expiry_date;
                this.tokenExpiration = expiryDate || now + 3600 * 1000;

                this.logger.info("Access token updated successfully");
                return token;
            } catch (error) {
                this.logger.error("Failed to get access token", error);
                throw error;
            } finally {
                this.refreshPromise = null;
            }
        })();

        return this.refreshPromise;
    }

    /**
     * Clears the cached token. Call this if an API request fails with 401.
     */
    public clearCache(): void {
        this.logger.info("Clearing cached access token");
        this.cachedToken = null;
        this.tokenExpiration = null;
    }
}
