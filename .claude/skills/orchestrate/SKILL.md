---
name: orchestrate
description: Orchestrate implementation work using milestone-based workflow with specialized agents. Use when implementing features from a plan file or resuming paused orchestration.
argument-hint: "[plan-file or continue]"
disable-model-invocation: true
---

# Orchestration Skill

You are the Orchestration Agent responsible for managing implementation work by breaking down plans into milestones, delegating to specialized agents in `.claude/agents/`, and managing the overall workflow.

## Control Flow Model

**Three staged execution**, split around the one point that needs a human:

1. **Stage 1 — Implement & Review Loop**: run as a **Dynamic Workflow** (the engine, see below). Implements the plan, then has independent agents review it, and iterates (≤3) until no Medium+ issues remain. Ends with a severity-ranked report.
2. **Human Gate** (back in the session): the human approves **Complete** or sends back **Iterate with added input**. This is a stage boundary because a Dynamic Workflow cannot take mid-run input.
3. **Stage 2 — PR**: on Complete, generate the PR body with `document-changes` and open the PR.

Within Stage 1, complete one major milestone at a time and report progress; the human gate is the mandatory stop before a PR.

## Execution Engine: Dynamic Workflows

The Stage 1 implement→review→iterate loop is executed as a **Dynamic Workflow** — a JavaScript orchestration script Claude writes and a background runtime executes. This is preferred over hand-running the loop turn-by-turn because:

- The loop, branching, and the ≤3 iteration cap live **in the script**, not in the orchestrator's context window — only the final report comes back.
- It runs **independent agents that adversarially review each other's work** before reporting — exactly the quality gate this skill needs.
- The orchestration is **codified and rerunnable**, and a run is **resumable** within the same session.

### The `/orchestrate-loop` saved workflow (primary path)

Stage 1 is meant to run as a **saved workflow command**, `/orchestrate-loop`, stored in `.claude/workflows/orchestrate-loop` (project, shared) so the orchestration is fixed and identical on every branch instead of re-improvised per run. The skill invokes it; it is **not** a hand-written JS file.

**How it is created (one time).** A dynamic workflow script is authored by Claude during a run and then saved — there is no documented API for hand-writing the `.js` file, so do not fabricate one. To produce `/orchestrate-loop`:

1. In a live session, kick off the loop with the word **`workflow`** in the prompt, describing exactly what Stage 1 must do (see the spec below). Claude writes the script; the runtime runs it in the background.
2. Watch with **`/workflows`**; when a run does what the spec describes, press **`s`** and save it to **`.claude/workflows/`** as `orchestrate-loop`.
3. From then on, `/orchestrate` runs `/orchestrate-loop` directly — no re-authoring.

**What the `/orchestrate-loop` script must do** (the authoring spec — keep runs consistent):
- **Inputs**: plan-file path, `base_branch`, and the worktree path; its agents operate inside the worktree.
- **Loop body, max 3 iterations**: (a) implement the plan's milestones via agents that follow the relevant module `CLAUDE.md`; (b) spawn a **fresh `general-purpose` reviewer on `model: sonnet`, no implementation context**, that diffs against the plan and ranks every issue **Low / Medium / High / Blocking**; (c) if any **Medium+** issue remains and iterations < 3 → fix only those and loop, else stop.
- **Output**: a severity-ranked report (issues by severity, iterations used, diff summary) ending with `VERDICT: … — Blocking: N, High: N, Medium: N, Low: N`. It must **not** open a PR or ask for human input — those are later stages.

**Other ways to launch** (when no saved command is wanted, or to (re)author one):
- Include **`workflow`** in the kickoff prompt for a one-off run.
- Or set **`/effort ultracode`** (combines `xhigh` reasoning with automatic workflow orchestration) so substantive tasks are planned as workflows automatically.

### Requirements, limits, and fallback

- Requires **Claude Code v2.1.154+** on a paid plan; on Pro, enable the **Dynamic workflows** row in `/config`.
- Runtime limits: **16 concurrent agents**, **1,000 agents total** per run. Workflow subagents run in `acceptEdits` and inherit your tool allowlist.
- **Fallback**: if Dynamic Workflows are unavailable or disabled (older client, `disableWorkflows`/`CLAUDE_CODE_DISABLE_WORKFLOWS`, Pro without the toggle), run the **same** Stage 1 loop turn-by-turn in the session as described under "Independent Review & Iteration Loop". The staging, severity gating, and human gate are identical — only the engine differs.

## Task Tracking with TodoWrite

**CRITICAL**: Use the new Task tool to track milestones and tasks throughout orchestration inside .claude/tasks. This provides:
- Visible progress in the persistent files
- Persistence across sessions (enables "continue" functionality)
- Sub-agent coordination

### Initial Setup

When starting orchestration, create todo items for each milestone inside the .claude/tasks

### During Execution

- If tasks are already created, continue the execution
- Set current milestone to `in_progress` before delegating to sub-agents
- Mark milestones `completed` immediately after validation passes
- Add sub-tasks discovered during implementation
- Keep exactly ONE milestone as `in_progress` at any time

### On Milestone Completion

Mark the milestone completed in the todo list. The mandatory human checkpoint is the **human gate** between Stage 1 and the PR — not after every milestone. Per-milestone "ask for user validation" pauses apply **only** when running the in-session fallback on a large plan; inside the Stage 1 Dynamic Workflow there is no mid-run user input (the script runs uninterrupted to its report).

## Major Milestones

Implementation work is broken down into these standard milestones, unless otherwise noted in the plan.

1. **Test Suite Implementation**: Write comprehensive tests before implementation
2. **Feature Implementation**: Build the feature and ensure tests pass
3. **Code Review & Quality Checks**: Validate code meets project standards
4. **Documentation Updates**: Update glossary, memory bank, and sprint checklists
5. **Refactoring** (if needed): Improve code structure while preserving behavior

Milestones 1–5 form one **implementation iteration**, followed by review (6) and triage (7). Milestones 1–7 run **inside the Stage 1 Dynamic Workflow** (the script holds the iteration loop and the ≤3 cap). Milestones 8–9 run **back in the session**, after the workflow returns its report:

6. **Independent Review**: a fresh review agent ranks issues Low/Medium/High/Blocking
7. **Triage & Iterate**: fix Medium+ issues and re-review (loop back to 1, max 3 iterations)
8. **Human Gate** (session): human approves completion or sends back with added input
9. **PR** (session): generate the description with `document-changes` and open the PR

## Workflow Pattern

```
1. Receive Implementation Plan (from plan mode or user)
   ↓
2. Parse plan into milestones; set up worktree + task tracking
   ↓
╔═ STAGE 1 — DYNAMIC WORKFLOW (the script holds this loop, max 3 iter) ═╗
║ 3. IMPLEMENT — FOR EACH MILESTONE:                                    ║
║    a. Delegate to appropriate agent(s) (per Agent Mapping)            ║
║    b. Monitor completion; validate against success criteria           ║
║    c. If a task fails validation: retry with fixes (≤3 attempts)      ║
║    (On iterations 2-3, implement ONLY the review fixes, not the       ║
║     whole plan again.)                                                ║
║   ↓                                                                    ║
║ 4. INDEPENDENT REVIEW — spawn a fresh review agent (no impl context)  ║
║    that checks the diff against the plan and ranks every issue        ║
║    Low / Medium / High / Blocking                                     ║
║   ↓                                                                    ║
║ 5. TRIAGE (script branch condition):                                  ║
║    - Any issue Medium+ AND iterations remain → loop back to step 3    ║
║    - Only Low issues (or none) → end the workflow                     ║
║    - 3 iterations used with Medium+ remaining → end the workflow      ║
║      (carry the open issues into the report)                          ║
╚═══════════════════════════════════════════════════════════════════╝
   ↓ workflow returns a severity-ranked report (no mid-run input possible)
6. HUMAN GATE (in session — the stage boundary). Human chooses:
   (a) Complete → go to step 7
   (b) Iterate again with added input → relaunch Stage 1 workflow,
       counter reset, with the new input folded in
   ↓
7. STAGE 2 — PR — generate the description via the document-changes skill
   and open the PR using that as the body. Report the PR URL.
```

Stage 1 (steps 3–5) is the body of the Dynamic Workflow script; steps 6–7 happen back in the session. The per-milestone "wait for user confirmation" checkpoints apply to large plans within step 3 when running the fallback in-session; the human gate at step 6 is the mandatory stop before a PR is created.

## Task Type → Agent Mapping

Backend and frontend dev/test work is handled by **general-purpose agents that follow the relevant module `CLAUDE.md`** — there are no longer dedicated `backend-dev` / `backend-test` / `frontend-dev` / `frontend-test` agents. When delegating such work, instruct the general-purpose agent to read and follow the module guide first:

- Frontend implementation **and** tests → general-purpose agent, must follow [`frontend/CLAUDE.md`](../../frontend/CLAUDE.md)
- Backend implementation **and** tests → general-purpose agent, must follow [`backend/CLAUDE.md`](../../backend/CLAUDE.md)
- Import worker work → follow [`import-service/CLAUDE.md`](../../import-service/CLAUDE.md); infra/deploy work → follow [`infrastructure/CLAUDE.md`](../../infrastructure/CLAUDE.md)

The specialized agents below remain:

| Task Type                       | Primary Agent        | Validation Agent | Fallback Agent |
| ------------------------------- | -------------------- | ---------------- | -------------- |
| Write/Update frontend tests     | general-purpose (→ frontend/CLAUDE.md) | run `npm test`   | code-reviewer  |
| Write/Update backend tests      | general-purpose (→ backend/CLAUDE.md)  | run `pytest`     | code-reviewer  |
| Implement frontend feature      | general-purpose (→ frontend/CLAUDE.md) | run `npm test`   | refactor       |
| Implement backend feature       | general-purpose (→ backend/CLAUDE.md)  | run `pytest`     | refactor       |
| Review code quality             | code-reviewer        | -                | refactor       |
| Improve code structure          | refactor             | code-reviewer    | -              |
| Generate documentation          | documentation-writer | code-reviewer    | -              |

## Test Writing Policy (CRITICAL)

Test **conventions** are the source of truth in the module `CLAUDE.md` files — follow them exactly:
- Frontend: [`frontend/CLAUDE.md`](../../frontend/CLAUDE.md) — test location (`src/__tests__/`), integration-first, semantic queries, MSW in-memory stores.
- Backend: [`backend/CLAUDE.md`](../../backend/CLAUDE.md) — `backend/api/tests/`, pytest fixtures, `TEST_MODE=1`, mandatory multi-tenant isolation tests.

### When Tests Must Be Written or Updated

Write/update tests (following the module guide) for: new features (tests first), behavior changes, test fixes after implementation, and convention refactors. A separate test-writing pass should still precede or accompany implementation in the milestone plan.

### Exception: Trivial Test Assertion Updates

Trivial assertion updates (e.g., expected text "Welcome" → "Dashboard", or "7 days" → "30 days") may be done inline alongside the implementation, but must still follow the conventions in the relevant module `CLAUDE.md` and be noted in the milestone report.

## Validation Responsibilities

### Test Implementation Validation

- ✅ Test files created in correct locations
- ✅ Tests cover success criteria from plan
- ✅ Tests follow project patterns (MSW for frontend, fixtures for backend)
- ✅ No syntax errors
- ✅ Proper imports and setup

### Feature Implementation Validation

- ✅ All tests pass (`npm run test:run` or `pytest`)
- ✅ No TypeScript errors (`npm run build`)
- ✅ Code follows naming conventions (full variable names)
- ✅ Inline comments present explaining "why"
- ✅ Files in correct directory structure

### Code Review Validation

- ✅ No abbreviations in variable names
- ✅ Inline comments present
- ✅ TypeScript strictness maintained
- ✅ Multi-tenant safety (tenant_id filtering)
- ✅ Proper error handling

### Documentation Validation

- ✅ Documentation files created/updated
- ✅ Glossary updated with new terms
- ✅ Sprint checklist marked complete
- ✅ Memory bank updated

## Error Handling Strategy

### Retry Logic (Auto-Iteration)

**Maximum Retries**: 3 attempts per task

**When to retry automatically**:
- Tests fail due to implementation bugs → Retry with error context
- Code doesn't meet quality standards → Delegate to refactor agent
- Tests don't cover requirements → Retry with gap analysis
- TypeScript errors → Retry with error output

**When to escalate to user**:
- After 3 failed retry attempts
- Architectural ambiguity discovered
- Conflicting requirements detected
- External dependency issues (API down, database connection failed)

### Escalation Format

When blocked after 3 retry attempts, report to user:

```markdown
🔴 MILESTONE BLOCKED - [Milestone Name]

**Task**: [What was being attempted]
**Agent**: [Which agent encountered the issue]
**Attempts**: 3/3 (max retries exhausted)

**Issue**:
[Detailed description of the problem]

**What was tried**:
1. [Attempt 1 description + result]
2. [Attempt 2 description + result]
3. [Attempt 3 description + result]

**Recommended next steps**:
- [Option 1]
- [Option 2]

**User decision needed**: How should we proceed?
```

> **Two distinct loops — don't confuse them.** The *per-task retry* above (max 3) handles a single delegated task that fails its own validation (failing tests, type errors). The *review-iterate loop* below (max 3) is the higher-level implement → independent-review → fix cycle for the whole plan. A task may exhaust its retries inside a single implementation iteration.

## Independent Review & Iteration Loop (CRITICAL)

This is the core quality gate and the **body of the Stage 1 Dynamic Workflow** (Steps 4–5 below). The workflow script repeats implement → independent-review → triage until no Medium+ issue remains or 3 iterations are used, then ends and returns its report. Steps 6–7 (human gate, PR) happen **outside** the workflow, back in the session — a Dynamic Workflow cannot take mid-run input, so the human gate is necessarily a stage boundary. When running the in-session fallback, the same steps execute turn-by-turn with identical gating.

### Step 4 — Launch the independent review agent (inside the workflow)

Within the workflow, after the implementation milestones of an iteration, spawn a **fresh** review agent with **no implementation context** (so it reviews with clean eyes):

- Spawn it as a `general-purpose` subagent on `model: sonnet` (in the in-session fallback, use the `Agent` tool with the same settings).
- It is independent of the agents that wrote the code — do **not** reuse an implementation agent or pass it the implementation reasoning. The workflow keeps reviewers' findings in script variables and feeds only the issue list back into the next iteration.
- Give it only: the path to the plan file, the diff to review (`git diff {base_branch}...HEAD` from inside the worktree), and the ranking instructions below.
- Instruct it to verify the diff against the plan, check project conventions (the relevant module `CLAUDE.md`, multi-tenant safety, tests), and **read the real files** rather than trust claims. It must not modify anything (read-only).

The review agent must rank **every** issue it finds by severity:

| Severity | Meaning | Triggers a fix loop? |
| --- | --- | --- |
| **Blocking** | Build/tests broken, security or multi-tenant data-leak, or a core plan requirement not implemented. | ✅ Yes |
| **High** | Significant correctness bug, missing required functionality, or major convention violation. | ✅ Yes |
| **Medium** | Real issue that should be fixed but is not breaking (inaccuracy, missed edge case, notable quality problem). | ✅ Yes |
| **Low** | Nit, style, or optional improvement. | ❌ No |

Require the review agent to end with a machine-readable verdict line, e.g.:
`VERDICT: <COMPLETE | ISSUES_FOUND> — Blocking: N, High: N, Medium: N, Low: N`

### Step 5 — Triage (the workflow script's branch condition)

- **Any Medium, High, or Blocking issue AND iterations remain** → loop back to **step 3** and fix **only those issues** (do not re-implement the whole plan). Record Low issues but do not act on them yet. Increment the iteration counter.
- **Only Low issues, or none** → end the workflow; the report flows to the human gate (carry Low issues into the PR description as known follow-ups).
- **3 iterations used and Medium+ issues still remain** → end the workflow and carry the open issues into the human gate, clearly labeled as unresolved.

**Maximum 3 implement→review iterations** before the human gate; the cap lives in the workflow script. Also record the iteration count + current stage in the task list so `/orchestrate continue` can resume even if the workflow run did not survive the session (DW runs resume within the same session via `/workflows`, but start fresh after exiting Claude Code).

### Step 6 — Human gate (mandatory stage boundary before PR)

The workflow has ended and returned its report. Back in the session, stop and present to the user: a summary of what was implemented, the final review report (issues grouped by severity), the iteration count used, and any unresolved Medium+ issues. Ask the human to choose:

```markdown
🧑‍⚖️ HUMAN REVIEW REQUIRED

**Iterations used**: X/3
**Final review**: Blocking: N · High: N · Medium: N · Low: N
[grouped issue list]

How should we proceed?
(a) **Complete** — accept current state and open the PR (step 7)
(b) **Iterate again with input** — provide additional guidance; I will relaunch the
    Stage 1 workflow (counter reset) and run up to 3 more iterations incorporating it
```

If the human picks **(b)**, fold their added input into the plan/context, reset the iteration counter, and relaunch the Stage 1 workflow (step 3). If **(a)**, proceed to the PR step even if Low (or human-accepted) issues remain.

### Step 7 — Create the PR with document-changes

Only after the human chooses **Complete**:

1. Generate the PR description by following the `document-changes` skill (see "PR Documentation" below) — this becomes the PR body. Append a **"Review summary"** section noting iterations used and any accepted/known issues from the final review.
2. Open the PR with `gh pr create` using that document as `--body-file`.
3. Report the PR URL to the user.

## Milestone Reporting

This template is for the **in-session fallback** (and any large-plan checkpoints). Inside the Stage 1 Dynamic Workflow there are no per-milestone pauses — progress is watched via `/workflows` and the only stop is the human gate after the run ends. After each milestone completion in the fallback, report to user:

```markdown
✅ MILESTONE COMPLETE - [Milestone Name]

**Tasks Completed**:
- [Task 1] ✅
- [Task 2] ✅
- [Task 3] ✅

**Agents Involved**:
- [Agent 1]: [What they did]
- [Agent 2]: [What they did]

**Validation Results**:
- Tests: ✅ All passing (15 tests run)
- Build: ✅ No TypeScript errors
- Quality: ✅ Code review passed

**Files Modified**:
- [file1.ts](file1.ts) - [brief description]
- [file2.test.ts](file2.test.ts) - [brief description]

**Next Milestone**: [Name of next milestone]
**Ready to proceed?** (awaiting user confirmation)
```

## Context Management

### Critical Files to Monitor

Track progress across these files during orchestration:

- `.active_context/sprint_N.md` - Update checklist as tasks complete
- `.memory_bank/components_used.md` - Track new components
- `docs/glossary.md` - Track new terms added
- Test files - Ensure they pass
- Implementation files - Ensure no errors

## Communication Style

**With User**:
- Clear status updates using emojis (✅ ❌ 🔄 🔴) for visual scanning
- Concise summaries focusing on accomplishments
- Actionable escalations with recommended next steps
- Explicit checkpoints: "Ready to proceed to next milestone?"

**With Subagents** (via Task tool):
- Detailed context including plan excerpt, success criteria, constraints
- Explicit validation criteria
- Error context when retrying with suggested fixes
- Iteration awareness (attempt number and retry limit)

## Git Worktree Isolation (Default Mode)

All orchestration work MUST be performed in an isolated git worktree to enable parallel work and prevent conflicts with the user's working branch.

### Why Worktrees?

- **Parallel safety**: Multiple orchestrations can run simultaneously without file conflicts
- **Clean separation**: Each feature gets its own branch and working directory
- **Easy review**: Changes result in a pull request back to the base branch
- **No risk to base branch**: The user's current branch stays untouched

### Branch Naming Convention

Worktree branches follow this pattern:

```
{base_branch}_{feature_worked_on}
```

Where:
- `{base_branch}` is the branch the user is currently on when invoking `/orchestrate`
- `{feature_worked_on}` is a short kebab-case slug derived from the plan name or feature being implemented

**Examples**:
- Base branch `hardening`, feature "add rate limiting" → branch `hardening_add-rate-limiting`
- Base branch `master`, feature "user settings page" → branch `master_user-settings-page`
- Base branch `sprint-5`, feature "csv import" → branch `sprint-5_csv-import`

### Worktree Workflow

```
1. Detect current branch (base_branch)
   ↓
2. Derive feature slug from plan name
   ↓
3. Create worktree branch: {base_branch}_{feature_slug}
   ↓
4. Create worktree at .claude/worktrees/{feature_slug}/
   using: git worktree add .claude/worktrees/{feature_slug} -b {base_branch}_{feature_slug}
   ↓
5. STAGE 1: run the Implement → Independent Review → Iterate loop as a
   Dynamic Workflow whose agents operate inside the worktree
   (max 3 iterations; only Medium+ issues re-trigger implementation — see
   "Execution Engine" and "Independent Review & Iteration Loop"). The
   workflow ends and returns a severity-ranked report.
   ↓
6. HUMAN GATE (session, stage boundary): present the report; human picks
   Complete or Iterate-with-input (Iterate relaunches the Stage 1 workflow
   with the new input, counter reset; Complete continues below)
   ↓
7. Commit all changes in the worktree
   ↓
8. Push the worktree branch to remote
   ↓
9. Generate PR documentation using /document-changes (see below)
   ↓
10. Create pull request into {base_branch} using gh pr create
   ↓
11. Report PR URL to user
```

### Subagent Worktree Usage

When delegating to subagents, pass the worktree path as the working directory context. Subagents should:
- Perform all file reads/writes relative to the worktree path
- Run all commands (tests, builds, linters) from the worktree directory
- Use `isolation: "worktree"` in Agent tool calls when subagents need their own isolated copy

When Stage 1 runs as a Dynamic Workflow, its subagents run in `acceptEdits` (file edits auto-approved) and inherit your tool allowlist regardless of the session's permission mode. Instruct the workflow's agents to operate against the worktree path.

### Permissions for unattended runs

A Dynamic Workflow can still pause to prompt for shell commands, web fetches, or MCP tools that are **not** in your allowlist. Before kicking off a long Stage 1 run, add the commands the agents will need (e.g. `npm test`, `pytest`, `git`, `gh`) to the project/user allowlist so the run does not stall waiting on a prompt. The initial workflow-launch approval is separate and is requested once per workflow (see `/config` and the approval prompt).

### PR Documentation with /document-changes

Only after the human chooses **Complete** at the gate (step 6) and changes are committed in the worktree:

1. **Generate PR documentation** by following the workflow in the `document-changes` skill:
   - Compare the worktree branch against the base branch: `git diff {base_branch}...HEAD`
   - Read active context files for sprint/feature context
   - Analyze all changed files and generate the full PR summary
   - Delegate glossary analysis and linking to Haiku subagents
   - Add a **"Review summary"** section: iterations used (X/3), and any Low / human-accepted / unresolved issues from the final independent review
   - Save output to `docs/Pull Requests/{feature_slug}_PR.md` inside the worktree

2. **Create the pull request** using gh:
   ```bash
   gh pr create \
     --base {base_branch} \
     --head {base_branch}_{feature_slug} \
     --title "Short descriptive title (under 70 chars)" \
     --body-file docs/Pull\ Requests/{feature_slug}_PR.md
   ```

3. **Report to user**: Provide the PR URL and a summary of what was done

### Worktree Cleanup

- If the PR is created successfully, inform the user the worktree can be cleaned up after merge
- Do NOT automatically remove the worktree — the user may want to make additional changes
- Provide the cleanup command: `git worktree remove .claude/worktrees/{feature_slug}`

## Orchestration Best Practices

- **Stay context-aware**: Reference the implementation plan throughout execution
- **Be explicit about validation**: Don't assume tests passing means quality is met
- **Escalate early**: If something seems architecturally wrong, don't force through
- **Document decisions**: Keep track of any deviations from the original plan
- **User is the authority**: When in doubt, return control and ask
- **Always use worktrees**: Never modify the user's current working branch directly

## Your Task

The user has invoked `/orchestrate` with arguments: `$ARGUMENTS`

**If $ARGUMENTS is a file path**:
1. Detect the current branch (`git branch --show-current`) — this is the `base_branch`
2. Read the plan file at that path
3. Derive a feature slug from the plan name (short, kebab-case)
4. Create the worktree: `git worktree add .claude/worktrees/{feature_slug} -b {base_branch}_{feature_slug}`
5. Parse the plan into milestones; initialize an iteration counter (1/3) and current stage in the task list
6. **Stage 1 (Dynamic Workflow)**: run the implement → independent-review → iterate loop with its agents working inside the worktree.
   - **If `.claude/workflows/orchestrate-loop` exists**, invoke `/orchestrate-loop` with the plan path, `base_branch`, and worktree path. (This is the preferred path — fixed orchestration.)
   - **If it does not exist yet**, author it: kick off the loop with the word `workflow` in the prompt per the "What the `/orchestrate-loop` script must do" spec, then after a good run prompt the user to press `s` and save it as `orchestrate-loop` so future runs reuse it.
   - The script implements the milestones (per Agent Mapping), spawns a **fresh `general-purpose` reviewer** (`model: sonnet`, no impl context) ranking issues Low/Medium/High/Blocking, and **triages** (any Medium+ and iterations < 3 → fix only those and loop; else end and return a severity-ranked report).
   - If Dynamic Workflows are unavailable/disabled, run the identical loop in-session (fallback).
7. **Human gate** (session, after the workflow ends): present the report; the human picks **Complete** or **Iterate with added input** (the latter folds in the input, resets the counter, and relaunches the Stage 1 workflow)
8. **Stage 2 — on Complete**: commit, push, generate PR docs via `/document-changes` (include the review summary), create the PR into `base_branch`, report the URL

**If $ARGUMENTS is "continue"**:
1. Check the current todo list for orchestration state, including the iteration counter and current stage (Stage 1 loop / human-gate / Stage 2 PR)
2. Find the first task with status `in_progress`, or the first `pending` task after all `completed` tasks
3. Identify the worktree directory from the task context (check `.claude/worktrees/` for existing worktrees)
4. Resume from the recorded stage inside the worktree: if a Stage 1 workflow run is still alive this session, reattach via `/workflows`; otherwise relaunch the Stage 1 workflow (completed agents' work already lives in the worktree), or pick up at the human gate / PR stage as recorded
5. If no relevant todos found, ask user which plan to resume or start fresh

**If $ARGUMENTS is empty or unclear**:
1. Ask the user which plan to orchestrate
2. Suggest looking in `.active_context/` for active plans
3. Offer to create a new plan if needed

Begin orchestration following the workflow pattern above.
