# Document Changes Command

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

When this command is invoked, Claude should:

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

5. **Save Output**:
   - Write to specified output path
   - Confirm location to user
   - Suggest next steps (e.g., "Ready to create PR")

## Best Practices

### Writing Style
- **Be Specific**: "Added MSW handlers for auth endpoints" not "Updated tests"
- **Explain Why**: Include the reasoning behind changes
- **Use Examples**: Show before/after code snippets when helpful
- **Link Context**: Reference planning docs, issues, or related PRs

### File Descriptions
- **NEW files**: Explain what it does and why it was needed
- **MODIFIED files**: Focus on what changed, not what already existed
- **DELETED files**: Explain why it was removed and what replaced it (if anything)

### Organization
- Group related files together (e.g., all MSW handlers, all test files)
- Use clear section headings
- Maintain consistent formatting
- Use emoji sparingly but meaningfully (🆕 ✏️ ❌)

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

This command should be used:

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
