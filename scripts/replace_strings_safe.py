#!/usr/bin/env python3
"""Carefully replace hardcoded Russian strings with t() calls."""
import os, re, sys

SRC = "/root/freqdash/frontend/src"

def process_file(fpath):
    with open(fpath, 'r') as f:
        text = f.read()
    
    if 'useTranslation' not in text:
        return False
    
    original = text
    modified = text
    
    # 1. toast.*('русский текст') → toast.*(t('русский текст'))
    modified = re.sub(
        r"(toast\.\w+\()'([^']*[А-Яа-яЁё][^']*)'",
        lambda m: f"{m.group(1)}t('{m.group(2)}')",
        modified
    )
    
    # 2. setError('текст') / setMessage('текст') → setError(t('текст'))
    modified = re.sub(
        r"((?:set\w*Error|set\w*Message)\s*\(\s*)'([^']*[А-Яа-яЁё][^']*)'",
        lambda m: f"{m.group(1)}t('{m.group(2)}')",
        modified
    )
    
    # 3. placeholder="текст" → placeholder={t('текст')}
    modified = re.sub(
        r'placeholder\s*=\s*"([^"]*[А-Яа-яЁё][^"]*)"',
        lambda m: f'placeholder={{t("{m.group(1)}")}}',
        modified
    )
    
    # 4. title="текст" → title={t('текст')}
    modified = re.sub(
        r'title\s*=\s*"([^"]*[А-Яа-яЁё][^"]*)"',
        lambda m: f'title={{t("{m.group(1)}")}}',
        modified
    )
    
    # 5. alt="текст" → alt={t('текст')}
    modified = re.sub(
        r'alt\s*=\s*"([^"]*[А-Яа-яЁё][^"]*)"',
        lambda m: f'alt={{t("{m.group(1)}")}}',
        modified
    )
    
    # 6. label="текст" → label={t('текст')}
    modified = re.sub(
        r'label\s*=\s*"([^"]*[А-Яа-яЁё][^"]*)"',
        lambda m: f'label={{t("{m.group(1)}")}}',
        modified
    )
    
    # 7. JSX text: >текст< → >{t('текст')}<  (but NOT inside template literal ${}, NOT already {t(})
    # Match: closing tag > followed by Russian text followed by opening tag <
    # But only if it's a leaf text node (no nested tags inside)
    def replace_leaf_text(m):
        prefix = m.group(1)  # the > character
        text = m.group(2).strip()
        suffix = m.group(3)  # the < character
        if re.search(r'[А-Яа-яЁё]', text) and len(text) > 1:
            # Check it's not already wrapped
            return f'{prefix}{{t("{text}")}}{suffix}'
        return m.group(0)
    
    # Match: > + whitespace? + Russian text (no <, {, }, `, $ inside) + whitespace? + </
    # This specifically targets leaf text: <tag>текст</tag>
    modified = re.sub(
        r'(>)\s*\n?\s*([А-Яа-яЁё][^<>`${}]{1,200})\s*\n?\s*(</)',
        replace_leaf_text,
        modified
    )
    
    # 8. {'строка'} inside JSX → {t('строка')}
    # Already handled above in patterns 2-6
    
    # 9. In ternary operators: ? 'текст' : 'текст'
    modified = re.sub(
        r"\?\s*'([^']*[А-Яа-яЁё][^']*)'\s*:",
        lambda m: f"? t('{m.group(1)}') :",
        modified
    )
    modified = re.sub(
        r":\s*'([^']*[А-Яа-яЁё][^']*)'",
        lambda m: f": t('{m.group(1)}')",
        modified
    )
    
    if modified != original:
        with open(fpath, 'w') as f:
            f.write(modified)
        return True
    return False

count = 0
for root, dirs, files in os.walk(SRC):
    dirs[:] = [d for d in dirs if d not in ('node_modules', 'i18n', 'dist')]
    for f in files:
        if not (f.endswith('.tsx') or f.endswith('.ts')):
            continue
        fpath = os.path.join(root, f)
        try:
            if process_file(fpath):
                count += 1
                print(f"  OK: {os.path.relpath(fpath, SRC)}")
        except Exception as e:
            print(f"  ERR: {os.path.relpath(fpath, SRC)}: {e}")

print(f"\nModified {count} files")
