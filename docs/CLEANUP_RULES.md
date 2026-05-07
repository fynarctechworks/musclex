# Cleanup Rules

## Code Hygiene
- Remove unused imports immediately
- Remove dead code — no commented-out blocks
- Remove unused files (empty components, abandoned utilities)
- No duplicate logic — extract shared code if used 3+ times
- No placeholder comments (`// TODO` without a linked issue)

## File Structure
- Keep folder structure flat and minimal
- No empty directories
- No redundant index files that just re-export one thing
- Group by feature, not by type

## Documentation
- Only docs in `/docs/` — no scattered .md files elsewhere
- Remove outdated docs when the feature changes
- Don't create README files unless explicitly asked

## Dependencies
- Remove unused packages from package.json
- Audit dependencies periodically (`npm ls --depth=0`)
- Don't add packages for trivial operations (e.g., lodash for one function)

## After Refactors
- Run lint + build to verify nothing broke
- Check for orphaned imports/exports
- Verify no circular dependencies introduced
