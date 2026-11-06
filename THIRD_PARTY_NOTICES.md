# Avis de tiers (THIRD PARTY NOTICES)

> Fichier GÉNÉRÉ par `node scripts/third-party-notices.mjs` : ne pas le modifier à la main. À régénérer après tout ajout ou mise à jour de dépendance (`npm install`, `cargo update`) et avant chaque publication.

ForgeOffice est écrit de A à Z ; il inclut ou utilise les composants tiers ci-dessous. Le texte complet de chaque licence se trouve dans le dossier du paquet (`node_modules/<paquet>/LICENSE`, sources de la crate dans `~/.cargo/registry`) et sur https://spdx.org/licenses/. Une expression « A OR B » laisse le choix de la licence : ForgeOffice retient l'alternative permissive.

## Synthèse

| | Paquets |
|---|---|
| npm distribués (production) | 99 |
| Crates Rust distribuées | 785 |
| npm outils de développement (non distribués) | 71 |
| Licence copyleft (à examiner) | 21 |
| Licence inconnue ou non résolue | 0 |

## ⚠ À examiner

Licences à copyleft (faible ou fort) sans alternative permissive :

- cssparser 0.37.0 : MPL-2.0 (https://github.com/servo/rust-cssparser)
- cssparser-macros 0.7.1 : MPL-2.0 (https://github.com/servo/rust-cssparser)
- dtoa-short 0.3.5 : MPL-2.0 (https://github.com/upsuper/dtoa-short)
- option-ext 0.2.0 : MPL-2.0 (https://github.com/soc/option-ext.git)
- resvg 0.44.0 : MPL-2.0 (https://github.com/RazrFalcon/resvg)
- selectors 0.38.0 : MPL-2.0 (https://github.com/servo/stylo)
- symphonia 0.5.5 : MPL-2.0 (https://github.com/pdeljanov/Symphonia)
- symphonia-bundle-flac 0.5.5 : MPL-2.0 (https://github.com/pdeljanov/Symphonia)
- symphonia-bundle-mp3 0.5.5 : MPL-2.0 (https://github.com/pdeljanov/Symphonia)
- symphonia-codec-aac 0.5.5 : MPL-2.0 (https://github.com/pdeljanov/Symphonia)
- symphonia-codec-adpcm 0.5.5 : MPL-2.0 (https://github.com/pdeljanov/Symphonia)
- symphonia-codec-pcm 0.5.5 : MPL-2.0 (https://github.com/pdeljanov/Symphonia)
- symphonia-codec-vorbis 0.5.5 : MPL-2.0 (https://github.com/pdeljanov/Symphonia)
- symphonia-core 0.5.5 : MPL-2.0 (https://github.com/pdeljanov/Symphonia)
- symphonia-format-isomp4 0.5.5 : MPL-2.0 (https://github.com/pdeljanov/Symphonia)
- symphonia-format-mkv 0.5.5 : MPL-2.0 (https://github.com/pdeljanov/Symphonia)
- symphonia-format-ogg 0.5.5 : MPL-2.0 (https://github.com/pdeljanov/Symphonia)
- symphonia-format-riff 0.5.5 : MPL-2.0 (https://github.com/pdeljanov/Symphonia)
- symphonia-metadata 0.5.5 : MPL-2.0 (https://github.com/pdeljanov/Symphonia)
- symphonia-utils-xiph 0.5.5 : MPL-2.0 (https://github.com/pdeljanov/Symphonia)
- usvg 0.44.0 : MPL-2.0 (https://github.com/RazrFalcon/resvg)

## Fluent UI System Icons

- Paquet : `@fluentui/svg-icons` (https://github.com/microsoft/fluentui-system-icons), Microsoft
- Utilisation : chemins SVG extraits dans `packages/ui/src/icons/generated.ts` par `packages/ui/scripts/extract-icons.mjs` (302 icônes embarquées)
- Licence : MIT

```
MIT License

Copyright (c) 2020 Microsoft Corporation

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## Polices

ForgeOffice embarque des polices libres (SIL Open Font License 1.1, redistribuables) dans `packages/ui/fonts/`, déclarées dans `packages/ui/src/fonts.css`. Les polices du système restent prioritaires (`local()` en premier). Aptos, Calibri, Segoe UI et Cambria (propriétaires) ne sont pas embarquées.

### Carlito 1.104

substitut de Calibri (mêmes métriques) — https://github.com/googlefonts/carlito

```
Copyright 2013 The Carlito Project Authors (https://github.com/googlefonts/carlito), with Reserved Font Name "Carlito"

This Font Software is licensed under the SIL Open Font License, Version 1.1.
This license is copied below, and is also available with a FAQ at:
https://scripts.sil.org/OFL

-----------------------------------------------------------
SIL OPEN FONT LICENSE Version 1.1 - 26 February 2007
-----------------------------------------------------------

PREAMBLE
The goals of the Open Font License (OFL) are to stimulate worldwide
development of collaborative font projects, to support the font creation
efforts of academic and linguistic communities, and to provide a free and
open framework in which fonts may be shared and improved in partnership
with others.

The OFL allows the licensed fonts to be used, studied, modified and
redistributed freely as long as they are not sold by themselves. The
fonts, including any derivative works, can be bundled, embedded, 
redistributed and/or sold with any software provided that any reserved
names are not used by derivative works. The fonts and derivatives,
however, cannot be released under any other type of license. The
requirement for fonts to remain under this license does not apply
to any document created using the fonts or their derivatives.

DEFINITIONS
"Font Software" refers to the set of files released by the Copyright
Holder(s) under this license and clearly marked as such. This may
include source files, build scripts and documentation.

"Reserved Font Name" refers to any names specified as such after the
copyright statement(s).

"Original Version" refers to the collection of Font Software components as
distributed by the Copyright Holder(s).

"Modified Version" refers to any derivative made by adding to, deleting,
or substituting -- in part or in whole -- any of the components of the
Original Version, by changing formats or by porting the Font Software to a
new environment.

"Author" refers to any designer, engineer, programmer, technical
writer or other person who contributed to the Font Software.

PERMISSION & CONDITIONS
Permission is hereby granted, free of charge, to any person obtaining
a copy of the Font Software, to use, study, copy, merge, embed, modify,
redistribute, and sell modified and unmodified copies of the Font
Software, subject to the following conditions:

1) Neither the Font Software nor any of its individual components,
in Original or Modified Versions, may be sold by itself.

2) Original or Modified Versions of the Font Software may be bundled,
redistributed and/or sold with any software, provided that each copy
contains the above copyright notice and this license. These can be
included either as stand-alone text files, human-readable headers or
in the appropriate machine-readable metadata fields within text or
binary files as long as those fields can be easily viewed by the user.

3) No Modified Version of the Font Software may use the Reserved Font
Name(s) unless explicit written permission is granted by the corresponding
Copyright Holder. This restriction only applies to the primary font name as
presented to the users.

4) The name(s) of the Copyright Holder(s) or the Author(s) of the Font
Software shall not be used to promote, endorse or advertise any
Modified Version, except to acknowledge the contribution(s) of the
Copyright Holder(s) and the Author(s) or with their explicit written
permission.

5) The Font Software, modified or unmodified, in part or in whole,
must be distributed entirely under this license, and must not be
distributed under any other license. The requirement for fonts to
remain under this license does not apply to any document created
using the Font Software.

TERMINATION
This license becomes null and void if any of the above conditions are
not met.

DISCLAIMER
THE FONT SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO ANY WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT
OF COPYRIGHT, PATENT, TRADEMARK, OR OTHER RIGHT. IN NO EVENT SHALL THE
COPYRIGHT HOLDER BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY,
INCLUDING ANY GENERAL, SPECIAL, INDIRECT, INCIDENTAL, OR CONSEQUENTIAL
DAMAGES, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
FROM, OUT OF THE USE OR INABILITY TO USE THE FONT SOFTWARE OR FROM
OTHER DEALINGS IN THE FONT SOFTWARE.
```

### Liberation Sans, Serif et Mono 2.1.5

substituts de Arial, Times New Roman et Courier New (mêmes métriques) — https://github.com/liberationfonts/liberation-fonts

```
Digitized data copyright (c) 2010 Google Corporation
	with Reserved Font Arimo, Tinos and Cousine.
Copyright (c) 2012 Red Hat, Inc.
	with Reserved Font Name Liberation.

This Font Software is licensed under the SIL Open Font License,
Version 1.1.

This license is copied below, and is also available with a FAQ at:
http://scripts.sil.org/OFL

SIL OPEN FONT LICENSE Version 1.1 - 26 February 2007

PREAMBLE The goals of the Open Font License (OFL) are to stimulate
worldwide development of collaborative font projects, to support the font
creation efforts of academic and linguistic communities, and to provide
a free and open framework in which fonts may be shared and improved in
partnership with others.

The OFL allows the licensed fonts to be used, studied, modified and
redistributed freely as long as they are not sold by themselves.
The fonts, including any derivative works, can be bundled, embedded,
redistributed and/or sold with any software provided that any reserved
names are not used by derivative works.  The fonts and derivatives,
however, cannot be released under any other type of license.  The
requirement for fonts to remain under this license does not apply to
any document created using the fonts or their derivatives.

 

DEFINITIONS
"Font Software" refers to the set of files released by the Copyright
Holder(s) under this license and clearly marked as such.
This may include source files, build scripts and documentation.

"Reserved Font Name" refers to any names specified as such after the
copyright statement(s).

"Original Version" refers to the collection of Font Software components
as distributed by the Copyright Holder(s).

"Modified Version" refers to any derivative made by adding to, deleting,
or substituting ? in part or in whole ?
any of the components of the Original Version, by changing formats or
by porting the Font Software to a new environment.

"Author" refers to any designer, engineer, programmer, technical writer
or other person who contributed to the Font Software.

PERMISSION & CONDITIONS

Permission is hereby granted, free of charge, to any person obtaining a
copy of the Font Software, to use, study, copy, merge, embed, modify,
redistribute, and sell modified and unmodified copies of the Font
Software, subject to the following conditions:

1) Neither the Font Software nor any of its individual components,in
   Original or Modified Versions, may be sold by itself.

2) Original or Modified Versions of the Font Software may be bundled,
   redistributed and/or sold with any software, provided that each copy
   contains the above copyright notice and this license. These can be
   included either as stand-alone text files, human-readable headers or
   in the appropriate machine-readable metadata fields within text or
   binary files as long as those fields can be easily viewed by the user.

3) No Modified Version of the Font Software may use the Reserved Font
   Name(s) unless explicit written permission is granted by the
   corresponding Copyright Holder. This restriction only applies to the
   primary font name as presented to the users.

4) The name(s) of the Copyright Holder(s) or the Author(s) of the Font
   Software shall not be used to promote, endorse or advertise any
   Modified Version, except to acknowledge the contribution(s) of the
   Copyright Holder(s) and the Author(s) or with their explicit written
   permission.

5) The Font Software, modified or unmodified, in part or in whole, must
   be distributed entirely under this license, and must not be distributed
   under any other license. The requirement for fonts to remain under
   this license does not apply to any document created using the Font
   Software.

 
TERMINATION
This license becomes null and void if any of the above conditions are not met.

 

DISCLAIMER
THE FONT SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO ANY WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT
OF COPYRIGHT, PATENT, TRADEMARK, OR OTHER RIGHT.  IN NO EVENT SHALL THE
COPYRIGHT HOLDER BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY,
INCLUDING ANY GENERAL, SPECIAL, INDIRECT, INCIDENTAL, OR CONSEQUENTIAL
DAMAGES, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
FROM, OUT OF THE USE OR INABILITY TO USE THE FONT SOFTWARE OR FROM OTHER
DEALINGS IN THE FONT SOFTWARE.
```

### Selawik 1.01

substitut libre de Segoe UI (Microsoft) — https://github.com/microsoft/Selawik

```
Copyright 2015, Microsoft Corporation (www.microsoft.com), with Reserved Font Name Selawik.  All Rights Reserved.  Selawik is a trademark of Microsoft Corporation in the United States and/or other countries.

This Font Software is licensed under the SIL Open Font License, Version 1.1.
This license is copied below, and is also available with a FAQ at:
http://scripts.sil.org/OFL

-----------------------------------------------------------
SIL OPEN FONT LICENSE Version 1.1 - 26 February 2007
-----------------------------------------------------------
PREAMBLE
The goals of the Open Font License (OFL) are to stimulate worldwide
development of collaborative font projects, to support the font creation
efforts of academic and linguistic communities, and to provide a free and
open framework in which fonts may be shared and improved in partnership
with others.

The OFL allows the licensed fonts to be used, studied, modified and
redistributed freely as long as they are not sold by themselves. The
fonts, including any derivative works, can be bundled, embedded, 
redistributed and/or sold with any software provided that any reserved
names are not used by derivative works. The fonts and derivatives,
however, cannot be released under any other type of license. The
requirement for fonts to remain under this license does not apply
to any document created using the fonts or their derivatives.

DEFINITIONS
"Font Software" refers to the set of files released by the Copyright
Holder(s) under this license and clearly marked as such. This may
include source files, build scripts and documentation.

"Reserved Font Name" refers to any names specified as such after the
copyright statement(s).

"Original Version" refers to the collection of Font Software components as
distributed by the Copyright Holder(s).

"Modified Version" refers to any derivative made by adding to, deleting,
or substituting -- in part or in whole -- any of the components of the
Original Version, by changing formats or by porting the Font Software to a
new environment.

"Author" refers to any designer, engineer, programmer, technical
writer or other person who contributed to the Font Software.

PERMISSION & CONDITIONS
Permission is hereby granted, free of charge, to any person obtaining
a copy of the Font Software, to use, study, copy, merge, embed, modify,
redistribute, and sell modified and unmodified copies of the Font
Software, subject to the following conditions:

1) Neither the Font Software nor any of its individual components,
in Original or Modified Versions, may be sold by itself.

2) Original or Modified Versions of the Font Software may be bundled,
redistributed and/or sold with any software, provided that each copy
contains the above copyright notice and this license. These can be
included either as stand-alone text files, human-readable headers or
in the appropriate machine-readable metadata fields within text or
binary files as long as those fields can be easily viewed by the user.

3) No Modified Version of the Font Software may use the Reserved Font
Name(s) unless explicit written permission is granted by the corresponding
Copyright Holder. This restriction only applies to the primary font name as
presented to the users.

4) The name(s) of the Copyright Holder(s) or the Author(s) of the Font
Software shall not be used to promote, endorse or advertise any
Modified Version, except to acknowledge the contribution(s) of the
Copyright Holder(s) and the Author(s) or with their explicit written
permission.

5) The Font Software, modified or unmodified, in part or in whole,
must be distributed entirely under this license, and must not be
distributed under any other license. The requirement for fonts to
remain under this license does not apply to any document created
using the Font Software.

TERMINATION
This license becomes null and void if any of the above conditions are
not met.

DISCLAIMER
THE FONT SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO ANY WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT
OF COPYRIGHT, PATENT, TRADEMARK, OR OTHER RIGHT. IN NO EVENT SHALL THE
COPYRIGHT HOLDER BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY,
INCLUDING ANY GENERAL, SPECIAL, INDIRECT, INCIDENTAL, OR CONSEQUENTIAL
DAMAGES, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
FROM, OUT OF THE USE OR INABILITY TO USE THE FONT SOFTWARE OR FROM
OTHER DEALINGS IN THE FONT SOFTWARE.
```

## Paquets npm distribués avec l'application (99)

### MIT (87)

| Paquet | Version | Copyright | Source |
|---|---|---|---|
| @cantoo/pdf-lib | 2.11.1 | Copyright (c) 2019 Andrew Dillon | https://github.com/cantoo-scribe/pdf-lib |
| @codemirror/autocomplete | 6.20.4 | Copyright (C) 2018-2021 by Marijn Haverbeke <marijn@haverbeke.berlin> and others | https://code.haverbeke.berlin/codemirror/autocomplete |
| @codemirror/commands | 6.11.1 | Copyright (C) 2018-2021 by Marijn Haverbeke <marijn@haverbeke.berlin> and others | https://code.haverbeke.berlin/codemirror/commands |
| @codemirror/lang-angular | 0.1.4 | Copyright (C) 2018-2021 by Marijn Haverbeke <marijn@haverbeke.berlin> and others | https://github.com/codemirror/lang-angular |
| @codemirror/lang-cpp | 6.0.3 | Copyright (C) 2018-2021 by Marijn Haverbeke <marijn@haverbeke.berlin> and others | https://github.com/codemirror/lang-cpp |
| @codemirror/lang-css | 6.3.1 | Copyright (C) 2018-2021 by Marijn Haverbeke <marijn@haverbeke.berlin> and others | https://github.com/codemirror/lang-css |
| @codemirror/lang-go | 6.0.1 | Copyright (C) 2024 by Marijn Haverbeke <marijn@haverbeke.berlin> and others | https://github.com/codemirror/lang-go |
| @codemirror/lang-html | 6.4.12 | Copyright (C) 2018-2021 by Marijn Haverbeke <marijn@haverbeke.berlin> and others | https://code.haverbeke.berlin/codemirror/lang-html |
| @codemirror/lang-java | 6.0.2 | Copyright (C) 2018-2021 by Marijn Haverbeke <marijn@haverbeke.berlin> and others | https://github.com/codemirror/lang-java |
| @codemirror/lang-javascript | 6.2.5 | Copyright (C) 2018-2021 by Marijn Haverbeke <marijn@haverbeke.berlin> and others | https://github.com/codemirror/lang-javascript |
| @codemirror/lang-jinja | 6.0.1 | Copyright (C) 2025 by Marijn Haverbeke <marijn@haverbeke.berlin> and others | https://code.haverbeke.berlin/codemirror/lang-jinja |
| @codemirror/lang-json | 6.0.2 | Copyright (C) 2018-2021 by Marijn Haverbeke <marijn@haverbeke.berlin> and others | https://github.com/codemirror/lang-json |
| @codemirror/lang-less | 6.0.2 | Copyright (C) 2018-2021 by Marijn Haverbeke <marijn@haverbeke.berlin> and others | https://github.com/codemirror/lang-less |
| @codemirror/lang-liquid | 6.3.3 | Copyright (C) 2018-2023 by Marijn Haverbeke <marijn@haverbeke.berlin> and others | https://code.haverbeke.berlin/codemirror/lang-liquid |
| @codemirror/lang-markdown | 6.5.2 | Copyright (C) 2018-2021 by Marijn Haverbeke <marijn@haverbeke.berlin> and others | https://code.haverbeke.berlin/codemirror/lang-markdown |
| @codemirror/lang-php | 6.0.2 | Copyright (C) 2018-2021 by Marijn Haverbeke <marijn@haverbeke.berlin> and others | https://github.com/codemirror/lang-php |
| @codemirror/lang-python | 6.2.1 | Copyright (C) 2018-2021 by Marijn Haverbeke <marijn@haverbeke.berlin> and others | https://github.com/codemirror/lang-python |
| @codemirror/lang-rust | 6.0.2 | Copyright (C) 2018-2021 by Marijn Haverbeke <marijn@haverbeke.berlin> and others | https://github.com/codemirror/lang-rust |
| @codemirror/lang-sass | 6.0.2 | Copyright (C) 2018-2021 by Marijn Haverbeke <marijn@haverbeke.berlin> and others | https://github.com/codemirror/lang-sass |
| @codemirror/lang-sql | 6.10.0 | Copyright (C) 2018-2021 by Marijn Haverbeke <marijn@haverbeke.berlin> and others | https://github.com/codemirror/lang-sql |
| @codemirror/lang-vue | 0.1.3 | Copyright (C) 2018-2021 by Marijn Haverbeke <marijn@haverbeke.berlin> and others | https://github.com/codemirror/lang-vue |
| @codemirror/lang-wast | 6.0.2 | Copyright (C) 2018-2021 by Marijn Haverbeke <marijn@haverbeke.berlin> and others | https://github.com/codemirror/lang-wast |
| @codemirror/lang-xml | 6.1.0 | Copyright (C) 2018-2021 by Marijn Haverbeke <marijn@haverbeke.berlin> and others | https://github.com/codemirror/lang-xml |
| @codemirror/lang-yaml | 6.1.3 | Copyright (C) 2024 by Marijn Haverbeke <marijn@haverbeke.berlin> and others | https://github.com/codemirror/lang-yaml |
| @codemirror/language | 6.13.1 | Copyright (C) 2018-2021 by Marijn Haverbeke <marijn@haverbeke.berlin> and others | https://code.haverbeke.berlin/codemirror/language |
| @codemirror/language-data | 6.5.2 | Copyright (C) 2018-2021 by Marijn Haverbeke <marijn@haverbeke.berlin> and others | https://github.com/codemirror/language-data |
| @codemirror/legacy-modes | 6.5.5 | Copyright (C) 2018-2021 by Marijn Haverbeke <marijn@haverbeke.berlin> and others | https://code.haverbeke.berlin/codemirror/legacy-modes |
| @codemirror/lint | 6.9.7 | Copyright (C) 2018-2021 by Marijn Haverbeke <marijn@haverbeke.berlin> and others | https://code.haverbeke.berlin/codemirror/lint |
| @codemirror/search | 6.7.2 | Copyright (C) 2018-2021 by Marijn Haverbeke <marijn@haverbeke.berlin> and others | https://code.haverbeke.berlin/codemirror/search |
| @codemirror/state | 6.7.6 | Copyright (C) 2018-2021 by Marijn Haverbeke <marijn@haverbeke.berlin> and others | https://code.haverbeke.berlin/codemirror/state |
| @codemirror/streamparser | 6.0.0 | Copyright (C) 2018-2021 by Marijn Haverbeke <marijn@haverbeke.berlin> and others | https://code.haverbeke.berlin/codemirror/streamparser |
| @codemirror/view | 6.43.15 | Copyright (C) 2018-2021 by Marijn Haverbeke <marijn@haverbeke.berlin> and others | https://code.haverbeke.berlin/codemirror/view |
| @lezer/common | 1.5.5 | Copyright (C) 2018 by Marijn Haverbeke <marijn@haverbeke.berlin> and others | https://code.haverbeke.berlin/lezer/common |
| @lezer/cpp | 1.1.6 | Copyright (C) 2020 by Marijn Haverbeke <marijn@haverbeke.berlin> and others | https://code.haverbeke.berlin/lezer/cpp |
| @lezer/css | 1.3.9 | Copyright (C) 2018 by Marijn Haverbeke <marijn@haverbeke.berlin> and others | https://code.haverbeke.berlin/lezer/css |
| @lezer/go | 1.0.1 | Copyright (C) 2020 by Marijn Haverbeke <marijn@haverbeke.berlin> and others | https://github.com/lezer-parser/go |
| @lezer/highlight | 1.2.5 | Copyright (C) 2018 by Marijn Haverbeke <marijn@haverbeke.berlin> and others | https://code.haverbeke.berlin/lezer/highlight |
| @lezer/html | 1.3.13 | Copyright (C) 2018 by Marijn Haverbeke <marijn@haverbeke.berlin> and others | https://github.com/lezer-parser/html |
| @lezer/java | 1.1.5 | Copyright (C) 2020 by Marijn Haverbeke <marijn@haverbeke.berlin> and others | https://code.haverbeke.berlin/lezer/java |
| @lezer/javascript | 1.5.6 | Copyright (C) 2018 by Marijn Haverbeke <marijn@haverbeke.berlin> and others | https://code.haverbeke.berlin/lezer/javascript |
| @lezer/json | 1.0.3 | Copyright (C) 2020 by Marijn Haverbeke <marijn@haverbeke.berlin>, Arun Srinivasan <rulfzid@gmail.com>, and others | https://github.com/lezer-parser/json |
| @lezer/lr | 1.4.12 | Copyright (C) 2018 by Marijn Haverbeke <marijn@haverbeke.berlin> and others | https://code.haverbeke.berlin/lezer/lr |
| @lezer/markdown | 1.8.1 | Copyright (C) 2020 by Marijn Haverbeke <marijn@haverbeke.berlin> and others | https://code.haverbeke.berlin/lezer/markdown |
| @lezer/php | 1.0.6 | Copyright (C) 2018 by Marijn Haverbeke <marijn@haverbeke.berlin> and others | https://code.haverbeke.berlin/lezer/php |
| @lezer/python | 1.1.19 | Copyright (C) 2020 by Marijn Haverbeke <marijn@haverbeke.berlin> and others | https://code.haverbeke.berlin/lezer/python |
| @lezer/rust | 1.0.3 | Copyright (C) 2018 by Marijn Haverbeke <marijn@haverbeke.berlin> and others | https://code.haverbeke.berlin/lezer/rust |
| @lezer/sass | 1.1.0 | Copyright (C) 2018 by Marijn Haverbeke <marijn@haverbeke.berlin> and others | https://github.com/lezer-parser/sass |
| @lezer/xml | 1.0.6 | Copyright (C) 2018 by Marijn Haverbeke <marijn@haverbeke.berlin> and others | https://github.com/lezer-parser/xml |
| @lezer/yaml | 1.0.4 | Copyright (C) 2024 by Marijn Haverbeke <marijnh@gmail.com> and others | https://github.com/lezer-parser/yaml |
| @marijn/find-cluster-break | 1.0.4 | Copyright (C) 2024 by Marijn Haverbeke <marijn@haverbeke.berlin> | https://code.haverbeke.berlin/marijn/find-cluster-break |
| @napi-rs/canvas | 1.1.0 | Copyright (c) 2020 lynweklm@gmail.com | https://github.com/Brooooooklyn/canvas |
| @napi-rs/canvas-win32-x64-msvc | 1.1.0 |  | https://github.com/Brooooooklyn/canvas |
| @types/trusted-types | 2.0.7 | Copyright (c) Microsoft Corporation. | https://github.com/DefinitelyTyped/DefinitelyTyped |
| core-util-is | 1.0.3 |  | https://github.com/isaacs/core-util-is |
| crelt | 1.0.7 | Copyright (C) 2020 by Marijn Haverbeke <marijn@haverbeke.berlin> | https://code.haverbeke.berlin/marijn/crelt |
| culori | 4.0.2 | Copyright (c) 2018 Dan Burzo | git@github.com:Evercoder/culori |
| fflate | 0.8.3 | Copyright (c) 2026 Arjun Barrett | https://github.com/101arrowz/fflate |
| html-entities | 2.6.0 | Copyright (c) 2021 Dulin Marat | https://github.com/mdevils/html-entities |
| immediate | 3.0.6 | Copyright (c) 2012 Barnesandnoble.com, llc, Donavon West, Domenic Denicola, Brian Cavalier | https://github.com/calvinmetcalf/immediate |
| isarray | 1.0.0 |  | https://github.com/juliangruber/isarray |
| lie | 3.3.0 | #Copyright (c) 2014-2018 Calvin Metcalf, Jordan Harband | https://github.com/calvinmetcalf/lie |
| node-html-better-parser | 1.5.9 | Copyright 2019 Tao Qiufeng | https://github.com/Sharcoux/node-html-parser |
| orderedmap | 2.1.1 | Copyright (C) 2016 by Marijn Haverbeke <marijn@haverbeke.berlin> and others | https://github.com/marijnh/orderedmap |
| process-nextick-args | 2.0.1 | # Copyright (c) 2015 Calvin Metcalf | https://github.com/calvinmetcalf/process-nextick-args |
| prosemirror-commands | 1.7.2 | Copyright (C) 2015-2017 by Marijn Haverbeke <marijn@haverbeke.berlin> and others | https://code.haverbeke.berlin/prosemirror/prosemirror-commands |
| prosemirror-dropcursor | 1.8.4 | Copyright (C) 2015-2017 by Marijn Haverbeke <marijn@haverbeke.berlin> and others | https://code.haverbeke.berlin/prosemirror/prosemirror-dropcursor |
| prosemirror-gapcursor | 1.4.1 | Copyright (C) 2015-2017 by Marijn Haverbeke <marijn@haverbeke.berlin> and others | https://github.com/prosemirror/prosemirror-gapcursor |
| prosemirror-history | 1.5.1 | Copyright (C) 2015-2017 by Marijn Haverbeke <marijn@haverbeke.berlin> and others | https://code.haverbeke.berlin/prosemirror/prosemirror-history |
| prosemirror-inputrules | 1.5.1 | Copyright (C) 2015-2017 by Marijn Haverbeke <marijn@haverbeke.berlin> and others | https://github.com/prosemirror/prosemirror-inputrules |
| prosemirror-keymap | 1.2.3 | Copyright (C) 2015-2017 by Marijn Haverbeke <marijn@haverbeke.berlin> and others | https://github.com/prosemirror/prosemirror-keymap |
| prosemirror-model | 1.25.12 | Copyright (C) 2015-2017 by Marijn Haverbeke <marijn@haverbeke.berlin> and others | https://code.haverbeke.berlin/prosemirror/prosemirror-model |
| prosemirror-schema-list | 1.6.0 | Copyright (C) 2015-2017 by Marijn Haverbeke <marijn@haverbeke.berlin> and others | https://code.haverbeke.berlin/prosemirror/prosemirror-schema-list |
| prosemirror-state | 1.4.4 | Copyright (C) 2015-2017 by Marijn Haverbeke <marijn@haverbeke.berlin> and others | https://github.com/prosemirror/prosemirror-state |
| prosemirror-tables | 1.8.5 | Copyright (C) 2015-2016 by Marijn Haverbeke <marijnh@gmail.com> and others | https://github.com/ProseMirror/prosemirror-tables |
| prosemirror-transform | 1.12.4 | Copyright (C) 2015-2017 by Marijn Haverbeke <marijn@haverbeke.berlin> and others | https://code.haverbeke.berlin/prosemirror/prosemirror-transform |
| prosemirror-view | 1.42.9 | Copyright (C) 2015-2017 by Marijn Haverbeke <marijn@haverbeke.berlin> and others | https://code.haverbeke.berlin/prosemirror/prosemirror-view |
| react | 19.3.1 | Copyright (c) Meta Platforms, Inc. and affiliates. | https://github.com/react/react |
| react-dom | 19.3.1 | Copyright (c) Meta Platforms, Inc. and affiliates. | https://github.com/react/react |
| readable-stream | 2.3.8 |  | https://github.com/nodejs/readable-stream |
| rope-sequence | 1.3.4 | Copyright (C) 2016 by Marijn Haverbeke <marijn@haverbeke.berlin> | https://github.com/marijnh/rope-sequence |
| safe-buffer | 5.1.2 | Copyright (c) Feross Aboukhadijeh | https://github.com/feross/safe-buffer |
| scheduler | 0.28.0 | Copyright (c) Meta Platforms, Inc. and affiliates. | https://github.com/react/react |
| setimmediate | 1.0.5 | Copyright (c) 2012 Barnesandnoble.com, llc, Donavon West, and Domenic Denicola | https://github.com/YuzuJS/setImmediate |
| string_decoder | 1.1.1 |  | https://github.com/nodejs/string_decoder |
| style-mod | 4.1.4 | Copyright (C) 2018 by Marijn Haverbeke <marijn@haverbeke.berlin> and others | https://code.haverbeke.berlin/marijn/style-mod |
| util-deprecate | 1.0.2 | Copyright (c) 2014 Nathan Rajlich <nathan@tootallnate.net> | https://github.com/TooTallNate/util-deprecate |
| w3c-keyname | 2.2.8 | Copyright (C) 2016 by Marijn Haverbeke <marijn@haverbeke.berlin> and others | https://github.com/marijnh/w3c-keyname |

### MIT OR Apache-2.0 (5)

| Paquet | Version | Copyright | Source |
|---|---|---|---|
| @tauri-apps/plugin-dialog | 2.8.4 | PackageCopyrightText: 2019-2022, The Tauri Programme in the Commons Conservancy | https://github.com/tauri-apps/plugins-workspace |
| @tauri-apps/plugin-fs | 2.7.1 | PackageCopyrightText: 2019-2022, The Tauri Programme in the Commons Conservancy | https://github.com/tauri-apps/plugins-workspace |
| @tauri-apps/plugin-opener | 2.7.2 | PackageCopyrightText: 2019-2022, The Tauri Programme in the Commons Conservancy | https://github.com/tauri-apps/plugins-workspace |
| @tauri-apps/plugin-process | 2.4.0 | PackageCopyrightText: 2019-2022, The Tauri Programme in the Commons Conservancy | https://github.com/tauri-apps/plugins-workspace |
| @tauri-apps/plugin-updater | 2.14.1 | PackageCopyrightText: 2019-2022, The Tauri Programme in the Commons Conservancy | https://github.com/tauri-apps/plugins-workspace |

### (MIT AND Zlib) (1)

| Paquet | Version | Copyright | Source |
|---|---|---|---|
| pako | 1.0.11 | Copyright (C) 2014-2017 by Vitaly Puzrin and Andrei Tuputcyn | https://github.com/nodeca/pako |

### (MIT OR GPL-3.0-or-later) (1)

| Paquet | Version | Copyright | Source |
|---|---|---|---|
| jszip | 3.10.2 | Copyright (c) 2009-2016 Stuart Knightley, David Duponchel, Franz Buchinger, António Afonso | https://github.com/Stuk/jszip |

### (MPL-2.0 OR Apache-2.0) (1)

| Paquet | Version | Copyright | Source |
|---|---|---|---|
| dompurify | 3.4.17 |  | https://github.com/cure53/DOMPurify |

### 0BSD (1)

| Paquet | Version | Copyright | Source |
|---|---|---|---|
| tslib | 2.9.1 | Copyright (c) Microsoft Corporation. | https://github.com/Microsoft/tslib |

### Apache-2.0 (1)

| Paquet | Version | Copyright | Source |
|---|---|---|---|
| pdfjs-dist | 6.5.438 |  | https://github.com/mozilla/pdf.js |

### Apache-2.0 OR MIT (1)

| Paquet | Version | Copyright | Source |
|---|---|---|---|
| @tauri-apps/api | 2.12.4 |  | https://github.com/tauri-apps/tauri |

### ISC (1)

| Paquet | Version | Copyright | Source |
|---|---|---|---|
| inherits | 2.0.4 | Copyright (c) Isaac Z. Schlueter | https://github.com/isaacs/inherits |

## Crates Rust distribuées avec l'application (785)

### MIT OR Apache-2.0 (388)

| Paquet | Version | Copyright | Source |
|---|---|---|---|
| aes | 0.8.4 |  | https://github.com/RustCrypto/block-ciphers |
| aes | 0.9.2 |  | https://github.com/RustCrypto/block-ciphers |
| aes | 0.9.4 |  | https://github.com/RustCrypto/block-ciphers |
| aligned | 0.4.3 |  | https://github.com/rust-embedded-community/aligned |
| android_system_properties | 0.1.6 | Copyright 2016 Nicolas Silva | https://github.com/nical/android_system_properties |
| anyhow | 1.0.104 |  | https://github.com/dtolnay/anyhow |
| arbitrary | 1.4.2 |  | https://github.com/rust-fuzz/arbitrary/ |
| arbitrary | 1.5.0 |  | https://github.com/rust-fuzz/arbitrary/ |
| arrayvec | 0.7.8 |  | https://github.com/bluss/arrayvec |
| as-slice | 0.2.1 |  | https://github.com/japaric/as-slice |
| async-broadcast | 0.7.2 | Copyright 2020 Yoshua Wuyts | https://github.com/smol-rs/async-broadcast |
| async-recursion | 1.2.0 |  | https://github.com/dcchut/async-recursion |
| async-trait | 0.1.92 |  | https://github.com/dtolnay/async-trait |
| atoi_simd | 0.18.1 | Copyright 2022-NOW Dmitry Rodionov | https://github.com/RoDmitry/atoi_simd |
| base64 | 0.21.7 |  | https://github.com/marshallpierce/rust-base64 |
| base64 | 0.22.1 |  | https://github.com/marshallpierce/rust-base64 |
| base64 | 0.23.1 |  | https://github.com/marshallpierce/rust-base64 |
| bitflags | 1.3.2 |  | https://github.com/bitflags/bitflags |
| bitflags | 2.13.1 |  | https://github.com/bitflags/bitflags |
| bitflags | 2.13.2 |  | https://github.com/bitflags/bitflags |
| bitstream-io | 4.10.0 |  | https://github.com/tuffy/bitstream-io |
| block-buffer | 0.10.4 |  | https://github.com/RustCrypto/utils |
| block-buffer | 0.12.1 |  | https://github.com/RustCrypto/utils |
| block-padding | 0.3.3 |  | https://github.com/RustCrypto/utils |
| block-padding | 0.4.2 |  | https://github.com/RustCrypto/utils |
| bs58 | 0.5.1 |  | https://github.com/Nullus157/bs58-rs |
| bumpalo | 3.20.3 |  | https://github.com/fitzgen/bumpalo |
| bzip2 | 0.6.1 |  | https://github.com/trifectatechfoundation/bzip2-rs |
| camino | 1.2.6 |  | https://github.com/camino-rs/camino |
| cargo-platform | 0.1.9 |  | https://github.com/rust-lang/cargo |
| cbc | 0.1.2 |  | https://github.com/RustCrypto/block-modes |
| cbc | 0.2.1 |  | https://github.com/RustCrypto/block-modes |
| cc | 1.4.4 |  | https://github.com/rust-lang/cc-rs |
| cc | 1.11.0 |  | https://github.com/rust-lang/cc-rs |
| cfg-expr | 0.15.8 |  | https://github.com/EmbarkStudios/cfg-expr |
| cfg-if | 1.0.4 |  | https://github.com/rust-lang/cfg-if |
| cfg-if | 1.0.5 |  | https://github.com/rust-lang/cfg-if |
| chacha20 | 0.10.2 |  | https://github.com/RustCrypto/stream-ciphers |
| chrono | 0.4.45 | Apache 2.0 License [2]. Copyright (c) 2014--2026, Kang Seonghoon and | https://github.com/chronotope/chrono |
| cipher | 0.4.4 |  | https://github.com/RustCrypto/traits |
| cipher | 0.5.2 |  | https://github.com/RustCrypto/traits |
| cookie | 0.18.2 | Copyright 2017 Sergio Benitez | https://github.com/SergioBenitez/cookie-rs |
| core_detect | 1.0.0 |  | https://github.com/thomcc/core_detect |
| core-foundation | 0.9.4 |  | https://github.com/servo/core-foundation-rs |
| core-foundation | 0.10.1 |  | https://github.com/servo/core-foundation-rs |
| core-foundation-sys | 0.8.7 |  | https://github.com/servo/core-foundation-rs |
| core-graphics | 0.25.0 |  | https://github.com/servo/core-foundation-rs |
| core-graphics-types | 0.2.0 |  | https://github.com/servo/core-foundation-rs |
| cpubits | 0.1.1 |  | https://github.com/RustCrypto/utils |
| cpufeatures | 0.2.17 |  | https://github.com/RustCrypto/utils |
| cpufeatures | 0.3.0 |  | https://github.com/RustCrypto/utils |
| cpufeatures | 0.3.1 |  | https://github.com/RustCrypto/utils |
| crc | 2.1.0 |  | https://github.com/mrhooray/crc-rs.git |
| crc-catalog | 1.1.1 | Copyright 2019 Akhil Velagapudi | https://github.com/akhilles/crc-catalog.git |
| crc32fast | 1.5.1 |  | https://github.com/srijs/rust-crc32fast |
| crc32fast | 1.5.4 |  | https://github.com/srijs/rust-crc32fast |
| crossbeam-channel | 0.5.16 |  | https://github.com/crossbeam-rs/crossbeam |
| crossbeam-channel | 0.5.17 |  | https://github.com/crossbeam-rs/crossbeam |
| crossbeam-deque | 0.8.7 |  | https://github.com/crossbeam-rs/crossbeam |
| crossbeam-deque | 0.8.8 |  | https://github.com/crossbeam-rs/crossbeam |
| crossbeam-epoch | 0.9.20 |  | https://github.com/crossbeam-rs/crossbeam |
| crossbeam-epoch | 0.9.21 |  | https://github.com/crossbeam-rs/crossbeam |
| crossbeam-utils | 0.8.22 |  | https://github.com/crossbeam-rs/crossbeam |
| crossbeam-utils | 0.8.23 |  | https://github.com/crossbeam-rs/crossbeam |
| crypto-common | 0.1.7 |  | https://github.com/RustCrypto/traits |
| crypto-common | 0.2.2 |  | https://github.com/RustCrypto/traits |
| data-url | 0.3.2 |  | https://github.com/servo/rust-url |
| debug_unsafe | 0.1.4 | Copyright 2025-NOW Dmitry Rodionov | https://github.com/RoDmitry/debug_unsafe |
| defmt | 1.1.1 |  | https://github.com/knurling-rs/defmt |
| defmt | 1.2.0 |  | https://github.com/knurling-rs/defmt |
| defmt-macros | 1.1.1 |  | https://github.com/knurling-rs/defmt |
| defmt-macros | 1.2.0 |  | https://github.com/knurling-rs/defmt |
| defmt-parser | 1.0.0 |  | https://github.com/knurling-rs/defmt |
| defmt-parser | 1.1.0 |  | https://github.com/knurling-rs/defmt |
| deranged | 0.5.8 | Copyright 2024 Jacob Pratt et al. | https://github.com/jhpratt/deranged |
| deranged | 0.5.9 | Copyright 2024 Jacob Pratt et al. | https://github.com/jhpratt/deranged |
| digest | 0.10.7 |  | https://github.com/RustCrypto/traits |
| digest | 0.11.3 |  | https://github.com/RustCrypto/traits |
| dirs | 7.0.0 |  | https://codeberg.org/dirs/dirs-rs |
| dirs-sys | 0.5.0 |  | https://github.com/dirs-dev/dirs-sys-rs |
| displaydoc | 0.2.7 |  | https://github.com/yaahc/displaydoc |
| dtoa | 1.0.11 |  | https://github.com/dtolnay/dtoa |
| dyn-clone | 1.0.20 |  | https://github.com/dtolnay/dyn-clone |
| either | 1.18.0 |  | https://github.com/rayon-rs/either |
| either | 1.19.0 |  | https://github.com/rayon-rs/either |
| embed_plist | 1.2.2 |  | https://github.com/nvzqz/embed-plist-rs |
| enumflags2 | 0.7.12 | Copyright 2017-2023 Maik Klein, Maja Kądziołka | https://github.com/meithecatte/enumflags2 |
| enumflags2_derive | 0.7.12 | Copyright [2017] [Maik Klein] | https://github.com/meithecatte/enumflags2 |
| erased-serde | 0.4.11 |  | https://github.com/dtolnay/erased-serde |
| errno | 0.3.14 |  | https://github.com/lambda-fairy/rust-errno |
| euclid | 0.22.14 |  | https://github.com/servo/euclid |
| fallible-iterator | 0.3.0 |  | https://github.com/sfackler/rust-fallible-iterator |
| fallible-streaming-iterator | 0.1.9 |  | https://github.com/sfackler/fallible-streaming-iterator |
| fast-float2 | 0.2.4 | Copyright 2021 Ivan Smirnov | https://github.com/Alexhuszagh/fast-float-rust |
| fdeflate | 0.3.7 |  | https://github.com/image-rs/fdeflate |
| field-offset | 0.3.6 |  | https://github.com/Diggsey/rust-field-offset |
| filetime | 0.2.29 |  | https://github.com/alexcrichton/filetime |
| find-msvc-tools | 0.1.11 |  | https://github.com/rust-lang/cc-rs |
| find-msvc-tools | 0.1.15 |  | https://github.com/rust-lang/cc-rs |
| flate2 | 1.1.9 |  | https://github.com/rust-lang/flate2-rs |
| flate2 | 1.1.10 |  | https://github.com/rust-lang/flate2-rs |
| foreign-types | 0.5.0 |  | https://github.com/sfackler/foreign-types |
| foreign-types-macros | 0.2.4 |  | https://github.com/sfackler/foreign-types |
| foreign-types-shared | 0.3.1 |  | https://github.com/sfackler/foreign-types |
| form_urlencoded | 1.2.2 |  | https://github.com/servo/rust-url |
| futf | 0.1.5 |  | https://github.com/servo/futf |
| futures-channel | 0.3.34 | Copyright (c) 2016 Alex Crichton | https://github.com/rust-lang/futures-rs |
| futures-core | 0.3.34 | Copyright (c) 2016 Alex Crichton | https://github.com/rust-lang/futures-rs |
| futures-executor | 0.3.34 | Copyright (c) 2016 Alex Crichton | https://github.com/rust-lang/futures-rs |
| futures-io | 0.3.34 | Copyright (c) 2016 Alex Crichton | https://github.com/rust-lang/futures-rs |
| futures-macro | 0.3.34 | Copyright (c) 2016 Alex Crichton | https://github.com/rust-lang/futures-rs |
| futures-sink | 0.3.34 | Copyright (c) 2016 Alex Crichton | https://github.com/rust-lang/futures-rs |
| futures-task | 0.3.34 | Copyright (c) 2016 Alex Crichton | https://github.com/rust-lang/futures-rs |
| futures-util | 0.3.34 | Copyright (c) 2016 Alex Crichton | https://github.com/rust-lang/futures-rs |
| getopts | 0.2.24 |  | https://github.com/rust-lang/getopts |
| getrandom | 0.2.17 |  | https://github.com/rust-random/getrandom |
| getrandom | 0.3.4 |  | https://github.com/rust-random/getrandom |
| getrandom | 0.4.3 |  | https://github.com/rust-random/getrandom |
| gif | 0.13.3 |  | https://github.com/image-rs/image-gif |
| gif | 0.14.2 |  | https://github.com/image-rs/image-gif |
| glob | 0.3.4 |  | https://github.com/rust-lang/glob |
| half | 2.7.1 |  | https://github.com/VoidStarKat/half-rs |
| hash32 | 0.3.1 |  | https://github.com/japaric/hash32 |
| hashbrown | 0.12.3 |  | https://github.com/rust-lang/hashbrown |
| hashbrown | 0.17.1 |  | https://github.com/rust-lang/hashbrown |
| hashlink | 0.12.2 |  | https://github.com/djc/hashlink |
| heapless | 0.8.0 |  | https://github.com/rust-embedded/heapless |
| heck | 0.4.1 |  | https://github.com/withoutboats/heck |
| heck | 0.5.0 |  | https://github.com/withoutboats/heck |
| hermit-abi | 0.5.3 |  | https://github.com/hermit-os/hermit-rs |
| hex | 0.4.3 |  | https://github.com/KokaKiwi/rust-hex |
| hmac | 0.13.0 |  | https://github.com/RustCrypto/MACs |
| html5ever | 0.27.0 |  | https://github.com/servo/html5ever |
| html5ever | 0.39.0 |  | https://github.com/servo/html5ever |
| http | 1.5.0 | Copyright 2017 http-rs authors | https://github.com/hyperium/http |
| httparse | 1.10.1 |  | https://github.com/seanmonstar/httparse |
| hybrid-array | 0.4.14 |  | https://github.com/RustCrypto/hybrid-array |
| hybrid-array | 0.4.15 |  | https://github.com/RustCrypto/hybrid-array |
| iana-time-zone | 0.1.65 | Copyright 2020 Andrew Straw | https://github.com/strawlab/iana-time-zone |
| iana-time-zone-haiku | 0.1.2 | Copyright 2020 Andrew Straw | https://github.com/strawlab/iana-time-zone |
| ident_case | 1.0.1 |  | https://github.com/TedDriggs/ident_case |
| idna | 1.1.0 |  | https://github.com/servo/rust-url/ |
| image | 0.25.10 |  | https://github.com/image-rs/image |
| image-webp | 0.1.3 |  | https://github.com/image-rs/image-webp |
| image-webp | 0.2.4 |  | https://github.com/image-rs/image-webp |
| inout | 0.1.4 |  | https://github.com/RustCrypto/utils |
| inout | 0.2.2 |  | https://github.com/RustCrypto/utils |
| inout | 0.2.5 |  | https://github.com/RustCrypto/utils |
| ipnet | 2.12.2 | Copyright 2017 Juniper Networks, Inc. | https://github.com/krisprice/ipnet |
| itertools | 0.14.0 |  | https://github.com/rust-itertools/itertools |
| itoa | 1.0.18 |  | https://github.com/dtolnay/itoa |
| jni | 0.21.1 |  | https://github.com/jni-rs/jni-rs |
| jni | 0.22.4 |  | https://github.com/jni-rs/jni-rs |
| jni-macros | 0.22.4 |  | https://github.com/jni-rs/jni-rs |
| jni-sys | 0.3.1 |  | https://github.com/jni-rs/jni-sys |
| jni-sys | 0.4.1 |  | https://github.com/jni-rs/jni-sys |
| jni-sys-macros | 0.4.1 |  | https://github.com/jni-rs/jni-sys |
| jobserver | 0.1.35 |  | https://github.com/rust-lang/jobserver-rs |
| js-sys | 0.3.104 |  | https://github.com/wasm-bindgen/wasm-bindgen/tree/master/crates/js-sys |
| js-sys | 0.3.107 |  | https://github.com/wasm-bindgen/wasm-bindgen/tree/master/crates/js-sys |
| json-patch | 4.2.0 |  | https://github.com/idubrov/json-patch |
| jsonptr | 0.7.1 | Copyright 2024 Chance Dinkins | https://github.com/chanced/jsonptr |
| keyboard-types | 0.8.3 |  | https://github.com/rust-windowing/keyboard-types |
| lazy_static | 1.5.0 |  | https://github.com/rust-lang-nursery/lazy-static.rs |
| lazy_static | 1.5.1 |  | https://github.com/rust-lang-nursery/lazy-static.rs |
| libc | 0.2.189 |  | https://github.com/rust-lang/libc |
| libc | 0.2.191 |  | https://github.com/rust-lang/libc |
| lock_api | 0.4.14 |  | https://github.com/Amanieu/parking_lot |
| log | 0.4.34 |  | https://github.com/rust-lang/log |
| log | 0.4.35 |  | https://github.com/rust-lang/log |
| mac | 0.1.1 |  | https://github.com/reem/rust-mac.git |
| markup5ever | 0.12.1 |  | https://github.com/servo/html5ever |
| markup5ever | 0.39.0 |  | https://github.com/servo/html5ever |
| markup5ever_rcdom | 0.3.0 |  | https://github.com/servo/html5ever |
| md-5 | 0.10.6 |  | https://github.com/RustCrypto/hashes |
| memmap2 | 0.9.11 | Copyright [2015] [Dan Burkert] | https://github.com/RazrFalcon/memmap2-rs |
| memmap2 | 0.9.12 | Copyright [2015] [Dan Burkert] | https://github.com/RazrFalcon/memmap2-rs |
| mime | 0.3.17 |  | https://github.com/hyperium/mime |
| ndk | 0.9.0 |  | https://github.com/rust-mobile/ndk |
| ndk-context | 0.1.1 |  | https://github.com/rust-windowing/android-ndk-rs |
| ndk-sys | 0.6.0+11769913 |  | https://github.com/rust-mobile/ndk |
| num-bigint | 0.4.8 |  | https://github.com/rust-num/num-bigint |
| num-complex | 0.4.6 |  | https://github.com/rust-num/num-complex |
| num-conv | 0.2.2 |  | https://github.com/jhpratt/num-conv |
| num-derive | 0.4.2 |  | https://github.com/rust-num/num-derive |
| num-integer | 0.1.47 |  | https://github.com/rust-num/num-integer |
| num-rational | 0.4.2 |  | https://github.com/rust-num/num-rational |
| num-traits | 0.2.19 |  | https://github.com/rust-num/num-traits |
| once_cell | 1.21.4 |  | https://github.com/matklad/once_cell |
| openssl-probe | 0.2.2 |  | https://github.com/rustls/openssl-probe |
| ordered-stream | 0.2.0 |  | https://github.com/danieldg/ordered-stream |
| osakit | 0.3.1 |  | https://github.com/mdevils/rust-osakit |
| parking_lot | 0.12.5 |  | https://github.com/Amanieu/parking_lot |
| parking_lot_core | 0.9.12 |  | https://github.com/Amanieu/parking_lot |
| paste | 1.0.15 |  | https://github.com/dtolnay/paste |
| pastey | 0.1.1 |  | https://github.com/as1100k/pastey |
| pbkdf2 | 0.13.0 |  | https://github.com/RustCrypto/password-hashes |
| percent-encoding | 2.3.2 |  | https://github.com/servo/rust-url/ |
| piper | 0.2.5 |  | https://github.com/smol-rs/piper |
| pkg-config | 0.3.34 |  | https://github.com/rust-lang/pkg-config-rs |
| png | 0.17.16 |  | https://github.com/image-rs/image-png |
| png | 0.18.1 |  | https://github.com/image-rs/image-png |
| powerfmt | 0.2.0 | Copyright 2023 Jacob Pratt et al. | https://github.com/jhpratt/powerfmt |
| powerfmt | 0.2.1 | Copyright 2023 Jacob Pratt et al. | https://github.com/jhpratt/powerfmt |
| ppv-lite86 | 0.2.21 | Copyright 2019 The CryptoCorrosion Contributors | https://github.com/cryptocorrosion/cryptocorrosion |
| proc-macro-crate | 1.3.1 |  | https://github.com/bkchr/proc-macro-crate |
| proc-macro-crate | 2.0.2 |  | https://github.com/bkchr/proc-macro-crate |
| proc-macro-crate | 3.5.0 |  | https://github.com/bkchr/proc-macro-crate |
| proc-macro-error | 1.0.4 | Copyright 2019-2020 CreepySkeleton <creepy-skeleton@yandex.ru> | https://gitlab.com/CreepySkeleton/proc-macro-error |
| proc-macro-error-attr | 1.0.4 | Copyright 2019-2020 CreepySkeleton <creepy-skeleton@yandex.ru> | https://gitlab.com/CreepySkeleton/proc-macro-error |
| proc-macro2 | 1.0.107 |  | https://github.com/dtolnay/proc-macro2 |
| profiling | 1.0.18 |  | https://github.com/aclysma/profiling |
| profiling-procmacros | 1.0.18 |  | https://github.com/aclysma/profiling |
| qoi | 0.4.1 |  | https://github.com/aldanor/qoi-rust |
| quick-error | 2.0.1 |  | http://github.com/tailhook/quick-error |
| quote | 1.0.47 |  | https://github.com/dtolnay/quote |
| rand | 0.8.8 |  | https://github.com/rust-random/rand |
| rand | 0.9.5 |  | https://github.com/rust-random/rand |
| rand | 0.10.2 |  | https://github.com/rust-random/rand |
| rand | 0.10.3 |  | https://github.com/rust-random/rand |
| rand_chacha | 0.9.0 |  | https://github.com/rust-random/rand |
| rand_core | 0.6.4 |  | https://github.com/rust-random/rand |
| rand_core | 0.9.5 |  | https://github.com/rust-random/rand |
| rand_core | 0.10.1 |  | https://github.com/rust-random/rand_core |
| rangemap | 1.8.0 | Copyright 2019-2022 Jeff Parsons, and [contributors](https://github.com/jeffparsons/rangemap/contributors) | https://github.com/jeffparsons/rangemap |
| rayon | 1.12.0 |  | https://github.com/rayon-rs/rayon |
| rayon-core | 1.13.0 |  | https://github.com/rayon-rs/rayon |
| ref-cast | 1.0.27 |  | https://github.com/dtolnay/ref-cast |
| ref-cast-impl | 1.0.27 |  | https://github.com/dtolnay/ref-cast |
| regex | 1.13.1 |  | https://github.com/rust-lang/regex |
| regex-automata | 0.4.18 |  | https://github.com/rust-lang/regex |
| regex-syntax | 0.8.11 |  | https://github.com/rust-lang/regex |
| reqwest | 0.13.5 | Copyright 2016 Sean McArthur | https://github.com/seanmonstar/reqwest |
| roxmltree | 0.20.0 |  | https://github.com/RazrFalcon/roxmltree |
| rust_xlsxwriter | 0.102.0 | Copyright 2022-2026 John McNamara <jmcnamara@cpan.org> | https://github.com/jmcnamara/rust_xlsxwriter |
| rustc_version | 0.4.1 |  | https://github.com/djc/rustc-version-rs |
| rustls-pki-types | 1.15.1 | Copyright 2023 Dirkjan Ochtman | https://github.com/rustls/pki-types |
| rustls-platform-verifier | 0.7.1 |  | https://github.com/rustls/rustls-platform-verifier |
| rustls-platform-verifier-android | 0.2.0 |  | https://github.com/rustls/rustls-platform-verifier |
| rustversion | 1.0.23 |  | https://github.com/dtolnay/rustversion |
| scopeguard | 1.2.0 |  | https://github.com/bluss/scopeguard |
| security-framework | 3.7.0 |  | https://github.com/kornelski/rust-security-framework |
| security-framework-sys | 2.17.0 |  | https://github.com/kornelski/rust-security-framework |
| semver | 1.0.28 |  | https://github.com/dtolnay/semver |
| seq-macro | 0.3.6 |  | https://github.com/dtolnay/seq-macro |
| serde | 1.0.229 |  | https://github.com/serde-rs/serde |
| serde_core | 1.0.229 |  | https://github.com/serde-rs/serde |
| serde_derive | 1.0.229 |  | https://github.com/serde-rs/serde |
| serde_derive_internals | 0.29.1 |  | https://github.com/serde-rs/serde |
| serde_json | 1.0.151 |  | https://github.com/serde-rs/json |
| serde_json | 1.0.154 |  | https://github.com/serde-rs/json |
| serde_repr | 0.1.21 |  | https://github.com/dtolnay/serde-repr |
| serde_spanned | 0.6.9 |  | https://github.com/toml-rs/toml |
| serde_spanned | 1.1.2 |  | https://github.com/toml-rs/toml |
| serde_with | 3.24.0 |  | https://github.com/jonasbb/serde_with/ |
| serde_with_macros | 3.24.0 |  | https://github.com/jonasbb/serde_with/ |
| serde_yaml | 0.9.34+deprecated |  | https://github.com/dtolnay/serde-yaml |
| serde-untagged | 0.1.9 |  | https://github.com/dtolnay/serde-untagged |
| serialize-to-javascript | 0.1.2 |  | https://github.com/chippers/serialize-to-javascript |
| serialize-to-javascript-impl | 0.1.2 |  | https://github.com/chippers/serialize-to-javascript |
| servo_arc | 0.4.3 |  | https://github.com/servo/stylo |
| sha1 | 0.11.0 |  | https://github.com/RustCrypto/hashes |
| sha2 | 0.10.9 |  | https://github.com/RustCrypto/hashes |
| sha2 | 0.11.0 |  | https://github.com/RustCrypto/hashes |
| sha2 | 0.11.1 |  | https://github.com/RustCrypto/hashes |
| shlex | 2.0.1 | Copyright 2015 Nicholas Allegra (comex). | https://github.com/comex/rust-shlex |
| signal-hook-registry | 1.4.8 |  | https://github.com/vorner/signal-hook |
| simdutf8 | 0.1.5 |  | https://github.com/rusticstuff/simdutf8 |
| siphasher | 1.0.3 | Copyright 2012-2016 The Rust Project Developers. | https://github.com/jedisct1/rust-siphash |
| siphasher | 1.0.4 | Copyright 2012-2016 The Rust Project Developers. | https://github.com/jedisct1/rust-siphash |
| smallvec | 1.15.2 |  | https://github.com/servo/rust-smallvec |
| smallvec | 1.16.4 |  | https://github.com/servo/rust-smallvec |
| socket2 | 0.6.5 |  | https://github.com/rust-lang/socket2 |
| softbuffer | 0.4.8 | Copyright 2022 Kirill Chibisov | https://github.com/rust-windowing/softbuffer |
| stable_deref_trait | 1.2.1 |  | https://github.com/storyyeller/stable_deref_trait |
| string_cache | 0.8.9 |  | https://github.com/servo/string-cache |
| string_cache | 0.9.0 |  | https://github.com/servo/string-cache |
| string_cache_codegen | 0.5.4 |  | https://github.com/servo/string-cache |
| string_cache_codegen | 0.6.1 |  | https://github.com/servo/string-cache |
| stringprep | 0.1.5 |  | https://github.com/sfackler/rust-stringprep |
| swift-rs | 1.0.9 | Copyright 2023 The swift-rs developers | https://github.com/Brendonovich/swift-rs |
| syn | 1.0.109 |  | https://github.com/dtolnay/syn |
| syn | 2.0.119 |  | https://github.com/dtolnay/syn |
| syn | 3.0.4 |  | https://github.com/dtolnay/syn |
| syn | 3.0.9 |  | https://github.com/dtolnay/syn |
| system-configuration | 0.7.0 |  | https://github.com/mullvad/system-configuration-rs |
| system-configuration-sys | 0.6.0 |  | https://github.com/mullvad/system-configuration-rs |
| system-deps | 6.2.2 |  | https://github.com/gdesmott/system-deps |
| tao-macros | 0.1.4 |  | https://github.com/tauri-apps/tao |
| tar | 0.4.46 |  | https://github.com/composefs/tar-rs |
| tempfile | 3.27.0 |  | https://github.com/Stebalien/tempfile |
| tendril | 0.4.3 |  | https://github.com/servo/tendril |
| tendril | 0.5.1 |  | https://github.com/servo/html5ever |
| thiserror | 1.0.69 |  | https://github.com/dtolnay/thiserror |
| thiserror | 2.0.20 |  | https://github.com/dtolnay/thiserror |
| thiserror | 2.0.21 |  | https://github.com/dtolnay/thiserror |
| thiserror-impl | 1.0.69 |  | https://github.com/dtolnay/thiserror |
| thiserror-impl | 2.0.20 |  | https://github.com/dtolnay/thiserror |
| thiserror-impl | 2.0.21 |  | https://github.com/dtolnay/thiserror |
| time | 0.3.55 |  | https://github.com/time-rs/time |
| time-core | 0.1.9 |  | https://github.com/time-rs/time |
| time-macros | 0.2.32 |  | https://github.com/time-rs/time |
| tokio-rustls | 0.26.6 | Copyright 2017 quininer kel | https://github.com/rustls/tokio-rustls |
| toml | 0.8.2 |  | https://github.com/toml-rs/toml |
| toml | 1.1.8+spec-1.1.0 |  | https://github.com/toml-rs/toml |
| toml_datetime | 0.6.3 |  | https://github.com/toml-rs/toml |
| toml_datetime | 1.1.2+spec-1.1.0 |  | https://github.com/toml-rs/toml |
| toml_edit | 0.19.15 |  | https://github.com/toml-rs/toml |
| toml_edit | 0.20.2 |  | https://github.com/toml-rs/toml |
| toml_edit | 0.25.17+spec-1.1.0 |  | https://github.com/toml-rs/toml |
| toml_parser | 1.1.5+spec-1.1.0 |  | https://github.com/toml-rs/toml |
| toml_writer | 1.1.3+spec-1.1.0 |  | https://github.com/toml-rs/toml |
| tray-icon | 0.25.1 |  | https://github.com/tauri-apps/tray-icon |
| ttf-parser | 0.24.1 |  | https://github.com/RazrFalcon/ttf-parser |
| ttf-parser | 0.25.1 |  | https://github.com/harfbuzz/ttf-parser |
| typed-path | 0.13.0 |  | https://github.com/chipsenkbeil/typed-path |
| typeid | 1.0.3 |  | https://github.com/dtolnay/typeid |
| typenum | 1.20.1 |  | https://github.com/paholg/typenum |
| unicase | 2.9.0 |  | https://github.com/seanmonstar/unicase |
| unicase | 2.10.0 |  | https://github.com/seanmonstar/unicase |
| unicode-bidi | 0.3.18 |  | https://github.com/servo/unicode-bidi |
| unicode-bidi-mirroring | 0.3.0 |  | https://github.com/RazrFalcon/unicode-bidi-mirroring |
| unicode-ccc | 0.3.0 |  | https://github.com/RazrFalcon/unicode-ccc |
| unicode-normalization | 0.1.25 |  | https://github.com/unicode-rs/unicode-normalization |
| unicode-properties | 0.1.4 |  | https://github.com/unicode-rs/unicode-properties |
| unicode-script | 0.5.8 | Copyright 2021 The Unicode-rs Developers | https://github.com/unicode-rs/unicode-script |
| unicode-script | 0.5.9 | Copyright 2021 The Unicode-rs Developers | https://github.com/unicode-rs/unicode-script |
| unicode-segmentation | 1.13.3 |  | https://github.com/unicode-rs/unicode-segmentation |
| unicode-vo | 0.1.0 |  | https://github.com/RazrFalcon/unicode-vo |
| unicode-width | 0.2.2 |  | https://github.com/unicode-rs/unicode-width |
| unicode-width | 0.2.3 |  | https://github.com/unicode-rs/unicode-width |
| url | 2.5.8 |  | https://github.com/servo/rust-url |
| utf-8 | 0.7.6 |  | https://github.com/SimonSapin/rust-utf8 |
| vcpkg | 0.2.15 |  | https://github.com/mcgoo/vcpkg-rs |
| version_check | 0.9.5 |  | https://github.com/SergioBenitez/version_check |
| wasm-bindgen | 0.2.127 |  | https://github.com/wasm-bindgen/wasm-bindgen |
| wasm-bindgen | 0.2.130 |  | https://github.com/wasm-bindgen/wasm-bindgen |
| wasm-bindgen-futures | 0.4.80 |  | https://github.com/wasm-bindgen/wasm-bindgen/tree/master/crates/futures |
| wasm-bindgen-macro | 0.2.127 |  | https://github.com/wasm-bindgen/wasm-bindgen/tree/master/crates/macro |
| wasm-bindgen-macro | 0.2.130 |  | https://github.com/wasm-bindgen/wasm-bindgen/tree/master/crates/macro |
| wasm-bindgen-macro-support | 0.2.127 |  | https://github.com/wasm-bindgen/wasm-bindgen/tree/master/crates/macro-support |
| wasm-bindgen-macro-support | 0.2.130 |  | https://github.com/wasm-bindgen/wasm-bindgen/tree/main/crates/macro-support |
| wasm-bindgen-shared | 0.2.127 |  | https://github.com/wasm-bindgen/wasm-bindgen/tree/master/crates/shared |
| wasm-bindgen-shared | 0.2.130 |  | https://github.com/wasm-bindgen/wasm-bindgen/tree/master/crates/shared |
| wasm-streams | 0.5.0 |  | https://github.com/MattiasBuelens/wasm-streams/ |
| web_atoms | 0.2.6 |  | https://github.com/servo/html5ever |
| web-sys | 0.3.107 |  | https://github.com/wasm-bindgen/wasm-bindgen/tree/master/crates/web-sys |
| web-time | 1.1.0 | Copyright 2023 dAxpeDDa | https://github.com/daxpedda/web-time |
| weezl | 0.1.12 |  | https://github.com/image-rs/weezl |
| winapi | 0.3.9 |  | https://github.com/retep998/winapi-rs |
| winapi-i686-pc-windows-gnu | 0.4.0 |  | https://github.com/retep998/winapi-rs |
| winapi-x86_64-pc-windows-gnu | 0.4.0 |  | https://github.com/retep998/winapi-rs |
| windows | 0.62.2 | Copyright (c) Microsoft Corporation. | https://github.com/microsoft/windows-rs |
| windows_aarch64_gnullvm | 0.42.2 | Copyright (c) Microsoft Corporation. | https://github.com/microsoft/windows-rs |
| windows_aarch64_gnullvm | 0.52.6 | Copyright (c) Microsoft Corporation. | https://github.com/microsoft/windows-rs |
| windows_aarch64_msvc | 0.42.2 | Copyright (c) Microsoft Corporation. | https://github.com/microsoft/windows-rs |
| windows_aarch64_msvc | 0.52.6 | Copyright (c) Microsoft Corporation. | https://github.com/microsoft/windows-rs |
| windows_i686_gnu | 0.42.2 | Copyright (c) Microsoft Corporation. | https://github.com/microsoft/windows-rs |
| windows_i686_gnu | 0.52.6 | Copyright (c) Microsoft Corporation. | https://github.com/microsoft/windows-rs |
| windows_i686_gnullvm | 0.52.6 | Copyright (c) Microsoft Corporation. | https://github.com/microsoft/windows-rs |
| windows_i686_msvc | 0.42.2 | Copyright (c) Microsoft Corporation. | https://github.com/microsoft/windows-rs |
| windows_i686_msvc | 0.52.6 | Copyright (c) Microsoft Corporation. | https://github.com/microsoft/windows-rs |
| windows_x86_64_gnu | 0.42.2 | Copyright (c) Microsoft Corporation. | https://github.com/microsoft/windows-rs |
| windows_x86_64_gnu | 0.52.6 | Copyright (c) Microsoft Corporation. | https://github.com/microsoft/windows-rs |
| windows_x86_64_gnullvm | 0.42.2 | Copyright (c) Microsoft Corporation. | https://github.com/microsoft/windows-rs |
| windows_x86_64_gnullvm | 0.52.6 | Copyright (c) Microsoft Corporation. | https://github.com/microsoft/windows-rs |
| windows_x86_64_msvc | 0.42.2 | Copyright (c) Microsoft Corporation. | https://github.com/microsoft/windows-rs |
| windows_x86_64_msvc | 0.52.6 | Copyright (c) Microsoft Corporation. | https://github.com/microsoft/windows-rs |
| windows-collections | 0.3.2 | Copyright (c) Microsoft Corporation. | https://github.com/microsoft/windows-rs |
| windows-core | 0.62.2 | Copyright (c) Microsoft Corporation. | https://github.com/microsoft/windows-rs |
| windows-future | 0.3.2 | Copyright (c) Microsoft Corporation. | https://github.com/microsoft/windows-rs |
| windows-implement | 0.60.2 | Copyright (c) Microsoft Corporation. | https://github.com/microsoft/windows-rs |
| windows-interface | 0.59.3 | Copyright (c) Microsoft Corporation. | https://github.com/microsoft/windows-rs |
| windows-link | 0.2.1 | Copyright (c) Microsoft Corporation. | https://github.com/microsoft/windows-rs |
| windows-numerics | 0.3.1 | Copyright (c) Microsoft Corporation. | https://github.com/microsoft/windows-rs |
| windows-registry | 0.6.1 | Copyright (c) Microsoft Corporation. | https://github.com/microsoft/windows-rs |
| windows-result | 0.4.1 | Copyright (c) Microsoft Corporation. | https://github.com/microsoft/windows-rs |
| windows-strings | 0.5.1 | Copyright (c) Microsoft Corporation. | https://github.com/microsoft/windows-rs |
| windows-sys | 0.45.0 | Copyright (c) Microsoft Corporation. | https://github.com/microsoft/windows-rs |
| windows-sys | 0.52.0 | Copyright (c) Microsoft Corporation. | https://github.com/microsoft/windows-rs |
| windows-sys | 0.61.2 | Copyright (c) Microsoft Corporation. | https://github.com/microsoft/windows-rs |
| windows-targets | 0.42.2 | Copyright (c) Microsoft Corporation. | https://github.com/microsoft/windows-rs |
| windows-targets | 0.52.6 | Copyright (c) Microsoft Corporation. | https://github.com/microsoft/windows-rs |
| windows-threading | 0.2.1 | Copyright (c) Microsoft Corporation. | https://github.com/microsoft/windows-rs |
| windows-version | 0.1.7 | Copyright (c) Microsoft Corporation. | https://github.com/microsoft/windows-rs |
| xattr | 1.6.1 |  | https://github.com/Stebalien/xattr |
| xattr | 1.7.0 |  | https://github.com/Stebalien/xattr |
| xml5ever | 0.18.1 |  | https://github.com/servo/html5ever |

### MIT (164)

| Paquet | Version | Copyright | Source |
|---|---|---|---|
| aligned-vec | 0.6.4 | Copyright (c) 2022 sarah | https://github.com/sarah-ek/aligned-vec/ |
| arg_enum_proc_macro | 0.3.4 | Copyright (c) 2018 Luca Barbato | https://github.com/lu-zero/arg_enum_proc_macro |
| atk | 0.18.2 |  | https://github.com/gtk-rs/gtk3-rs |
| atk-sys | 0.18.2 |  | https://github.com/gtk-rs/gtk3-rs |
| av-scenechange | 0.14.1 | Copyright (c) 2019 Multimedia and Rust | https://github.com/rust-av/av-scenechange |
| block2 | 0.6.2 |  | https://github.com/madsmtm/objc2 |
| built | 0.7.7 | Copyright (c) 2017-2023 Lukas Lueg | https://github.com/lukaslueg/built |
| built | 0.8.1 | Copyright (c) 2017-2023 Lukas Lueg | https://github.com/lukaslueg/built |
| bytes | 1.12.1 | Copyright (c) 2018 Carl Lerche | https://github.com/tokio-rs/bytes |
| cairo-rs | 0.18.5 |  | https://github.com/gtk-rs/gtk-rs-core |
| cairo-sys-rs | 0.18.2 |  | https://github.com/gtk-rs/gtk-rs-core |
| calamine | 0.38.0 | Copyright (c) 2016 Johann Tuffe | https://github.com/tafia/calamine |
| cargo_metadata | 0.19.2 |  | https://github.com/oli-obk/cargo_metadata |
| cfb | 0.14.0 | Copyright (c) 2017 Matthew D. Steele | https://github.com/mdsteele/rust-cfb |
| cfg_aliases | 0.2.2 | Copyright (c) 2020 Katharos Technology | https://github.com/katharostech/cfg_aliases |
| color_quant | 1.1.0 | Copyright (c) 2016 PistonDevelopers | https://github.com/image-rs/color_quant.git |
| combine | 4.6.9 | Copyright (c) 2015 Markus Westerlind | https://github.com/Marwes/combine |
| core_maths | 0.1.1 | Copyright (c) 2024 Robert Bastian | https://github.com/robertbastian/core_maths |
| crunchy | 0.2.4 | Copyright 2017-2023 Eira Fransham. | https://github.com/eira-fransham/crunchy |
| darling | 0.24.1 | Copyright (c) 2017 Ted Driggs | https://github.com/TedDriggs/darling |
| darling_core | 0.24.1 | Copyright (c) 2017 Ted Driggs | https://github.com/TedDriggs/darling |
| darling_macro | 0.24.1 | Copyright (c) 2017 Ted Driggs | https://github.com/TedDriggs/darling |
| deflate64 | 0.1.12 | Copyright (c) .NET Foundation and Contributors | https://github.com/anatawa12/deflate64-rs |
| derive_more | 2.1.1 | Copyright (c) 2016 Jelte Fennema | https://github.com/JelteF/derive_more |
| derive_more-impl | 2.1.1 | Copyright (c) 2016 Jelte Fennema | https://github.com/JelteF/derive_more |
| dlopen2 | 0.8.2 |  | https://github.com/OpenByteDev/dlopen2 |
| dlopen2_derive | 0.4.3 |  | https://github.com/OpenByteDev/dlopen2 |
| dom_query | 0.28.0 | Copyright (c) 2023 Mykola Humanov | https://github.com/niklak/dom_query |
| ecb | 0.1.2 | Copyright (c) magic-akari | https://github.com/magic-akari/ecb |
| embed-resource | 3.0.12 | Copyright (c) 2017 nabijaczleweli | https://github.com/nabijaczleweli/rust-embed-resource |
| endi | 1.1.1 |  | https://github.com/zeenix/endi |
| equator | 0.4.2 | Copyright (c) 2023 sarah | https://github.com/sarah-ek/equator/ |
| equator-macro | 0.4.2 | Copyright (c) 2023 sarah | https://github.com/sarah-ek/equator/ |
| extended | 0.1.0 | Copyright 2022 Dietrich Epp | https://github.com/depp/extended-rs |
| fax | 0.2.7 | Copyright © 2021 The pdf-rs contributers. | https://github.com/pdf-rs/fax |
| float-cmp | 0.9.0 | Copyright (c) 2014-2020 Optimal Computing (NZ) Ltd | https://github.com/mikedilger/float-cmp |
| fontconfig-parser | 0.5.8 | Copyright (c) 2021 Riey | https://github.com/Riey/fontconfig-parser |
| fontdb | 0.22.0 | Copyright (c) 2020 Yevhenii Reizner | https://github.com/RazrFalcon/fontdb |
| gdk | 0.18.2 |  | https://github.com/gtk-rs/gtk3-rs |
| gdk-pixbuf | 0.18.5 |  | https://github.com/gtk-rs/gtk-rs-core |
| gdk-pixbuf-sys | 0.18.0 |  | https://github.com/gtk-rs/gtk-rs-core |
| gdk-sys | 0.18.2 |  | https://github.com/gtk-rs/gtk3-rs |
| gdkwayland-sys | 0.18.2 |  | https://github.com/gtk-rs/gtk3-rs |
| gdkx11 | 0.18.2 |  | https://github.com/gtk-rs/gtk3-rs |
| gdkx11-sys | 0.18.2 |  | https://github.com/gtk-rs/gtk3-rs |
| generic-array | 0.14.7 | Copyright (c) 2015 Bartłomiej Kamiński | https://github.com/fizyk20/generic-array.git |
| gio | 0.18.4 |  | https://github.com/gtk-rs/gtk-rs-core |
| gio-sys | 0.18.1 |  | https://github.com/gtk-rs/gtk-rs-core |
| glib | 0.18.5 |  | https://github.com/gtk-rs/gtk-rs-core |
| glib-macros | 0.18.5 |  | https://github.com/gtk-rs/gtk-rs-core |
| glib-sys | 0.18.1 |  | https://github.com/gtk-rs/gtk-rs-core |
| gobject-sys | 0.18.0 |  | https://github.com/gtk-rs/gtk-rs-core |
| gtk | 0.18.2 |  | https://github.com/gtk-rs/gtk3-rs |
| gtk-sys | 0.18.2 |  | https://github.com/gtk-rs/gtk3-rs |
| gtk3-macros | 0.18.2 |  | https://github.com/gtk-rs/gtk3-rs |
| http-body | 1.1.0 | Copyright (c) 2019-2026 Sean McArthur & Hyper Contributors | https://github.com/hyperium/http-body |
| http-body-util | 0.1.5 | Copyright (c) 2019-2026 Sean McArthur & Hyper Contributors | https://github.com/hyperium/http-body |
| hyper | 1.12.0 | Copyright (c) 2014-2026 Sean McArthur | https://github.com/hyperium/hyper |
| hyper-util | 0.1.21 | Copyright (c) 2023-2025 Sean McArthur | https://github.com/hyperium/hyper-util |
| ico | 0.6.0 | Copyright (c) 2018 Matthew D. Steele | https://github.com/mdsteele/rust-ico |
| imagesize | 0.13.0 | Copyright (c) 2017 Maiddog | https://github.com/Roughsketch/imagesize |
| infer | 0.22.0 | Copyright (c) 2019 Bojan | https://github.com/bojand/infer |
| interpolate_name | 0.2.4 | Copyright (c) 2018 Luca Barbato | https://github.com/lu-zero/interpolate_name |
| javascriptcore-rs | 1.1.2 | Copyright (c) 2013-2021, The Gtk-rs Project Developers. | https://github.com/tauri-apps/javascriptcore-rs |
| javascriptcore-rs-sys | 1.1.1 | Copyright (c) 2013-2017, The Gtk-rs Project Developers. | https://github.com/tauri-apps/javascriptcore-rs |
| libm | 0.2.16 | Copyright (c) 2018 Jorge Aparicio | https://github.com/rust-lang/compiler-builtins |
| libredox | 0.1.25 | Copyright (c) 2023 4lDO2 | https://gitlab.redox-os.org/redox-os/libredox.git |
| libsqlite3-sys | 0.39.1 | Copyright (c) 2014 The rusqlite developers | https://github.com/rusqlite/rusqlite |
| loop9 | 0.1.5 |  | https://gitlab.com/kornelski/loop9.git |
| lopdf | 0.42.0 | Copyright (c) 2016 Junfeng Liu | https://github.com/J-F-Liu/lopdf.git |
| maybe-rayon | 0.1.1 | Copyright (c) 2021 Joshua Holmer | https://github.com/shssoichiro/maybe-rayon |
| memoffset | 0.9.1 | Copyright (c) 2017 Gilad Naaman | https://github.com/Gilnaa/memoffset |
| minisign-verify | 0.3.0 | Copyright (c) 2019-2025 Frank Denis | https://github.com/jedisct1/rust-minisign-verify |
| mio | 1.2.4 | Copyright (c) 2014 Carl Lerche and other MIO contributors | https://github.com/tokio-rs/mio |
| new_debug_unreachable | 1.0.6 | Copyright (c) 2015 Jonathan Reem | https://github.com/mbrubeck/rust-debug-unreachable |
| nix | 0.31.3 | Copyright (c) 2015 Carl Lerche + nix-rust Authors | https://github.com/nix-rust/nix |
| nom | 8.0.0 | Copyright (c) 2014-2019 Geoffroy Couprie | https://github.com/rust-bakery/nom |
| noop_proc_macro | 0.3.0 | Copyright (c) 2019 Luca Barbato | https://github.com/lu-zero/noop_proc_macro |
| objc2 | 0.6.5 |  | https://github.com/madsmtm/objc2 |
| objc2-encode | 4.1.0 |  | https://github.com/madsmtm/objc2 |
| objc2-foundation | 0.3.2 |  | https://github.com/madsmtm/objc2 |
| pango | 0.18.3 |  | https://github.com/gtk-rs/gtk-rs-core |
| pango-sys | 0.18.0 |  | https://github.com/gtk-rs/gtk-rs-core |
| phf | 0.11.3 | Copyright (c) 2014-2022 Steven Fackler, Yuki Okushi | https://github.com/rust-phf/rust-phf |
| phf | 0.13.1 | Copyright (c) 2014-2022 Steven Fackler, Yuki Okushi | https://github.com/rust-phf/rust-phf |
| phf_codegen | 0.11.3 | Copyright (c) 2014-2022 Steven Fackler, Yuki Okushi | https://github.com/rust-phf/rust-phf |
| phf_codegen | 0.13.1 | Copyright (c) 2014-2022 Steven Fackler, Yuki Okushi | https://github.com/rust-phf/rust-phf |
| phf_generator | 0.11.3 | Copyright (c) 2014-2022 Steven Fackler, Yuki Okushi | https://github.com/rust-phf/rust-phf |
| phf_generator | 0.13.1 | Copyright (c) 2014-2022 Steven Fackler, Yuki Okushi | https://github.com/rust-phf/rust-phf |
| phf_macros | 0.13.1 | Copyright (c) 2014-2022 Steven Fackler, Yuki Okushi | https://github.com/rust-phf/rust-phf |
| phf_shared | 0.11.3 | Copyright (c) 2014-2022 Steven Fackler, Yuki Okushi | https://github.com/rust-phf/rust-phf |
| phf_shared | 0.13.1 | Copyright (c) 2014-2022 Steven Fackler, Yuki Okushi | https://github.com/rust-phf/rust-phf |
| pico-args | 0.5.0 | Copyright (c) 2019 Yevhenii Reizner | https://github.com/RazrFalcon/pico-args |
| plist | 1.10.3 | Copyright (c) 2015 Edward Barnard | https://github.com/ebarnard/rust-plist/ |
| precomputed-hash | 0.1.1 | Copyright (c) 2017 Emilio Cobos Álvarez | https://github.com/emilio/precomputed-hash |
| pulldown-cmark | 0.11.3 | Copyright 2015 Google Inc. All rights reserved. | https://github.com/raphlinus/pulldown-cmark |
| pulldown-cmark-escape | 0.11.0 | Copyright 2015 Google Inc. All rights reserved. | https://github.com/raphlinus/pulldown-cmark |
| pulp | 0.22.3 | Copyright (c) 2021 sarah | https://github.com/sarah-quinones/pulp/ |
| pulp-wasm-simd-flag | 0.1.1 |  | https://github.com/sarah-quinones/pulp/ |
| quick-xml | 0.41.0 | Copyright (c) 2016 Johann Tuffe | https://github.com/tafia/quick-xml |
| quick-xml | 0.42.0 | Copyright (c) 2016 Johann Tuffe | https://github.com/tafia/quick-xml |
| raw-cpuid | 11.6.0 | Copyright (c) 2015 Gerd Zellweger | https://github.com/gz/rust-cpuid |
| reborrow | 0.5.5 | Copyright (c) 2022 sarah | https://github.com/sarah-ek/reborrow/ |
| redox_syscall | 0.5.18 | Copyright (c) 2017 Redox OS Developers | https://gitlab.redox-os.org/redox-os/syscall |
| redox_users | 0.5.3 | Copyright (c) 2017 Jose Narvaez | https://gitlab.redox-os.org/redox-os/users |
| rfd | 0.17.2 | Copyright (c) 2022 Bartłomiej Maryńczak | https://github.com/PolyMeilex/rfd |
| rgb | 0.8.53 | Copyright (c) 2019 Kornel | https://github.com/kornelski/rust-rgb |
| rsqlite-vfs | 0.2.0 |  | https://github.com/Spxg/sqlite-wasm-rs |
| rusqlite | 0.41.1 | Copyright (c) 2014 The rusqlite developers | https://github.com/rusqlite/rusqlite |
| rustybuzz | 0.18.0 | Copyright (c) HarfBuzz developers | https://github.com/RazrFalcon/rustybuzz |
| schannel | 0.1.30 | Copyright (c) 2015 steffengy | https://github.com/steffengy/schannel-rs |
| schemars | 0.8.22 | Copyright (c) 2019 Graham Esau | https://github.com/GREsau/schemars |
| schemars | 0.9.0 | Copyright (c) 2019 Graham Esau | https://github.com/GREsau/schemars |
| schemars | 1.2.3 | Copyright (c) 2019 Graham Esau | https://github.com/GREsau/schemars |
| schemars_derive | 0.8.22 | Copyright (c) 2019 Graham Esau | https://github.com/GREsau/schemars |
| simd_helpers | 0.1.0 |  | https://github.com/lu-zero/simd_helpers |
| simd-adler32 | 0.3.10 | Copyright (c) [2021] [Marvin Countryman] | https://github.com/mcountryman/simd-adler32 |
| slab | 0.4.12 | Copyright (c) 2019 Carl Lerche | https://github.com/tokio-rs/slab |
| soup3 | 0.5.0 | Copyright (c) 2013-2017, The Gtk-rs Project Developers. | https://gitlab.gnome.org/World/Rust/soup3-rs |
| soup3-sys | 0.5.0 | Copyright (c) 2013-2017, The Gtk-rs Project Developers. | https://gitlab.gnome.org/World/Rust/soup3-rs |
| sqlite-wasm-rs | 0.6.2 | Copyright (c) 2024 Spxg | https://github.com/Spxg/sqlite-wasm-rs |
| strict-num | 0.1.1 | Copyright (c) 2022 Yevhenii Reizner | https://github.com/RazrFalcon/strict-num |
| strsim | 0.11.1 | Copyright (c) 2015 Danny Guo | https://github.com/rapidfuzz/strsim-rs |
| synstructure | 0.14.0 | Copyright 2016 Nika Layzell | https://github.com/mystor/synstructure |
| tauri-winres | 0.3.7 | Copyright (c) 2023 - Present Tauri Apps Contributors | https://github.com/tauri-apps/winres |
| tiff | 0.11.3 | Copyright (c) 2018 PistonDevelopers | https://github.com/image-rs/image-tiff |
| tokio | 1.54.1 | Copyright (c) Tokio Contributors | https://github.com/tokio-rs/tokio |
| tokio-util | 0.7.20 | Copyright (c) Tokio Contributors | https://github.com/tokio-rs/tokio |
| tower | 0.5.3 | Copyright (c) 2019 Tower Contributors | https://github.com/tower-rs/tower |
| tower-http | 0.6.11 | Copyright (c) 2019-2021 Tower Contributors | https://github.com/tower-rs/tower-http |
| tower-layer | 0.3.3 | Copyright (c) 2019 Tower Contributors | https://github.com/tower-rs/tower |
| tower-service | 0.3.3 | Copyright (c) 2019 Tower Contributors | https://github.com/tower-rs/tower |
| tracing | 0.1.44 | Copyright (c) 2019 Tokio Contributors | https://github.com/tokio-rs/tracing |
| tracing-attributes | 0.1.31 | Copyright (c) 2019 Tokio Contributors | https://github.com/tokio-rs/tracing |
| tracing-core | 0.1.36 | Copyright (c) 2019 Tokio Contributors | https://github.com/tokio-rs/tracing |
| try-lock | 0.2.5 | Copyright (c) 2018-2023 Sean McArthur | https://github.com/seanmonstar/try-lock |
| uds_windows | 1.2.1 | Copyright (c) Microsoft Corporation. All rights reserved. | https://github.com/haraldh/rust_uds_windows |
| unsafe-libyaml | 0.2.11 |  | https://github.com/dtolnay/unsafe-libyaml |
| urlpattern | 0.6.0 | Copyright (c) 2021 the Deno authors | https://github.com/denoland/rust-urlpattern |
| version-compare | 0.2.1 | Copyright (c) 2017 Tim Visée | https://gitlab.com/timvisee/version-compare |
| vswhom | 0.1.0 | Copyright (c) 2019 nabijaczleweli | https://github.com/nabijaczleweli/vswhom.rs |
| vswhom-sys | 0.1.3 | Copyright (c) 2019 nabijaczleweli | https://github.com/nabijaczleweli/vswhom-sys.rs |
| want | 0.3.2 | Copyright (c) 2018-2019 Sean McArthur | https://github.com/seanmonstar/want |
| webkit2gtk | 2.0.2 | Copyright (c) 2016 Boucher, Antoni <bouanto@zoho.com> | https://github.com/tauri-apps/webkit2gtk-rs |
| webkit2gtk-sys | 2.0.2 | Copyright (c) 2016 Boucher, Antoni <bouanto@zoho.com> | https://github.com/tauri-apps/webkit2gtk-rs |
| webview2-com | 0.39.1 |  | https://github.com/wravery/webview2-rs |
| webview2-com-macros | 0.8.1 |  | https://github.com/wravery/webview2-rs |
| webview2-com-sys | 0.39.1 |  | https://github.com/wravery/webview2-rs |
| winnow | 0.5.40 |  | https://github.com/winnow-rs/winnow |
| winnow | 1.0.4 |  | https://github.com/winnow-rs/winnow |
| winreg | 0.56.0 | Copyright (c) 2015 Igor Shaula | https://github.com/gentoo90/winreg-rs |
| x11 | 2.21.0 |  | https://github.com/AltF02/x11-rs.git |
| x11-dl | 2.21.0 |  | https://github.com/AltF02/x11-rs.git |
| xmlwriter | 0.1.0 | Copyright (c) 2019 Reizner Evgeniy | https://github.com/RazrFalcon/xmlwriter |
| y4m | 0.8.0 | Copyright (c) 2015-2019 PistonDevelopers | https://github.com/image-rs/y4m.git |
| zbus | 5.19.0 | Copyright (c) 2024 Zeeshan Ali Khan & zbus contributors | https://github.com/z-galaxy/zbus/ |
| zbus_macros | 5.19.0 | Copyright (c) 2024 Zeeshan Ali Khan & zbus contributors | https://github.com/z-galaxy/zbus/ |
| zbus_names | 4.3.5 | Copyright (c) 2024 Zeeshan Ali Khan & zbus contributors | https://github.com/z-galaxy/zbus/ |
| zcheapstr | 1.2.0 | Copyright (c) 2026 Zeeshan Ali Khan & zcheapstr contributors | https://github.com/z-galaxy/zcheapstr/ |
| zip | 9.3.0 | Copyright (c) 2014 Mathijs van de Nes | https://github.com/zip-rs/zip2 |
| zmij | 1.0.23 |  | https://github.com/dtolnay/zmij |
| zvariant | 5.15.1 | Copyright (c) 2024 Zeeshan Ali Khan & zbus contributors | https://github.com/z-galaxy/zbus/ |
| zvariant_derive | 5.15.1 | Copyright (c) 2024 Zeeshan Ali Khan & zbus contributors | https://github.com/z-galaxy/zbus/ |
| zvariant_utils | 4.2.0 |  | https://github.com/z-galaxy/zbus/ |

### Apache-2.0 OR MIT (71)

| Paquet | Version | Copyright | Source |
|---|---|---|---|
| async-channel | 2.5.0 |  | https://github.com/smol-rs/async-channel |
| async-executor | 1.14.1 |  | https://github.com/smol-rs/async-executor |
| async-io | 2.6.0 |  | https://github.com/smol-rs/async-io |
| async-lock | 3.5.0 |  | https://github.com/smol-rs/async-lock |
| async-process | 2.5.0 |  | https://github.com/smol-rs/async-process |
| async-signal | 0.2.14 |  | https://github.com/smol-rs/async-signal |
| async-task | 4.7.1 |  | https://github.com/smol-rs/async-task |
| atomic-waker | 1.1.2 |  | https://github.com/smol-rs/atomic-waker |
| autocfg | 1.5.1 |  | https://github.com/cuviper/autocfg |
| bit_field | 0.10.3 |  | https://github.com/phil-opp/rust-bit-field |
| bit-set | 0.8.0 |  | https://github.com/contain-rs/bit-set |
| bit-vec | 0.8.0 |  | https://github.com/contain-rs/bit-vec |
| blocking | 1.7.0 |  | https://github.com/smol-rs/blocking |
| cargo_toml | 1.0.1 |  | https://gitlab.com/lib.rs/cargo_toml |
| cesu8 | 1.1.0 |  | https://github.com/emk/cesu8-rs |
| cmov | 0.5.4 |  | https://github.com/RustCrypto/utils |
| codepage | 0.1.2 |  | https://github.com/hsivonen/codepage |
| codepage | 0.1.3 |  | https://github.com/hsivonen/codepage |
| concurrent-queue | 2.5.0 |  | https://github.com/smol-rs/concurrent-queue |
| const-oid | 0.10.2 |  | https://github.com/RustCrypto/formats |
| ctor | 1.0.13 |  | https://github.com/mmastrac/linktime |
| ctutils | 0.4.5 |  | https://github.com/RustCrypto/utils |
| ctutils | 0.4.8 |  | https://github.com/RustCrypto/utils |
| dbus | 0.9.12 | Copyright 2014-2018 David Henningsson <diwic@ubuntu.com> and other contributors | https://github.com/diwic/dbus-rs |
| equivalent | 1.0.2 |  | https://github.com/indexmap-rs/equivalent |
| equivalent | 1.0.3 |  | https://github.com/indexmap-rs/equivalent |
| event-listener | 5.4.2 |  | https://github.com/smol-rs/event-listener |
| event-listener-strategy | 0.5.4 |  | https://github.com/smol-rs/event-listener-strategy |
| fastrand | 2.5.0 |  | https://github.com/smol-rs/fastrand |
| fnv | 1.0.7 |  | https://github.com/servo/rust-fnv |
| futures-lite | 2.6.1 |  | https://github.com/smol-rs/futures-lite |
| idna_adapter | 1.2.2 |  | https://github.com/hsivonen/idna_adapter |
| indexmap | 1.9.3 |  | https://github.com/bluss/indexmap |
| indexmap | 2.14.0 |  | https://github.com/indexmap-rs/indexmap |
| indexmap | 2.14.2 |  | https://github.com/indexmap-rs/indexmap |
| kurbo | 0.11.3 |  | https://github.com/linebender/kurbo |
| libappindicator | 0.9.0 |  |  |
| libappindicator-sys | 0.9.0 |  |  |
| libdbus-sys | 0.2.7 | Copyright 2014-2018 David Henningsson <diwic@ubuntu.com> and other contributors | https://github.com/diwic/dbus-rs |
| muda | 0.20.0 |  | https://github.com/tauri-apps/muda |
| multiversion_no_op | 1.0.0 |  | https://github.com/hsivonen/multiversion_no_op |
| no_std_io2 | 0.9.4 |  | https://github.com/wcampbell0x2a/no-std-io2 |
| parking | 2.2.1 |  | https://github.com/smol-rs/parking |
| pin-project-lite | 0.2.17 |  | https://github.com/taiki-e/pin-project-lite |
| polling | 3.11.0 |  | https://github.com/smol-rs/polling |
| portable-atomic | 1.15.0 |  | https://github.com/taiki-e/portable-atomic |
| portable-atomic-util | 0.2.7 |  | https://github.com/taiki-e/portable-atomic-util |
| portable-atomic-util | 0.2.8 |  | https://github.com/taiki-e/portable-atomic-util |
| rustc-hash | 2.1.3 |  | https://github.com/rust-lang/rustc-hash |
| simd_cesu8 | 1.2.0 |  | https://github.com/seancroach/simd_cesu8 |
| simplecss | 0.2.2 |  | https://github.com/linebender/simplecss |
| svgtypes | 0.15.3 |  | https://github.com/linebender/svgtypes |
| tauri | 2.12.5 |  | https://github.com/tauri-apps/tauri |
| tauri-build | 2.7.4 |  | https://github.com/tauri-apps/tauri |
| tauri-codegen | 2.7.4 |  | https://github.com/tauri-apps/tauri |
| tauri-macros | 2.7.4 |  | https://github.com/tauri-apps/tauri |
| tauri-plugin | 2.7.2 |  | https://github.com/tauri-apps/tauri |
| tauri-plugin-dialog | 2.8.4 | PackageCopyrightText: 2019-2022, The Tauri Programme in the Commons Conservancy | https://github.com/tauri-apps/plugins-workspace |
| tauri-plugin-fs | 2.7.1 | PackageCopyrightText: 2019-2022, The Tauri Programme in the Commons Conservancy | https://github.com/tauri-apps/plugins-workspace |
| tauri-plugin-single-instance | 2.5.5 | PackageCopyrightText: 2019-2022, The Tauri Programme in the Commons Conservancy | https://github.com/tauri-apps/plugins-workspace |
| tauri-plugin-updater | 2.14.1 | PackageCopyrightText: 2019-2022, The Tauri Programme in the Commons Conservancy | https://github.com/tauri-apps/plugins-workspace |
| tauri-runtime | 2.12.2 |  | https://github.com/tauri-apps/tauri |
| tauri-runtime-wry | 2.12.3 |  | https://github.com/tauri-apps/tauri |
| tauri-utils | 2.10.2 |  | https://github.com/tauri-apps/tauri |
| utf_types | 1.0.0 |  | https://github.com/hsivonen/utf_types |
| utf8_iter | 1.1.0 |  | https://github.com/hsivonen/utf8_iter |
| uuid | 1.29.0 |  | https://github.com/uuid-rs/uuid |
| window-vibrancy | 0.8.1 |  | https://github.com/tauri-apps/tauri-plugin-vibrancy |
| wry | 0.57.1 |  | https://github.com/tauri-apps/wry |
| zeroize | 1.9.0 |  | https://github.com/RustCrypto/utils |
| zeroize | 1.9.1 |  | https://github.com/RustCrypto/utils |

### MPL-2.0 (21)

| Paquet | Version | Copyright | Source |
|---|---|---|---|
| cssparser | 0.37.0 |  | https://github.com/servo/rust-cssparser |
| cssparser-macros | 0.7.1 |  | https://github.com/servo/rust-cssparser |
| dtoa-short | 0.3.5 |  | https://github.com/upsuper/dtoa-short |
| option-ext | 0.2.0 |  | https://github.com/soc/option-ext.git |
| resvg | 0.44.0 |  | https://github.com/RazrFalcon/resvg |
| selectors | 0.38.0 |  | https://github.com/servo/stylo |
| symphonia | 0.5.5 |  | https://github.com/pdeljanov/Symphonia |
| symphonia-bundle-flac | 0.5.5 |  | https://github.com/pdeljanov/Symphonia |
| symphonia-bundle-mp3 | 0.5.5 |  | https://github.com/pdeljanov/Symphonia |
| symphonia-codec-aac | 0.5.5 |  | https://github.com/pdeljanov/Symphonia |
| symphonia-codec-adpcm | 0.5.5 |  | https://github.com/pdeljanov/Symphonia |
| symphonia-codec-pcm | 0.5.5 |  | https://github.com/pdeljanov/Symphonia |
| symphonia-codec-vorbis | 0.5.5 |  | https://github.com/pdeljanov/Symphonia |
| symphonia-core | 0.5.5 |  | https://github.com/pdeljanov/Symphonia |
| symphonia-format-isomp4 | 0.5.5 |  | https://github.com/pdeljanov/Symphonia |
| symphonia-format-mkv | 0.5.5 |  | https://github.com/pdeljanov/Symphonia |
| symphonia-format-ogg | 0.5.5 |  | https://github.com/pdeljanov/Symphonia |
| symphonia-format-riff | 0.5.5 |  | https://github.com/pdeljanov/Symphonia |
| symphonia-metadata | 0.5.5 |  | https://github.com/pdeljanov/Symphonia |
| symphonia-utils-xiph | 0.5.5 |  | https://github.com/pdeljanov/Symphonia |
| usvg | 0.44.0 |  | https://github.com/RazrFalcon/resvg |

### Zlib OR Apache-2.0 OR MIT (19)

| Paquet | Version | Copyright | Source |
|---|---|---|---|
| bytemuck | 1.25.2 | (c) You must retain, in the Source form of any Derivative Works that You distribute, all copyright, patent, trademark, and attribution notices from the Source f | https://github.com/Lokathor/bytemuck |
| dispatch2 | 0.3.1 |  | https://github.com/madsmtm/objc2 |
| objc2-app-kit | 0.3.2 |  | https://github.com/madsmtm/objc2 |
| objc2-cloud-kit | 0.3.2 |  | https://github.com/madsmtm/objc2 |
| objc2-core-data | 0.3.2 |  | https://github.com/madsmtm/objc2 |
| objc2-core-foundation | 0.3.2 |  | https://github.com/madsmtm/objc2 |
| objc2-core-graphics | 0.3.2 |  | https://github.com/madsmtm/objc2 |
| objc2-core-image | 0.3.2 |  | https://github.com/madsmtm/objc2 |
| objc2-core-location | 0.3.2 |  | https://github.com/madsmtm/objc2 |
| objc2-core-text | 0.3.2 |  | https://github.com/madsmtm/objc2 |
| objc2-exception-helper | 0.1.1 |  | https://github.com/madsmtm/objc2 |
| objc2-io-surface | 0.3.2 |  | https://github.com/madsmtm/objc2 |
| objc2-osa-kit | 0.3.2 |  | https://github.com/madsmtm/objc2 |
| objc2-quartz-core | 0.3.2 |  | https://github.com/madsmtm/objc2 |
| objc2-ui-kit | 0.3.2 |  | https://github.com/madsmtm/objc2 |
| objc2-user-notifications | 0.3.2 |  | https://github.com/madsmtm/objc2 |
| objc2-web-kit | 0.3.2 |  | https://github.com/madsmtm/objc2 |
| tinyvec | 1.12.0 |  | https://github.com/Lokathor/tinyvec |
| tinyvec | 1.13.3 |  | https://github.com/Lokathor/tinyvec |

### Unicode-3.0 (18)

| Paquet | Version | Copyright | Source |
|---|---|---|---|
| icu_collections | 2.4.0 | Copyright © 2020-2024 Unicode, Inc. | https://github.com/unicode-org/icu4x |
| icu_locale_core | 2.4.0 | Copyright © 2020-2024 Unicode, Inc. | https://github.com/unicode-org/icu4x |
| icu_normalizer | 2.4.0 | Copyright © 2020-2024 Unicode, Inc. | https://github.com/unicode-org/icu4x |
| icu_normalizer_data | 2.4.0 | Copyright © 2020-2024 Unicode, Inc. | https://github.com/unicode-org/icu4x |
| icu_properties | 2.4.0 | Copyright © 2020-2024 Unicode, Inc. | https://github.com/unicode-org/icu4x |
| icu_properties_data | 2.4.0 | Copyright © 2020-2024 Unicode, Inc. | https://github.com/unicode-org/icu4x |
| icu_provider | 2.4.0 | Copyright © 2020-2024 Unicode, Inc. | https://github.com/unicode-org/icu4x |
| litemap | 0.8.3 | Copyright © 2020-2024 Unicode, Inc. | https://github.com/unicode-org/icu4x |
| potential_utf | 0.1.6 | Copyright © 2020-2024 Unicode, Inc. | https://github.com/unicode-org/icu4x |
| tinystr | 0.8.5 | Copyright © 2020-2024 Unicode, Inc. | https://github.com/unicode-org/icu4x |
| writeable | 0.6.4 | Copyright © 2020-2024 Unicode, Inc. | https://github.com/unicode-org/icu4x |
| yoke | 0.8.4 | Copyright © 2020-2024 Unicode, Inc. | https://github.com/unicode-org/icu4x |
| yoke-derive | 0.8.4 | Copyright © 2020-2024 Unicode, Inc. | https://github.com/unicode-org/icu4x |
| zerofrom | 0.1.8 | Copyright © 2020-2024 Unicode, Inc. | https://github.com/unicode-org/icu4x |
| zerofrom-derive | 0.1.8 | Copyright © 2020-2024 Unicode, Inc. | https://github.com/unicode-org/icu4x |
| zerotrie | 0.2.5 | Copyright © 2020-2024 Unicode, Inc. | https://github.com/unicode-org/icu4x |
| zerovec | 0.11.9 | Copyright © 2020-2024 Unicode, Inc. | https://github.com/unicode-org/icu4x |
| zerovec-derive | 0.11.7 | Copyright © 2020-2024 Unicode, Inc. | https://github.com/unicode-org/icu4x |

### Unlicense OR MIT (18)

| Paquet | Version | Copyright | Source |
|---|---|---|---|
| aho-corasick | 1.1.5 |  | https://github.com/BurntSushi/aho-corasick |
| byteorder | 1.5.0 |  | https://github.com/BurntSushi/byteorder |
| byteorder-lite | 0.1.0 | Copyright (c) 2015 Andrew Gallant | https://github.com/image-rs/byteorder-lite |
| csv | 1.4.0 |  | https://github.com/BurntSushi/rust-csv |
| csv-core | 0.1.13 |  | https://github.com/BurntSushi/rust-csv |
| jiff | 0.2.35 |  | https://github.com/BurntSushi/jiff |
| jiff | 0.2.39 |  | https://github.com/BurntSushi/jiff |
| jiff-core | 0.1.0 |  | https://github.com/BurntSushi/jiff |
| jiff-core | 0.1.2 |  | https://github.com/BurntSushi/jiff |
| jiff-static | 0.2.35 |  | https://github.com/BurntSushi/jiff |
| jiff-static | 0.2.39 |  | https://github.com/BurntSushi/jiff |
| jiff-tzdb | 0.1.8 |  | https://github.com/BurntSushi/jiff |
| jiff-tzdb | 0.1.9 |  | https://github.com/BurntSushi/jiff |
| jiff-tzdb-platform | 0.1.3 |  | https://github.com/BurntSushi/jiff |
| memchr | 2.8.3 |  | https://github.com/BurntSushi/memchr |
| same-file | 1.0.6 |  | https://github.com/BurntSushi/same-file |
| walkdir | 2.5.0 |  | https://github.com/BurntSushi/walkdir |
| winapi-util | 0.1.11 |  | https://github.com/BurntSushi/winapi-util |

### Apache-2.0 (12)

| Paquet | Version | Copyright | Source |
|---|---|---|---|
| flacenc | 0.4.0 |  | https://github.com/yotarok/flacenc-rs/ |
| hound | 3.5.1 |  | https://github.com/ruuda/hound |
| htmd | 0.1.6 |  | https://github.com/letmutex/htmd |
| lzma-rust2 | 0.20.0 |  | https://github.com/hasenbanck/lzma-rust2/ |
| lzma-rust2 | 0.20.1 |  | https://github.com/hasenbanck/lzma-rust2/ |
| lzma-rust2 | 0.24.0 |  | https://github.com/hasenbanck/lzma-rust2/ |
| sevenz-rust2 | 0.22.2 |  | https://github.com/hasenbanck/sevenz-rust |
| similar | 2.7.0 |  | https://github.com/mitsuhiko/similar |
| sync_wrapper | 1.0.2 |  | https://github.com/Actyx/sync_wrapper |
| tao | 0.37.2 |  | https://github.com/tauri-apps/tao |
| zopfli | 0.8.3 | Copyright 2011 Google Inc. | https://github.com/zopfli-rs/zopfli |
| zopfli | 0.8.4 | Copyright 2011 Google Inc. | https://github.com/zopfli-rs/zopfli |

### BSD-3-Clause (12)

| Paquet | Version | Copyright | Source |
|---|---|---|---|
| alloc-no-stdlib | 3.0.0 | Copyright (c) 2016 Dropbox, Inc. | https://github.com/dropbox/rust-alloc-no-stdlib |
| alloc-stdlib | 0.3.0 |  | https://github.com/dropbox/rust-alloc-no-stdlib |
| avif-serialize | 0.8.9 | Copyright (c) 2020, Cloudflare, Inc. | https://github.com/kornelski/avif-serialize |
| exr | 1.74.2 | Copyright (c) Contributors to the OpenEXR Project. All rights reserved. | https://github.com/johannesvollmer/exrs |
| lebe | 0.5.3 | Copyright (c) 2022 Contributors to the lebe Project. All rights reserved. | https://github.com/johannesvollmer/lebe |
| ravif | 0.13.0 | Copyright (c) 2020, Kornel | https://github.com/kornelski/cavif-rs |
| subtle | 2.6.1 | Copyright (c) 2016-2017 Isis Agora Lovecruft, Henry de Valence. All rights reserved. | https://github.com/dalek-cryptography/subtle |
| tiny-skia | 0.11.4 | Copyright (c) 2011 Google Inc. All rights reserved. | https://github.com/RazrFalcon/tiny-skia |
| tiny-skia-path | 0.11.4 | Copyright (c) 2011 Google Inc. All rights reserved. | https://github.com/RazrFalcon/tiny-skia/tree/master/path |
| zstd | 0.14.3 | Copyright (c) 2026, Alexandre Bury | https://github.com/gyscos/zstd-rs |
| zstd-safe | 8.2.0 | Copyright (c) 2026, Alexandre Bury | https://github.com/gyscos/zstd-rs |
| zstd-sys | 2.1.2+zstd.1.5.7 | Copyright (c) 2026, Alexandre Bury | https://github.com/gyscos/zstd-rs |

### MIT OR Apache-2.0 OR Zlib (8)

| Paquet | Version | Copyright | Source |
|---|---|---|---|
| raw-window-handle | 0.6.2 |  | https://github.com/rust-windowing/raw-window-handle |
| static_vcruntime | 3.0.0 |  | https://github.com/ChrisDenton/static_vcruntime |
| tinyvec_macros | 0.1.1 | Copyright 2020 Tomasz "Soveu" Marx | https://github.com/Soveu/tinyvec_macros |
| zune-core | 0.4.12 |  | https://github.com/etemesi254/zune-image/tree/dev/zune-core |
| zune-core | 0.5.3 |  | https://github.com/etemesi254/zune-image |
| zune-inflate | 0.2.54 |  | https://github.com/etemesi254/zune-image/tree/main/zune-inflate |
| zune-jpeg | 0.4.21 |  | https://github.com/etemesi254/zune-image/tree/dev/crates/zune-jpeg |
| zune-jpeg | 0.5.15 |  | https://github.com/etemesi254/zune-image/tree/dev/crates/zune-jpeg |

### Apache-2.0 WITH LLVM-exception OR Apache-2.0 OR MIT (6)

| Paquet | Version | Copyright | Source |
|---|---|---|---|
| linux-raw-sys | 0.12.1 |  | https://github.com/sunfishcode/linux-raw-sys |
| rustix | 1.1.4 |  | https://github.com/bytecodealliance/rustix |
| rustix | 1.1.6 |  | https://github.com/bytecodealliance/rustix |
| wasi | 0.11.1+wasi-snapshot-preview1 |  | https://github.com/bytecodealliance/wasi |
| wasip2 | 1.0.4+wasi-0.2.12 |  | https://github.com/bytecodealliance/wasi-rs |
| wit-bindgen | 0.57.1 |  | https://github.com/bytecodealliance/wit-bindgen |

### (MIT OR Apache-2.0) AND Unicode-3.0 (4)

| Paquet | Version | Copyright | Source |
|---|---|---|---|
| unicode-ident | 1.0.24 |  | https://github.com/dtolnay/unicode-ident |
| unicode-ident | 1.0.27 |  | https://github.com/dtolnay/unicode-ident |
| unicode-normalization | 0.1.26 |  | https://github.com/unicode-rs/unicode-normalization |
| unicode-properties | 0.1.5 |  | https://github.com/unicode-rs/unicode-properties |

### BSD-2-Clause (4)

| Paquet | Version | Copyright | Source |
|---|---|---|---|
| arrayref | 0.3.9 | Copyright (c) 2015 David Roundy <roundyd@physics.oregonstate.edu> | https://github.com/droundy/arrayref |
| av1-grain | 0.2.5 | Copyright (c) 2022-2022, the rav1e contributors | https://github.com/rust-av/av1-grain |
| rav1e | 0.8.1 | Copyright (c) 2017-2023, the rav1e contributors | https://github.com/xiph/rav1e/ |
| v_frame | 0.3.9 | Copyright (c) 2017-2022, the rav1e contributors | https://github.com/rust-av/v_frame |

### BSD-2-Clause OR Apache-2.0 OR MIT (4)

| Paquet | Version | Copyright | Source |
|---|---|---|---|
| zerocopy | 0.8.56 | Copyright 2023 The Fuchsia Authors | https://github.com/google/zerocopy |
| zerocopy | 0.8.63 | Copyright 2023 The Fuchsia Authors | https://github.com/google/zerocopy |
| zerocopy-derive | 0.8.56 | Copyright 2023 The Fuchsia Authors | https://github.com/google/zerocopy |
| zerocopy-derive | 0.8.63 | Copyright 2023 The Fuchsia Authors | https://github.com/google/zerocopy |

### Zlib (4)

| Paquet | Version | Copyright | Source |
|---|---|---|---|
| foldhash | 0.2.0 | Copyright (c) 2024 Orson Peters | https://github.com/orlp/foldhash |
| slotmap | 1.1.1 | Copyright (c) 2021 Orson Peters <orsonpeters@gmail.com> | https://github.com/orlp/slotmap |
| zlib-rs | 0.6.7 |  | https://github.com/trifectatechfoundation/zlib-rs |
| zlib-rs | 0.6.8 |  | https://github.com/trifectatechfoundation/zlib-rs |

### Apache-2.0 OR ISC OR MIT (3)

| Paquet | Version | Copyright | Source |
|---|---|---|---|
| hyper-rustls | 0.27.10 |  | https://github.com/rustls/hyper-rustls |
| rustls | 0.23.46 |  | https://github.com/rustls/rustls |
| rustls-native-certs | 0.8.5 |  | https://github.com/rustls/rustls-native-certs |

### ISC (3)

| Paquet | Version | Copyright | Source |
|---|---|---|---|
| libloading | 0.7.4 | Copyright © 2015, Simonas Kazlauskas | https://github.com/nagisa/rust_libloading/ |
| rustls-webpki | 0.103.16 | Copyright 2015 Brian Smith. | https://github.com/rustls/webpki |
| untrusted | 0.9.0 | // Copyright 2015-2016 Brian Smith. | https://github.com/briansmith/untrusted |

### (Apache-2.0 OR MIT) AND BSD-3-Clause (2)

| Paquet | Version | Copyright | Source |
|---|---|---|---|
| encoding_rs | 0.8.35 |  | https://github.com/hsivonen/encoding_rs |
| encoding_rs | 0.8.44 |  | https://github.com/hsivonen/encoding_rs |

### BSD-3-Clause OR Apache-2.0 (2)

| Paquet | Version | Copyright | Source |
|---|---|---|---|
| moxcms | 0.8.1 | Copyright 2024 Radzivon Bartoshyk | https://github.com/awxkee/moxcms.git |
| pxfm | 0.1.30 | Copyright 2024 Radzivon Bartoshyk | https://github.com/awxkee/pxfm |

### BSD-3-Clause OR MIT OR Apache-2.0 (2)

| Paquet | Version | Copyright | Source |
|---|---|---|---|
| num_enum | 0.7.6 |  | https://github.com/illicitonion/num_enum |
| num_enum_derive | 0.7.6 |  | https://github.com/illicitonion/num_enum |

### bzip2-1.0.6 (2)

| Paquet | Version | Copyright | Source |
|---|---|---|---|
| libbz2-rs-sys | 0.2.5 | Copyright (C) 1996-2021 Julian R Seward. | https://github.com/trifectatechfoundation/libbzip2-rs |
| libbz2-rs-sys | 0.2.6 | Copyright (C) 1996-2021 Julian R Seward. | https://github.com/trifectatechfoundation/libbzip2-rs |

### CC0-1.0 OR Apache-2.0 (2)

| Paquet | Version | Copyright | Source |
|---|---|---|---|
| imgref | 1.12.2 |  | https://github.com/kornelski/imgref |
| imgref | 1.12.3 |  | https://github.com/kornelski/imgref |

### CC0-1.0 OR MIT-0 OR Apache-2.0 (2)

| Paquet | Version | Copyright | Source |
|---|---|---|---|
| constant_time_eq | 0.6.1 |  | https://codeberg.org/cesarb/constant_time_eq |
| dunce | 1.0.5 |  | https://gitlab.com/kornelski/dunce |

### MIT OR Apache-2.0 OR LGPL-2.1-or-later (2)

| Paquet | Version | Copyright | Source |
|---|---|---|---|
| r-efi | 5.3.0 |  | https://github.com/r-efi/r-efi |
| r-efi | 6.0.0 |  | https://github.com/r-efi/r-efi |

### MIT OR Zlib OR Apache-2.0 (2)

| Paquet | Version | Copyright | Source |
|---|---|---|---|
| miniz_oxide | 0.8.9 | Copyright 2013-2014 RAD Game Tools and Valve Software | https://github.com/Frommi/miniz_oxide/tree/master/miniz_oxide |
| miniz_oxide | 0.9.1 | Copyright 2013-2014 RAD Game Tools and Valve Software | https://github.com/Frommi/miniz_oxide/tree/master/miniz_oxide |

### (MIT OR Apache-2.0) AND NCSA (1)

| Paquet | Version | Copyright | Source |
|---|---|---|---|
| libfuzzer-sys | 0.4.13 |  | https://github.com/rust-fuzz/libfuzzer |

### 0BSD OR MIT OR Apache-2.0 (1)

| Paquet | Version | Copyright | Source |
|---|---|---|---|
| adler2 | 2.0.1 | Copyright (C) Jonas Schievink <jonasschievink@gmail.com> | https://github.com/oyvindln/adler2 |

### Apache-2.0 AND ISC (1)

| Paquet | Version | Copyright | Source |
|---|---|---|---|
| ring | 0.17.14 |  | https://github.com/briansmith/ring |

### Apache-2.0 AND MIT (1)

| Paquet | Version | Copyright | Source |
|---|---|---|---|
| dpi | 0.1.2 |  | https://github.com/rust-windowing/winit |

### Apache-2.0 OR BSL-1.0 (1)

| Paquet | Version | Copyright | Source |
|---|---|---|---|
| ryu | 1.0.23 |  | https://github.com/dtolnay/ryu |

### Apache-2.0 WITH LLVM-exception (1)

| Paquet | Version | Copyright | Source |
|---|---|---|---|
| target-lexicon | 0.12.16 |  | https://github.com/bytecodealliance/target-lexicon |

### BSD-3-Clause AND MIT (1)

| Paquet | Version | Copyright | Source |
|---|---|---|---|
| brotli | 9.1.1 | Copyright (c) 2016 Dropbox, Inc. | https://github.com/dropbox/rust-brotli |

### BSD-3-Clause OR MIT (1)

| Paquet | Version | Copyright | Source |
|---|---|---|---|
| brotli-decompressor | 6.2.0 | Copyright (c) 2016 Dropbox, Inc. | https://github.com/dropbox/rust-brotli-decompressor |

### CC0-1.0 OR MIT-0 (1)

| Paquet | Version | Copyright | Source |
|---|---|---|---|
| ppmd-rust | 1.5.2 |  | https://github.com/hasenbanck/ppmd-rust |

### CDLA-Permissive-2.0 (1)

| Paquet | Version | Copyright | Source |
|---|---|---|---|
| webpki-root-certs | 1.0.11 |  | https://github.com/rustls/webpki-roots |

## Outils de développement npm (non distribués) (71)

### MIT (60)

| Paquet | Version | Copyright | Source |
|---|---|---|---|
| @babel/code-frame | 7.29.7 | Copyright (c) 2014-present Sebastian McKenzie and other contributors | https://github.com/babel/babel |
| @babel/compat-data | 7.29.7 | Copyright (c) 2014-present Sebastian McKenzie and other contributors | https://github.com/babel/babel |
| @babel/core | 7.29.7 | Copyright (c) 2014-present Sebastian McKenzie and other contributors | https://github.com/babel/babel |
| @babel/generator | 7.29.12 | Copyright (c) 2014-present Sebastian McKenzie and other contributors | https://github.com/babel/babel |
| @babel/helper-compilation-targets | 7.29.7 | Copyright (c) 2014-present Sebastian McKenzie and other contributors | https://github.com/babel/babel |
| @babel/helper-globals | 7.29.7 | Copyright (c) 2014-present Sebastian McKenzie and other contributors | https://github.com/babel/babel |
| @babel/helper-module-imports | 7.29.7 | Copyright (c) 2014-present Sebastian McKenzie and other contributors | https://github.com/babel/babel |
| @babel/helper-module-transforms | 7.29.7 | Copyright (c) 2014-present Sebastian McKenzie and other contributors | https://github.com/babel/babel |
| @babel/helper-plugin-utils | 7.29.7 | Copyright (c) 2014-present Sebastian McKenzie and other contributors | https://github.com/babel/babel |
| @babel/helper-string-parser | 7.29.11 | Copyright (c) 2014-present Sebastian McKenzie and other contributors | https://github.com/babel/babel |
| @babel/helper-validator-identifier | 7.29.7 | Copyright (c) 2014-present Sebastian McKenzie and other contributors | https://github.com/babel/babel |
| @babel/helper-validator-option | 7.29.7 | Copyright (c) 2014-present Sebastian McKenzie and other contributors | https://github.com/babel/babel |
| @babel/helpers | 7.29.10 | Copyright (c) 2014-present Sebastian McKenzie and other contributors | https://github.com/babel/babel |
| @babel/parser | 7.29.12 | Copyright (C) 2012-2014 by various contributors (see AUTHORS) | https://github.com/babel/babel |
| @babel/plugin-transform-react-jsx-self | 7.29.7 | Copyright (c) 2014-present Sebastian McKenzie and other contributors | https://github.com/babel/babel |
| @babel/plugin-transform-react-jsx-source | 7.29.7 | Copyright (c) 2014-present Sebastian McKenzie and other contributors | https://github.com/babel/babel |
| @babel/template | 7.29.7 | Copyright (c) 2014-present Sebastian McKenzie and other contributors | https://github.com/babel/babel |
| @babel/traverse | 7.29.12 | Copyright (c) 2014-present Sebastian McKenzie and other contributors | https://github.com/babel/babel |
| @babel/types | 7.29.11 | Copyright (c) 2014-present Sebastian McKenzie and other contributors | https://github.com/babel/babel |
| @esbuild/win32-x64 | 0.28.2 |  | https://github.com/evanw/esbuild |
| @fluentui/svg-icons | 1.1.345 |  | https://github.com/microsoft/fluentui-system-icons |
| @jridgewell/gen-mapping | 0.3.13 | Copyright 2024 Justin Ridgewell <justin@ridgewell.name> | https://github.com/jridgewell/sourcemaps |
| @jridgewell/remapping | 2.3.5 | Copyright 2024 Justin Ridgewell <justin@ridgewell.name> | https://github.com/jridgewell/sourcemaps |
| @jridgewell/resolve-uri | 3.1.2 | Copyright 2019 Justin Ridgewell <jridgewell@google.com> | https://github.com/jridgewell/resolve-uri |
| @jridgewell/sourcemap-codec | 1.6.0 | Copyright 2024 Justin Ridgewell <justin@ridgewell.name> | https://github.com/jridgewell/sourcemaps |
| @jridgewell/trace-mapping | 0.3.31 | Copyright 2024 Justin Ridgewell <justin@ridgewell.name> | https://github.com/jridgewell/sourcemaps |
| @rolldown/pluginutils | 1.0.0-rc.3 | Copyright (c) 2024-present VoidZero Inc. & Contributors | https://github.com/rolldown/rolldown |
| @rollup/rollup-win32-x64-gnu | 4.67.4 |  | https://github.com/rollup/rollup |
| @rollup/rollup-win32-x64-msvc | 4.67.4 |  | https://github.com/rollup/rollup |
| @types/babel__core | 7.20.5 | Copyright (c) Microsoft Corporation. | https://github.com/DefinitelyTyped/DefinitelyTyped |
| @types/babel__generator | 7.27.0 | Copyright (c) Microsoft Corporation. | https://github.com/DefinitelyTyped/DefinitelyTyped |
| @types/babel__template | 7.4.4 | Copyright (c) Microsoft Corporation. | https://github.com/DefinitelyTyped/DefinitelyTyped |
| @types/babel__traverse | 7.28.0 | Copyright (c) Microsoft Corporation. | https://github.com/DefinitelyTyped/DefinitelyTyped |
| @types/estree | 1.0.10 | Copyright (c) Microsoft Corporation. | https://github.com/DefinitelyTyped/DefinitelyTyped |
| @types/node | 24.19.2 | Copyright (c) Microsoft Corporation. | https://github.com/DefinitelyTyped/DefinitelyTyped |
| @types/react | 19.3.0 | Copyright (c) Microsoft Corporation. | https://github.com/DefinitelyTyped/DefinitelyTyped |
| @types/react-dom | 19.3.0 | Copyright (c) Microsoft Corporation. | https://github.com/DefinitelyTyped/DefinitelyTyped |
| @vitejs/plugin-react | 5.2.0 | Copyright (c) 2019-present, Yuxi (Evan) You and Vite contributors | https://github.com/vitejs/vite-plugin-react |
| browserslist | 4.29.5 | Copyright 2014 Andrey Sitnik <andrey@sitnik.es> and other contributors | https://github.com/browserslist/browserslist |
| convert-source-map | 2.0.0 | Copyright 2013 Thorsten Lorenz. | https://github.com/thlorenz/convert-source-map |
| csstype | 3.2.3 | Copyright (c) 2017-2018 Fredrik Nicol | https://github.com/frenic/csstype |
| debug | 4.4.3 | Copyright (c) 2014-2017 TJ Holowaychuk <tj@vision-media.ca> | https://github.com/debug-js/debug |
| esbuild | 0.28.2 | Copyright (c) 2020 Evan Wallace | https://github.com/evanw/esbuild |
| escalade | 3.2.0 | Copyright (c) Luke Edwards <luke.edwards05@gmail.com> (lukeed.com) | https://github.com/lukeed/escalade |
| fdir | 6.5.0 | Copyright 2023 Abdullah Atta | https://github.com/thecodrr/fdir |
| gensync | 1.0.0-beta.2 | Copyright 2018 Logan Smyth <loganfsmyth@gmail.com> | https://github.com/loganfsmyth/gensync |
| js-tokens | 4.0.0 | Copyright (c) 2014, 2015, 2016, 2017, 2018 Simon Lydell | https://github.com/lydell/js-tokens |
| jsesc | 3.1.0 |  | https://github.com/mathiasbynens/jsesc |
| json5 | 2.2.3 | Copyright (c) 2012-2018 Aseem Kishore, and [others]. | https://github.com/json5/json5 |
| ms | 2.1.3 | Copyright (c) 2020 Vercel, Inc. | https://github.com/vercel/ms |
| nanoid | 3.3.20 | Copyright 2017 Andrey Sitnik <andrey@sitnik.ru> | https://github.com/ai/nanoid |
| node-releases | 2.0.63 | Copyright (c) 2017 Sergey Rubanov (https://github.com/chicoxyzzy) | https://github.com/chicoxyzzy/node-releases |
| picomatch | 4.0.7 | Copyright (c) 2017-present, Jon Schlinkert. | https://github.com/micromatch/picomatch |
| postcss | 8.5.32 | Copyright 2013 Andrey Sitnik <andrey@sitnik.es> | https://github.com/postcss/postcss |
| react-refresh | 0.18.0 | Copyright (c) Meta Platforms, Inc. and affiliates. | https://github.com/facebook/react |
| rollup | 4.67.4 | Copyright (c) 2017 [these people](https://github.com/rollup/rollup/graphs/contributors) | https://github.com/rollup/rollup |
| tinyglobby | 0.2.17 | Copyright (c) 2024 Madeline Gurriarán | https://github.com/SuperchupuDev/tinyglobby |
| undici-types | 7.24.6 | Copyright (c) Matteo Collina and Undici contributors | https://github.com/nodejs/undici |
| update-browserslist-db | 1.3.4 | Copyright 2022 Andrey Sitnik <andrey@sitnik.es> and other contributors | https://github.com/browserslist/update-db |
| vite | 7.3.7 | Copyright (c) 2019-present, VoidZero Inc. and Vite contributors | https://github.com/vitejs/vite |

### ISC (5)

| Paquet | Version | Copyright | Source |
|---|---|---|---|
| electron-to-chromium | 1.5.474 | Copyright 2018 Kilian Valkhof | https://github.com/Kilian/electron-to-chromium |
| lru-cache | 5.1.1 | Copyright (c) Isaac Z. Schlueter and Contributors | https://github.com/isaacs/node-lru-cache |
| picocolors | 1.1.1 | Copyright (c) 2021-2024 Oleksii Raspopov, Kostiantyn Denysov, Anton Verinov | https://github.com/alexeyraspopov/picocolors |
| semver | 6.3.2 | Copyright (c) Isaac Z. Schlueter and Contributors | https://github.com/npm/node-semver |
| yallist | 3.1.1 | Copyright (c) Isaac Z. Schlueter and Contributors | https://github.com/isaacs/yallist |

### Apache-2.0 (2)

| Paquet | Version | Copyright | Source |
|---|---|---|---|
| baseline-browser-mapping | 2.11.35 |  | https://github.com/web-platform-dx/baseline-browser-mapping |
| typescript | 5.9.3 |  | https://github.com/microsoft/TypeScript |

### Apache-2.0 OR MIT (2)

| Paquet | Version | Copyright | Source |
|---|---|---|---|
| @tauri-apps/cli | 2.12.4 |  | https://github.com/tauri-apps/tauri |
| @tauri-apps/cli-win32-x64-msvc | 2.12.4 |  | https://github.com/tauri-apps/tauri |

### BSD-3-Clause (1)

| Paquet | Version | Copyright | Source |
|---|---|---|---|
| source-map-js | 1.2.2 | Copyright (c) 2009-2011, Mozilla Foundation and contributors | https://github.com/7rulnik/source-map-js |

### CC-BY-4.0 (1)

| Paquet | Version | Copyright | Source |
|---|---|---|---|
| caniuse-lite | 1.0.30001820 |  | https://github.com/browserslist/caniuse-lite |
