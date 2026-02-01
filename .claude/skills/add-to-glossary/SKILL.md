# Add to Glossary Skill

## Purpose
Intelligently add or update technical concepts in the project glossary based on conversation topics, using Haiku subagents for efficient analysis and documentation.

## Usage

```bash
# Add concepts from current conversation to glossary
/add-to-glossary

# Add specific concept to glossary
/add-to-glossary --concept "React Server Components"

# Review and suggest glossary updates without writing
/add-to-glossary --dry-run
```

## Arguments

- `--concept <name>`: Specific concept name to add (optional, defaults to analyzing current conversation)
- `--category <name>`: Target glossary category/file (e.g., "react-patterns-hooks", "authentication-security")
- `--dry-run`: Analyze and suggest updates without writing to files
- `--force-new`: Create a new glossary file even if related ones exist

## What It Does

This skill helps maintain the project's technical glossary (`/docs/knowledge/glossary`) by:

1. **Analyzing Conversations**: Reviews current conversation or specified topics to identify technical concepts worth documenting
2. **Finding Related Content**: Searches existing glossary files to avoid duplication and find appropriate placement
3. **Making Smart Updates**: Decides whether to update existing entries or create new ones
4. **Following Standards**: Ensures all glossary entries have proper frontmatter and Obsidian-compatible formatting

## Glossary Structure

The glossary is organized into specialized files under `/docs/knowledge/glossary`:

- `glossary.md` - Main index file linking to all topic files
- dynamic files with detailed explanation of the topics

## Frontmatter Requirements

Every glossary file MUST include YAML frontmatter with these properties:

```yaml
---
documentation_status: New|Updated|Reviewed
overview: 2-4 sentence summary of what this file covers and its purpose in the glossary
tags:
  - tag1
  - tag2
  - tag3
---
```

### Frontmatter Fields

- **documentation_status**: Current state of the documentation. new files are always added as 'New', Updated with 'Updated'. Never set to 'Reviewed' the user must do it manually
  - `New` - Recently created, needs review
  - `Updated` - Recently modified content
  - `Reviewed` - Verified and up-to-date

- **overview**: A concise 2-4 sentence summary that:
  - Describes what topics the file covers
  - Explains the context or use cases
  - Helps readers quickly understand if this is relevant to their needs

- **tags**: Array of relevant technology/topic tags for categorization
  - Use lowercase with hyphens (e.g., `react-query`, `type-safety`)
  - Include technology names (e.g., `react`, `typescript`, `docker`)
  - Include concept categories (e.g., `testing`, `security`, `architecture`)
  - 3-8 tags per file is ideal
  - Read what tags already exist in the obsidian vault, and try not to add new if you can use existing ones

## Entry Format

Each glossary entry should follow this format:

```markdown
**Concept Name**: Brief explanation (1-3 sentences) of what it is and why it matters. Include practical examples or use cases when helpful. Reference implementation files with markdown links when relevant.

Example:
**React Query (TanStack Query)**: Library for managing server state (API data). Handles loading states, caching, refetching, mutations. Alternative to Redux for async data. We use it for all API calls.
```

### Entry Guidelines

- **Bold the concept name** at the start
- Keep explanations concise but complete (1-3 sentences)
- Include practical context: "We use it for..." or "This helps with..."
- Link to relevant implementation files: `Implementation: [filename.ts](../path/to/file.ts)`
- Use concrete examples when helpful
- Explain WHY not just WHAT

## Execution Steps

When this skill is invoked, follow these steps:

### Step 1: Delegate Analysis to Haiku Agent (Read-Only)

Use a Haiku subagent to efficiently analyze existing glossary content. **IMPORTANT**: Haiku is used ONLY for reading and analysis, NOT for writing.

```
Task: Analyze glossary files and identify related concepts
Agent Type: Explore (or general-purpose)
Model: Haiku

Prompt:
"Read all frontmatter from files in /docs/knowledge/glossary directory.
For each file, extract:
- File name
- documentation_status
- overview summary
- tags

Based on the current conversation topic [TOPIC], identify:
1. Which existing glossary files are most related (based on tags and overview)
2. Whether new entries should be added to existing files or need a new file
3. Any tag overlaps or categorization suggestions
4. What existing tags are already used across all glossary files (to avoid creating new tags unnecessarily)

Return a structured summary of findings."
```

### Step 2: Decide Update Strategy

Based on the Haiku agent's analysis, determine:

- **Update Existing File**: If closely related concepts exist
  - Identify specific file to update
  - Determine placement within file (alphabetical or logical grouping)
  - Check if concept already exists (avoid duplication)

- **Create New File**: If topic is distinct enough
  - Propose new filename (kebab-case, descriptive)
  - Define appropriate tags
  - Write comprehensive overview

- **Update Multiple Files**: If concept spans categories
  - Identify all relevant files
  - Determine what aspects to document in each

### Step 3: Write the Updates (Main Session or Inherited Model Agent)

**IMPORTANT**: Writing must be done by the main session or a subagent with the inherited model (NOT Haiku). This ensures quality and consistency with the rest of the codebase documentation.

Options for writing:
1. **Main session directly**: If the update is straightforward and single-file
2. **documentation-writer agent**: For complex multi-file updates or when creating new glossary files
3. **general-purpose agent with inherited model**: For updates requiring additional research

Write the updates with the following approach:

```
Concept: [CONCEPT NAME]
Category: [CATEGORY/FILE]
Context: [2-3 sentences from conversation explaining the concept]

Requirements:
1. Write entry in glossary format (bold name, 1-3 sentence explanation)
2. Include practical examples or use cases
3. Link to implementation files if mentioned in conversation
4. Use Obsidian markdown syntax for links: [[filename]] or [display](path)
5. If this is a new file, include proper frontmatter with documentation_status: New
6. Update existing frontmatter's documentation_status to 'Updated' if modifying existing file
7. Ensure tags in frontmatter include relevant technologies (reuse existing tags from Haiku's analysis)

Write the entry now."
```

### Step 4: Update Index if Needed

If a new glossary file was created:

1. Read `/docs/knowledge/glossaryglossary.md`
2. Add link to new file in the Sections list (maintain alphabetical order)
3. Update "Last Updated" date
4. Update frontmatter tags if new categories were introduced

### Step 5: Verify Obsidian Compatibility

Ensure all entries follow Obsidian markdown conventions:

- **Wikilinks**: Use `[[filename]]` for internal links where appropriate
- **External Links**: Use `[text](url)` format
- **File Links**: Use relative paths `[file.ts](../../path/to/file.ts)`
- **Tags in Content**: Can use `#tag` syntax in addition to frontmatter tags
- **Callouts**: Use `> [!note]`, `> [!warning]`, etc. for important notes
- **Code Blocks**: Use triple backticks with language specification

## Examples

### Example 1: Adding New React Concept

Conversation discusses React Server Components. The skill:

1. Haiku agent analyzes glossary (read-only), finds `react-patterns-hooks.md` is most related
2. Main session determines RSC is advanced enough to warrant entry in `concepts-to-learn-more.md` instead
3. Main session adds entry:
   ```markdown
   **React Server Components**: New React paradigm for server-side rendering with component-level granularity. Reduces client bundle size by keeping data fetching and rendering on server. Currently experimental but planned for future sprints.
   ```
4. Main session updates frontmatter to `documentation_status: Updated`

### Example 2: Creating New Category

Conversation covers Celery, Redis, background jobs:

1. Haiku agent analyzes (read-only) and finds no existing category for backend job processing
2. Main session proposes new file: `background-jobs.md`
3. Main session or documentation-writer agent creates file with proper frontmatter:
   ```yaml
   ---
   documentation_status: New
   overview: Covers asynchronous background job processing with Celery and Redis. Explains task queues, workers, scheduling, and patterns for handling long-running operations without blocking API requests.
   tags:
     - celery
     - redis
     - background-jobs
     - python
     - async
   ---
   ```
4. Main session adds entries for Celery, Redis, task patterns
5. Main session updates main `glossary.md` index

### Example 3: Multi-File Update

Conversation about JWT refresh token security:

1. Haiku agent identifies `authentication-security.md` needs update
2. Also identifies `api-communication.md` needs cookie handling info
3. Delegates two Haiku agents in parallel:
   - Agent 1: Updates JWT/refresh token entries in `authentication-security.md`
   - Agent 2: Adds cookie credentials info to `api-communication.md`
4. Both update their file's frontmatter to `documentation_status: Updated`

## Best Practices

1. **Use Haiku for Efficiency**: Glossary updates are straightforward documentation tasks perfect for Haiku's speed and cost-effectiveness

2. **Analyze Before Writing**: Always delegate the analysis step first to avoid duplicate work or poor categorization

3. **Maintain Consistency**: Follow existing entry formats and naming conventions in each file

4. **Link Generously**: Connect glossary entries to implementation files and other relevant documentation

5. **Keep It Current**: Update `documentation_status` to `Updated` whenever modifying existing files

6. **Tag Appropriately**: Use consistent tags that match existing patterns. Check other files for tag examples.

7. **Update Index**: Never forget to update the main `glossary.md` index when adding new files

8. **Obsidian Features**: Leverage Obsidian's features like wikilinks, callouts, and tag search to make glossary more powerful

## Integration with Obsidian

This skill uses the Obsidian markdown skills when available:

- `obsidian:obsidian-markdown` - For creating and editing glossary entries with proper Obsidian syntax
- Wikilinks for cross-referencing between glossary files
- Tags for categorization and search
- Frontmatter for metadata
- Callouts for important notes or warnings

## Error Handling

If the skill encounters issues:

- **File Not Found**: Verify `/docs/knowledge/glossary` directory exists, check spelling
- **Duplicate Concept**: Search existing files before adding; update instead of duplicate
- **Missing Frontmatter**: All glossary files MUST have frontmatter; add if missing
- **Invalid Tags**: Use lowercase-with-hyphens format; avoid spaces or special characters
- **Broken Links**: Verify file paths are relative and correct from glossary location

## Future Enhancements

Potential improvements to this skill:

- Auto-detect concepts from conversation without explicit invocation
- Suggest related glossary entries when user asks questions
- Validate frontmatter schema automatically
- Generate tag suggestions based on existing patterns
- Create visual knowledge graph from glossary links
- Sync with Obsidian graph view

---

**Last Updated**: 2026-02-01
**Skill Version**: 1.0
**Maintained By**: documentation-writer agent
