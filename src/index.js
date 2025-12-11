/*
 * minit.js – tiny Handlebars-inspired template engine.
 *
 * README
 *   template(string, data)
 *     Renders the provided template with the given context object. Supports:
 *       - {{path}} variable interpolation, including nested
 *       - {{#each list}}{{/each}} loops with access to {{this}} and {{@index}}
 *       - {{#if flag}}true{{else}}false{{/if}} conditionals (only a single else branch)
 *     Behaves like a reduced Handlebars subset (same block markers, a single {{else}} per if,
 *     literal evaluation, and simple dot-path lookups) so it can replace simple Handlebars
 *     usage across the docs site without pulling in the full runtime.
 *
 * Usage example:
 *   import { template } from "./minit.js";
 *   const tpl = "{{#each palettes}}{{name}} {{#if isSpacer}}(spacer){{else}}(color){{/if}}\n";
 *   console.log(template(tpl, { palettes: [{ name: "A" }] }));
 */

export function template(string, data = {}) {
  return render(String(string), data);
}

function render(input, context) {
  const src = String(input);
  let out = "";
  let i = 0;

  while (i < src.length) {
    const open = src.indexOf("{{", i);
    if (open === -1) {
      out += src.slice(i);
      break;
    }

    out += src.slice(i, open);
    const close = src.indexOf("}}", open + 2);
    if (close === -1) {
      out += src.slice(open);
      break;
    }

    const tag = src.slice(open + 2, close).trim();

    // Branch on the kinds of tokens we recognize: each, if, literals, or variables.
    if (tag.startsWith("#each ")) {
      const expr = tag.slice("#each ".length).trim();
      const { body, nextIndex } = extractBlock(src, close + 2, "each");
      out += renderEach(expr, body, context);
      i = nextIndex;
      continue;
    }

    if (tag.startsWith("#if ")) {
      const expr = tag.slice("#if ".length).trim();
      const { body, nextIndex } = extractBlock(src, close + 2, "if");
      out += renderIf(expr, body, context);
      i = nextIndex;
      continue;
    }

    if (tag === "else" || tag === "/each" || tag === "/if") {
      // Unbalanced/misplaced tag; treat literally.
      out += src.slice(open, close + 2);
      i = close + 2;
      continue;
    }

    // Variable interpolation.
    const value = resolvePath(context, tag);
    out += value === undefined || value === null ? "" : String(value);
    i = close + 2;
  }

  return out;
}

function renderEach(expr, body, context) {
  const list = resolvePath(context, expr);
  if (!Array.isArray(list) || list.length === 0) return "";

  return list
    .map((item, index) => {
      const childContext = makeChildContext(context, item, index);
      return render(body, childContext);
    })
    .join("");
}

function renderIf(expr, body, context) {
  const [truthyPart, falsyPart = ""] = splitElseTopLevel(body);
  const cond = resolvePath(context, expr);
  return cond ? render(truthyPart, context) : render(falsyPart, context);
}

function splitElseTopLevel(body) {
  const src = String(body);
  let depth = 0;
  let i = 0;

  while (i < src.length) {
    const open = src.indexOf("{{", i);
    if (open === -1) break;
    const close = src.indexOf("}}", open + 2);
    if (close === -1) break;
    const tag = src.slice(open + 2, close).trim();

    if (tag.startsWith("#each ") || tag.startsWith("#if ")) {
      // Increase depth for nested blocks so we find the matching closing tag.
      // Track nested block depth so {{else}} split only happens at the outermost level.
      depth++;
    } else if (tag === "/each" || tag === "/if") {
      depth = Math.max(0, depth - 1);
    } else if (tag === "else" && depth === 0) {
      return [src.slice(0, open), src.slice(close + 2)];
    }

    i = close + 2;
  }

  return [src];
}

function extractBlock(src, fromIndex, kind) {
  let depth = 1;
  let i = fromIndex;

  while (i < src.length) {
    const open = src.indexOf("{{", i);
    if (open === -1) break;
    const close = src.indexOf("}}", open + 2);
    if (close === -1) break;
    const tag = src.slice(open + 2, close).trim();

    if (tag.startsWith("#each ") || tag.startsWith("#if ")) {
      depth++;
      i = close + 2;
      continue;
    }

    if (tag === "/" + kind) {
      depth--;
      if (depth === 0) {
        return { body: src.slice(fromIndex, open), nextIndex: close + 2 };
      }
      i = close + 2;
      continue;
    }

    if (tag === "/each" || tag === "/if") {
      depth = Math.max(0, depth - 1);
      i = close + 2;
      continue;
    }

    i = close + 2;
  }

  // Missing close tag: treat remainder as body.
  return { body: src.slice(fromIndex), nextIndex: src.length };
}

function resolvePath(context, expr) {
  if (!expr) return undefined;
  if (expr === "this") return context?.this;
  if (expr === "@index") return context?.["@index"];

  const parts = String(expr).split(".").filter(Boolean);
  let cur = context;
  for (const part of parts) {
    if (cur == null) return undefined;
    cur = cur[part];
  }
  return cur;
}

function makeChildContext(parent, item, index) {
  const base = parent && typeof parent === "object" ? parent : {};
  if (item && typeof item === "object") {
    return { ...base, ...item, this: item, "@index": index };
  }
  return { ...base, this: item, "@index": index };
}
