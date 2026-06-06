# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default defineConfig([
<<<<<<< HEAD
  globalIgnores(["dist"]),
  {
    files: ["**/*.{ts,tsx}"],
=======
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
>>>>>>> 7863711792b8e6ad242e87e929f5c3ad2b21979d
    extends: [
      // Other configs...

      // Remove tseslint.configs.recommended and replace with this
      tseslint.configs.recommendedTypeChecked,
      // Alternatively, use this for stricter rules
      tseslint.configs.strictTypeChecked,
      // Optionally, add this for stylistic rules
      tseslint.configs.stylisticTypeChecked,

      // Other configs...
    ],
    languageOptions: {
      parserOptions: {
<<<<<<< HEAD
        project: ["./tsconfig.node.json", "./tsconfig.app.json"],
=======
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
>>>>>>> 7863711792b8e6ad242e87e929f5c3ad2b21979d
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
<<<<<<< HEAD
]);
=======
])
>>>>>>> 7863711792b8e6ad242e87e929f5c3ad2b21979d
```

You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
<<<<<<< HEAD
import reactX from "eslint-plugin-react-x";
import reactDom from "eslint-plugin-react-dom";

export default defineConfig([
  globalIgnores(["dist"]),
  {
    files: ["**/*.{ts,tsx}"],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs["recommended-typescript"],
=======
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
>>>>>>> 7863711792b8e6ad242e87e929f5c3ad2b21979d
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
<<<<<<< HEAD
        project: ["./tsconfig.node.json", "./tsconfig.app.json"],
=======
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
>>>>>>> 7863711792b8e6ad242e87e929f5c3ad2b21979d
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
<<<<<<< HEAD
]);
=======
])
>>>>>>> 7863711792b8e6ad242e87e929f5c3ad2b21979d
```
