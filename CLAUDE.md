# CLAUDE.md

## TDD Methodology Requirements

**MANDATORY TDD Process**: For every feature or refactor, strictly follow the RED-GREEN-REFACTOR cycle.

1. **RED Phase**
   - Generate failing tests FIRST using `mcp__zen__testgen` that define the expected behavior.
   - Confirm tests fail for the correct reason before implementation.
   - Do not implement functionality until tests exist and are failing.

2. **GREEN Phase**
   - Implement only enough code to make tests pass.
   - Verify all tests pass.
   - **MANDATORY ARCHITECTURAL REVIEW**: Run `mcp__zen__codereview` with models `[claude-opus-4.1, gemini-2.5-pro]`.
     - Check for duplication, unnecessary abstraction, violations of DRY, and over-complex APIs.
   - Address all critical issues before moving to refactor.

3. **REFACTOR Phase** (never skip)
   - Use `mcp__zen__refactor` to restructure code while keeping tests green.
   - Apply best practices, improve readability, add documentation, and implement robust error handling.
   - Run `mcp__zen__codereview` again to confirm architecture compliance.
   - Maintain all tests green.

---

## Repo-Wide Refactor Workflow

### Command: `REFACTOR-APP`

```
REFACTOR-APP: 
  refactor repo:// goals=[simplify architecture, reduce coupling, improve readability]; 
  codereview with models=[claude-opus-4.1, gemini-2.5-pro] for architecture + implementation review; 
  debug with model=gpt-5 for logic/bug tracing; 
  planner to order safe refactor steps; 
  testgen to generate missing RED tests; 
  precommit gate with models=[claude-opus-4.1, gemini-2.5-pro, gpt-5] consensus before merge.
```

**Tool roles**:
- `claude-opus-4.1` → deep architecture review
- `gemini-2.5-pro` → long-context reasoning and refactor validation
- `gpt-5` → logic tracing and debugging
- `testgen` → ensure proper RED coverage
- `planner` → enforce stepwise restructuring
- `precommit` → final merge gate requiring consensus

---

## File-Level Refactor Workflow

### Command: `REFACTOR-FILE`

```
REFACTOR-FILE: 
  refactor path=src/<file>.ext goals=[improve readability, apply best practices, simplify logic]; 
  codereview with models=[claude-opus-4.1, gemini-2.5-pro] for style + architecture; 
  debug with model=gpt-5 for logic/bug tracing; 
  testgen to ensure coverage; 
  precommit gate with models=[claude-opus-4.1, gemini-2.5-pro, gpt-5] consensus before merge.
```

**Use case**: Quicker targeted refactors for individual files or modules, without running on the full repository.

---

## Enforcement

- **All commits must pass precommit checks** with consensus across `claude-opus-4.1`, `gemini-2.5-pro`, and `gpt-5`.
- **Skipping TDD phases is prohibited.**
- **Every feature and refactor must have corresponding tests.**

