---
name: thread-register
description: Register a new forum thread/topic mapping so messages in that thread route to a specific project subsession. Use when the user wants to connect a Telegram forum topic to a project.
user-invocable: true
allowed-tools:
  - Read
  - Write
---

# /telegram:thread-register — Register a Thread-to-Project Mapping

Adds a new entry to the plugin's `config.json` that maps a Telegram forum
thread ID to a project name and path. When a message arrives in that thread,
it will be routed to the project's subsession instead of the main session.

Arguments passed: `$ARGUMENTS`

---

## Dispatch on arguments

### No args — show usage

Print:
```
Usage: /telegram:thread-register <thread_id> <project_name> <project_path>

Example: /telegram:thread-register 24 my-project ~/dev/my-project
```

### `<thread_id> <project_name> <project_path>`

1. Read the plugin config file. The path is relative to the plugin root:
   find the plugin directory by looking for `config.json` alongside `server.ts`.
   The standard location is the directory containing this SKILL.md, two levels up:
   `../../config.json` relative to this file. Use the absolute path based on
   the plugin installation location.

2. Parse the JSON. Ensure `topicRouting` object exists with the shape:
   ```json
   {
     "topicRouting": {
       "enabled": true/false,
       "configSource": "...",
       "tmuxSession": "...",
       "scripts": { "send": "...", "start": "..." },
       "topics": { ... }
     }
   }
   ```

3. Check if `thread_id` already exists in `topicRouting.topics`. If so,
   warn the user and suggest using `/telegram:thread-edit` instead. Stop.

4. Add the mapping:
   ```json
   "topics": {
     "<thread_id>": {
       "project": "<project_name>",
       "path": "<project_path>"
     }
   }
   ```

5. Write the updated config.json back (2-space indent, trailing newline).

6. Confirm: "Registered thread `<thread_id>` -> `<project_name>` (`<project_path>`)."

7. If `topicRouting.enabled` is `false`, warn:
   "Note: topic routing is currently disabled. Set `enabled: true` in
   config.json and configure `tmuxSession` and `scripts` to activate routing."

---

## Implementation notes

- Always Read the config file before writing — don't clobber other settings.
- Thread IDs are strings (Telegram numeric thread IDs).
- Project paths should be stored as-is (tilde notation is fine).
- Pretty-print JSON with 2-space indent.
