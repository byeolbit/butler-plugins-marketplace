---
name: thread-remove
description: Remove a forum thread/topic mapping so messages in that thread are no longer routed to a subsession. Use when the user wants to disconnect a Telegram forum topic from a project.
user-invocable: true
allowed-tools:
  - Read
  - Write
---

# /telegram:thread-remove — Remove a Thread Mapping

Deletes a thread-to-project mapping from the plugin's `config.json`.

Arguments passed: `$ARGUMENTS`

---

## Dispatch on arguments

### No args — list current mappings

1. Read the plugin's `config.json` (located two directories up from this
   SKILL.md, alongside `server.ts`).
2. List all entries in `topicRouting.topics` with their project names.
3. Ask which thread ID to remove.

### `<thread_id>`

1. Read the plugin's `config.json`.
2. Look up `topicRouting.topics[<thread_id>]`. If not found, tell the user
   it doesn't exist and list current mappings. Stop.
3. Delete `topicRouting.topics[<thread_id>]`.
4. Write the updated config.json back (2-space indent, trailing newline).
5. Confirm: "Removed thread `<thread_id>` (was: `<project_name>`)."

---

## Implementation notes

- Always Read before Write.
- Thread IDs are strings.
- Pretty-print JSON with 2-space indent.
