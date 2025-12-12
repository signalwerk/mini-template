import { describe, expect, test } from "vitest";
import { template } from "./index.js";

describe("template", () => {
  test("interpolates simple values", () => {
    expect(template("Hello {{name}}", { name: "World" })).toBe("Hello World");
  });

  test("supports dot paths", () => {
    expect(template("{{a.b.c}}", { a: { b: { c: 1 } } })).toBe("1");
  });

  test("missing values render as empty string", () => {
    expect(template("x{{nope}}y", {})).toBe("xy");
    expect(template("x{{a.b}}y", { a: null })).toBe("xy");
  });

  test("each loops with this and @index", () => {
    const tpl = "{{#each items}}[{{@index}}:{{this}}]{{/each}}";
    expect(template(tpl, { items: ["a", "b"] })).toBe("[0:a][1:b]");
  });

  test("each merges object items into context", () => {
    const tpl = "{{#each items}}{{name}}-{{root}};{{/each}}";
    expect(
      template(tpl, { root: "R", items: [{ name: "A" }, { name: "B" }] }),
    ).toBe("A-R;B-R;");
  });

  test("if / else", () => {
    expect(template("{{#if ok}}Y{{else}}N{{/if}}", { ok: true })).toBe("Y");
    expect(template("{{#if ok}}Y{{else}}N{{/if}}", { ok: 0 })).toBe("N");
  });

  test("else only splits at top-level", () => {
    const tpl = "{{#if ok}}A{{#if inner}}X{{else}}Y{{/if}}B{{else}}C{{/if}}";
    expect(template(tpl, { ok: true, inner: true })).toBe("AXB");
    expect(template(tpl, { ok: true, inner: false })).toBe("AYB");
    expect(template(tpl, { ok: false, inner: true })).toBe("C");
  });

  test("unbalanced closing tags are treated literally", () => {
    expect(template("x{{/if}}y", {})).toBe("x{{/if}}y");
  });

  test("unclosed mustache is treated literally", () => {
    expect(template("x{{oops", {})).toBe("x{{oops");
  });

  test("each ignores non-array values", () => {
    expect(template("{{#each missing}}X{{/each}}", { missing: "nope" })).toBe(
      "",
    );
  });

  test("if without else only renders when truthy", () => {
    const tpl = "{{#if ok}}yes{{/if}}";
    expect(template(tpl, { ok: true })).toBe("yes");
    expect(template(tpl, { ok: false })).toBe("");
  });

  test("zero values render as text", () => {
    expect(template("count:{{zero}}", { zero: 0 })).toBe("count:0");
  });

  test("each keeps parent context while exposing child fields", () => {
    const tpl =
      "{{shared}}:{{#each items}}{{value}}-{{shared}}@{{@index}};{{/each}}";
    const items = [{ value: "a" }, { value: "b" }];
    expect(template(tpl, { shared: "root", items })).toBe(
      "root:a-root@0;b-root@1;",
    );
  });

  test("escaped expressions are output literally", () => {
    expect(template("Hello \\{{name}}", { name: "World" })).toBe(
      "Hello {{name}}",
    );
  });

  test("escaped block tags are output literally", () => {
    expect(template("\\{{#if ok}}Y{{/if}}", { ok: true })).toBe(
      "{{#if ok}}Y{{/if}}",
    );
  });

  test("interpolations are HTML-escaped by default (Handlebars-style)", () => {
    expect(template("{{v}}", { v: "&<>\"'`=" })).toBe(
      "&amp;&lt;&gt;&quot;&#x27;&#x60;&#x3D;",
    );
  });

  test("triple-stash renders unescaped HTML", () => {
    expect(template("{{{html}}}", { html: "<b>Hi</b>" })).toBe("<b>Hi</b>");
  });

  test("escaped triple-stash expressions are output literally", () => {
    expect(template("x\\{{{html}}}y", { html: "<b>Hi</b>" })).toBe(
      "x{{{html}}}y",
    );
  });
});
