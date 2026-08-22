import { piAgentHost } from "./core";
import { registerAgentSessionFeed } from "./agent/agent-session-feed-ipc";
import { getSharedModelRuntime } from "./agent/pi-model-runtime";

registerAgentSessionFeed(piAgentHost);

// Prewarm the shared ModelRuntime at startup (background, non-blocking) so the
// first agent message never waits on the pi.dev catalog refresh / provider
// availability checks. ModelRuntime.create is intentionally not called on the
// per-message hot path.
void getSharedModelRuntime().catch(() => undefined);
