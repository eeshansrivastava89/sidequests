# Release Checklist

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
- [ ] GitHub Actions `release.yml` workflow completes
- [ ] DMG artifact is signed and notarized
- [ ] GitHub Release created with artifacts

## Post-Release

- [ ] Download DMG from release and verify install on clean macOS
- [ ] Gatekeeper accepts app without manual bypass
- [ ] Auto-update delivers to previous version (if applicable)
- [ ] Smoke test: configure > scan > enrich flow works
