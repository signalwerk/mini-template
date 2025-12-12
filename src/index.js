/**
 * mini-template — tiny Handlebars-inspired template function.
 * Grab a copy for your project:
 * curl https://raw.githubusercontent.com/signalwerk/mini-template/refs/heads/main/src/index.js -o src/mini-template.js
 */

export function template(templateStr, data = {}) {
  return render(String(templateStr), data);
}

function render(source, context) {
  let output = "";
  let index = 0;

  while (index < source.length) {
    const nextTag = findNextTag(source, index);
    if (!nextTag) {
      output += source.slice(index);
      break;
    }

    // Check for escape: a preceding backslash means we output literal tag
    if (nextTag.open > 0 && source[nextTag.open - 1] === "\\") {
      output += source.slice(index, nextTag.open - 1);
      output += source.slice(nextTag.open, nextTag.close + nextTag.closeLen);
      index = nextTag.close + nextTag.closeLen;
      continue;
    }

    output += source.slice(index, nextTag.open);
    index = nextTag.close + nextTag.closeLen;

    const block = parseBlockTag(nextTag.tag);
    if (block) {
      const { body, end } = extractBlock(source, index, block.kind);
      output +=
        block.kind === "each"
          ? renderEach(block.expression, body, context)
          : renderIf(block.expression, body, context);
      index = end;
      continue;
    }

    if (isSkippableTag(nextTag.tag)) {
      output += source.slice(nextTag.open, index);
      continue;
    }

    output += renderSimple(nextTag, context);
  }

  return output;
}

function renderEach(expression, body, context) {
  const items = resolveValue(context, expression);
  if (!Array.isArray(items)) return "";

  return items
    .map((item, itemIndex) =>
      render(body, createChildContext(context, item, itemIndex)),
    )
    .join("");
}

function renderIf(expression, body, context) {
  const [truthyPart, falsyPart = ""] = splitElseSegment(body);
  const guard = resolveValue(context, expression);
  return render(guard ? truthyPart : falsyPart, context);
}

// Split the block into the content before/after a top-level {{else}}.
function splitElseSegment(source) {
  let depth = 0;
  let position = 0;

  while (position < source.length) {
    const tagInfo = findNextTag(source, position);
    if (!tagInfo) break;

    if (isOpeningBlock(tagInfo.tag)) {
      depth++;
    } else if (isClosingBlock(tagInfo.tag)) {
      depth = Math.max(0, depth - 1);
    } else if (tagInfo.tag === "else" && depth === 0) {
      return [
        source.slice(0, tagInfo.open),
        source.slice(tagInfo.close + tagInfo.closeLen),
      ];
    }

    position = tagInfo.close + tagInfo.closeLen;
  }

  return [source];
}

// Capture the block body between the opening tag and its matching closing tag.
function extractBlock(source, fromIndex, kind) {
  let depth = 1;
  let position = fromIndex;

  while (position < source.length) {
    const tagInfo = findNextTag(source, position);
    if (!tagInfo) break;

    if (isOpeningBlock(tagInfo.tag)) {
      depth++;
    } else if (tagInfo.tag === `/${kind}`) {
      depth = Math.max(0, depth - 1);
      if (depth === 0) {
        return {
          body: source.slice(fromIndex, tagInfo.open),
          end: tagInfo.close + tagInfo.closeLen,
        };
      }
    } else if (isClosingBlock(tagInfo.tag)) {
      depth = Math.max(0, depth - 1);
    }

    position = tagInfo.close + tagInfo.closeLen;
  }

  return { body: source.slice(fromIndex), end: source.length };
}

function resolveValue(context, path) {
  if (!path) return;
  if (path === "this" || path === "@index") return context?.[path];

  let current = context;
  for (const segment of path.split(".")) {
    if (current == null) return;
    current = current[segment];
  }

  return current;
}

function findNextTag(source, fromIndex) {
  const open = source.indexOf("{{", fromIndex);
  if (open < 0) return null;

  const isTriple = source.startsWith("{{{", open);
  const openLen = isTriple ? 3 : 2;
  const closeToken = isTriple ? "}}}" : "}}";
  const closeLen = isTriple ? 3 : 2;

  const close = source.indexOf(closeToken, open + openLen);
  if (close < 0) return null;

  return {
    open,
    close,
    closeLen,
    isTriple,
    tag: source.slice(open + openLen, close).trim(),
  };
}

function parseBlockTag(tag) {
  if (tag.startsWith("#each ")) {
    return { kind: "each", expression: tag.slice(6).trim() };
  }
  if (tag.startsWith("#if ")) {
    return { kind: "if", expression: tag.slice(4).trim() };
  }
  return null;
}

function renderSimple(tagInfo, context) {
  const { expression, isUnescaped } = parseExpression(
    tagInfo.tag,
    tagInfo.isTriple,
  );
  const value = resolveValue(context, expression);
  if (value == null) return "";
  const stringValue = String(value);
  return isUnescaped ? stringValue : escapeHtml(stringValue);
}

function parseExpression(tag, isTriple) {
  if (isTriple) return { expression: tag, isUnescaped: true };
  return { expression: tag, isUnescaped: false };
}

function escapeHtml(value) {
  // Mirrors Handlebars-style HTML escaping.
  return value.replace(/[&<>"'`=]/g, (char) => {
    switch (char) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      case "'":
        return "&#x27;";
      case "`":
        return "&#x60;";
      case "=":
        return "&#x3D;";
      default:
        return char;
    }
  });
}

// Merge the parent scope with the current item, tracking handy helpers.
function createChildContext(parentContext, item, itemIndex) {
  const baseContext =
    typeof parentContext === "object" && parentContext
      ? { ...parentContext }
      : {};
  const itemContext = item && typeof item === "object" ? item : {};
  return {
    ...baseContext,
    ...itemContext,
    this: item,
    ["@index"]: itemIndex,
  };
}

function isSkippableTag(tag) {
  return tag === "else" || tag.startsWith("/");
}

function isOpeningBlock(tag) {
  return tag.startsWith("#each ") || tag.startsWith("#if ");
}

function isClosingBlock(tag) {
  return tag === "/each" || tag === "/if";
}
