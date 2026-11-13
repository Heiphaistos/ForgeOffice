# -*- coding: utf-8 -*-
"""Releve les variables de theme (couleurs, cotes) de l'OnlyOffice Desktop Editors installe et les ecrit en CSS
sous `html[data-layout="onlyoffice"]` : valeurs de mesure seulement (pas de code ni d'icone copies)."""
import re, sys
src = sys.argv[1] if len(sys.argv) > 1 else 'D:/Tools/ONLYOFFICE/editors/web-apps/apps/documenteditor/main/resources/css/app.css'
out = sys.argv[2] if len(sys.argv) > 2 else 'packages/ui/src/components/layouts/onlyoffice-themes.css'
css = open(src, encoding='utf8').read()
MAP = {':root': '', ':root .theme-classic-light': '[data-oo-theme="classic-light"]', ':root .theme-dark,:root .theme-type-dark': '[data-oo-theme="classic-dark"]', ':root .theme-night': '[data-oo-theme="dark"]',
       ':root .theme-contrast-dark': '[data-oo-theme="contrast-dark"]', ':root .theme-white': '[data-oo-theme="white"]', ':root .theme-gray': '[data-oo-theme="gray"]'}
res = ['/* Genere par scripts/oo-ref/extract-themes.py depuis OnlyOffice Desktop Editors 10.0 (variables de theme : valeurs relevees). */']
for sel, scope in MAP.items():
    m = re.search(re.escape(sel) + r'\{(--toolbar-header-document[^}]*)\}', css)
    assert m, sel
    body = re.sub(r'(--[\w-]+):\s*', r'\1: ', m.group(1)).replace(';--', ';\n  --')
    res.append('html[data-layout="onlyoffice"]%s {\n  %s\n}' % (scope, body))
open(out, 'w', encoding='utf8').write('\n'.join(res) + '\n')
print(len(res) - 1, 'blocs')
