## PROJECT_MAP.md — Knowledge Center File

### Decision
Created `PROJECT_MAP.md` in the root directory as a single comprehensive knowledge center for the entire codebase.

### Why
Every time a new Claude session starts, it reads each file individually to understand the project, consuming significant tokens. `PROJECT_MAP.md` consolidates everything into one authoritative document.

### What was done
1. **Created `PROJECT_MAP.md`** at the repo root containing:
   - Project overview and monorepo structure
   - Complete tech stack (frontend, backend, database)
   - Full Prisma database schema with relationships
   - All API routes with endpoints, auth requirements, and descriptions
   - Frontend route map, component tree, contexts, hooks, and lib utilities
   - Environment variables reference
   - Auth flow summary (step by step)
   - Authorization matrix (who can do what)
   - Coding standards and conventions (from CLAUDE.md)
   - Planned features and roadmap (from specs/)
   - Key design patterns used in the codebase

2. **Updated `CLAUDE.md`** with a "SESSION START" directive at the top instructing Claude to read `PROJECT_MAP.md` first, before exploring any other files.

### Files changed
- `PROJECT_MAP.md` — new file (root)
- `CLAUDE.md` — added session start instruction at top
- `specs/05-project-map.md` — this file
