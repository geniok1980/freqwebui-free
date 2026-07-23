/**
 * Vite plugin: automatically wraps Russian JSX text with t() calls at build time.
 * No source code changes needed — Russian text in JSX is transformed during build.
 */
import type { Plugin } from 'vite';

const RUSSIAN_RE = /[А-Яа-яЁё]/;

/** Escape string for safe embedding in JS single-quoted string literal. */
function escapeStr(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

export function i18nTransform(): Plugin {
  return {
    name: 'i18n-transform',
    enforce: 'pre',
    transform(code: string, id: string) {
      // Only process TSX/JSX files that use useTranslation
      if (!id.match(/\.(tsx|jsx)$/)) return null;
      if (!code.includes('useTranslation')) return null;
      let modified = code;
      let changed = false;

      // 1. DISABLED - JSX text wrapping is too fragile with regex
      // const JSX_TEXT_RE = />([^<>{}$`\n]+[А-Яа-яЁё][^<>{}$`\n]*)<\//g;
      // modified = modified.replace(JSX_TEXT_RE, (match, text) => { ... });

      // 2. Wrap placeholder="Русский текст" → placeholder={t('Русский текст')}
      modified = modified.replace(
        /placeholder\s*=\s*"([^"]*?[А-Яа-яЁё][^"]*?)"/g,
        (_, text) => {
          changed = true;
          return `placeholder={t('${escapeStr(text)}')}`;
        }
      );

      // 3. Wrap toast.*('...') → toast.*(t('...'))
      modified = modified.replace(
        /(toast\.\w+\()'([^']*?[А-Яа-яЁё][^']*?)'/g,
        (_, prefix, text) => {
          changed = true;
          return `${prefix}t('${escapeStr(text)}')`;
        }
      );

      // 4. Wrap setError/setMessage('...') → setError(t('...'))
      modified = modified.replace(
        /((?:set\w*(?:Error|Message|Info|Warning))\s*\(\s*)'([^']*?[А-Яа-яЁё][^']*?)'/g,
        (_, prefix, text) => {
          changed = true;
          return `${prefix}t('${escapeStr(text)}')`;
        }
      );

      // 5. DISABLED - label wrapping is JSX-based
      // modified = modified.replace( ... label ... );

      if (!changed) return null;
      return { code: modified, map: null };
    },
  };
}
