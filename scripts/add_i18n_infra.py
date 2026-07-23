#!/usr/bin/env python3
"""Add useTranslation import and hook to all TSX files that have Russian strings but lack it."""
import os, re, sys

SRC = "/root/freqdash/frontend/src"

def find_files():
    """Find TSX/TS files with Russian chars but no useTranslation."""
    result = []
    for root, dirs, files in os.walk(SRC):
        dirs[:] = [d for d in dirs if d not in ('node_modules', 'i18n', 'dist')]
        for f in files:
            if not (f.endswith('.tsx') or f.endswith('.ts')):
                continue
            fpath = os.path.join(root, f)
            with open(fpath, 'r') as fh:
                text = fh.read()
            if 'useTranslation' in text:
                continue
            if not re.search(r'[А-Яа-яЁё]', text):
                continue
            result.append((fpath, text))
    return result

def add_infra(fpath, text):
    """Add import and hook. Returns new text or None on failure."""
    modified = text
    
    # 1. Add import
    if 'useTranslation' in modified:
        return None
    
    # Find last import line
    lines = modified.split('\n')
    last_import = -1
    for i, line in enumerate(lines):
        stripped = line.strip()
        if stripped.startswith('import ') and 'from ' in stripped:
            last_import = i
        elif stripped.startswith('//') or stripped.startswith('/*'):
            continue
        elif stripped == '':
            continue
    
    if last_import < 0:
        return None
    
    lines.insert(last_import + 1, "import { useTranslation } from 'react-i18next';")
    modified = '\n'.join(lines)
    
    # 2. Add hook
    hook_added = False
    patterns = [
        (r'(export\s+(?:default\s+)?function\s+\w+\s*\(([^)]*)\)\s*\{)', 
         lambda m: f'{m.group(1)}\n  const {{ t }} = useTranslation();'),
        (r'(export\s+const\s+\w+\s*:\s*React\.FC[^{]*\{)', 
         lambda m: f'{m.group(1)}\n  const {{ t }} = useTranslation();'),
        (r'(export\s+const\s+\w+\s*=\s*\([^)]*\)\s*:\s*\w+\s*=>\s*\{)', 
         lambda m: f'{m.group(1)}\n  const {{ t }} = useTranslation();'),
        (r'(export\s+const\s+\w+\s*=\s*\([^)]*\)\s*=>\s*\{)', 
         lambda m: f'{m.group(1)}\n  const {{ t }} = useTranslation();'),
        (r'(export\s+default\s+function\s+(\w+)\s*\([^)]*\)\s*\{)', 
         lambda m: f'{m.group(1)}\n  const {{ t }} = useTranslation();'),
    ]
    
    for pat, repl_fn in patterns:
        m = re.search(pat, modified)
        if m:
            modified = re.sub(pat, repl_fn(m), modified, count=1)
            hook_added = True
            break
    
    if not hook_added:
        # Try to find any function/component definition and add hook
        # Last resort: find the first { after export
        m = re.search(r'(export\s+(?:default\s+)?(?:function|const)\s+\w+[^{]*\{)', modified)
        if m:
            modified = modified.replace(m.group(1), m.group(1) + '\n  const { t } = useTranslation();', 1)
            hook_added = True
    
    if not hook_added:
        return None
    
    return modified

files = find_files()
print(f"Found {len(files)} files to process")

processed = 0
for fpath, text in files:
    new_text = add_infra(fpath, text)
    if new_text:
        with open(fpath, 'w') as fh:
            fh.write(new_text)
        processed += 1
        rel = os.path.relpath(fpath, SRC)
        print(f"  OK: {rel}")
    else:
        rel = os.path.relpath(fpath, SRC)
        print(f"  SKIP: {rel} (couldn't add hook)")

print(f"\nProcessed {processed}/{len(files)} files")
