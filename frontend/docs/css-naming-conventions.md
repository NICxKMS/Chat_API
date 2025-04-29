# CSS Naming Conventions: BEM + Utility-First Hybrid

This document outlines the standardized naming conventions for CSS classes across the project to ensure maintainability, readability, and consistency.

## 1. Block-Element-Modifier (BEM)

- **Block**: Standalone component, e.g. `Button`, `AuthButton`, `MoreActions`.
- **Element**: Child of a block, prefixed with `__`, e.g. `Button__icon`, `AuthButton__avatar`.
- **Modifier**: Variant or state of a block/element, prefixed with `--`, e.g. `Button--primary`, `AuthButton__avatar--small`.

### Examples
```
<Block>       => .AuthButton
<Block>__<el> => .AuthButton__avatar
<Block>--<mod>=> .AuthButton--loading
``` 

## 2. Utility Classes

- Use short, descriptive class names for standalone utilities, e.g. `.animation-spin`, `.text-center`.
- Avoid coupling utilities to specific components.

## 3. CSS Modules

- Component-specific styles live alongside the component in `ComponentName.module.css`.
- Use BEM within modules: class names should begin with the block name.
- Avoid global/naked class names in modules.

## 4. Global Styles & Tokens

- All design tokens (colors, spacing, typography, breakpoints) in `src/styles/common/colors.css` and `tokens.css`.
- Utility classes in `src/styles/common/utilities.css`.

## 5. File Naming

- CSS modules: `ComponentName.module.css`.
- Global shared CSS: `buttons.css`, `animations.css`, `utilities.css` in `src/styles/common`.

## 6. Implementation Guidelines

- Always use `className={styles.Block__element}` in React when using CSS modules.
- For global utilities, use string classes: `className="circleActionButton animation-spin"`.

## 7. Migration Steps

- Refactor existing module CSS to adhere to BEM naming.
- Remove duplicated styles (use utilities).
- Update React components to reference new class names.  


_Last updated: 2024-06-25_ 