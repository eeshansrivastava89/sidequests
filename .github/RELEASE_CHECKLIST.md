# Release Checklist

## Pre-Release

- [ ] All tests pass: `npm test` and `npm run test:integration`
- [ ] TypeScript compiles: `npx tsc --noEmit`
- [ ] Lint passes: `npm run lint`
- [ ] Version bumped in `package.json`
- [ ] CHANGELOG updated (if maintained)

## Build Verification

- [ ] `npm run build:npx` succeeds
- [ ] `npm pack --dry-run` shows only `bin/*.mjs`, `.next/standalone/`, `public/`
- [ ] `npx @eeshans/sidequests --no-open` starts server and `/api/preflight` returns 200
- [ ] Onboarding wizard works on fresh config
- [ ] Scan completes successfully
- [ ] Settings persist across restart

## Privacy Gate

- [ ] `npm run check:privacy` passes
- [ ] No `.env` files in `npm pack` output
- [ ] No test files in `npm pack` output

## Release

CI auto-publishes to npm on version tags via `.github/workflows/publish.yml` (OIDC trusted publishing with provenance).

```bash
npm version patch    # bumps version, creates git tag
git push --tags      # triggers publish workflow
```

- [ ] Verify CI publish workflow passes
- [ ] Verify: `npx @eeshans/sidequests@<version>` launches correctly

## Post-Release

- [ ] Clean-machine validation: `npx @eeshans/sidequests` on fresh environment
- [ ] Smoke test: configure > scan > enrich flow works
