import js from "@eslint/js";
import globals from "globals";
import pluginReact from "eslint-plugin-react";
import stylelintPlugin from 'eslint-plugin-stylelint'; // Import the stylelint plugin
import { defineConfig } from "eslint/config";

export default defineConfig([
  {
    files: ["**/*.{js,mjs,cjs,jsx}"],
    plugins: {
      js,
    },
    extends: ["js/recommended"],
  },
  {
    files: ["**/*.{js,mjs,cjs,jsx}"],
    languageOptions: {
      globals: globals.browser,
    },
  },
  pluginReact.configs.flat.recommended,
  {
    files: ["**/*.css"], // Target CSS files
    plugins: {
      stylelint: stylelintPlugin, // Use the stylelint plugin
    },
    rules: {
      'stylelint/config': [
        true,
        {
          configFile: '.stylelintrc.json', // Point to your Stylelint config
        },
      ],
    },
  },
]);