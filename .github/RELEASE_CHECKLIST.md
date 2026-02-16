# Release Checklist (Source-First Default)

## Pre-Release

- [ ] All tests pass: `npm test` and `npm run test:integration`
- [ ] TypeScript compiles: `npx tsc --noEmit` and `npx tsc -p desktop/tsconfig.json`
- [ ] Lint passes: `npm run lint`
- [ ] Version bumped in `package.json`
- [ ] CHANGELOG updated (if maintained)

## Build Verification

- [ ] `npm run build` succeeds
- [ ] `npm run electron:build -- --dir` produces app bundle
- [ ] App launches from packaged build
- [ ] Onboarding wizard works on fresh config
- [ ] Scan completes successfully
- [ ] Settings persist across restart

## Release

- [ ] Create and push git tag: `git tag v<version> && git push origin v<version>`
- [ ] Source-first release notes published (build/run commands verified)
- [ ] GitHub Actions `release.yml` workflow completes (if using prebuilt artifacts)
- [ ] Optional: DMG artifact is signed and notarized (only when maintainer credentials are configured)
- [ ] Optional: GitHub Release includes desktop artifacts (`.dmg/.zip/.yml`)

## Post-Release

- [ ] Clean-clone validation: clone -> install -> setup -> desktop run works
- [ ] Smoke test: configure > scan > enrich flow works
- [ ] Optional signed lane: Download DMG and verify install on clean macOS
- [ ] Optional signed lane: Gatekeeper accepts app without manual bypass
- [ ] Optional signed lane: Auto-update delivers to previous version (if applicable)
