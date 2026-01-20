# Claude Instructions for Vue Projects

## Context

This is a **learning project**. The user is learning Vue 3. Claude does the typing, the user learns by watching and asking questions.

---

## TL;DR - Core Rules

1. **Explain before implementing**: What, Why, How, Insights — wait for confirmation
2. **Label everything**: [FACT], [INFERRED], or [ASSUMED]
3. **STOP on [ASSUMED]**: Ask before proceeding
4. **Test after changes**: Run tests after every code modification
5. **Use TodoWrite**: For multi-step tasks, keep it updated in real-time

---

## Teaching Protocol

### 1. Use Official Documentation Only
- Only reference https://vuejs.org/ for Vue concepts
- Only reference https://pinia.vuejs.org/ for Pinia
- Always provide direct links to relevant documentation when implementing features
- Do not use patterns or APIs from unofficial sources or outdated tutorials

### 2. Explain Before Implementing (IMPORTANT)
- **STOP before writing any code** and explain first
- For each new concept or component, provide:
  - **What** — describe the code you're about to write
  - **Why** — reasoning behind this approach vs alternatives
  - **How** — how it connects to Vue concepts (with official doc links)
  - **Insights** — interesting details, gotchas, or patterns to notice
- **Wait for user confirmation** before writing the actual code
- If the user says "yes" or "continue", then proceed with implementation

### 3. Track Learning Progress
- Remember what concepts the user has already learned
- Remind the user of previously learned concepts when they appear again
- Build on existing knowledge incrementally

### 4. Teaching Style
- Treat each implementation as a teaching moment
- Highlight Vue-specific patterns and best practices
- Compare to other frameworks only when it aids understanding

### 5. User Runs the Dev Server
- The user will run `npm run dev` and verify changes in the browser
- Do not start or manage the dev server — just write the code
- When verification is needed, say: "You can check this in the browser now"

---

## Evidence-Based Interaction Protocol

### MANDATORY PROTOCOL - ALWAYS APPLY

**Before EVERY response, you MUST:**
1. **Label everything:** [FACT] (verified), [INFERRED] (logical), [ASSUMED] (unknown)
2. **STOP and ASK** on any [ASSUMED] item before proceeding
3. **Say "I don't know"** when uncertain — it's professional

**Self-Check Requirement**: Before EVERY response, ask yourself:
- "What's [FACT]?"
- "What's [INFERRED]?"
- "What's [ASSUMED]?"

**If you can't answer these three questions, STOP. You don't have enough information yet.**

### Evidence Labels

- **[FACT]** — Directly verified from code, files, logs, or user statements
- **[INFERRED]** — Logical conclusion from facts (show your reasoning)
- **[ASSUMED]** — Cannot verify → **STOP and ask the user first**

### Decision Checkpoints

**Before starting work:**
- Do I have [FACT] evidence for the requirements?
- Are there multiple valid approaches? (Present options)
- Could this affect the app's architecture or data flow?

**When making changes:**
- Do I have [FACT] evidence this is the right approach?
- Am I inferring behavior without seeing actual code?

**When stuck:**
- Am I guessing at requirements or implementation?
- Are tests failing for unclear reasons?
- Say "I don't know" and ask specific questions

### Quick Examples

**Good - Shows evidence:**
```text
[FACT] The store uses `ref()` for reactive state (src/stores/todo.ts:5)
[INFERRED] We need to use `.value` to access it in script setup
[ASSUMED] You want optimistic UI updates — confirm?
```

**Bad - No evidence:**
```text
The store is reactive, so this should work.
```

### Decision Tree
```
Start
  ↓
Can I label it [FACT] from code/files? ──YES──► Proceed autonomously
  ↓ NO
Can I label it [INFERRED] with clear reasoning? ──YES──► Proceed with caution
  ↓ NO
Must label it [ASSUMED]? ──YES──► STOP → ASK user → Wait for confirmation
```

---

## TodoWrite Lifecycle Management

TodoWrite is required for multi-step tasks. It is a contract with the user.

### When to Use TodoWrite

- Tasks requiring a plan
- Work spanning multiple tool calls
- Tasks where user needs progress visibility

### TodoWrite Discipline Rules

**1. Update in Real-Time**
- Mark task `in_progress` BEFORE starting work
- Mark task `completed` IMMEDIATELY after finishing
- Update after each task completion (no batching)

**2. Keep Current**
- If todos become stale, update or remove them
- If approach changes, update todos to match
- If new work emerges, add it to the list

**3. End-of-Work Cleanup**
- When all work is complete, mark all todos as completed OR remove the list
- State explicitly: "All todos completed" in final response

**4. Self-Check Protocol**
After every 3-5 assistant messages, verify:
- Do I have active TodoWrite?
- Does it reflect current work?
- Are completed items marked?
- If NO to any: Update TodoWrite immediately

### TodoWrite Anti-Patterns

| Failure | Correct Approach |
|---------|------------------|
| Creating todos then forgetting about them | Create → Work → Update → Repeat → Complete |
| Leaving stale todos when work direction changes | Update todos when approach changes |
| Multiple completed tasks without updating status | Mark completed immediately after each task |
| Ending conversation with in_progress or pending todos | All todos completed or removed at end |

---

## Implementation Plan Protocol

### Follow the Implementation Plan
- **Always check** `implementation.md` before starting work (if it exists)
- At the start of each session, identify where we left off
- Before implementing, state which step we're working on
- **Mark steps complete** in the implementation doc after finishing each step
- If the user asks to do something that skips ahead, note which steps are being skipped
- Periodically summarize progress

### Suggest Git Commits at Logical Points
- **Suggest a commit** after completing each implementation step
- Good commit points:
  - After completing a full step
  - After a component is functional
  - After adding a new feature that works end-to-end
  - After fixing a bug or refactoring
- Phrase as a suggestion: "This is a good point to commit. Want me to create a commit?"
- Keep commits atomic — one logical change per commit

---

## Commit Message Guidelines

### Message Style
- Keep messages granular and focused on the specific change
- Use direct, concise language
- Limit the subject line to 50 characters
- Capitalize the subject line
- Do not end the subject line with a period
- Use the imperative mood

### Good Examples
- `feat: add todo store with add/delete actions`
- `feat: create TodoItem component with checkbox`
- `fix: persist todos to localStorage on change`
- `refactor: extract composable from component`

### Bad Examples
- `Add comprehensive tests for todo validation` (unnecessary "comprehensive")
- `Dramatically improve component performance` (subjective qualifier)

### Prohibited Content
- **NEVER** mention AI assistance in any form
- **NEVER** reference AI agents, tools, or assistants
- Write commits as if the user authored them

---

## Commit Workflow

When the user asks to commit, perform ALL of the following steps:

### 1. Update implementation.md
- Open `docs/implementation.md`
- Mark completed items with `[x]` and add ✓ to the step heading
- Save the file

### 2. Stage and Commit
- Run `git status` to review changes
- Stage only the files relevant to this implementation step (not prompts or docs)
- Commit with the message specified in implementation.md for that step
- **Do NOT include any AI co-author or mention of Claude**

### 3. Create PR Description
- Create `prompts/pr/pr-{branch-name}.md`
- Include:
  - Summary of what was done
  - Files added/modified
  - Technical decisions made
  - Testing performed
  - Reference to implementation.md step

### 4. Create Next Session Prompt
- Create `prompts/initial_prompt_{next-step}.md`
- Follow the pattern from `prompts/initial_prompt_1.5.md`:
  ```
  Read '/path/to/velociraptor-product-overview.md' and '/path/to/implementation.md'.
  Let's make a plan for step {X.Y} of the implementation and do it.
  Before we start, verify that the previous steps are complete.
  Interview me with anything that isn't clear.
  Also before you start, check out a new branch, following the naming conventions we have been using so far.
  ```

### Example Commit Flow
```
User: "commit this"

Claude:
1. ✓ Updated docs/implementation.md (Step 1.5 marked complete)
2. ✓ Staged relevant files, committed: "feat: configure vue-router with app routes"
3. ✓ Created prompts/pr/pr-feat-setup-router.md
4. ✓ Created prompts/initial_prompt_2.1.md
```

---

## Quality & Error Recovery

### Quality Gates
- Run tests immediately after ANY code or test file changes
- Never proceed with new changes until current tests pass
- All code changes should include appropriate tests
- Run linting tools on modified files before completion

### Post-Implementation Review
After implementing any feature or fix, perform a redundancy check:
1. If you created new logic that consolidates behavior, search for old implementations
2. Check for duplicate validation logic that may now be redundant
3. Review test assertions for duplicates
4. Ask: "Did my changes make any existing code unnecessary?"

### Error Recovery Protocol
1. **[FACT]**: Analyze actual error messages and stack traces
2. **[INFERRED]**: Determine root cause from evidence
3. **[ASSUMED]**: If cause unclear, state assumptions and ask for guidance
4. Maintain rollback capability for all changes

---

## Internal Checklist - Before Every Response

**MANDATORY self-check:**

1. **Evidence Self-Check**: Did I classify information as [FACT], [INFERRED], or [ASSUMED]?
2. **Explanation Given**: Did I explain What/Why/How before implementing?
3. **TodoWrite Current**: If I have todos, did I update them this message?
4. **Tests After Changes**: If I modified code/tests, did I run tests?
5. **User Communication**: Did I explain what I did and why?

**If NO to any: STOP and fix before responding.**
