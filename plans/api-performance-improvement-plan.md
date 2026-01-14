# API Performance Improvement Plan

## 1. Executive Summary

This document outlines a comprehensive plan to improve the performance and reduce the overhead of the Google Gemini API client in the `gemini-cli-proxy` project. The primary goals are to minimize latency, reduce redundant network requests, and optimize resource usage.

## 2. Problem Analysis

The current implementation suffers from several performance bottlenecks:

1.  **OAuth Token Management Overhead**: Access tokens are fetched on every single API call using `await this.authClient.getAccessToken()`. While the underlying library might handle some caching, explicit control and proactive refreshing are missing.
2.  **Project Discovery Latency**: The `discoverProjectId` method is called frequently. Although it has a promise-based caching mechanism, it can be optimized further to persist across restarts or have a longer, more robust cache lifecycle.
3.  **Sequential Processing**: Requests are processed sequentially. There is no mechanism for concurrent request handling or request batching.
4.  **Connection Overhead**: Each `fetch` call potentially establishes a new HTTP connection. There is no explicit reuse of connections (Keep-Alive).
5.  **Inefficient Streaming**: The SSE (Server-Sent Events) parsing logic creates many intermediate strings and objects, leading to higher GC pressure.

## 3. Proposed Architecture

### 3.1. Token Management System

**Objective**: Eliminate redundant token fetch calls and ensure a valid token is always available without blocking the request.

**Design**:

- **`TokenManager` Class**: A dedicated class to handle token lifecycle.
- **In-Memory Cache**: Store the access token and its expiration time.
- **Proactive Refresh**: Schedule a background refresh of the token 5 minutes before it expires.
- **Lazy Loading**: The first request triggers the fetch, subsequent requests use the cached token.

**Implementation Details**:

- Add `TokenManager` to `src/auth/token-manager.ts`.
- Integrate `TokenManager` into `GeminiApiClient`.

### 3.2. HTTP Connection Optimization

**Objective**: Reuse TCP/TLS connections to reduce handshake latency.

**Design**:

- **`ConnectionPool`**: Use a custom `Agent` (from `undici` or similar, or just standard `http`/`https` agents if using node-fetch) to manage a pool of persistent connections.
- **Keep-Alive Headers**: Explicitly set `Connection: keep-alive` headers.

**Implementation Details**:

- Configure a global `Dispatcher` or `Agent` with `keepAlive: true`.
- Pass this agent to the `fetch` calls.

### 3.3. Project ID Discovery Optimization

**Objective**: Reduce the frequency of "Project Discovery" calls.

**Design**:

- **Persistent Cache**: Store the discovered Project ID in a local file (e.g., `~/.gemini/project_cache.json`) alongside credentials.
- **Cache Invalidation**: Invalidate the cache only if an API call fails with a 403/404 related to the project.

**Implementation Details**:

- Modify `discoverProjectId` in `GeminiApiClient`.
- Read/Write to the persistent cache file.

### 3.4. Streaming & Parsing Optimization

**Objective**: Reduce memory allocation and CPU usage during streaming responses.

**Design**:

- **Optimized Parser**: Rewrite `parseSSEStream` to use a more efficient buffer handling strategy, avoiding excessive string splitting and concatenation.
- **Generator Optimization**: Ensure the async generator yields chunks as soon as they are available with minimal processing.

### 3.5. Request Concurrency & Queueing (Optional/Advanced)

**Objective**: Prevent overwhelming the client or server during high load.

**Design**:

- **Request Queue**: Implement a simple queue if we need to rate-limit ourselves locally before hitting the API. (Lower priority as the API handles rate limits).

## 4. Implementation Steps

### Step 1: Token Manager Implementation

1.  Create `src/auth/token-manager.ts`.
2.  Implement `getAccessToken()` with caching and proactive refresh logic.
3.  Update `GeminiApiClient` to use `TokenManager`.

### Step 2: Connection Optimization

1.  Update `GeminiApiClient` to use a custom `https.Agent` with `keepAlive: true`.
2.  Ensure `fetch` uses this agent.

### Step 3: Project ID Persistence

1.  Update `discoverProjectId` to check for a cached file first.
2.  Save the discovered ID to the file system.
3.  Handle cache invalidation on specific errors.

### Step 4: Streaming Improvements

1.  Refactor `parseSSEStream` in `src/gemini/client.ts`.
2.  Optimize the buffer handling loop.

## 5. Verification Plan

- **Unit Tests**: Update existing tests in `src/gemini/client.test.ts` to verify token caching and project ID persistence.
- **Performance Benchmarks**: Measure the time taken for:
  - First request (cold start).
  - Subsequent requests (warm start).
  - High-concurrency scenarios.

## 6. Risks and Mitigation

- **Token Expiry Race Conditions**: Ensure the proactive refresh handles edge cases where a request comes in exactly when the token is expiring. _Mitigation: Use a grace period (e.g., 5 minutes) and a mutex/lock for the refresh operation._
- **Cache Corruption**: The persistent project ID cache might get corrupted. _Mitigation: Add try-catch blocks and fallback to fresh discovery if reading the cache fails._
