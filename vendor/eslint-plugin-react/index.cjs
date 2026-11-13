'use strict';
// See README.md for upstream provenance and the ESLint 10 compatibility patch.
const names = [
  "display-name",
  "jsx-key",
  "jsx-no-comment-textnodes",
  "jsx-no-duplicate-props",
  "jsx-no-undef",
  "jsx-uses-react",
  "jsx-uses-vars",
  "no-children-prop",
  "no-danger-with-children",
  "no-deprecated",
  "no-direct-mutation-state",
  "no-find-dom-node",
  "no-is-mounted",
  "no-render-return-value",
  "no-string-refs",
  "no-unescaped-entities",
  "require-render-return"
];
const rules = Object.fromEntries(names.map(name => [name, require('./lib/rules/' + name)]));
module.exports = { rules, configs: { recommended: { rules: { ...Object.fromEntries(names.map(name => ['react/' + name, 'error'])), 'react/no-unsafe': 'off' } } } };
