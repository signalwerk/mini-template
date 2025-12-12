# mini-template

Tiny Handlebars-inspired template function.

## Usage

```js
import { template } from "./src/index.js";

const tpl = "Hello {{name}}!";
console.log(template(tpl, { name: "World" }));
```

Supported subset:

- `{{path}}` interpolation (dot paths, HTML-escaped like Handlebars)
- `{{{path}}}` unescaped interpolation
- `\{{path}}` escape (outputs `{{path}}` literally, also works for block tags)
- `{{#each list}}...{{/each}}` with `{{this}}` and `{{@index}}`
- `{{#if flag}}...{{else}}...{{/if}}`

## Commands

```sh
npm run build
npm test
npm run test:watch
```
