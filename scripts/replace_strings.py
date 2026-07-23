#!/usr/bin/env python3
"""Replace hardcoded Russian strings with t() calls in all TSX files that have useTranslation."""
import os, re, json

SRC = "/root/freqdash/frontend/src"
RU_JSON = f"{SRC}/i18n/locales/ru.json"
EN_JSON = f"{SRC}/i18n/locales/en.json"

# Load existing locales
with open(RU_JSON) as f:
    ru = json.load(f)
with open(EN_JSON) as f:
    en = json.load(f)

# Collect existing keys
def collect_keys(d, prefix=''):
    keys = set()
    for k, v in d.items():
        full = f"{prefix}.{k}" if prefix else k
        if isinstance(v, dict):
            keys |= collect_keys(v, full)
        else:
            keys.add(full)
    return keys

existing = collect_keys(ru)

# New keys to add
new_ru = {}
new_en = {}

# Token to short key mapping for common patterns
# We'll use strings themselves as fallback keys when no structured key exists

def find_files():
    result = []
    for root, dirs, files in os.walk(SRC):
        dirs[:] = [d for d in dirs if d not in ('node_modules', 'i18n', 'dist')]
        for f in files:
            if not (f.endswith('.tsx') or f.endswith('.ts')):
                continue
            fpath = os.path.join(root, f)
            with open(fpath, 'r') as fh:
                text = fh.read()
            if 'useTranslation' not in text:
                continue
            if not re.search(r"'[А-Яа-яЁё][^']*'|\"[А-Яа-яЁё][^\"]*\"", text):
                continue
            result.append((fpath, text))
    return result

def replace_ui_strings(text):
    """Replace Russian UI strings with t() calls. Returns (new_text, new_keys_dict)."""
    
    # Patterns to replace (only in code contexts that are user-visible):
    # 1. toast.success('...'), toast.error('...'), toast.info('...')
    # 2. set*(..., '...') — error/success messages 
    # 3. placeholder='...', placeholder="..."
    # 4. JSX text content: >текст< (but not inside backtick template expressions for data)
    # 5. alt="..."
    # 6. title="..."
    # 7. label content
    
    replacements = {}
    counter = [0]
    
    def make_key(text):
        """Generate a stable key from Russian text."""
        counter[0] += 1
        key = f"_auto_{counter[0]}"
        return key, text
    
    modified = text
    
    # 1. toast.* calls with Russian strings
    modified = re.sub(
        r"(toast\.(?:success|error|info|warning)\()'([^']*[А-Яа-яЁё][^']*)'",
        lambda m: f"{m.group(1)}t('{m.group(2)}')",
        modified
    )
    
    # 2. setError / setMessage with Russian strings
    modified = re.sub(
        r"(set\w*Error\s*\(\s*)'([^']*[А-Яа-яЁё][^']*)'",
        lambda m: f"{m.group(1)}t('{m.group(2)}')",
        modified
    )
    
    # 3. placeholder= with Russian
    modified = re.sub(
        r'(placeholder\s*=\s*)"([^"]*[А-Яа-яЁё][^"]*)"',
        lambda m: f'{m.group(1)}{{t("{m.group(2)}")}}',
        modified
    )
    
    # 4. label text in JSX
    modified = re.sub(
        r'(<label[^>]*>\s*)\n?\s*([А-Яа-яЁё][^<]{1,100})\n?\s*(</label>)',
        lambda m: f'{m.group(1)}{{t("{m.group(2).strip()}")}}{m.group(3)}',
        modified
    )
    
    # 5. alt="..."
    modified = re.sub(
        r'(alt\s*=\s*)"([^"]*[А-Яа-яЁё][^"]*)"',
        lambda m: f'{m.group(1)}{{t("{m.group(2)}")}}',
        modified
    )
    
    # 6. title="..."
    modified = re.sub(
        r'(title\s*=\s*)"([^"]*[А-Яа-яЁё][^"]*)"',
        lambda m: f'{m.group(1)}{{t("{m.group(2)}")}}',
        modified
    )
    
    # 7. JSX text between tags: >Текст<
    # Be careful not to match inside template literals or already-wrapped t() calls
    def replace_jsx_text(m):
        tag = m.group(1)
        text = m.group(2).strip()
        if text and re.search(r'[А-Яа-яЁё]', text) and '{t(' not in m.group(0):
            # Don't replace if it's inside a comment
            if '//' in m.group(0) or '/*' in m.group(0):
                return m.group(0)
            return f'{tag}{{t("{text}")}}'
        return m.group(0)
    
    # Match: >Russian text</  (closing tag)
    modified = re.sub(
        r'(>)\s*([А-Яа-яЁё][^<>{`$]{1,200})\s*(</)',
        replace_jsx_text,
        modified
    )
    
    # 8. Inline button/link text
    modified = re.sub(
        r'(>\s*)\n?\s*([А-Яа-яЁё][^<]{1,100})\n?\s*(</)',
        lambda m: f'{m.group(1)}{{t("{m.group(2).strip()}")}}{m.group(3)}' if re.search(r'[А-Яа-яЁё]', m.group(2)) else m.group(0),
        modified
    )
    
    return modified

files = find_files()
print(f"Found {len(files)} files with useTranslation + Russian strings")

processed = 0
for fpath, text in files:
    try:
        new_text = replace_ui_strings(text)
        if new_text != text:
            with open(fpath, 'w') as fh:
                fh.write(new_text)
            processed += 1
        rel = os.path.relpath(fpath, SRC)
        print(f"  OK: {rel}")
    except Exception as e:
        rel = os.path.relpath(fpath, SRC)
        print(f"  ERR: {rel}: {e}")

print(f"\nModified {processed} files")
