# Kilo Virtual Provider Routing Plan

> Status: ready for implementation.

## Goal

Configure project-level Kilo routing so this repo uses:

- hard tasks: Anthropic Sonnet first, then OpenAI GPT-5.4, then DeepSeek Reasoning
- general/code tasks: DeepSeek Chat first, then DeepSeek V3.2 fallbacks on OpenRouter, HuggingFace, and Venice
- small tasks: a separate small/free-provider route
- plan/debug/ask mapped to the hard route
- code/default mapped to the general route
- small mapped to the small route
- reasoning disabled for code/default
- reasoning enabled at medium for plan/debug

## What Docs Confirmed

### Kilo supports exact models

- Custom models can be defined under `provider.<provider_id>.models` and referenced as `provider/model`.
- Model-level reasoning support and variants are supported.

### Kilo supports per-agent model overrides

- Built-in agents can be overridden by name under the `agent` key.
- Relevant built-ins for this task: `code`, `plan`, `debug`, `ask`.
- Agent overrides can pin model, variant, temperature, and permissions.

### Kilo has a Virtual Quota Fallback provider

- The docs confirm a meta-provider that switches through a prioritized provider/profile chain on quota exhaustion or API error.
- It is specifically intended for multi-provider fallback.

## Current Repo State

- Project config is currently a minimal `kilo.json` with a single default model: `anthropic/claude-sonnet-4-6`.
- Project-specific sub-agent `mtcute-specialist` is pinned to `anthropic/claude-sonnet-4-6`.
- Custom slash commands exist in `.kilo/command/` and currently do not pin custom models.
- AGENTS.md already requires commits after each logical block.

## Important Constraints / Unknowns

### Verified from docs

- Staying on `kilo.json` is acceptable.
- Per-agent model routing is supported.
- Reasoning-capable model variants are supported.

### Not yet verified locally

- The exact provider/profile IDs exposed by the user's current Kilo UI/global configuration.
- The exact file-config JSON shape Kilo expects for Virtual Quota Fallback in this installation.
- Whether the existing provider setup already exposes DeepSeek chat/reasoning as directly selectable model IDs or only through provider profiles.

Because of that, implementation should be inspection-first, not guess-first.

## Implementation Plan

### Block 1 - Inspect actual available providers/models

1. Read the effective Kilo config sources relevant to providers:
   - project `kilo.json`
   - project `.kilo/agent/*.md`
   - project `.kilo/command/*.md`
   - global Kilo config if needed for provider IDs only
2. Run read-only Kilo inspection commands during implementation:
   - `kilo models`
   - `kilo config` help/subcommands if available
3. Record the exact IDs for:
   - Anthropic Sonnet model to use for hard route
   - OpenAI GPT-5.4 model
   - DeepSeek reasoning model
   - DeepSeek chat / V3.2 models on each configured provider
   - any available small/free provider models
4. Determine whether Virtual Quota Fallback appears as:
   - a normal provider with addressable model IDs, or
   - a named provider profile that must be referenced via its configured profile name(s)

Output of this block:

- exact model IDs to wire into project config
- exact fallback-provider config shape to use

Commit target:

- `chore: inspect and document kilo provider model ids`

### Block 2 - Define virtual routing models in project config

Update `kilo.json` to add project-level routing models without embedding secrets.

Planned structure:

1. Keep `model` and add `small_model`.
2. Add/extend `provider` definitions only as needed to reference already configured providers.
3. Add three logical routes:
   - `hard`
   - `general`
   - `small`
4. If Kilo's Virtual Quota Fallback provider is file-configurable in this install, define those virtual routes directly in `kilo.json`.
5. If the fallback provider is only addressable through already-created UI/global profiles, point project config to those existing profile-backed model IDs instead of redefining provider auth.

Desired route mapping:

- `hard`
  - Anthropic Sonnet
  - OpenAI GPT-5.4 fallback
  - DeepSeek reasoning fallback
- `general`
  - DeepSeek chat
  - OpenRouter DeepSeek V3.2 fallback
  - HuggingFace DeepSeek V3.2 fallback
  - Venice DeepSeek V3.2 fallback
- `small`
  - whichever small/free providers are actually present and supported locally

Reasoning policy:

- `code` / default route: reasoning off
- `plan` / `debug`: reasoning medium
- `ask`: use hard route; reasoning only if supported and desirable after local ID inspection

Commit target:

- `feat: add project-level kilo virtual provider routing`

### Block 3 - Override built-in agents by role

Add/extend `agent` entries in `kilo.json` so built-ins use the correct route:

- `code` -> `general`
- `plan` -> `hard`
- `debug` -> `hard`
- `ask` -> `hard`

For each:

- set exact model ID
- set `variant` or model options when needed for reasoning level
- keep permissions unchanged unless required

Reasoning settings:

- `plan`: medium reasoning
- `debug`: medium reasoning
- `code`: no reasoning
- `ask`: hard route, final reasoning behavior chosen after local inspection of supported variants

Commit target:

- `feat: route kilo built-in agents to hard and general virtual providers`

### Block 4 - Update project-specific sub-agents and commands

Review project files that currently pin old exact models:

- `.kilo/agent/mtcute-specialist.md`
- any command frontmatter that should explicitly use hard routing for planning/debugging style tasks

Planned changes:

- switch `mtcute-specialist` from hard-coded Sonnet to the hard virtual route unless there is a strong reason to keep a fixed Anthropic-only model
- optionally pin `/spec`, `/phase-check`, `/design-check`, and `/commit` to the hard route if the user wants those command invocations to always use the strongest chain

Recommended mapping:

- `/spec` -> hard
- `/phase-check` -> hard
- `/design-check` -> hard
- `/commit` -> hard
- `mtcute-specialist` -> hard

Commit target:

- `feat: align project kilo commands and subagents with virtual routing`

### Block 5 - Validate the routing

After config edits:

1. Run `kilo models` and confirm all referenced project model IDs resolve.
2. Start Kilo in the repo and verify agent selections show expected models.
3. Verify:
   - default/code uses general route
   - plan/debug/ask use hard route
   - small tasks use `small_model`
4. If possible, simulate provider disablement or temporarily invalid profile ordering to confirm fallback behavior is active.
5. Ensure no secrets were written into repo config.

Commit target:

- `test: validate kilo virtual provider routing configuration`

## Proposed File Changes

### Must change

- `kilo.json`

### Likely change

- `.kilo/agent/mtcute-specialist.md`

### Optional change

- `.kilo/command/spec.md`
- `.kilo/command/phase-check.md`
- `.kilo/command/commit.md`
- `.kilo/command/design-check.md`

## Acceptance Criteria

1. `kilo.json` still loads as valid strict JSON.
2. The project no longer uses a single fixed default model only.
3. A hard route exists with the intended fallback order after local ID verification.
4. A general route exists with the intended fallback order after local ID verification.
5. A small route/model exists for lightweight work.
6. `code` resolves to the general route.
7. `plan` resolves to the hard route with medium reasoning.
8. `debug` resolves to the hard route with medium reasoning.
9. `ask` resolves to the hard route.
10. Reasoning is disabled for code/default.
11. Project-specific sub-agent/command pins no longer bypass the routing unintentionally.
12. No API keys or secrets are committed.

## Risks and Mitigations

- Risk: docs describe the Virtual Quota Fallback provider conceptually but local file-config syntax differs.
  - Mitigation: inspect `kilo models` and local config behavior before editing.
- Risk: provider/model IDs differ from assumed names.
  - Mitigation: use exact locally enumerated IDs only.
- Risk: `ask` may not need medium reasoning and could become slower/costlier than intended.
  - Mitigation: keep `ask` on hard route but only enable explicit medium reasoning for `plan` and `debug` unless inspection shows a better fit.
- Risk: project command/sub-agent files may continue pinning old exact models.
  - Mitigation: audit `.kilo/agent/*.md` and `.kilo/command/*.md` during implementation.

## Recommendation

Implement this in 5 logical commits, inspection-first. Keep `kilo.json` in place, use exact locally verified provider/model IDs, and route built-in agents through virtual fallback chains rather than embedding provider secrets into the repo.

> **Project status tracked in [`.kilo/status.md`](../status.md).**
