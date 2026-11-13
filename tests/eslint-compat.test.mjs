import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { Linter } from "eslint";
import tseslint from "typescript-eslint";
import react from "../vendor/eslint-plugin-react/index.cjs";
import projectConfig from "../eslint.config.mjs";

const upstreamCases = JSON.parse(readFileSync(new URL("./fixtures/eslint-react-upstream-7.37.5.json", import.meta.url), "utf8"));
const linter = new Linter({ configType: "flat" });
const normalize = (messages) => JSON.parse(JSON.stringify(messages.map(({ ruleId, severity, message, line, column, endLine, endColumn }) => ({ ruleId, severity, message, line, column, endLine, endColumn }))));

test("upstream React rule fixtures retain their baseline TSX diagnostics", () => {
  assert.equal(upstreamCases.length, 475);
  for (const [index, fixture] of upstreamCases.entries()) {
    const config = [{
      files: ["**/*.tsx"],
      languageOptions: { parser: tseslint.parser, parserOptions: { ecmaFeatures: { jsx: true }, ...fixture.parserOptions }, globals: fixture.globals ?? {} },
      plugins: { react },
      settings: { react: { version: "19.0", ...fixture.settings?.react } },
      rules: { [`react/${fixture.rule}`]: ["error", ...(fixture.options ?? [])] },
    }];
    const actual = normalize(linter.verify(fixture.code, config, { filename: "fixture.tsx" }));
    assert.deepEqual(actual, fixture.diagnostics, `${fixture.rule} fixture ${index} (${fixture.kind})`);
  }
});

test("JSX usage rules preserve pragma and fragment variable accounting", () => {
  const cases = [
    ["/** @jsx h */\nimport { h } from './h'; export const A = () => <div />;", []],
    ["/** @jsx Foo.h */\nimport Foo from './f'; export const A = () => <div />;", []],
    ["import { Fragment } from 'react'; export const A = () => <>text</>;", []],
    ["import Thing from './thing'; export const A = () => <Thing />;", []],
    ["import Thing from './thing'; export const A = () => <div />;", ["@typescript-eslint/no-unused-vars"]],
  ];
  for (const extension of ["js", "jsx", "tsx"]) {
    for (const [source, expected] of cases) {
      const config = [{ files: [`**/*.${extension}`], languageOptions: { parser: tseslint.parser, parserOptions: { ecmaFeatures: { jsx: true } } }, plugins: { react, "@typescript-eslint": tseslint.plugin }, settings: { react: { version: "19.0" } }, rules: { "react/jsx-uses-react": "error", "react/jsx-uses-vars": "error", "@typescript-eslint/no-unused-vars": "warn" } }];
      assert.deepEqual(linter.verify(source, config, { filename: `fixture.${extension}` }).map((m) => m.ruleId), expected);
    }
  }
});

test("configured accessibility warnings accept prior inline object options", () => {
  const cases = {
    "aria-props": '<div aria-fake="x" />',
    "aria-proptypes": '<div aria-hidden="maybe" />',
    "aria-unsupported-elements": '<meta aria-label="x" />',
    "role-has-required-aria-props": '<div role="checkbox" />',
    "role-supports-aria-props": '<div role="button" aria-valuenow="3" />',
  };
  for (const [rule, jsx] of Object.entries(cases)) {
    const code = `/* eslint jsx-a11y/${rule}: ["warn", {}] */\nexport const A = () => ${jsx};`;
    const messages = linter.verify(code, projectConfig, { filename: "app/lint-fixture.tsx" });
    assert.ok(messages.some((m) => m.ruleId === `jsx-a11y/${rule}` && m.severity === 1), rule);
    assert.ok(!messages.some((m) => m.fatal), rule);
  }
});

test("React checks respect inline rule controls", () => {
  const code = "export const A = () => <p>You\u0027re ready</p>;";
  const run = (prefix) => linter.verify(prefix + code, projectConfig, { filename: "app/lint-fixture.tsx" }).filter((m) => m.ruleId === "react/no-unescaped-entities");
  assert.equal(run("").length, 1);
  assert.equal(run("/* eslint react/no-unescaped-entities: off */\n").length, 0);
  assert.equal(run("// eslint-disable-next-line react/no-unescaped-entities\n").length, 0);
});

test("configured import and accessibility rules detect invalid and accept valid code", () => {
  const cases = [
    ["import/no-anonymous-default-export", "export default () => null;", "const Component = () => null; export default Component;"],
    ["jsx-a11y/alt-text", "export const A = () => <Image src='x' />;", "export const A = () => <Image src='x' alt='description' />;"],
    ["jsx-a11y/aria-props", "export const A = () => <div aria-fake='x' />;", "export const A = () => <div aria-label='x' />;"],
    ["jsx-a11y/aria-proptypes", "export const A = () => <div aria-hidden='maybe' />;", "export const A = () => <div aria-hidden='true' />;"],
    ["jsx-a11y/aria-unsupported-elements", "export const A = () => <meta aria-label='x' />;", "export const A = () => <div aria-label='x' />;"],
    ["jsx-a11y/role-has-required-aria-props", "export const A = () => <div role='checkbox' />;", "export const A = () => <div role='checkbox' aria-checked='false' />;"],
    ["jsx-a11y/role-supports-aria-props", "export const A = () => <div role='button' aria-valuenow='3' />;", "export const A = () => <div role='button' aria-label='Go' />;"],
  ];
  for (const [rule, invalid, valid] of cases) {
    const check = (source) => linter.verify(source, projectConfig, { filename: "app/lint-fixture.tsx" }).filter((m) => m.ruleId === rule);
    assert.deepEqual(check(invalid).map((m) => m.severity), [1], `${rule} invalid`);
    assert.equal(check(valid).length, 0, `${rule} valid`);
  }
});

test("configured lint scopes and rule severities remain stable", async () => {
  const { ESLint } = await import("eslint");
  const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
  assert.equal(pkg.scripts.lint, "eslint app client components lib mcp tests worker --max-warnings=0");
  const engine = new ESLint();
  for (const file of ["app/board-app.tsx", "client/board.tsx", "components/ui/dialog.tsx", "lib/utils.ts", "mcp/server.mjs", "tests/eslint-compat.test.mjs", "worker/index.ts"]) {
    assert.equal(await engine.isPathIgnored(file), false, file);
    const config = await engine.calculateConfigForFile(file);
    for (const name of Object.keys(react.rules)) assert.equal(config.rules[`react/${name}`][0], 2, `${file}: react/${name}`);
    for (const name of ["import/no-anonymous-default-export", "jsx-a11y/alt-text", "jsx-a11y/aria-props", "jsx-a11y/aria-proptypes", "jsx-a11y/aria-unsupported-elements", "jsx-a11y/role-has-required-aria-props", "jsx-a11y/role-supports-aria-props"]) assert.equal(config.rules[name][0], 1, `${file}: ${name}`);
    for (const name of ["react/no-unknown-property", "react/react-in-jsx-scope", "react/prop-types", "react/jsx-no-target-blank"]) assert.equal(config.rules[name][0], 0, `${file}: ${name}`);
  }
  for (const file of ["dist/file.ts", ".sites-runtime/file.ts", ".wrangler/file.ts"]) assert.equal(await engine.isPathIgnored(file), true, file);
});

test("import and accessibility warnings respect inline controls", () => {
  const cases = [
    ["import/no-anonymous-default-export", "export default () => null;"],
    ["jsx-a11y/alt-text", "export const A = () => <Image src='x' />;"],
    ["jsx-a11y/aria-props", "export const A = () => <div aria-fake='x' />;"],
    ["jsx-a11y/aria-proptypes", "export const A = () => <div aria-hidden='maybe' />;"],
    ["jsx-a11y/aria-unsupported-elements", "export const A = () => <meta aria-label='x' />;"],
    ["jsx-a11y/role-has-required-aria-props", "export const A = () => <div role='checkbox' />;"],
    ["jsx-a11y/role-supports-aria-props", "export const A = () => <div role='button' aria-valuenow='3' />;"],
  ];
  for (const [rule, source] of cases) {
    const check = (prefix) => linter.verify(prefix + source, projectConfig, { filename: "app/lint-fixture.tsx" }).filter((m) => m.ruleId === rule);
    assert.equal(check("").length, 1, rule);
    assert.equal(check(`/* eslint ${rule}: off */\n`).length, 0, rule);
    assert.equal(check(`// eslint-disable-next-line ${rule}\n`).length, 0, rule);
  }
});
