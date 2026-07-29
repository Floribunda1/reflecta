# Reflecta Glossary

## Understanding

A user-owned piece of personal understanding that Reflecta helps preserve and revisit. An
Understanding can be a judgment, expression, boundary, experience-backed lesson, or mental-model
fragment that the user currently wants to keep developing.
_Avoid_: Thought, note, idea, AI summary

## Context

The concrete surrounding context of one Understanding. A Context can describe where the
Understanding first formed, later support it, show where it was applied, challenge its boundary, or
revise it.

A Context does not have a role. Its medium only describes the kind of surrounding material it is.

**Context medium**:
experience | video | book | article | opinion | ai | other

_Avoid_: Source, evidence, attachment

## Connection

A user-recognized relationship between two Understandings. AI may suggest a Connection, but it
cannot become part of the user's understanding network until the user confirms it.
_Avoid_: inferred graph edge, automatic relation

## Domain

A long-lived area where the user revisits and develops a group of Understandings, such as trading
psychology, product design, behavior design, or AI agents.
_Avoid_: Category, folder, tag

## App Config Dir

The directory that contains Reflecta application-owned state, including `reflecta-config.json`,
diagnostic logs, downloaded embedding models, and the retrieval index. It is not user content
storage, and it does not move when the user changes the data directory.

## Content Storage Root

The directory that contains user-owned Reflecta content files. Reflecta stores `reflecta.db`,
`Sessions/`, and `assets/` under this directory.

## Database Path

The full path to a SQLite database file. CLI, Drizzle, migrations, and scripts use this file-level
concept. A Database Path is usually `<contentStorageRoot>/reflecta.db`.

## Profile

The runtime mode, either `dev` or `prod`. The profile controls default paths and migration behavior.

## Agent Interaction Legibility

How clearly a user can understand what the Agent is doing, why it is doing it, how far it has
progressed, and whether user intervention is required. This is distinct from feature completeness
or visual polish.

## Agent Turn

One delegated work cycle in the chat, from the user's request until the Agent hands back a response,
needs a user decision, fails, or stops. A Turn organizes process, Actions, receipts, and the final
response by user meaning rather than presenting a raw event timeline.

## Turn Renderer

The UI layer that derives one user-facing Agent Turn from ordered message parts. It translates raw
events into phase, Activity, blocking Actions, receipts, and Response without inventing facts that
the protocol cannot prove.

## Agent Action

A user-meaningful unit of work performed or proposed by the Agent. One Action may use a tool or an
approval flow underneath, but its UI is defined by intent, consequence, lifecycle, and outcome
rather than by the raw tool name.

**Action mode**:

- `observe`: reads information without changing durable state.
- `operate`: changes a system or performs a consequential operation, including deletion.
- `propose`: offers a create or update candidate for user-owned knowledge.

## Activity

The compact, inspectable record of autonomous work inside an Agent Turn. It can contain process
explanations, running Actions, and terminal Action receipts, while the final Response remains the
primary reading surface.

## Decision

A blocking request for the user to allow or decline a consequential Agent operation. A Decision
must explain the intended action, target, impact, and what happens if permission is withheld.

## Candidate

An editable proposal to create or update user-owned Understanding, Context, Domain, or Connection
content. AI authors the draft; only the user's reviewed and confirmed payload may become durable
personal knowledge.

## Receipt

The compact terminal record of an Agent Action after it completes, is declined, fails, or is
cancelled. A Receipt preserves the outcome and can expose the original candidate, the user's final
payload, impact, and execution evidence when those facts exist.

## Process Explanation

A user-readable description of what the Agent is doing or has done. It is not raw chain-of-thought
and must not imply access to hidden reasoning.

## AI Configuration

**AI Provider**:
An external AI service account that Reflecta can call. A provider owns the models available through
that account.
_Avoid_: Endpoint, vendor

**AI Model**:
A named model offered through one AI Provider. The same model name under different providers is a
different selectable model.
_Avoid_: Model string

**Agent Model Selection**:
The provider/model pair Reflecta uses for new Agent turns.
_Avoid_: Default model
