---
name: document-changes
description: Generate comprehensive PR documentation for code changes, with glossary linking and Obsidian wikilinks. Use when preparing pull request descriptions or sprint summaries.
argument-hint: "[--commits range] [--files paths] [--compare-branch branch] [--output path] [--format type]"
disable-model-invocation: true
---

# Document Changes Skill

## Purpose
Generate comprehensive documentation for code changes in a pull request, following the project's established documentation patterns (similar to sprint summary documents).

## Usage

```bash
# Document all uncommitted changes on current branch
/document-changes

# Document changes from specific commits
/document-changes --commits "commit1..commit2"

# Document specific files
/document-changes --files "path/to/file1.ts path/to/file2.tsx"

# Document changes compared to a specific branch
/document-changes --compare-branch main
```

## Arguments

- `--commits <range>`: Git commit range (e.g., "HEAD~3..HEAD", "abc123..def456")
- `--files <paths>`: Space-separated list of file paths to document
- `--compare-branch <branch>`: Branch to compare against (default: main)
- `--output <path>`: Output file path (default: docs/frontend/pull_request_summary.md)
- `--format <type>`: Output format: "pr" (pull request), "sprint" (sprint summary), "changelog" (default: "pr")

## What It Does

1. **Analyzes Changes**:
   - Reads git diff or specified files
   - Identifies new, modified, and deleted files
   - Extracts key changes from commit messages if available
   - Reviews test files to understand testing strategy

2. **Gathers Context**:
   - Reads relevant planning documents (e.g., .active_context/*.md)
   - Identifies the goal/objective of the changes
   - Understands the broader sprint or feature context

3. **Generates Documentation** following this structure:

   ### For Pull Request Format:
   ```markdown
   # [Feature/Fix Name] - Summary

   ## Overview
   Brief 2-3 sentence summary of what changed and why

   ## Goals Achieved
   - Bulleted list of objectives completed
   - References to original planning documents

   ## Architecture & Tech Stack Changes
   - Only document NEW or CHANGED architectural decisions
   - Skip unchanged patterns already documented elsewhere

   ## Directory Structure
   Explicit tree showing:
   - 🆕 NEW files (with 1-line description)
   - ✏️ MODIFIED files (with 1-line description of what changed)
   - ❌ DELETED files (with 1-line reason)
   - Unchanged files shown without emoji for context

   ## Files Changed - Detailed Breakdown
   Group files logically (e.g., "Test Infrastructure", "Auth Hooks", etc.)

   For each file:
   - **Status**: NEW / MODIFIED / DELETED
   - **Purpose**: 1-3 sentences explaining the file's role
   - **Key Changes**: What specifically changed (for MODIFIED files)
   - **Impact**: How this affects the codebase

   ## Testing Strategy
   - Test coverage changes (before/after)
   - New test patterns introduced
   - Testing infrastructure changes

   ## Migration Notes (if applicable)
   - Breaking changes
   - Required manual steps
   - Deprecation warnings

   ## Performance Impact (if applicable)
   - Build time changes
   - Test suite duration
   - Bundle size changes

   ## Next Steps / Follow-up Work
   - Known limitations
   - Future improvements planned
   - Related work needed
   ```

## Execution Steps

When this skill is invoked, Claude should:

1. **Determine Change Scope**:
   ```bash
   # If --files specified: analyze those files
   # Else if --commits specified: git diff <range>
   # Else if --compare-branch specified: git diff <branch>...HEAD
   # Else: git status + git diff for uncommitted changes
   ```

2. **Read Planning Context**:
   - Check .active_context/ for relevant planning docs
   - Read commit messages for context
   - Identify the sprint/feature being worked on

3. **Analyze Each File**:
   - Read file contents (for new/modified files)
   - Understand purpose and changes
   - Identify dependencies and impacts

4. **Generate Documentation**:
   - Follow the structure above
   - Use clear, descriptive language
   - Include code examples where helpful
   - Reference related documentation

5. **Link to Glossary and Related Documentation**:

   a. **Write Initial Documentation Draft**:
      - Generate the complete documentation following the structure above
      - Save to the specified output path

   b. **Delegate Glossary Analysis to Haiku Subagent**:
      - Use Task tool with `subagent_type="general-purpose"` and `model="haiku"`
      - Task: "Read all files in /docs/knowledge/glossary/ and identify which glossary topics are related to [conversation topic/feature name]"
      - Haiku should:
        - Read frontmatter/metadata from all glossary markdown files
        - Return a list of relevant glossary topics with brief descriptions
        - Identify related documentation files (e.g., north_star.md, SystemArchitecture.md)

   c. **Decide on Glossary Updates**:
      - Review Haiku's analysis
      - Determine if any existing glossary items need updates based on new changes
      - Identify new concepts that should be added to glossary (note for future work)

   d. **Delegate Documentation Enhancement to Haiku Subagent**:
      - Use Task tool with `subagent_type="general-purpose"` and `model="haiku"`
      - Task: "Update [output file path] with Obsidian wikilinks to relevant glossary topics: [list from step b]"
      - Haiku should:
        - Add wikilinks using Obsidian syntax: `[[../gloassary/topic|Display Text]]`
        - Insert informational callout boxes with references
        - Add inline links where technical concepts are mentioned
        - Follow the pattern from Sprint_3_Release.md as reference

   e. **Verify Links**:
      - Review the updated documentation
      - Ensure all wikilinks are correctly formatted
      - Confirm glossary references are relevant and helpful

6. **Save Output**:
   - Confirm final documentation location to user
   - Report which glossary topics were linked
   - Suggest next steps (e.g., "Ready to create PR", "Consider updating glossary with new concepts")

## Best Practices

### Writing Style
- **Be Specific**: "Added MSW handlers for auth endpoints" not "Updated tests"
- **Explain Why**: Include the reasoning behind changes
- **Use Examples**: Show before/after code snippets when helpful
- **Link Context**: Reference planning docs, issues, or related PRs
- **Add Glossary Links**: Use Obsidian wikilinks to connect documentation to learning resources

### File Descriptions
- **NEW files**: Explain what it does and why it was needed
- **MODIFIED files**: Focus on what changed, not what already existed
- **DELETED files**: Explain why it was removed and what replaced it (if anything)

### Organization
- Group related files together (e.g., all MSW handlers, all test files)
- Use clear section headings
- Maintain consistent formatting
- Use emoji sparingly but meaningfully (🆕 ✏️ ❌)

### Glossary Integration
- **Identify Technical Concepts**: Note all technical terms mentioned (e.g., "React Query", "JWT", "multi-tenant")
- **Use Obsidian Callouts**: Add informational callout boxes with glossary references
  ```markdown
  > [!info] Related Concepts
  > - [[../gloassary/state-management|State Management]] - React Query patterns
  > - [[../gloassary/authentication-security|Authentication & Security]] - JWT implementation
  ```
- **Inline Links**: Add inline wikilinks where concepts are first introduced
  ```markdown
  See [[../gloassary/testing|Testing]] for comprehensive testing patterns
  ```
- **Comprehensive Reference Section**: Include a "Technical Glossary" subsection in "Related Documentation"
  ```markdown
  ### Technical Glossary
  > [!info] Learning Resources
  > New to the project? Start with the [[../gloassary/glossary|Technical Glossary]] for:
  > - [[../gloassary/frontend-build-configuration|Frontend Build & Configuration]]
  > - [[../gloassary/routing-navigation|Routing & Navigation]]
  > - [[../gloassary/testing|Testing]]
  > ...
  ```

### Delegation to Haiku for Efficiency
- **Use Haiku for Analysis Tasks**: Delegate glossary analysis to Haiku subagents to save tokens
- **Use Haiku for Link Updates**: Delegate documentation enhancement with wikilinks to Haiku
- **Pattern Reference**: Point Haiku to `docs/Pull Requests/Sprint_3_Release.md` as a reference for glossary linking patterns

## Examples

### Example 1: Documenting Uncommitted Changes
```bash
/document-changes
```
Output: Analyzes `git status` and `git diff`, reads active context files, generates PR summary.

### Example 2: Documenting Specific Commits
```bash
/document-changes --commits "abc123..def456" --output docs/feature_x_summary.md
```
Output: Analyzes commits in range, generates summary at specified path.

### Example 3: Sprint Summary Format
```bash
/document-changes --compare-branch main --format sprint --output docs/frontend/sprint_1_summary.md
```
Output: Generates comprehensive sprint summary document.

## Integration with Workflow

This skill should be used:

1. **Before Creating PR**: Generate documentation to include in PR description
2. **After Sprint Completion**: Create sprint summary for historical reference
3. **For Code Reviews**: Provide reviewers with comprehensive change context
4. **Documentation Updates**: Keep docs/ folder current with changes

## Notes

- Always read the example format from docs/frontend/sprint_0_summary.md for reference
- Maintain consistency with existing documentation style
- Include test coverage statistics when available
- Reference related documentation files
- Update the output file's "Last Updated" timestamp
- **IMPORTANT**: Always link to glossary and related documentation using the workflow in step 5
- Use `docs/Pull Requests/Sprint_3_Release.md` as a reference for glossary linking patterns

## Glossary Topics Reference

The following glossary topics are available in `/docs/knowledge/glossary/`:

1. **frontend-build-configuration.md** - Vite, TypeScript, build tools
2. **routing-navigation.md** - React Router, navigation patterns
3. **authentication-security.md** - JWT, auth patterns, multi-tenant security
4. **state-management.md** - React Query, Context API, state patterns
5. **react-patterns-hooks.md** - Custom hooks, composition patterns
6. **typescript.md** - Type patterns, generics, best practices
7. **api-communication.md** - REST API, error handling, HTTP patterns
8. **ui-components-design.md** - MUI, atomic design, AG Grid
9. **development-workflow.md** - Git, migrations, testing, CI/CD
10. **testing.md** - Vitest, pytest, React Testing Library, MSW
11. **project-structure-concepts.md** - File organization, architecture
12. **concepts-to-learn-more.md** - Advanced topics
13. **resources.md** - External learning resources

## Example Workflow

### Full Example: Documenting Sprint 4 Changes

```bash
# User runs skill
/document-changes --compare-branch main --format sprint --output docs/Pull Requests/Sprint_4_Release.md
```

**Step-by-step execution**:

1. **Analyze changes**: `git diff main...HEAD`
2. **Read context**: Check `.active_context/sprint_4.md`
3. **Generate initial documentation**: Write complete sprint summary
4. **Delegate glossary analysis to Haiku**:
   ```
   Task: "Read all files in /docs/knowledge/glossary/ (frontend-build-configuration.md,
   routing-navigation.md, authentication-security.md, state-management.md,
   react-patterns-hooks.md, typescript.md, api-communication.md,
   ui-components-design.md, development-workflow.md, testing.md,
   project-structure-concepts.md, concepts-to-learn-more.md, resources.md)
   and identify which glossary topics are related to Sprint 4: Categories Feature"
   ```

   Haiku returns:
   - `state-management.md` - React Query for category queries
   - `ui-components-design.md` - Tree component for hierarchical categories
   - `api-communication.md` - Category CRUD endpoints
   - `testing.md` - Category hook tests

5. **Delegate documentation enhancement to Haiku**:
   ```
   Task: "Update docs/Pull Requests/Sprint_4_Release.md with Obsidian wikilinks
   to these glossary topics: state-management, ui-components-design,
   api-communication, testing. Follow the pattern from
   docs/Pull Requests/Sprint_3_Release.md"
   ```

6. **Report to user**:
   - "Documentation saved to: docs/Pull Requests/Sprint_4_Release.md"
   - "Linked to 4 glossary topics: State Management, UI Components & Design, API Communication, Testing"
   - "Next steps: Review documentation, create PR"
