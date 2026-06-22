# v1.1.0 Pi Agent Migration Plan

> Date: 2026-06-22
>
> Status: Draft
>
> Goal: Replace the current AI SDK chat runtime with Pi Agent without creating a second message model or a fake runtime that only looks like Pi.

## 1. Gap Audit

The reverted implementation was not a real Pi Agent migration.

| Area     | What was done                                                   | Gap                                                                                                           |
| -------- | --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Runtime  | Replaced the runtime with a deterministic `PiAgentHost` runner. | It did not call Pi SDK, Pi session, Pi loop, Pi resume, or Pi tools.                                          |
| Storage  | Wrote Pi-like JSONL custom records by hand.                     | It did not prove compatibility with Pi session APIs or actual Pi JSONL entries.                               |
| Tests    | Made the event/UI path green with fake output.                  | It did not include a Pi SDK integration test; one e2e scenario was briefly weakened, which is not acceptable. |
| Tools    | Converted tool code toward plain specs.                         | It did not register tools through Pi or prove approval continuation through Pi.                               |
| Frontend | Removed AI SDK transport and consumed events directly.          | This happened before the real backend boundary existed, so it hid the missing Pi integration.                 |
| Cleanup  | Removed `@ai-sdk/react`.                                        | Cleanup is only valid after the real Pi path is green.                                                        |

Conclusion: the correct migration must start at the Pi boundary, not at the UI.

## 2. Non-Negotiables

- Existing feature/e2e specs are product contracts. Do not change scenario semantics to make the migration pass.
- Fake model output is allowed for stable automation, but only behind a real Pi SDK adapter.
- The production host must call Pi Agent APIs before frontend runtime removal starts.
- No `AgentViewBuilder`, no backend DTO projection, no old `agent_messages.parts_json` recovery.
- One public model crosses backend, IPC, frontend, fixtures, and Reflecta Pi custom entries: `AgentSessionEvent`.
- Do not migrate old Agent history in v1.1.0.

## 3. Target Shape

```txt
Renderer
  -> AgentCommand
  -> AgentService
  -> PiAgentHost
      -> Pi SDK session / prompt / resume / tools / skills
      -> ReflectaToolBridge
      -> AgentSessionLog appendCustomEntry("reflecta.agent.event", event)
  -> IPC agent:event
  -> Renderer AgentSessionEvent[]
  -> reduceAgentSession(events)
```

Pi owns the loop and session mechanics. Reflecta owns event semantics, tool meaning, approval, and UI.

## 4. Phase Plan

### Phase 0: Pi SDK Spike

Goal: prove Reflecta can open a Pi session in the app process and run one prompt through Pi with a deterministic model.

Do:

- Add the real Pi dependency/API adapter.
- Create a tiny `PiAgentHost` spike that calls Pi session/prompt APIs.
- Use a deterministic model/provider only as Pi input, not as a replacement for Pi.
- Persist the session under Reflecta content storage root, not global Pi state.

Tests first:

- One integration test: prompt through Pi emits assistant text.
- One storage check: Pi creates/opens the expected session file under Reflecta storage.

Exit:

- A production code path calls Pi SDK.
- No frontend changes yet.

### Phase 1: Canonical Shared Events

Goal: introduce `@shared/agent` without changing runtime behavior.

Do:

- Add `AgentSessionEvent`, `AgentCommand`, `AgentSessionSummary`.
- Add `reduceAgentSession(events)`.
- Keep existing UI running until backend event history is real.

Tests first:

- `@shared/agent` does not import `ai`.
- Reducer merges text deltas, orders reasoning/tool/proposal/text, resolves approval states, and makes failed/cancelled runs composer-ready.

Exit:

- Shared model exists and is tested.
- No UI migration yet.

### Phase 2: Pi SessionLog

Goal: make Pi session files the only new Agent history source.

Do:

- Wrap Pi session custom entry APIs in `AgentSessionLog`.
- `appendEvent(event)` writes `reflecta.agent.event`.
- `readSessionEvents(sessionId)` reads only Reflecta custom entries.
- Use `agent_threads` only as session list metadata if needed.

Tests first:

- append/read exact event round-trip.
- restart reads the same event sequence.
- malformed and non-Reflecta entries are ignored.
- no code path reads `agent_messages` for new Agent history.

Exit:

- History restore works from Pi JSONL custom entries.

### Phase 3: Runtime Vertical Slice

Goal: send one message through Pi and surface the same event live and persisted.

Do:

- `message.send` appends `run.started` and `user.message`.
- Pi callbacks become `assistant.text.delta`, `assistant.reasoning.delta`, tool events, and terminal run events.
- `appendAndEmit(event)` is the only live stream path.
- `run.cancel` aborts the active Pi run and appends `run.cancelled`.

Tests first:

- Integration: fake model through real Pi produces `run.started -> user.message -> assistant.text.delta -> run.completed`.
- Failure: model error appends `run.failed`, then next message can run.
- Cancel: active Pi run aborts and appends `run.cancelled`.
- Shape: emitted event equals persisted event.

Exit:

- Backend event runtime is real Pi-backed.
- Frontend still may use old UI until this is green.

### Phase 4: Tools and Approval

Goal: use Pi tools while preserving Reflecta approval semantics.

Do:

- Convert existing tools into plain Reflecta tool specs.
- Register specs through Pi tool APIs.
- Read/search/list/get tools execute directly.
- Write/delete/bash tools append `approval.requested` and pause mutation.
- Approve executes mutation once and appends `approval.resolved` plus `tool.completed`.
- Reject appends `approval.resolved` and executes nothing.

Tests first:

- read tool needs no approval.
- write tool pending does not call domain mutation.
- approve calls mutation once.
- reject never mutates.
- mutation error becomes `tool.failed`.

Exit:

- Approval is event-driven and Pi-backed.

### Phase 5: IPC Cutover

Goal: IPC carries only shared events and commands.

Do:

- Add `readSessionEvents(sessionId)`.
- Add `sendAgentCommand(command)`.
- Emit `agent:event`.
- Remove new-path use of `agent:stream`, AI SDK chunks, and message array inputs.

Tests first:

- IPC service delegates commands to `PiAgentHost`.
- `readSessionEvents` returns canonical events.
- IPC payload contains no raw Pi entries and no AI SDK chunks.

Exit:

- Backend API is event-only.

### Phase 6: Frontend Cutover

Goal: renderer reads events, subscribes to events, sends commands.

Do:

- Add `useAgentSessionEvents(sessionId)`.
- Add `useAgentSessionState(sessionId)` using `reduceAgentSession`.
- Add `useAgentCommands(sessionId)`.
- Replace `useChat` and chat transport usage.
- Render `AgentSessionState.turns`.

Tests first:

- incoming `agent:event` updates only the matching session.
- failed/cancelled run restores composer availability.
- approve/reject waits for returned events; it does not locally fake canonical state.

Exit:

- UI no longer parses AI SDK parts.

### Phase 7: Fixture and E2E Migration

Goal: keep feature semantics, change only fixture storage mechanics.

Do:

- Existing e2e specs keep their user-path assertions.
- Fixture helpers can keep old names, but write Pi JSONL Reflecta events.
- Real AI smoke stays one skipped-by-default test.

Tests:

- Full existing e2e suite passes unchanged in behavior.
- Seeded completed sessions restore from Pi JSONL.
- Pending approval survives reload and can still be handled.

Exit:

- Product paths are still covered, now through event history.

### Phase 8: Cleanup

Goal: remove old runtime only after the real Pi path is green.

Delete:

- `@ai-sdk/react`.
- AI SDK chat transport.
- AI SDK UI message persistence tests.
- Old runtime helpers that exist only for AI SDK message conversion.
- Fixture writes to `agent_messages.parts_json`.

Keep temporarily:

- AI model/provider adapter code if Pi still needs the same provider credentials.

Exit:

- `rg "useChat|ChatTransport|UIMessageChunk|toUIMessageStream|AgentChatMessage = UIMessage|agent:stream|parts_json"` has no new-path hits.

## 5. Validation Commands

Run at every phase that changes code:

```bash
bun run --filter '@reflecta/electron' typecheck
bun run --filter '@reflecta/electron' test
```

Run before accepting the migration:

```bash
bun run --cwd apps/electron test:e2e
rg "useChat|ChatTransport|UIMessageChunk|toUIMessageStream|AgentChatMessage = UIMessage|agent:stream|parts_json" apps/electron/src apps/electron/e2e
```

## 6. Stop Rule

If Phase 0 cannot prove a real Pi SDK prompt/session path inside Electron main, stop. Do not rewrite frontend, storage, or tests around a fake host.
