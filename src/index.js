export function template(templateStr, data = {}) {
  return render(String(templateStr), data);
}

function render(source, context) {
  let output = "";
  let index = 0;

  while (index < source.length) {
    const open = source.indexOf("{{", index);
    if (open < 0) return output + source.slice(index);
    output += source.slice(index, open);

    const close = source.indexOf("}}", open + 2);
    if (close < 0) return output + source.slice(open);

    const tag = source.slice(open + 2, close).trim();

    if (tag.startsWith("#each ") || tag.startsWith("#if ")) {
      const blockKind = tag.startsWith("#each ") ? "each" : "if";
      const expression = tag.slice(blockKind.length + 2).trim();
      const { body: blockBody, end } = extractBlock(
        source,
        close + 2,
        blockKind,
      );
      output +=
        blockKind === "each"
          ? renderEach(expression, blockBody, context)
          : renderIf(expression, blockBody, context);
      index = end;
    } else if (tag === "else" || tag[0] === "/") {
      output += source.slice(open, close + 2);
      index = close + 2;
    } else {
      const value = resolveValue(context, tag);
      output += value == null ? "" : value;
      index = close + 2;
    }
  }

  return output;
}

function renderEach(expression, body, context) {
  const items = resolveValue(context, expression);
  if (!Array.isArray(items)) return "";

  return items
    .map((item, itemIndex) => {
      const childContext =
        typeof context === "object" && context ? { ...context } : {};
      if (typeof item === "object" && item) Object.assign(childContext, item);
      childContext.this = item;
      childContext["@index"] = itemIndex;
      return render(body, childContext);
    })
    .join("");
}

function renderIf(expression, body, context) {
  const [truthyPart, falsyPart = ""] = splitElseSegment(body);
  const guard = resolveValue(context, expression);
  return render(guard ? truthyPart : falsyPart, context);
}

function splitElseSegment(source) {
  let depth = 0;
  let position = 0;

  while (position < source.length) {
    const open = source.indexOf("{{", position);
    if (open < 0) break;
    const close = source.indexOf("}}", open + 2);
    if (close < 0) break;
    const tag = source.slice(open + 2, close).trim();

    if (tag.startsWith("#each ") || tag.startsWith("#if ")) {
      depth++;
    } else if (tag === "/each" || tag === "/if") {
      depth = Math.max(0, depth - 1);
    } else if (tag === "else" && depth === 0) {
      return [source.slice(0, open), source.slice(close + 2)];
    }

    position = close + 2;
  }

  return [source];
}

function extractBlock(source, fromIndex, kind) {
  let depth = 1;
  let position = fromIndex;

  while (position < source.length) {
    const open = source.indexOf("{{", position);
    if (open < 0) break;
    const close = source.indexOf("}}", open + 2);
    if (close < 0) break;
    const tag = source.slice(open + 2, close).trim();

    if (tag.startsWith("#each ") || tag.startsWith("#if ")) {
      depth++;
    } else if (tag === "/" + kind) {
      if (--depth === 0) {
        return { body: source.slice(fromIndex, open), end: close + 2 };
      }
    } else if (tag === "/each" || tag === "/if") {
      depth = Math.max(0, depth - 1);
    }

    position = close + 2;
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
