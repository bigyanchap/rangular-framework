import { snapForProp, SUPPORTED_STYLE_PROPERTIES } from './style/css';

/**
 * The mechanical fixes (verification fortification, 2026-11-26): the
 * repairs whose correct outcome the compiler already knows, applied
 * to source text. Everything here is per-declaration and preserves
 * the rest of the text byte for byte. Anything that needs judgment
 * is never touched; it is reported by the caller instead.
 */

export interface StyleFix {
  code: 'STYLE_OFF_SCALE' | 'CSS_UNSUPPORTED';
  detail: string;
}

function camelCase(prop: string): string {
  return prop.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());
}

/**
 * Rewrite one style text: off-scale numeric values are written back
 * at their snapped value (the same snap the compiler would apply,
 * via snapForProp), and unsupported properties are removed with a
 * comment naming what was taken out and why.
 */
export function fixStyleText(text: string): { text: string; fixes: StyleFix[] } {
  const fixes: StyleFix[] = [];
  const out = text.replace(/([^{}]+)\{([^{}]*)\}/g, (whole, selector: string, body: string) => {
    const decls = body.split(';').map((decl) => {
      const m = /^(\s*)([a-zA-Z-]+)(\s*:\s*)(-?\d+(?:\.\d+)?)(px)?(\s*)$/.exec(decl);
      if (!m) {
        const bare = /^(\s*)([a-zA-Z-]+)\s*:/.exec(decl);
        if (bare && !SUPPORTED_STYLE_PROPERTIES.has(camelCase(bare[2]))) {
          fixes.push({ code: 'CSS_UNSUPPORTED', detail: `removed '${bare[2]}' from '${selector.trim()}'` });
          return `${bare[1]}/* rg fix: removed '${bare[2]}' (CSS_UNSUPPORTED: not a supported property) */`;
        }
        return decl;
      }
      const [, lead, rawProp, mid, numText, px, tail] = m;
      const prop = camelCase(rawProp);
      if (!SUPPORTED_STYLE_PROPERTIES.has(prop)) {
        fixes.push({ code: 'CSS_UNSUPPORTED', detail: `removed '${rawProp}' from '${selector.trim()}'` });
        return `${lead}/* rg fix: removed '${rawProp}' (CSS_UNSUPPORTED: not a supported property) */${tail}`;
      }
      const value = Number(numText);
      const snapped = snapForProp(prop, value);
      if (snapped !== undefined && snapped !== value) {
        fixes.push({ code: 'STYLE_OFF_SCALE', detail: `'${selector.trim()}' ${rawProp}: ${value} -> ${snapped}` });
        return `${lead}${rawProp}${mid}${snapped}${px ?? ''}${tail}`;
      }
      return decl;
    });
    return `${selector}{${decls.join(';')}}`;
  });
  return { text: out, fixes };
}
