# Release Notes

## 1.3.3 -> 2.0 (Fork & Prerelease)

Please report any issues during this phase on the [github repository](https://github.com/mtb-tools/vscode-mono-workspace/issues?q=is%3Aissue+is%3Aopen+sort%3Aupdated-desc):

### 1.3.9

- ci: autodeploy on OpenVSX
- fix: Bug when running commands on empty workspaces.

### 1.3.8

- feature: Added initial support for vscode.dev
- dev: Removed nx, nx/dev & ultra-runner dependencies
  
### 1.3.5 -> 1.3.6 -> 1.3.7

- dev: Chore bumps
- ci: Added cross platform CI
- dev: Switch to esbuild
  
### 1.3.3

- hint: Forked here by @melMass.
- feature: Added support for NX Monorepo & Cargo workspaces.
- fix: Updated dependencies.
- fix: Reduced bundle size.

## 1.3.0

- Use rollup for smaller (and faster) builds
- Added config option to include monorepo root during sync. (Implements Make includeRoot configurable from VSCode settings #56)

## 1.2.0

- Added option to configure custom package types

## 1.1.3

- Fixed an issue with workspace folders on Windows

## 1.0.0

- Initial release :tada:
