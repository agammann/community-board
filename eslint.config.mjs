import { defineConfig, globalIgnores } from "eslint/config";
import react from "./vendor/eslint-plugin-react/index.cjs";
import reactHooks from "eslint-plugin-react-hooks";
import importPlugin from "eslint-plugin-import-x";
import jsxA11yUpstream from "eslint-plugin-jsx-a11y-x";
import globals from "globals";
import tseslint from "typescript-eslint";

// The former JSX a11y plugin accepted a no-op options object for these rules.
// The maintained successor rejects that syntax, so preserve the prior schema.
const legacyObjectOptions = ["aria-props", "aria-proptypes", "aria-unsupported-elements", "role-has-required-aria-props", "role-supports-aria-props"];
const jsxA11y = {
  ...jsxA11yUpstream,
  rules: {
    ...jsxA11yUpstream.rules,
    ...Object.fromEntries(legacyObjectOptions.map((name) => [name, {
      ...jsxA11yUpstream.rules[name],
      meta: { ...jsxA11yUpstream.rules[name].meta, schema: [{ type: "object", properties: {} }] },
    }])),
  },
};

export default defineConfig([
  {
    files: ["**/*.{js,jsx,mjs,ts,tsx,mts,cts}"],
    plugins: { react, "react-hooks": reactHooks, import: importPlugin, "jsx-a11y": jsxA11y },
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
    settings: { react: { version: "detect" } },
    rules: {
      ...react.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,
      "import/no-anonymous-default-export": "warn",
      "react/no-unknown-property": "off",
      "react/react-in-jsx-scope": "off",
      "react/prop-types": "off",
      "react/jsx-no-target-blank": "off",
      "jsx-a11y/alt-text": ["warn", { elements: ["img"], img: ["Image"] }],
      "jsx-a11y/aria-props": "warn",
      "jsx-a11y/aria-proptypes": "warn",
      "jsx-a11y/aria-unsupported-elements": "warn",
      "jsx-a11y/role-has-required-aria-props": "warn",
      "jsx-a11y/role-supports-aria-props": "warn",
      "no-restricted-syntax": ["error", {
        selector: "JSXOpeningElement[name.name='script']:has(> JSXAttribute[name.name='src']):not(:has(> JSXAttribute[name.name='async'])):not(:has(> JSXAttribute[name.name='defer'])):not(:has(> JSXAttribute[name.name='type'][value.value='module']))",
        message: "External scripts must use async, defer or type=module to avoid blocking the page.",
      }],
    },
  },
  ...tseslint.configs.recommended,
  { rules: {
    "@typescript-eslint/no-unused-vars": ["error", { ignoreRestSiblings: true }],
    "@typescript-eslint/no-unused-expressions": "warn",
  } },
  globalIgnores(["dist/**", ".sites-runtime/**", ".wrangler/**"]),
]);
