# Codex compatibility record

This file records measured compatibility, not intended support. Update it after running `pnpm verify:codex` on a real machine.

## Verified environment

- Verification date: 2026-08-17
- Operating system: Windows 10.0.26200, x86_64
- Node.js: 24.19.0
- `@openai/codex-sdk`: 0.147.0
- Codex CLI: 0.148.0-alpha.9 (desktop runtime cache)
- Authentication: the existing local Codex session successfully completed an SDK turn. The verification intentionally does not inspect or print the underlying credential type.

## Capability gate

| Capability                                 | Status | Notes                                                                                                                                                                                              |
| ------------------------------------------ | ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Resolve the desktop Codex runtime          | Passed | Uses the newest executable under `%LOCALAPPDATA%\\OpenAI\\Codex\\bin`, with `WORKBENCH_CODEX_PATH` as an override. The WindowsApps command alias is not directly executable by this child process. |
| App Server initialization over stdio       | Passed | Initialized as `personal-codex-workbench` against the desktop runtime.                                                                                                                             |
| `skills/list` in the real user environment | Passed | Read-only scan found 28 unique Skill paths.                                                                                                                                                        |
| `skills/extraRoots/set`                    | Passed | The current CLI protocol uses this method instead of the older `perCwdExtraUserRoots` parameter.                                                                                                   |
| `skills/config/write`                      | Passed | Toggled and restored only a repository fixture in an isolated temporary `CODEX_HOME`; the real user configuration remained read-only.                                                              |
| SDK turn and thread ID                     | Passed | Returned a thread ID and `WORKBENCH_CODEX_OK`. The direct diagnostic run first timed out over WebSocket and fell back to HTTPS, so the capability-check timeout is 240 seconds.                    |

## Measured limitations

- The npm SDK version (0.147.0) and desktop CLI version (0.148.0-alpha.9) are not identical. Their tested execution path is compatible, but upgrades must rerun this gate.
- On this machine, a minimal SDK turn may be silent for about two minutes while Codex retries WebSocket transport and falls back to HTTPS. Task logs need explicit heartbeats and a configurable timeout rather than treating silence as immediate failure.
- The report exposes only Skill names, paths, scopes, and enablement metadata. It does not print complete Skill contents or credentials.

## Product boundary

The public App Server protocol verified for this project does not expose native Codex Scheduled Tasks. Personal Workbench therefore owns its scheduler and run history, and delegates each execution to the Codex SDK. It does not claim to enable, pause, or delete tasks created elsewhere in Codex.
