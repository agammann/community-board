import { defineConfig, globalIgnores } from "eslint/config";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import importPlugin from "eslint-plugin-import";
import jsxA11y from "eslint-plugin-jsx-a11y";
import globals from "globals";
import tseslint from "typescript-eslint";

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
