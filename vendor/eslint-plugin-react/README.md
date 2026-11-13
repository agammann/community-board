# React lint compatibility

This directory contains the 17 rules enabled by this project's React lint
configuration and their transitive local utilities from `eslint-plugin-react`
7.37.5, tag commit `2c98b83c451a4297edf1787d9a616e50687e27e8`:
https://github.com/jsx-eslint/eslint-plugin-react/tree/v7.37.5

The four utility files `componentUtil.js`, `eslint.js`, `message.js`, and
`version.js` are from the unmerged upstream ESLint 10 compatibility proposal,
head `06a0f984e0799437e69cb8bfac9550be8efb4d46`:
https://github.com/jsx-eslint/eslint-plugin-react/pull/4022
The upstream MIT license and copyright notice are in `LICENSE`. The
`tests/fixtures/eslint-react-upstream-7.37.5.json` cases are derived from the
same release's upstream rule tests; expected diagnostics were recorded using
ESLint 9.39.4 and typescript-eslint 8.59.3.

This is a temporary, locally maintained compatibility copy. Pin the ESLint
version, keep these files and test fixtures under review, and check upstream
security fixes and releases when upgrading ESLint or its React rules. Replace
the copy with the official plugin after it supports ESLint 10 and the project
regressions pass. Only the 17 configured React rules are present; an inline
comment cannot enable a different React rule until the official plugin returns.
The accessibility and import successor plugins are maintained dependencies;
the configuration preserves the old a11y option schema for five rules.
