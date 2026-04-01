---
name: thread-edit
description: Edit an existing forum thread/topic mapping — change the project name or path for a registered thread. Use when the user wants to update a thread-to-project mapping.
user-invocable: true
allowed-tools:
  - Read
  - Write
---

# /telegram:thread-edit — Edit a Thread Mapping

Modifies an existing thread-to-project mapping in the plugin's `config.json`.

Arguments passed: `$ARGUMENTS`

---

## Dispatch on arguments

### No args — list current mappings

1. Read the plugin's `config.json` (located two directories up from this
   SKILL.md, alongside `server.ts`).
2. List all entries in `topicRouting.topics`:
   ```
   Thread mappings:
     24 -> my-project (~/dev/my-project)
     34 -> other-project (~/dev/other-project)
   ```
3. If no mappings exist, say so and suggest `/telegram:thread-register`.

### `<thread_id> [--project <name>] [--path <path>]`

1. Read the plugin's `config.json`.
2. Look up `topicRouting.topics[<thread_id>]`. If not found, tell the user
   and suggest `/telegram:thread-register`. Stop.
3. Update the fields that were provided:
   - `--project <name>` updates `project`
   - `--path <path>` updates `path`
   - At least one flag must be given.
4. Write the updated config.json back (2-space indent, trailing newline).
5. Confirm what changed.

---

## Implementation notes

- Always Read before Write.
- Thread IDs are strings.
- Pretty-print JSON with 2-space indent.
