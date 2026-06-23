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

The directory that contains Reflecta application configuration, including `reflecta-config.json`.
It is not user content storage, and it does not move when the user changes the data directory.

## Content Storage Root

The directory that contains user-owned Reflecta content files. Electron stores `reflecta.db` and
`assets/` under this directory.

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

One assistant response cycle in the chat, including visible text, thinking summary, tool activity,
proposal cards, evidence, and recovery states in the order they happened.

## Turn Renderer

The UI layer that renders an Agent Turn from ordered message parts. It preserves the sequence of
thinking, tool activity, text, proposal, and evidence instead of separating text from tools.

## Tool Activity Group

A user-readable group of adjacent Agent tool calls that belong to the same work phase, such as
searching related content or inspecting graph relationships.

## Thinking Summary

A user-readable summary of what the Agent is currently doing or has done in a turn. It is not the
model's raw chain-of-thought.

## Ignore

An Agent proposal action that stops the current proposal flow without writing anything. After a
proposal is ignored, the Agent chat waits for the user to decide what to type next.

## Reject

An Agent proposal action that declines the current proposal without writing anything, then returns
the next step to the Agent so it can continue or revise the response.

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
