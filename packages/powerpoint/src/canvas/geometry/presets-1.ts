// Formes predefinies DrawingML (partie 1/5), transcrites de presetShapeDefinitions.xml (ECMA-376 partie 1).
// Format : voir PresetDef dans types.ts. Fichier genere : ne pas reformater a la main.
import type { PresetDef } from './types.ts';

export const PRESETS_1: Readonly<Record<string, PresetDef>> = {
  accentBorderCallout1: {
    av: ['adj1 val 18750', 'adj2 val -8333', 'adj3 val 112500', 'adj4 val -38333'],
    gd: ['y1 */ h adj1 100000', 'x1 */ w adj2 100000', 'y2 */ h adj3 100000', 'x2 */ w adj4 100000'],
    ah: [
      'xy adj2 -2147483647 2147483647 adj1 -2147483647 2147483647 x1 y1',
      'xy adj4 -2147483647 2147483647 adj3 -2147483647 2147483647 x2 y2',
    ],
    cxn: ['0 r vc', 'cd4 hc b', 'cd2 l vc', '3cd4 hc t'],
    rect: 'l t r b',
    path: [
      ['M l t', 'L r t', 'L r b', 'L l b', 'Z'],
      ['fill=none', 'M x1 t', 'Z', 'L x1 b'],
      ['fill=none', 'M x1 y1', 'L x2 y2'],
    ],
  },
  accentBorderCallout2: {
    av: ['adj1 val 18750', 'adj2 val -8333', 'adj3 val 18750', 'adj4 val -16667', 'adj5 val 112500', 'adj6 val -46667'],
    gd: [
      'y1 */ h adj1 100000', 'x1 */ w adj2 100000', 'y2 */ h adj3 100000', 'x2 */ w adj4 100000',
      'y3 */ h adj5 100000', 'x3 */ w adj6 100000',
    ],
    ah: [
      'xy adj2 -2147483647 2147483647 adj1 -2147483647 2147483647 x1 y1',
      'xy adj4 -2147483647 2147483647 adj3 -2147483647 2147483647 x2 y2',
      'xy adj6 -2147483647 2147483647 adj5 -2147483647 2147483647 x3 y3',
    ],
    cxn: ['0 r vc', 'cd4 hc b', 'cd2 l vc', '3cd4 hc t'],
    rect: 'l t r b',
    path: [
      ['M l t', 'L r t', 'L r b', 'L l b', 'Z'],
      ['fill=none', 'M x1 t', 'Z', 'L x1 b'],
      ['fill=none', 'M x1 y1', 'L x2 y2', 'L x3 y3'],
    ],
  },
  accentBorderCallout3: {
    av: [
      'adj1 val 18750', 'adj2 val -8333', 'adj3 val 18750', 'adj4 val -16667', 'adj5 val 100000', 'adj6 val -16667',
      'adj7 val 112963', 'adj8 val -8333',
    ],
    gd: [
      'y1 */ h adj1 100000', 'x1 */ w adj2 100000', 'y2 */ h adj3 100000', 'x2 */ w adj4 100000',
      'y3 */ h adj5 100000', 'x3 */ w adj6 100000', 'y4 */ h adj7 100000', 'x4 */ w adj8 100000',
    ],
    ah: [
      'xy adj2 -2147483647 2147483647 adj1 -2147483647 2147483647 x1 y1',
      'xy adj4 -2147483647 2147483647 adj3 -2147483647 2147483647 x2 y2',
      'xy adj6 -2147483647 2147483647 adj5 -2147483647 2147483647 x3 y3',
      'xy adj8 -2147483647 2147483647 adj7 -2147483647 2147483647 x4 y4',
    ],
    cxn: ['0 r vc', 'cd4 hc b', 'cd2 l vc', '3cd4 hc t'],
    rect: 'l t r b',
    path: [
      ['M l t', 'L r t', 'L r b', 'L l b', 'Z'],
      ['fill=none', 'M x1 t', 'Z', 'L x1 b'],
      ['fill=none', 'M x1 y1', 'L x2 y2', 'L x3 y3', 'L x4 y4'],
    ],
  },
  accentCallout1: {
    av: ['adj1 val 18750', 'adj2 val -8333', 'adj3 val 112500', 'adj4 val -38333'],
    gd: ['y1 */ h adj1 100000', 'x1 */ w adj2 100000', 'y2 */ h adj3 100000', 'x2 */ w adj4 100000'],
    ah: [
      'xy adj2 -2147483647 2147483647 adj1 -2147483647 2147483647 x1 y1',
      'xy adj4 -2147483647 2147483647 adj3 -2147483647 2147483647 x2 y2',
    ],
    cxn: ['0 r vc', 'cd4 hc b', 'cd2 l vc', '3cd4 hc t'],
    rect: 'l t r b',
    path: [
      ['stroke=0', 'M l t', 'L r t', 'L r b', 'L l b', 'Z'],
      ['fill=none', 'M x1 t', 'Z', 'L x1 b'],
      ['fill=none', 'M x1 y1', 'L x2 y2'],
    ],
  },
  accentCallout2: {
    av: ['adj1 val 18750', 'adj2 val -8333', 'adj3 val 18750', 'adj4 val -16667', 'adj5 val 112500', 'adj6 val -46667'],
    gd: [
      'y1 */ h adj1 100000', 'x1 */ w adj2 100000', 'y2 */ h adj3 100000', 'x2 */ w adj4 100000',
      'y3 */ h adj5 100000', 'x3 */ w adj6 100000',
    ],
    ah: [
      'xy adj2 -2147483647 2147483647 adj1 -2147483647 2147483647 x1 y1',
      'xy adj4 -2147483647 2147483647 adj3 -2147483647 2147483647 x2 y2',
      'xy adj6 -2147483647 2147483647 adj5 -2147483647 2147483647 x3 y3',
    ],
    cxn: ['0 r vc', 'cd4 hc b', 'cd2 l vc', '3cd4 hc t'],
    rect: 'l t r b',
    path: [
      ['stroke=0', 'M l t', 'L r t', 'L r b', 'L l b', 'Z'],
      ['fill=none', 'M x1 t', 'Z', 'L x1 b'],
      ['fill=none', 'M x1 y1', 'L x2 y2', 'L x3 y3'],
    ],
  },
  accentCallout3: {
    av: [
      'adj1 val 18750', 'adj2 val -8333', 'adj3 val 18750', 'adj4 val -16667', 'adj5 val 100000', 'adj6 val -16667',
      'adj7 val 112963', 'adj8 val -8333',
    ],
    gd: [
      'y1 */ h adj1 100000', 'x1 */ w adj2 100000', 'y2 */ h adj3 100000', 'x2 */ w adj4 100000',
      'y3 */ h adj5 100000', 'x3 */ w adj6 100000', 'y4 */ h adj7 100000', 'x4 */ w adj8 100000',
    ],
    ah: [
      'xy adj2 -2147483647 2147483647 adj1 -2147483647 2147483647 x1 y1',
      'xy adj4 -2147483647 2147483647 adj3 -2147483647 2147483647 x2 y2',
      'xy adj6 -2147483647 2147483647 adj5 -2147483647 2147483647 x3 y3',
      'xy adj8 -2147483647 2147483647 adj7 -2147483647 2147483647 x4 y4',
    ],
    cxn: ['0 r vc', 'cd4 hc b', 'cd2 l vc', '3cd4 hc t'],
    rect: 'l t r b',
    path: [
      ['stroke=0', 'M l t', 'L r t', 'L r b', 'L l b', 'Z'],
      ['fill=none', 'M x1 t', 'Z', 'L x1 b'],
      ['fill=none', 'M x1 y1', 'L x2 y2', 'L x3 y3', 'L x4 y4'],
    ],
  },
  actionButtonBackPrevious: {
    gd: ['dx2 */ ss 3 8', 'g9 +- vc 0 dx2', 'g10 +- vc dx2 0', 'g11 +- hc 0 dx2', 'g12 +- hc dx2 0'],
    cxn: ['0 r vc', 'cd4 hc b', 'cd2 l vc', '3cd4 hc t'],
    rect: 'l t r b',
    path: [
      ['stroke=0', 'M l t', 'L r t', 'L r b', 'L l b', 'Z', 'M g11 vc', 'L g12 g9', 'L g12 g10', 'Z'],
      ['fill=darken stroke=0', 'M g11 vc', 'L g12 g9', 'L g12 g10', 'Z'],
      ['fill=none', 'M g11 vc', 'L g12 g9', 'L g12 g10', 'Z'],
      ['fill=none', 'M l t', 'L r t', 'L r b', 'L l b', 'Z'],
    ],
  },
  actionButtonBeginning: {
    gd: [
      'dx2 */ ss 3 8', 'g9 +- vc 0 dx2', 'g10 +- vc dx2 0', 'g11 +- hc 0 dx2', 'g12 +- hc dx2 0', 'g13 */ ss 3 4',
      'g14 */ g13 1 8', 'g15 */ g13 1 4', 'g16 +- g11 g14 0', 'g17 +- g11 g15 0',
    ],
    cxn: ['0 r vc', 'cd4 hc b', 'cd2 l vc', '3cd4 hc t'],
    rect: 'l t r b',
    path: [
      [
        'stroke=0', 'M l t', 'L r t', 'L r b', 'L l b', 'Z', 'M g17 vc', 'L g12 g9', 'L g12 g10', 'Z', 'M g16 g9',
        'L g11 g9', 'L g11 g10', 'L g16 g10', 'Z',
      ],
      [
        'fill=darken stroke=0', 'M g17 vc', 'L g12 g9', 'L g12 g10', 'Z', 'M g16 g9', 'L g11 g9', 'L g11 g10',
        'L g16 g10', 'Z',
      ],
      ['fill=none', 'M g17 vc', 'L g12 g9', 'L g12 g10', 'Z', 'M g16 g9', 'L g16 g10', 'L g11 g10', 'L g11 g9', 'Z'],
      ['fill=none', 'M l t', 'L r t', 'L r b', 'L l b', 'Z'],
    ],
  },
  actionButtonBlank: {
    cxn: ['0 r vc', 'cd4 hc b', 'cd2 l vc', '3cd4 hc t'],
    rect: 'l t r b',
    path: [
      ['M l t', 'L r t', 'L r b', 'L l b', 'Z'],
    ],
  },
  actionButtonDocument: {
    gd: [
      'dx2 */ ss 3 8', 'g9 +- vc 0 dx2', 'g10 +- vc dx2 0', 'dx1 */ ss 9 32', 'g11 +- hc 0 dx1', 'g12 +- hc dx1 0',
      'g13 */ ss 3 16', 'g14 +- g12 0 g13', 'g15 +- g9 g13 0',
    ],
    cxn: ['0 r vc', 'cd4 hc b', 'cd2 l vc', '3cd4 hc t'],
    rect: 'l t r b',
    path: [
      [
        'stroke=0', 'M l t', 'L r t', 'L r b', 'L l b', 'Z', 'M g11 g9', 'L g14 g9', 'L g12 g15', 'L g12 g10',
        'L g11 g10', 'Z',
      ],
      ['fill=darkenLess stroke=0', 'M g11 g9', 'L g14 g9', 'L g14 g15', 'L g12 g15', 'L g12 g10', 'L g11 g10', 'Z'],
      ['fill=darken stroke=0', 'M g14 g9', 'L g14 g15', 'L g12 g15', 'Z'],
      [
        'fill=none', 'M g11 g9', 'L g14 g9', 'L g12 g15', 'L g12 g10', 'L g11 g10', 'Z', 'M g12 g15', 'L g14 g15',
        'L g14 g9',
      ],
      ['fill=none', 'M l t', 'L r t', 'L r b', 'L l b', 'Z'],
    ],
  },
  actionButtonEnd: {
    gd: [
      'dx2 */ ss 3 8', 'g9 +- vc 0 dx2', 'g10 +- vc dx2 0', 'g11 +- hc 0 dx2', 'g12 +- hc dx2 0', 'g13 */ ss 3 4',
      'g14 */ g13 3 4', 'g15 */ g13 7 8', 'g16 +- g11 g14 0', 'g17 +- g11 g15 0',
    ],
    cxn: ['0 r vc', 'cd4 hc b', 'cd2 l vc', '3cd4 hc t'],
    rect: 'l t r b',
    path: [
      [
        'stroke=0', 'M l t', 'L r t', 'L r b', 'L l b', 'Z', 'M g16 vc', 'L g11 g9', 'L g11 g10', 'Z', 'M g17 g9',
        'L g12 g9', 'L g12 g10', 'L g17 g10', 'Z',
      ],
      [
        'fill=darken stroke=0', 'M g16 vc', 'L g11 g9', 'L g11 g10', 'Z', 'M g17 g9', 'L g12 g9', 'L g12 g10',
        'L g17 g10', 'Z',
      ],
      ['fill=none', 'M g16 vc', 'L g11 g10', 'L g11 g9', 'Z', 'M g17 g9', 'L g12 g9', 'L g12 g10', 'L g17 g10', 'Z'],
      ['fill=none', 'M l t', 'L r t', 'L r b', 'L l b', 'Z'],
    ],
  },
  actionButtonForwardNext: {
    gd: ['dx2 */ ss 3 8', 'g9 +- vc 0 dx2', 'g10 +- vc dx2 0', 'g11 +- hc 0 dx2', 'g12 +- hc dx2 0'],
    cxn: ['0 r vc', 'cd4 hc b', 'cd2 l vc', '3cd4 hc t'],
    rect: 'l t r b',
    path: [
      ['stroke=0', 'M l t', 'L r t', 'L r b', 'L l b', 'Z', 'M g12 vc', 'L g11 g9', 'L g11 g10', 'Z'],
      ['fill=darken stroke=0', 'M g12 vc', 'L g11 g9', 'L g11 g10', 'Z'],
      ['fill=none', 'M g12 vc', 'L g11 g10', 'L g11 g9', 'Z'],
      ['fill=none', 'M l t', 'L r t', 'L r b', 'L l b', 'Z'],
    ],
  },
  actionButtonHelp: {
    gd: [
      'dx2 */ ss 3 8', 'g9 +- vc 0 dx2', 'g11 +- hc 0 dx2', 'g13 */ ss 3 4', 'g14 */ g13 1 7', 'g15 */ g13 3 14',
      'g16 */ g13 2 7', 'g19 */ g13 3 7', 'g20 */ g13 4 7', 'g21 */ g13 17 28', 'g23 */ g13 21 28', 'g24 */ g13 11 14',
      'g27 +- g9 g16 0', 'g29 +- g9 g21 0', 'g30 +- g9 g23 0', 'g31 +- g9 g24 0', 'g33 +- g11 g15 0',
      'g36 +- g11 g19 0', 'g37 +- g11 g20 0', 'g41 */ g13 1 14', 'g42 */ g13 3 28',
    ],
    cxn: ['0 r vc', 'cd4 hc b', 'cd2 l vc', '3cd4 hc t'],
    rect: 'l t r b',
    path: [
      [
        'stroke=0', 'M l t', 'L r t', 'L r b', 'L l b', 'Z', 'M g33 g27', 'A g16 g16 cd2 cd2', 'A g14 g15 0 cd4',
        'A g41 g42 3cd4 -5400000', 'L g37 g30', 'L g36 g30', 'L g36 g29', 'A g14 g15 cd2 cd4',
        'A g41 g42 cd4 -5400000', 'A g14 g14 0 -10800000', 'Z', 'M hc g31', 'A g42 g42 3cd4 21600000', 'Z',
      ],
      [
        'fill=darken stroke=0', 'M g33 g27', 'A g16 g16 cd2 cd2', 'A g14 g15 0 cd4', 'A g41 g42 3cd4 -5400000',
        'L g37 g30', 'L g36 g30', 'L g36 g29', 'A g14 g15 cd2 cd4', 'A g41 g42 cd4 -5400000', 'A g14 g14 0 -10800000',
        'Z', 'M hc g31', 'A g42 g42 3cd4 21600000', 'Z',
      ],
      [
        'fill=none', 'M g33 g27', 'A g16 g16 cd2 cd2', 'A g14 g15 0 cd4', 'A g41 g42 3cd4 -5400000', 'L g37 g30',
        'L g36 g30', 'L g36 g29', 'A g14 g15 cd2 cd4', 'A g41 g42 cd4 -5400000', 'A g14 g14 0 -10800000', 'Z',
        'M hc g31', 'A g42 g42 3cd4 21600000', 'Z',
      ],
      ['fill=none', 'M l t', 'L r t', 'L r b', 'L l b', 'Z'],
    ],
  },
  actionButtonHome: {
    gd: [
      'dx2 */ ss 3 8', 'g9 +- vc 0 dx2', 'g10 +- vc dx2 0', 'g11 +- hc 0 dx2', 'g12 +- hc dx2 0', 'g13 */ ss 3 4',
      'g14 */ g13 1 16', 'g15 */ g13 1 8', 'g16 */ g13 3 16', 'g17 */ g13 5 16', 'g18 */ g13 7 16', 'g19 */ g13 9 16',
      'g20 */ g13 11 16', 'g21 */ g13 3 4', 'g22 */ g13 13 16', 'g23 */ g13 7 8', 'g24 +- g9 g14 0', 'g25 +- g9 g16 0',
      'g26 +- g9 g17 0', 'g27 +- g9 g21 0', 'g28 +- g11 g15 0', 'g29 +- g11 g18 0', 'g30 +- g11 g19 0',
      'g31 +- g11 g20 0', 'g32 +- g11 g22 0', 'g33 +- g11 g23 0',
    ],
    cxn: ['0 r vc', 'cd4 hc b', 'cd2 l vc', '3cd4 hc t'],
    rect: 'l t r b',
    path: [
      [
        'stroke=0', 'M l t', 'L r t', 'L r b', 'L l b', 'Z', 'M hc g9', 'L g11 vc', 'L g28 vc', 'L g28 g10',
        'L g33 g10', 'L g33 vc', 'L g12 vc', 'L g32 g26', 'L g32 g24', 'L g31 g24', 'L g31 g25', 'Z',
      ],
      [
        'fill=darkenLess stroke=0', 'M g32 g26', 'L g32 g24', 'L g31 g24', 'L g31 g25', 'Z', 'M g28 vc', 'L g28 g10',
        'L g29 g10', 'L g29 g27', 'L g30 g27', 'L g30 g10', 'L g33 g10', 'L g33 vc', 'Z',
      ],
      [
        'fill=darken stroke=0', 'M hc g9', 'L g11 vc', 'L g12 vc', 'Z', 'M g29 g27', 'L g30 g27', 'L g30 g10',
        'L g29 g10', 'Z',
      ],
      [
        'fill=none', 'M hc g9', 'L g31 g25', 'L g31 g24', 'L g32 g24', 'L g32 g26', 'L g12 vc', 'L g33 vc',
        'L g33 g10', 'L g28 g10', 'L g28 vc', 'L g11 vc', 'Z', 'M g31 g25', 'L g32 g26', 'M g33 vc', 'L g28 vc',
        'M g29 g10', 'L g29 g27', 'L g30 g27', 'L g30 g10',
      ],
      ['fill=none', 'M l t', 'L r t', 'L r b', 'L l b', 'Z'],
    ],
  },
  actionButtonInformation: {
    gd: [
      'dx2 */ ss 3 8', 'g9 +- vc 0 dx2', 'g11 +- hc 0 dx2', 'g13 */ ss 3 4', 'g14 */ g13 1 32', 'g17 */ g13 5 16',
      'g18 */ g13 3 8', 'g19 */ g13 13 32', 'g20 */ g13 19 32', 'g22 */ g13 11 16', 'g23 */ g13 13 16',
      'g24 */ g13 7 8', 'g25 +- g9 g14 0', 'g28 +- g9 g17 0', 'g29 +- g9 g18 0', 'g30 +- g9 g23 0', 'g31 +- g9 g24 0',
      'g32 +- g11 g17 0', 'g34 +- g11 g19 0', 'g35 +- g11 g20 0', 'g37 +- g11 g22 0', 'g38 */ g13 3 32',
    ],
    cxn: ['0 r vc', 'cd4 hc b', 'cd2 l vc', '3cd4 hc t'],
    rect: 'l t r b',
    path: [
      ['stroke=0', 'M l t', 'L r t', 'L r b', 'L l b', 'Z', 'M hc g9', 'A dx2 dx2 3cd4 21600000', 'Z'],
      [
        'fill=darken stroke=0', 'M hc g9', 'A dx2 dx2 3cd4 21600000', 'Z', 'M hc g25', 'A g38 g38 3cd4 21600000',
        'M g32 g28', 'L g32 g29', 'L g34 g29', 'L g34 g30', 'L g32 g30', 'L g32 g31', 'L g37 g31', 'L g37 g30',
        'L g35 g30', 'L g35 g28', 'Z',
      ],
      [
        'fill=lighten stroke=0', 'M hc g25', 'A g38 g38 3cd4 21600000', 'M g32 g28', 'L g35 g28', 'L g35 g30',
        'L g37 g30', 'L g37 g31', 'L g32 g31', 'L g32 g30', 'L g34 g30', 'L g34 g29', 'L g32 g29', 'Z',
      ],
      [
        'fill=none', 'M hc g9', 'A dx2 dx2 3cd4 21600000', 'Z', 'M hc g25', 'A g38 g38 3cd4 21600000', 'M g32 g28',
        'L g35 g28', 'L g35 g30', 'L g37 g30', 'L g37 g31', 'L g32 g31', 'L g32 g30', 'L g34 g30', 'L g34 g29',
        'L g32 g29', 'Z',
      ],
      ['fill=none', 'M l t', 'L r t', 'L r b', 'L l b', 'Z'],
    ],
  },
  actionButtonMovie: {
    gd: [
      'dx2 */ ss 3 8', 'g9 +- vc 0 dx2', 'g10 +- vc dx2 0', 'g11 +- hc 0 dx2', 'g12 +- hc dx2 0', 'g13 */ ss 3 4',
      'g14 */ g13 1455 21600', 'g15 */ g13 1905 21600', 'g16 */ g13 2325 21600', 'g17 */ g13 16155 21600',
      'g18 */ g13 17010 21600', 'g19 */ g13 19335 21600', 'g20 */ g13 19725 21600', 'g21 */ g13 20595 21600',
      'g22 */ g13 5280 21600', 'g23 */ g13 5730 21600', 'g24 */ g13 6630 21600', 'g25 */ g13 7492 21600',
      'g26 */ g13 9067 21600', 'g27 */ g13 9555 21600', 'g28 */ g13 13342 21600', 'g29 */ g13 14580 21600',
      'g30 */ g13 15592 21600', 'g31 +- g11 g14 0', 'g32 +- g11 g15 0', 'g33 +- g11 g16 0', 'g34 +- g11 g17 0',
      'g35 +- g11 g18 0', 'g36 +- g11 g19 0', 'g37 +- g11 g20 0', 'g38 +- g11 g21 0', 'g39 +- g9 g22 0',
      'g40 +- g9 g23 0', 'g41 +- g9 g24 0', 'g42 +- g9 g25 0', 'g43 +- g9 g26 0', 'g44 +- g9 g27 0', 'g45 +- g9 g28 0',
      'g46 +- g9 g29 0', 'g47 +- g9 g30 0', 'g48 +- g9 g31 0',
    ],
    cxn: ['0 r vc', 'cd4 hc b', 'cd2 l vc', '3cd4 hc t'],
    rect: 'l t r b',
    path: [
      [
        'stroke=0', 'M l t', 'L r t', 'L r b', 'L l b', 'Z', 'M g11 g39', 'L g11 g44', 'L g31 g44', 'L g32 g43',
        'L g33 g43', 'L g33 g47', 'L g35 g47', 'L g35 g45', 'L g36 g45', 'L g38 g46', 'L g12 g46', 'L g12 g41',
        'L g38 g41', 'L g37 g42', 'L g35 g42', 'L g35 g41', 'L g34 g40', 'L g32 g40', 'L g31 g39', 'Z',
      ],
      [
        'fill=darken stroke=0', 'M g11 g39', 'L g11 g44', 'L g31 g44', 'L g32 g43', 'L g33 g43', 'L g33 g47',
        'L g35 g47', 'L g35 g45', 'L g36 g45', 'L g38 g46', 'L g12 g46', 'L g12 g41', 'L g38 g41', 'L g37 g42',
        'L g35 g42', 'L g35 g41', 'L g34 g40', 'L g32 g40', 'L g31 g39', 'Z',
      ],
      [
        'fill=none', 'M g11 g39', 'L g31 g39', 'L g32 g40', 'L g34 g40', 'L g35 g41', 'L g35 g42', 'L g37 g42',
        'L g38 g41', 'L g12 g41', 'L g12 g46', 'L g38 g46', 'L g36 g45', 'L g35 g45', 'L g35 g47', 'L g33 g47',
        'L g33 g43', 'L g32 g43', 'L g31 g44', 'L g11 g44', 'Z',
      ],
      ['fill=none', 'M l t', 'L r t', 'L r b', 'L l b', 'Z'],
    ],
  },
  actionButtonReturn: {
    gd: [
      'dx2 */ ss 3 8', 'g9 +- vc 0 dx2', 'g10 +- vc dx2 0', 'g11 +- hc 0 dx2', 'g12 +- hc dx2 0', 'g13 */ ss 3 4',
      'g14 */ g13 7 8', 'g15 */ g13 3 4', 'g16 */ g13 5 8', 'g17 */ g13 3 8', 'g18 */ g13 1 4', 'g19 +- g9 g15 0',
      'g20 +- g9 g16 0', 'g21 +- g9 g18 0', 'g22 +- g11 g14 0', 'g23 +- g11 g15 0', 'g24 +- g11 g16 0',
      'g25 +- g11 g17 0', 'g26 +- g11 g18 0', 'g27 */ g13 1 8',
    ],
    cxn: ['0 r vc', 'cd4 hc b', 'cd2 l vc', '3cd4 hc t'],
    rect: 'l t r b',
    path: [
      [
        'stroke=0', 'M l t', 'L r t', 'L r b', 'L l b', 'Z', 'M g12 g21', 'L g23 g9', 'L hc g21', 'L g24 g21',
        'L g24 g20', 'A g27 g27 0 cd4', 'L g25 g19', 'A g27 g27 cd4 cd4', 'L g26 g21', 'L g11 g21', 'L g11 g20',
        'A g17 g17 cd2 -5400000', 'L hc g10', 'A g17 g17 cd4 -5400000', 'L g22 g21', 'Z',
      ],
      [
        'fill=darken stroke=0', 'M g12 g21', 'L g23 g9', 'L hc g21', 'L g24 g21', 'L g24 g20', 'A g27 g27 0 cd4',
        'L g25 g19', 'A g27 g27 cd4 cd4', 'L g26 g21', 'L g11 g21', 'L g11 g20', 'A g17 g17 cd2 -5400000', 'L hc g10',
        'A g17 g17 cd4 -5400000', 'L g22 g21', 'Z',
      ],
      [
        'fill=none', 'M g12 g21', 'L g22 g21', 'L g22 g20', 'A g17 g17 0 cd4', 'L g25 g10', 'A g17 g17 cd4 cd4',
        'L g11 g21', 'L g26 g21', 'L g26 g20', 'A g27 g27 cd2 -5400000', 'L hc g19', 'A g27 g27 cd4 -5400000',
        'L g24 g21', 'L hc g21', 'L g23 g9', 'Z',
      ],
      ['fill=none', 'M l t', 'L r t', 'L r b', 'L l b', 'Z'],
    ],
  },
  actionButtonSound: {
    gd: [
      'dx2 */ ss 3 8', 'g9 +- vc 0 dx2', 'g10 +- vc dx2 0', 'g11 +- hc 0 dx2', 'g12 +- hc dx2 0', 'g13 */ ss 3 4',
      'g14 */ g13 1 8', 'g15 */ g13 5 16', 'g16 */ g13 5 8', 'g17 */ g13 11 16', 'g18 */ g13 3 4', 'g19 */ g13 7 8',
      'g20 +- g9 g14 0', 'g21 +- g9 g15 0', 'g22 +- g9 g17 0', 'g23 +- g9 g19 0', 'g24 +- g11 g15 0',
      'g25 +- g11 g16 0', 'g26 +- g11 g18 0',
    ],
    cxn: ['0 r vc', 'cd4 hc b', 'cd2 l vc', '3cd4 hc t'],
    rect: 'l t r b',
    path: [
      [
        'stroke=0', 'M l t', 'L r t', 'L r b', 'L l b', 'Z', 'M g11 g21', 'L g11 g22', 'L g24 g22', 'L g25 g10',
        'L g25 g9', 'L g24 g21', 'Z',
      ],
      ['fill=darken stroke=0', 'M g11 g21', 'L g11 g22', 'L g24 g22', 'L g25 g10', 'L g25 g9', 'L g24 g21', 'Z'],
      [
        'fill=none', 'M g11 g21', 'L g24 g21', 'L g25 g9', 'L g25 g10', 'L g24 g22', 'L g11 g22', 'Z', 'M g26 g21',
        'L g12 g20', 'M g26 vc', 'L g12 vc', 'M g26 g22', 'L g12 g23',
      ],
      ['fill=none', 'M l t', 'L r t', 'L r b', 'L l b', 'Z'],
    ],
  },
  arc: {
    av: ['adj1 val 16200000', 'adj2 val 0'],
    gd: [
      'stAng pin 0 adj1 21599999', 'enAng pin 0 adj2 21599999', 'sw11 +- enAng 0 stAng', 'sw12 +- sw11 21600000 0',
      'swAng ?: sw11 sw11 sw12', 'wt1 sin wd2 stAng', 'ht1 cos hd2 stAng', 'dx1 cat2 wd2 ht1 wt1',
      'dy1 sat2 hd2 ht1 wt1', 'wt2 sin wd2 enAng', 'ht2 cos hd2 enAng', 'dx2 cat2 wd2 ht2 wt2', 'dy2 sat2 hd2 ht2 wt2',
      'x1 +- hc dx1 0', 'y1 +- vc dy1 0', 'x2 +- hc dx2 0', 'y2 +- vc dy2 0', 'sw0 +- 21600000 0 stAng',
      'da1 +- swAng 0 sw0', 'g1 max x1 x2', 'ir ?: da1 r g1', 'sw1 +- cd4 0 stAng', 'sw2 +- 27000000 0 stAng',
      'sw3 ?: sw1 sw1 sw2', 'da2 +- swAng 0 sw3', 'g5 max y1 y2', 'ib ?: da2 b g5', 'sw4 +- cd2 0 stAng',
      'sw5 +- 32400000 0 stAng', 'sw6 ?: sw4 sw4 sw5', 'da3 +- swAng 0 sw6', 'g9 min x1 x2', 'il ?: da3 l g9',
      'sw7 +- 3cd4 0 stAng', 'sw8 +- 37800000 0 stAng', 'sw9 ?: sw7 sw7 sw8', 'da4 +- swAng 0 sw9', 'g13 min y1 y2',
      'it ?: da4 t g13', 'cang1 +- stAng 0 cd4', 'cang2 +- enAng cd4 0', 'cang3 +/ cang1 cang2 2',
    ],
    ah: ['polar _ _ _ adj1 0 21599999 x1 y1', 'polar _ _ _ adj2 0 21599999 x2 y2'],
    cxn: ['cang1 x1 y1', 'cang3 hc vc', 'cang2 x2 y2'],
    rect: 'il it ir ib',
    path: [
      ['stroke=0', 'M x1 y1', 'A wd2 hd2 stAng swAng', 'L hc vc', 'Z'],
      ['fill=none', 'M x1 y1', 'A wd2 hd2 stAng swAng'],
    ],
  },
  bentArrow: {
    av: ['adj1 val 25000', 'adj2 val 25000', 'adj3 val 25000', 'adj4 val 43750'],
    gd: [
      'a2 pin 0 adj2 50000', 'maxAdj1 */ a2 2 1', 'a1 pin 0 adj1 maxAdj1', 'a3 pin 0 adj3 50000', 'th */ ss a1 100000',
      'aw2 */ ss a2 100000', 'th2 */ th 1 2', 'dh2 +- aw2 0 th2', 'ah */ ss a3 100000', 'bw +- r 0 ah',
      'bh +- b 0 dh2', 'bs min bw bh', 'maxAdj4 */ 100000 bs ss', 'a4 pin 0 adj4 maxAdj4', 'bd */ ss a4 100000',
      'bd3 +- bd 0 th', 'bd2 max bd3 0', 'x3 +- th bd2 0', 'x4 +- r 0 ah', 'y3 +- dh2 th 0', 'y4 +- y3 dh2 0',
      'y5 +- dh2 bd 0', 'y6 +- y3 bd2 0',
    ],
    ah: [
      'xy adj1 0 maxAdj1 _ _ _ th b', 'xy _ _ _ adj2 0 50000 r y4', 'xy adj3 0 50000 _ _ _ x4 t',
      'xy adj4 0 maxAdj4 _ _ _ bd t',
    ],
    cxn: ['3cd4 x4 t', 'cd4 x4 y4', 'cd4 th2 b', '0 r aw2'],
    rect: 'l t r b',
    path: [
      [
        'M l b', 'L l y5', 'A bd bd cd2 cd4', 'L x4 dh2', 'L x4 t', 'L r aw2', 'L x4 y4', 'L x4 y3', 'L x3 y3',
        'A bd2 bd2 3cd4 -5400000', 'L th b', 'Z',
      ],
    ],
  },
  bentConnector2: {
    rect: 'l t r b',
    path: [
      ['fill=none', 'M l t', 'L r t', 'L r b'],
    ],
  },
  bentConnector3: {
    av: ['adj1 val 50000'],
    gd: ['x1 */ w adj1 100000'],
    ah: ['xy adj1 -2147483647 2147483647 _ _ _ x1 vc'],
    rect: 'l t r b',
    path: [
      ['fill=none', 'M l t', 'L x1 t', 'L x1 b', 'L r b'],
    ],
  },
  bentConnector4: {
    av: ['adj1 val 50000', 'adj2 val 50000'],
    gd: ['x1 */ w adj1 100000', 'x2 +/ x1 r 2', 'y2 */ h adj2 100000', 'y1 +/ t y2 2'],
    ah: ['xy adj1 -2147483647 2147483647 _ _ _ x1 y1', 'xy _ _ _ adj2 -2147483647 2147483647 x2 y2'],
    rect: 'l t r b',
    path: [
      ['fill=none', 'M l t', 'L x1 t', 'L x1 y2', 'L r y2', 'L r b'],
    ],
  },
  bentConnector5: {
    av: ['adj1 val 50000', 'adj2 val 50000', 'adj3 val 50000'],
    gd: [
      'x1 */ w adj1 100000', 'x3 */ w adj3 100000', 'x2 +/ x1 x3 2', 'y2 */ h adj2 100000', 'y1 +/ t y2 2',
      'y3 +/ b y2 2',
    ],
    ah: [
      'xy adj1 -2147483647 2147483647 _ _ _ x1 y1', 'xy _ _ _ adj2 -2147483647 2147483647 x2 y2',
      'xy adj3 -2147483647 2147483647 _ _ _ x3 y3',
    ],
    rect: 'l t r b',
    path: [
      ['fill=none', 'M l t', 'L x1 t', 'L x1 y2', 'L x3 y2', 'L x3 b', 'L r b'],
    ],
  },
  bentUpArrow: {
    av: ['adj1 val 25000', 'adj2 val 25000', 'adj3 val 25000'],
    gd: [
      'a1 pin 0 adj1 50000', 'a2 pin 0 adj2 50000', 'a3 pin 0 adj3 50000', 'y1 */ ss a3 100000', 'dx1 */ ss a2 50000',
      'x1 +- r 0 dx1', 'dx3 */ ss a2 100000', 'x3 +- r 0 dx3', 'dx2 */ ss a1 200000', 'x2 +- x3 0 dx2',
      'x4 +- x3 dx2 0', 'dy2 */ ss a1 100000', 'y2 +- b 0 dy2', 'x0 */ x4 1 2', 'y3 +/ y2 b 2', 'y15 +/ y1 b 2',
    ],
    ah: ['xy _ _ _ adj1 0 50000 l y2', 'xy adj2 0 50000 _ _ _ x1 t', 'xy _ _ _ adj3 0 50000 x2 y1'],
    cxn: ['3cd4 x3 t', 'cd2 x1 y1', 'cd2 l y3', 'cd4 x0 b', '0 x4 y15', '0 r y1'],
    rect: 'l y2 x4 b',
    path: [
      ['M l y2', 'L x2 y2', 'L x2 y1', 'L x1 y1', 'L x3 t', 'L r y1', 'L x4 y1', 'L x4 b', 'L l b', 'Z'],
    ],
  },
  bevel: {
    av: ['adj val 12500'],
    gd: ['a pin 0 adj 50000', 'x1 */ ss a 100000', 'x2 +- r 0 x1', 'y2 +- b 0 x1'],
    ah: ['xy adj 0 50000 _ _ _ x1 t'],
    cxn: ['0 r vc', '0 x2 vc', 'cd4 hc b', 'cd4 hc y2', 'cd2 l vc', 'cd2 x1 vc', '3cd4 hc t', '3cd4 hc x1'],
    rect: 'x1 x1 x2 y2',
    path: [
      ['stroke=0', 'M x1 x1', 'L x2 x1', 'L x2 y2', 'L x1 y2', 'Z'],
      ['fill=lightenLess stroke=0', 'M l t', 'L r t', 'L x2 x1', 'L x1 x1', 'Z'],
      ['fill=darkenLess stroke=0', 'M l b', 'L x1 y2', 'L x2 y2', 'L r b', 'Z'],
      ['fill=lighten stroke=0', 'M l t', 'L x1 x1', 'L x1 y2', 'L l b', 'Z'],
      ['fill=darken stroke=0', 'M r t', 'L r b', 'L x2 y2', 'L x2 x1', 'Z'],
      [
        'fill=none', 'M l t', 'L r t', 'L r b', 'L l b', 'Z', 'M x1 x1', 'L x2 x1', 'L x2 y2', 'L x1 y2', 'Z', 'M l t',
        'L x1 x1', 'M l b', 'L x1 y2', 'M r t', 'L x2 x1', 'M r b', 'L x2 y2',
      ],
    ],
  },
  blockArc: {
    av: ['adj1 val 10800000', 'adj2 val 0', 'adj3 val 25000'],
    gd: [
      'stAng pin 0 adj1 21599999', 'istAng pin 0 adj2 21599999', 'a3 pin 0 adj3 50000', 'sw11 +- istAng 0 stAng',
      'sw12 +- sw11 21600000 0', 'swAng ?: sw11 sw11 sw12', 'iswAng +- 0 0 swAng', 'wt1 sin wd2 stAng',
      'ht1 cos hd2 stAng', 'wt3 sin wd2 istAng', 'ht3 cos hd2 istAng', 'dx1 cat2 wd2 ht1 wt1', 'dy1 sat2 hd2 ht1 wt1',
      'dx3 cat2 wd2 ht3 wt3', 'dy3 sat2 hd2 ht3 wt3', 'x1 +- hc dx1 0', 'y1 +- vc dy1 0', 'x3 +- hc dx3 0',
      'y3 +- vc dy3 0', 'dr */ ss a3 100000', 'iwd2 +- wd2 0 dr', 'ihd2 +- hd2 0 dr', 'wt2 sin iwd2 istAng',
      'ht2 cos ihd2 istAng', 'wt4 sin iwd2 stAng', 'ht4 cos ihd2 stAng', 'dx2 cat2 iwd2 ht2 wt2',
      'dy2 sat2 ihd2 ht2 wt2', 'dx4 cat2 iwd2 ht4 wt4', 'dy4 sat2 ihd2 ht4 wt4', 'x2 +- hc dx2 0', 'y2 +- vc dy2 0',
      'x4 +- hc dx4 0', 'y4 +- vc dy4 0', 'sw0 +- 21600000 0 stAng', 'da1 +- swAng 0 sw0', 'g1 max x1 x2',
      'g2 max x3 x4', 'g3 max g1 g2', 'ir ?: da1 r g3', 'sw1 +- cd4 0 stAng', 'sw2 +- 27000000 0 stAng',
      'sw3 ?: sw1 sw1 sw2', 'da2 +- swAng 0 sw3', 'g5 max y1 y2', 'g6 max y3 y4', 'g7 max g5 g6', 'ib ?: da2 b g7',
      'sw4 +- cd2 0 stAng', 'sw5 +- 32400000 0 stAng', 'sw6 ?: sw4 sw4 sw5', 'da3 +- swAng 0 sw6', 'g9 min x1 x2',
      'g10 min x3 x4', 'g11 min g9 g10', 'il ?: da3 l g11', 'sw7 +- 3cd4 0 stAng', 'sw8 +- 37800000 0 stAng',
      'sw9 ?: sw7 sw7 sw8', 'da4 +- swAng 0 sw9', 'g13 min y1 y2', 'g14 min y3 y4', 'g15 min g13 g14',
      'it ?: da4 t g15', 'x5 +/ x1 x4 2', 'y5 +/ y1 y4 2', 'x6 +/ x3 x2 2', 'y6 +/ y3 y2 2', 'cang1 +- stAng 0 cd4',
      'cang2 +- istAng cd4 0', 'cang3 +/ cang1 cang2 2',
    ],
    ah: ['polar _ _ _ adj1 0 21599999 x1 y1', 'polar adj3 0 50000 adj2 0 21599999 x2 y2'],
    cxn: ['cang1 x5 y5', 'cang2 x6 y6', 'cang3 hc vc'],
    rect: 'il it ir ib',
    path: [
      ['M x1 y1', 'A wd2 hd2 stAng swAng', 'L x2 y2', 'A iwd2 ihd2 istAng iswAng', 'Z'],
    ],
  },
  borderCallout1: {
    av: ['adj1 val 18750', 'adj2 val -8333', 'adj3 val 112500', 'adj4 val -38333'],
    gd: ['y1 */ h adj1 100000', 'x1 */ w adj2 100000', 'y2 */ h adj3 100000', 'x2 */ w adj4 100000'],
    ah: [
      'xy adj2 -2147483647 2147483647 adj1 -2147483647 2147483647 x1 y1',
      'xy adj4 -2147483647 2147483647 adj3 -2147483647 2147483647 x2 y2',
    ],
    cxn: ['0 r vc', 'cd4 hc b', 'cd2 l vc', '3cd4 hc t'],
    rect: 'l t r b',
    path: [
      ['M l t', 'L r t', 'L r b', 'L l b', 'Z'],
      ['fill=none', 'M x1 y1', 'L x2 y2'],
    ],
  },
  borderCallout2: {
    av: ['adj1 val 18750', 'adj2 val -8333', 'adj3 val 18750', 'adj4 val -16667', 'adj5 val 112500', 'adj6 val -46667'],
    gd: [
      'y1 */ h adj1 100000', 'x1 */ w adj2 100000', 'y2 */ h adj3 100000', 'x2 */ w adj4 100000',
      'y3 */ h adj5 100000', 'x3 */ w adj6 100000',
    ],
    ah: [
      'xy adj2 -2147483647 2147483647 adj1 -2147483647 2147483647 x1 y1',
      'xy adj4 -2147483647 2147483647 adj3 -2147483647 2147483647 x2 y2',
      'xy adj6 -2147483647 2147483647 adj5 -2147483647 2147483647 x3 y3',
    ],
    cxn: ['0 r vc', 'cd4 hc b', 'cd2 l vc', '3cd4 hc t'],
    rect: 'l t r b',
    path: [
      ['M l t', 'L r t', 'L r b', 'L l b', 'Z'],
      ['fill=none', 'M x1 y1', 'L x2 y2', 'L x3 y3'],
    ],
  },
  borderCallout3: {
    av: [
      'adj1 val 18750', 'adj2 val -8333', 'adj3 val 18750', 'adj4 val -16667', 'adj5 val 100000', 'adj6 val -16667',
      'adj7 val 112963', 'adj8 val -8333',
    ],
    gd: [
      'y1 */ h adj1 100000', 'x1 */ w adj2 100000', 'y2 */ h adj3 100000', 'x2 */ w adj4 100000',
      'y3 */ h adj5 100000', 'x3 */ w adj6 100000', 'y4 */ h adj7 100000', 'x4 */ w adj8 100000',
    ],
    ah: [
      'xy adj2 -2147483647 2147483647 adj1 -2147483647 2147483647 x1 y1',
      'xy adj4 -2147483647 2147483647 adj3 -2147483647 2147483647 x2 y2',
      'xy adj6 -2147483647 2147483647 adj5 -2147483647 2147483647 x3 y3',
      'xy adj8 -2147483647 2147483647 adj7 -2147483647 2147483647 x4 y4',
    ],
    cxn: ['0 r vc', 'cd4 hc b', 'cd2 l vc', '3cd4 hc t'],
    rect: 'l t r b',
    path: [
      ['M l t', 'L r t', 'L r b', 'L l b', 'Z'],
      ['fill=none', 'M x1 y1', 'L x2 y2', 'L x3 y3', 'L x4 y4'],
    ],
  },
  bracePair: {
    av: ['adj val 8333'],
    gd: [
      'a pin 0 adj 25000', 'x1 */ ss a 100000', 'x2 */ ss a 50000', 'x3 +- r 0 x2', 'x4 +- r 0 x1', 'y2 +- vc 0 x1',
      'y3 +- vc x1 0', 'y4 +- b 0 x1', 'it */ x1 29289 100000', 'il +- x1 it 0', 'ir +- r 0 il', 'ib +- b 0 it',
    ],
    ah: ['xy _ _ _ adj 0 25000 l x1'],
    cxn: ['3cd4 hc t', 'cd2 l vc', 'cd4 hc b', '0 r vc'],
    rect: 'il il ir ib',
    path: [
      [
        'stroke=0', 'M x2 b', 'A x1 x1 cd4 cd4', 'L x1 y3', 'A x1 x1 0 -5400000', 'A x1 x1 cd4 -5400000', 'L x1 x1',
        'A x1 x1 cd2 cd4', 'L x3 t', 'A x1 x1 3cd4 cd4', 'L x4 y2', 'A x1 x1 cd2 -5400000', 'A x1 x1 3cd4 -5400000',
        'L x4 y4', 'A x1 x1 0 cd4', 'Z',
      ],
      [
        'fill=none', 'M x2 b', 'A x1 x1 cd4 cd4', 'L x1 y3', 'A x1 x1 0 -5400000', 'A x1 x1 cd4 -5400000', 'L x1 x1',
        'A x1 x1 cd2 cd4', 'M x3 t', 'A x1 x1 3cd4 cd4', 'L x4 y2', 'A x1 x1 cd2 -5400000', 'A x1 x1 3cd4 -5400000',
        'L x4 y4', 'A x1 x1 0 cd4',
      ],
    ],
  },
  bracketPair: {
    av: ['adj val 16667'],
    gd: [
      'a pin 0 adj 50000', 'x1 */ ss a 100000', 'x2 +- r 0 x1', 'y2 +- b 0 x1', 'il */ x1 29289 100000',
      'ir +- r 0 il', 'ib +- b 0 il',
    ],
    ah: ['xy _ _ _ adj 0 50000 l x1'],
    cxn: ['3cd4 hc t', 'cd2 l vc', 'cd4 hc b', '0 r vc'],
    rect: 'il il ir ib',
    path: [
      [
        'stroke=0', 'M l x1', 'A x1 x1 cd2 cd4', 'L x2 t', 'A x1 x1 3cd4 cd4', 'L r y2', 'A x1 x1 0 cd4', 'L x1 b',
        'A x1 x1 cd4 cd4', 'Z',
      ],
      [
        'fill=none', 'M x1 b', 'A x1 x1 cd4 cd4', 'L l x1', 'A x1 x1 cd2 cd4', 'M x2 t', 'A x1 x1 3cd4 cd4', 'L r y2',
        'A x1 x1 0 cd4',
      ],
    ],
  },
  callout1: {
    av: ['adj1 val 18750', 'adj2 val -8333', 'adj3 val 112500', 'adj4 val -38333'],
    gd: ['y1 */ h adj1 100000', 'x1 */ w adj2 100000', 'y2 */ h adj3 100000', 'x2 */ w adj4 100000'],
    ah: [
      'xy adj2 -2147483647 2147483647 adj1 -2147483647 2147483647 x1 y1',
      'xy adj4 -2147483647 2147483647 adj3 -2147483647 2147483647 x2 y2',
    ],
    cxn: ['0 r vc', 'cd4 hc b', 'cd2 l vc', '3cd4 hc t'],
    rect: 'l t r b',
    path: [
      ['stroke=0', 'M l t', 'L r t', 'L r b', 'L l b', 'Z'],
      ['fill=none', 'M x1 y1', 'L x2 y2'],
    ],
  },
  callout2: {
    av: ['adj1 val 18750', 'adj2 val -8333', 'adj3 val 18750', 'adj4 val -16667', 'adj5 val 112500', 'adj6 val -46667'],
    gd: [
      'y1 */ h adj1 100000', 'x1 */ w adj2 100000', 'y2 */ h adj3 100000', 'x2 */ w adj4 100000',
      'y3 */ h adj5 100000', 'x3 */ w adj6 100000',
    ],
    ah: [
      'xy adj2 -2147483647 2147483647 adj1 -2147483647 2147483647 x1 y1',
      'xy adj4 -2147483647 2147483647 adj3 -2147483647 2147483647 x2 y2',
      'xy adj6 -2147483647 2147483647 adj5 -2147483647 2147483647 x3 y3',
    ],
    cxn: ['0 r vc', 'cd4 hc b', 'cd2 l vc', '3cd4 hc t'],
    rect: 'l t r b',
    path: [
      ['stroke=0', 'M l t', 'L r t', 'L r b', 'L l b', 'Z'],
      ['fill=none', 'M x1 y1', 'L x2 y2', 'L x3 y3'],
    ],
  },
  callout3: {
    av: [
      'adj1 val 18750', 'adj2 val -8333', 'adj3 val 18750', 'adj4 val -16667', 'adj5 val 100000', 'adj6 val -16667',
      'adj7 val 112963', 'adj8 val -8333',
    ],
    gd: [
      'y1 */ h adj1 100000', 'x1 */ w adj2 100000', 'y2 */ h adj3 100000', 'x2 */ w adj4 100000',
      'y3 */ h adj5 100000', 'x3 */ w adj6 100000', 'y4 */ h adj7 100000', 'x4 */ w adj8 100000',
    ],
    ah: [
      'xy adj2 -2147483647 2147483647 adj1 -2147483647 2147483647 x1 y1',
      'xy adj4 -2147483647 2147483647 adj3 -2147483647 2147483647 x2 y2',
      'xy adj6 -2147483647 2147483647 adj5 -2147483647 2147483647 x3 y3',
      'xy adj8 -2147483647 2147483647 adj7 -2147483647 2147483647 x4 y4',
    ],
    cxn: ['0 r vc', 'cd4 hc b', 'cd2 l vc', '3cd4 hc t'],
    rect: 'l t r b',
    path: [
      ['stroke=0', 'M l t', 'L r t', 'L r b', 'L l b', 'Z'],
      ['fill=none', 'M x1 y1', 'L x2 y2', 'L x3 y3', 'L x4 y4'],
    ],
  },
  can: {
    av: ['adj val 25000'],
    gd: ['maxAdj */ 50000 h ss', 'a pin 0 adj maxAdj', 'y1 */ ss a 200000', 'y2 +- y1 y1 0', 'y3 +- b 0 y1'],
    ah: ['xy _ _ _ adj 0 maxAdj hc y2'],
    cxn: ['3cd4 hc y2', '3cd4 hc t', 'cd2 l vc', 'cd4 hc b', '0 r vc'],
    rect: 'l y2 r y3',
    path: [
      ['stroke=0', 'M l y1', 'A wd2 y1 cd2 -10800000', 'L r y3', 'A wd2 y1 0 cd2', 'Z'],
      ['fill=lighten stroke=0', 'M l y1', 'A wd2 y1 cd2 cd2', 'A wd2 y1 0 cd2', 'Z'],
      ['fill=none', 'M r y1', 'A wd2 y1 0 cd2', 'A wd2 y1 cd2 cd2', 'L r y3', 'A wd2 y1 0 cd2', 'L l y1'],
    ],
  },
  chartPlus: {
    path: [
      ['w=10 h=10 fill=none', 'M 5 0', 'L 5 10', 'M 0 5', 'L 10 5'],
      ['w=10 h=10 stroke=0', 'M 0 0', 'L 0 10', 'L 10 10', 'L 10 0', 'Z'],
    ],
  },
  chartStar: {
    path: [
      ['w=10 h=10 fill=none', 'M 0 0', 'L 10 10', 'M 0 10', 'L 10 0', 'M 5 0', 'L 5 10'],
      ['w=10 h=10 stroke=0', 'M 0 0', 'L 0 10', 'L 10 10', 'L 10 0', 'Z'],
    ],
  },
  chartX: {
    path: [
      ['w=10 h=10 fill=none', 'M 0 0', 'L 10 10', 'M 0 10', 'L 10 0'],
      ['w=10 h=10 stroke=0', 'M 0 0', 'L 0 10', 'L 10 10', 'L 10 0', 'Z'],
    ],
  },
  chevron: {
    av: ['adj val 50000'],
    gd: [
      'maxAdj */ 100000 w ss', 'a pin 0 adj maxAdj', 'x1 */ ss a 100000', 'x2 +- r 0 x1', 'x3 */ x2 1 2',
      'dx +- x2 0 x1', 'il ?: dx x1 l', 'ir ?: dx x2 r',
    ],
    ah: ['xy adj 0 maxAdj _ _ _ x2 t'],
    cxn: ['3cd4 x3 t', 'cd2 x1 vc', 'cd4 x3 b', '0 r vc'],
    rect: 'il t ir b',
    path: [
      ['M l t', 'L x2 t', 'L r vc', 'L x2 b', 'L l b', 'L x1 vc', 'Z'],
    ],
  },
  chord: {
    av: ['adj1 val 2700000', 'adj2 val 16200000'],
    gd: [
      'stAng pin 0 adj1 21599999', 'enAng pin 0 adj2 21599999', 'sw1 +- enAng 0 stAng', 'sw2 +- sw1 21600000 0',
      'swAng ?: sw1 sw1 sw2', 'wt1 sin wd2 stAng', 'ht1 cos hd2 stAng', 'dx1 cat2 wd2 ht1 wt1', 'dy1 sat2 hd2 ht1 wt1',
      'wt2 sin wd2 enAng', 'ht2 cos hd2 enAng', 'dx2 cat2 wd2 ht2 wt2', 'dy2 sat2 hd2 ht2 wt2', 'x1 +- hc dx1 0',
      'y1 +- vc dy1 0', 'x2 +- hc dx2 0', 'y2 +- vc dy2 0', 'x3 +/ x1 x2 2', 'y3 +/ y1 y2 2', 'midAng0 */ swAng 1 2',
      'midAng +- stAng midAng0 cd2', 'idx cos wd2 2700000', 'idy sin hd2 2700000', 'il +- hc 0 idx', 'ir +- hc idx 0',
      'it +- vc 0 idy', 'ib +- vc idy 0',
    ],
    ah: ['polar _ _ _ adj1 0 21599999 x1 y1', 'polar _ _ _ adj2 0 21599999 x2 y2'],
    cxn: ['stAng x1 y1', 'enAng x2 y2', 'midAng x3 y3'],
    rect: 'il it ir ib',
    path: [
      ['M x1 y1', 'A wd2 hd2 stAng swAng', 'Z'],
    ],
  },
};
