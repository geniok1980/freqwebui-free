#!/usr/bin/env python3
"""
Proper JSX text replacement: handles single and multi-line strings correctly.
Only wraps leaf text nodes (no nested JSX inside the text).
"""
import os, re

SRC = "/root/freqdash/frontend/src"

def process_file(fpath):
    with open(fpath, 'r') as f:
        text = f.read()
    
    if 'useTranslation' not in text:
        return False
    
    original = text
    modified = text
    
    # 1. Safe: toast.*('text') → toast.*(t('text'))
    modified = re.sub(
        r"(toast\.\w+\()'([^']+)'",
        lambda m: f"{m.group(1)}t('{m.group(2)}')" if re.search(r'[А-Яа-яЁё]', m.group(2)) else m.group(0),
        modified
    )
    
    # 2. Safe: setError/setMessage('text') → setError(t('text'))
    modified = re.sub(
        r"((?:set\w*(?:Error|Message|Info|Warning))\s*\(\s*)'([^']+)'",
        lambda m: f"{m.group(1)}t('{m.group(2)}')" if re.search(r'[А-Яа-яЁё]', m.group(2)) else m.group(0),
        modified
    )
    
    # 3. Safe: throw new Error('text') / alert('text')
    modified = re.sub(
        r"(new\s+Error\(\s*)'([^']+)'",
        lambda m: f"{m.group(1)}t('{m.group(2)}')" if re.search(r'[А-Яа-яЁё]', m.group(2)) else m.group(0),
        modified
    )
    
    # 4. Safe: placeholder="text" → placeholder={t('text')}
    modified = re.sub(
        r'(placeholder)\s*=\s*"([^"]+)"',
        lambda m: f'{m.group(1)}={{t("{m.group(2)}")}}' if re.search(r'[А-Яа-яЁё]', m.group(2)) else m.group(0),
        modified
    )
    
    # 5. Safe: label content in <label>text</label>
    modified = re.sub(
        r'(<label[^>]*>)\s*(.+?)\s*(</label>)',
        lambda m: f"{m.group(1)}{{t('{m.group(2)}')}}{m.group(3)}"
        if re.search(r'[А-Яа-яЁё]', m.group(2)) and '{' not in m.group(2)
        else m.group(0),
        modified,
        flags=re.DOTALL
    )
    
    # 6. Safe single-line JSX text: <tag>text</tag> where text is purely Russian
    # Match: opening>  text  </closing
    def wrap_leaf_text(m):
        prefix = m.group(1)  # >
        text = m.group(2).strip()
        suffix = m.group(3)  # </
        
        # Skip if already wrapped, has JSX inside, is inside comment, or not Russian
        if '{t(' in m.group(0) or '{' in text or '}' in text:
            return m.group(0)
        if '//' in prefix or '/*' in text:
            return m.group(0)
        if not re.search(r'[А-Яа-яЁё]', text):
            return m.group(0)
        if len(text) < 2:
            return m.group(0)
        
        return f'{prefix}{{t("{text}")}}{suffix}'
    
    # Match >TEXT< where TEXT has no angle brackets
    modified = re.sub(
        r'(>)\s*([^<>{}]{2,200})\s*(</)',
        wrap_leaf_text,
        modified
    )
    
    # 7. Handle ternary: ? 'text' : 'text'
    def wrap_ternary_str(m):
        text = m.group(1)
        if re.search(r'[А-Яа-яЁё]', text) and '{' not in text:
            return f"t('{text}')"
        return f"'{text}'"
    
    modified = re.sub(
        r"\?\s*'([^']+)'\s*:",
        lambda m: f"? {wrap_ternary_str(m)} :",
        modified
    )
    modified = re.sub(
        r":\s*'([^']+)'\s*(\}|\))",
        lambda m: f": {wrap_ternary_str(m)}{m.group(2)}",
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
                rel = os.path.relpath(fpath, SRC)
                print(f"  OK: {rel}")
        except Exception as e:
            rel = os.path.relpath(fpath, SRC)
            print(f"  ERR: {rel}: {e}")

print(f"\nModified {count} files")
