// Formes predefinies DrawingML (partie 4/5), transcrites de presetShapeDefinitions.xml (ECMA-376 partie 1).
// Format : voir PresetDef dans types.ts. Fichier genere : ne pas reformater a la main.
import type { PresetDef } from './types.ts';

export const PRESETS_4: Readonly<Record<string, PresetDef>> = {
  nonIsoscelesTrapezoid: {
    av: ['adj1 val 25000', 'adj2 val 25000'],
    gd: [
      'maxAdj */ 50000 w ss', 'a1 pin 0 adj1 maxAdj', 'a2 pin 0 adj2 maxAdj', 'x1 */ ss a1 200000',
      'x2 */ ss a1 100000', 'dx3 */ ss a2 100000', 'x3 +- r 0 dx3', 'x4 +/ r x3 2', 'il */ wd3 a1 maxAdj',
      'adjm max a1 a2', 'it */ hd3 adjm maxAdj', 'irt */ wd3 a2 maxAdj', 'ir +- r 0 irt',
    ],
    ah: ['xy adj1 0 maxAdj _ _ _ x2 t', 'xy adj2 0 maxAdj _ _ _ x3 t'],
    cxn: ['0 x4 vc', 'cd4 hc b', 'cd2 x1 vc', '3cd4 hc t'],
    rect: 'il it ir b',
    path: [
      ['M l b', 'L x2 t', 'L x3 t', 'L r b', 'Z'],
    ],
  },
  noSmoking: {
    av: ['adj val 18750'],
    gd: [
      'a pin 0 adj 50000', 'dr */ ss a 100000', 'iwd2 +- wd2 0 dr', 'ihd2 +- hd2 0 dr', 'ang at2 w h',
      'ct cos ihd2 ang', 'st sin iwd2 ang', 'm mod ct st 0', 'n */ iwd2 ihd2 m', 'drd2 */ dr 1 2', 'dang at2 n drd2',
      'dang2 */ dang 2 1', 'swAng +- -10800000 dang2 0', 't3 at2 w h', 'stAng1 +- t3 0 dang', 'stAng2 +- stAng1 0 cd2',
      'ct1 cos ihd2 stAng1', 'st1 sin iwd2 stAng1', 'm1 mod ct1 st1 0', 'n1 */ iwd2 ihd2 m1', 'dx1 cos n1 stAng1',
      'dy1 sin n1 stAng1', 'x1 +- hc dx1 0', 'y1 +- vc dy1 0', 'x2 +- hc 0 dx1', 'y2 +- vc 0 dy1',
      'idx cos wd2 2700000', 'idy sin hd2 2700000', 'il +- hc 0 idx', 'ir +- hc idx 0', 'it +- vc 0 idy',
      'ib +- vc idy 0',
    ],
    ah: ['polar adj 0 50000 _ _ _ dr vc'],
    cxn: ['3cd4 hc t', '3cd4 il it', 'cd2 l vc', 'cd4 il ib', 'cd4 hc b', 'cd4 ir ib', '0 r vc', '3cd4 ir it'],
    rect: 'il it ir ib',
    path: [
      [
        'M l vc', 'A wd2 hd2 cd2 cd4', 'A wd2 hd2 3cd4 cd4', 'A wd2 hd2 0 cd4', 'A wd2 hd2 cd4 cd4', 'Z', 'M x1 y1',
        'A iwd2 ihd2 stAng1 swAng', 'Z', 'M x2 y2', 'A iwd2 ihd2 stAng2 swAng', 'Z',
      ],
    ],
  },
  notchedRightArrow: {
    av: ['adj1 val 50000', 'adj2 val 50000'],
    gd: [
      'maxAdj2 */ 100000 w ss', 'a1 pin 0 adj1 100000', 'a2 pin 0 adj2 maxAdj2', 'dx2 */ ss a2 100000',
      'x2 +- r 0 dx2', 'dy1 */ h a1 200000', 'y1 +- vc 0 dy1', 'y2 +- vc dy1 0', 'x1 */ dy1 dx2 hd2', 'x3 +- r 0 x1',
    ],
    ah: ['xy _ _ _ adj1 0 100000 r y1', 'xy adj2 0 maxAdj2 _ _ _ x2 t'],
    cxn: ['3cd4 x2 t', 'cd2 x1 vc', 'cd4 x2 b', '0 r vc'],
    rect: 'x1 y1 x3 y2',
    path: [
      ['M l y1', 'L x2 y1', 'L x2 t', 'L r vc', 'L x2 b', 'L x2 y2', 'L l y2', 'L x1 vc', 'Z'],
    ],
  },
  octagon: {
    av: ['adj val 29289'],
    gd: [
      'a pin 0 adj 50000', 'x1 */ ss a 100000', 'x2 +- r 0 x1', 'y2 +- b 0 x1', 'il */ x1 1 2', 'ir +- r 0 il',
      'ib +- b 0 il',
    ],
    ah: ['xy adj 0 50000 _ _ _ x1 t'],
    cxn: ['0 r x1', '0 r y2', 'cd4 x2 b', 'cd4 x1 b', 'cd2 l y2', 'cd2 l x1', '3cd4 x1 t', '3cd4 x2 t'],
    rect: 'il il ir ib',
    path: [
      ['M l x1', 'L x1 t', 'L x2 t', 'L r x1', 'L r y2', 'L x2 b', 'L x1 b', 'L l y2', 'Z'],
    ],
  },
  parallelogram: {
    av: ['adj val 25000'],
    gd: [
      'maxAdj */ 100000 w ss', 'a pin 0 adj maxAdj', 'x1 */ ss a 200000', 'x2 */ ss a 100000', 'x6 +- r 0 x1',
      'x5 +- r 0 x2', 'x3 */ x5 1 2', 'x4 +- r 0 x3', 'il */ wd2 a maxAdj', 'q1 */ 5 a maxAdj', 'q2 +/ 1 q1 12',
      'il */ q2 w 1', 'it */ q2 h 1', 'ir +- r 0 il', 'ib +- b 0 it', 'q3 */ h hc x2', 'y1 pin 0 q3 h', 'y2 +- b 0 y1',
    ],
    ah: ['xy adj 0 maxAdj _ _ _ x2 t'],
    cxn: ['3cd4 hc y2', '3cd4 x4 t', '0 x6 vc', 'cd4 x3 b', 'cd4 hc y1', 'cd2 x1 vc'],
    rect: 'il it ir ib',
    path: [
      ['M l b', 'L x2 t', 'L r t', 'L x5 b', 'Z'],
    ],
  },
  pentagon: {
    av: ['hf val 105146', 'vf val 110557'],
    gd: [
      'swd2 */ wd2 hf 100000', 'shd2 */ hd2 vf 100000', 'svc */ vc vf 100000', 'dx1 cos swd2 1080000',
      'dx2 cos swd2 18360000', 'dy1 sin shd2 1080000', 'dy2 sin shd2 18360000', 'x1 +- hc 0 dx1', 'x2 +- hc 0 dx2',
      'x3 +- hc dx2 0', 'x4 +- hc dx1 0', 'y1 +- svc 0 dy1', 'y2 +- svc 0 dy2', 'it */ y1 dx2 dx1',
    ],
    cxn: ['3cd4 hc t', 'cd2 x1 y1', 'cd4 x2 y2', 'cd4 hc b', 'cd4 x3 y2', '0 x4 y1'],
    rect: 'x2 it x3 y2',
    path: [
      ['M x1 y1', 'L hc t', 'L x4 y1', 'L x3 y2', 'L x2 y2', 'Z'],
    ],
  },
  pie: {
    av: ['adj1 val 0', 'adj2 val 16200000'],
    gd: [
      'stAng pin 0 adj1 21599999', 'enAng pin 0 adj2 21599999', 'sw1 +- enAng 0 stAng', 'sw2 +- sw1 21600000 0',
      'swAng ?: sw1 sw1 sw2', 'wt1 sin wd2 stAng', 'ht1 cos hd2 stAng', 'dx1 cat2 wd2 ht1 wt1', 'dy1 sat2 hd2 ht1 wt1',
      'x1 +- hc dx1 0', 'y1 +- vc dy1 0', 'wt2 sin wd2 enAng', 'ht2 cos hd2 enAng', 'dx2 cat2 wd2 ht2 wt2',
      'dy2 sat2 hd2 ht2 wt2', 'x2 +- hc dx2 0', 'y2 +- vc dy2 0', 'idx cos wd2 2700000', 'idy sin hd2 2700000',
      'il +- hc 0 idx', 'ir +- hc idx 0', 'it +- vc 0 idy', 'ib +- vc idy 0',
    ],
    ah: ['polar _ _ _ adj1 0 21599999 x1 y1', 'polar _ _ _ adj2 0 21599999 x2 y2'],
    cxn: ['0 r vc', 'cd4 hc b', 'cd2 l vc', '3cd4 hc t'],
    rect: 'il it ir ib',
    path: [
      ['M x1 y1', 'A wd2 hd2 stAng swAng', 'L hc vc', 'Z'],
    ],
  },
  pieWedge: {
    gd: ['g1 cos w 13500000', 'g2 sin h 13500000', 'x1 +- r g1 0', 'y1 +- b g2 0'],
    cxn: ['0 r vc', 'cd4 hc b'],
    rect: 'x1 y1 r b',
    path: [
      ['M l b', 'A w h cd2 cd4', 'L r b', 'Z'],
    ],
  },
  plaque: {
    av: ['adj val 16667'],
    gd: [
      'a pin 0 adj 50000', 'x1 */ ss a 100000', 'x2 +- r 0 x1', 'y2 +- b 0 x1', 'il */ x1 70711 100000',
      'ir +- r 0 il', 'ib +- b 0 il',
    ],
    ah: ['xy adj 0 50000 _ _ _ x1 t'],
    cxn: ['3cd4 hc t', 'cd2 l vc', 'cd4 hc b', '0 r vc'],
    rect: 'il il ir ib',
    path: [
      [
        'M l x1', 'A x1 x1 cd4 -5400000', 'L x2 t', 'A x1 x1 cd2 -5400000', 'L r y2', 'A x1 x1 3cd4 -5400000',
        'L x1 b', 'A x1 x1 0 -5400000', 'Z',
      ],
    ],
  },
  plaqueTabs: {
    gd: ['md mod w h 0', 'dx */ 1 md 20', 'y1 +- 0 b dx', 'x1 +- 0 r dx'],
    cxn: [
      'cd2 l t', 'cd2 l dx', 'cd2 l y1', 'cd2 l b', '3cd4 dx t', '3cd4 x1 t', 'cd4 dx b', 'cd4 x1 b', '0 r t',
      '0 r dx', '0 r y1', '0 r b',
    ],
    rect: 'dx dx x1 y1',
    path: [
      ['M l t', 'L dx t', 'A dx dx 0 cd4', 'Z'],
      ['M l y1', 'A dx dx 3cd4 cd4', 'L l b', 'Z'],
      ['M r t', 'L r dx', 'A dx dx cd4 cd4', 'Z'],
      ['M x1 b', 'A dx dx cd2 cd4', 'L r b', 'Z'],
    ],
  },
  plus: {
    av: ['adj val 25000'],
    gd: [
      'a pin 0 adj 50000', 'x1 */ ss a 100000', 'x2 +- r 0 x1', 'y2 +- b 0 x1', 'd +- w 0 h', 'il ?: d l x1',
      'ir ?: d r x2', 'it ?: d x1 t', 'ib ?: d y2 b',
    ],
    ah: ['xy adj 0 50000 _ _ _ x1 t'],
    cxn: ['3cd4 hc t', 'cd2 l vc', 'cd4 hc b', '0 r vc'],
    rect: 'il it ir ib',
    path: [
      [
        'M l x1', 'L x1 x1', 'L x1 t', 'L x2 t', 'L x2 x1', 'L r x1', 'L r y2', 'L x2 y2', 'L x2 b', 'L x1 b',
        'L x1 y2', 'L l y2', 'Z',
      ],
    ],
  },
  quadArrow: {
    av: ['adj1 val 22500', 'adj2 val 22500', 'adj3 val 22500'],
    gd: [
      'a2 pin 0 adj2 50000', 'maxAdj1 */ a2 2 1', 'a1 pin 0 adj1 maxAdj1', 'q1 +- 100000 0 maxAdj1',
      'maxAdj3 */ q1 1 2', 'a3 pin 0 adj3 maxAdj3', 'x1 */ ss a3 100000', 'dx2 */ ss a2 100000', 'x2 +- hc 0 dx2',
      'x5 +- hc dx2 0', 'dx3 */ ss a1 200000', 'x3 +- hc 0 dx3', 'x4 +- hc dx3 0', 'x6 +- r 0 x1', 'y2 +- vc 0 dx2',
      'y5 +- vc dx2 0', 'y3 +- vc 0 dx3', 'y4 +- vc dx3 0', 'y6 +- b 0 x1', 'il */ dx3 x1 dx2', 'ir +- r 0 il',
    ],
    ah: ['xy adj1 0 maxAdj1 _ _ _ x3 x1', 'xy adj2 0 50000 _ _ _ x2 t', 'xy _ _ _ adj3 0 maxAdj3 r x1'],
    cxn: ['3cd4 hc t', 'cd2 l vc', 'cd4 hc b', '0 r vc'],
    rect: 'il y3 ir y4',
    path: [
      [
        'M l vc', 'L x1 y2', 'L x1 y3', 'L x3 y3', 'L x3 x1', 'L x2 x1', 'L hc t', 'L x5 x1', 'L x4 x1', 'L x4 y3',
        'L x6 y3', 'L x6 y2', 'L r vc', 'L x6 y5', 'L x6 y4', 'L x4 y4', 'L x4 y6', 'L x5 y6', 'L hc b', 'L x2 y6',
        'L x3 y6', 'L x3 y4', 'L x1 y4', 'L x1 y5', 'Z',
      ],
    ],
  },
  quadArrowCallout: {
    av: ['adj1 val 18515', 'adj2 val 18515', 'adj3 val 18515', 'adj4 val 48123'],
    gd: [
      'a2 pin 0 adj2 50000', 'maxAdj1 */ a2 2 1', 'a1 pin 0 adj1 maxAdj1', 'maxAdj3 +- 50000 0 a2',
      'a3 pin 0 adj3 maxAdj3', 'q2 */ a3 2 1', 'maxAdj4 +- 100000 0 q2', 'a4 pin a1 adj4 maxAdj4',
      'dx2 */ ss a2 100000', 'dx3 */ ss a1 200000', 'ah */ ss a3 100000', 'dx1 */ w a4 200000', 'dy1 */ h a4 200000',
      'x8 +- r 0 ah', 'x2 +- hc 0 dx1', 'x7 +- hc dx1 0', 'x3 +- hc 0 dx2', 'x6 +- hc dx2 0', 'x4 +- hc 0 dx3',
      'x5 +- hc dx3 0', 'y8 +- b 0 ah', 'y2 +- vc 0 dy1', 'y7 +- vc dy1 0', 'y3 +- vc 0 dx2', 'y6 +- vc dx2 0',
      'y4 +- vc 0 dx3', 'y5 +- vc dx3 0',
    ],
    ah: [
      'xy adj1 0 maxAdj1 _ _ _ x4 ah', 'xy adj2 0 50000 _ _ _ x3 t', 'xy _ _ _ adj3 0 maxAdj3 r ah',
      'xy _ _ _ adj4 a1 maxAdj4 l y2',
    ],
    cxn: ['3cd4 hc t', 'cd2 l vc', 'cd4 hc b', '0 r vc'],
    rect: 'x2 y2 x7 y7',
    path: [
      [
        'M l vc', 'L ah y3', 'L ah y4', 'L x2 y4', 'L x2 y2', 'L x4 y2', 'L x4 ah', 'L x3 ah', 'L hc t', 'L x6 ah',
        'L x5 ah', 'L x5 y2', 'L x7 y2', 'L x7 y4', 'L x8 y4', 'L x8 y3', 'L r vc', 'L x8 y6', 'L x8 y5', 'L x7 y5',
        'L x7 y7', 'L x5 y7', 'L x5 y8', 'L x6 y8', 'L hc b', 'L x3 y8', 'L x4 y8', 'L x4 y7', 'L x2 y7', 'L x2 y5',
        'L ah y5', 'L ah y6', 'Z',
      ],
    ],
  },
  rect: {
    cxn: ['3cd4 hc t', 'cd2 l vc', 'cd4 hc b', '0 r vc'],
    rect: 'l t r b',
    path: [
      ['M l t', 'L r t', 'L r b', 'L l b', 'Z'],
    ],
  },
  ribbon: {
    av: ['adj1 val 16667', 'adj2 val 50000'],
    gd: [
      'a1 pin 0 adj1 33333', 'a2 pin 25000 adj2 75000', 'x10 +- r 0 wd8', 'dx2 */ w a2 200000', 'x2 +- hc 0 dx2',
      'x9 +- hc dx2 0', 'x3 +- x2 wd32 0', 'x8 +- x9 0 wd32', 'x5 +- x2 wd8 0', 'x6 +- x9 0 wd8', 'x4 +- x5 0 wd32',
      'x7 +- x6 wd32 0', 'y1 */ h a1 200000', 'y2 */ h a1 100000', 'y4 +- b 0 y2', 'y3 */ y4 1 2', 'hR */ h a1 400000',
      'y5 +- b 0 hR', 'y6 +- y2 0 hR',
    ],
    ah: ['xy _ _ _ adj1 0 33333 hc y2', 'xy adj2 25000 75000 _ _ _ x2 t'],
    cxn: ['3cd4 hc y2', 'cd2 wd8 y3', 'cd4 hc b', '0 x10 y3'],
    rect: 'x2 y2 x9 b',
    path: [
      [
        'stroke=0', 'M l t', 'L x4 t', 'A wd32 hR 3cd4 cd2', 'L x3 y1', 'A wd32 hR 3cd4 -10800000', 'L x8 y2',
        'A wd32 hR cd4 -10800000', 'L x7 y1', 'A wd32 hR cd4 cd2', 'L r t', 'L x10 y3', 'L r y4', 'L x9 y4', 'L x9 y5',
        'A wd32 hR 0 cd4', 'L x3 b', 'A wd32 hR cd4 cd4', 'L x2 y4', 'L l y4', 'L wd8 y3', 'Z',
      ],
      [
        'fill=darkenLess stroke=0', 'M x5 hR', 'A wd32 hR 0 cd4', 'L x3 y1', 'A wd32 hR 3cd4 -10800000', 'L x5 y2',
        'Z', 'M x6 hR', 'A wd32 hR cd2 -5400000', 'L x8 y1', 'A wd32 hR 3cd4 cd2', 'L x6 y2', 'Z',
      ],
      [
        'fill=none', 'M l t', 'L x4 t', 'A wd32 hR 3cd4 cd2', 'L x3 y1', 'A wd32 hR 3cd4 -10800000', 'L x8 y2',
        'A wd32 hR cd4 -10800000', 'L x7 y1', 'A wd32 hR cd4 cd2', 'L r t', 'L x10 y3', 'L r y4', 'L x9 y4', 'L x9 y5',
        'A wd32 hR 0 cd4', 'L x3 b', 'A wd32 hR cd4 cd4', 'L x2 y4', 'L l y4', 'L wd8 y3', 'Z', 'M x5 hR', 'L x5 y2',
        'M x6 y2', 'L x6 hR', 'M x2 y4', 'L x2 y6', 'M x9 y6', 'L x9 y4',
      ],
    ],
  },
  ribbon2: {
    av: ['adj1 val 16667', 'adj2 val 50000'],
    gd: [
      'a1 pin 0 adj1 33333', 'a2 pin 25000 adj2 75000', 'x10 +- r 0 wd8', 'dx2 */ w a2 200000', 'x2 +- hc 0 dx2',
      'x9 +- hc dx2 0', 'x3 +- x2 wd32 0', 'x8 +- x9 0 wd32', 'x5 +- x2 wd8 0', 'x6 +- x9 0 wd8', 'x4 +- x5 0 wd32',
      'x7 +- x6 wd32 0', 'dy1 */ h a1 200000', 'y1 +- b 0 dy1', 'dy2 */ h a1 100000', 'y2 +- b 0 dy2', 'y4 +- t dy2 0',
      'y3 +/ y4 b 2', 'hR */ h a1 400000', 'y6 +- b 0 hR', 'y7 +- y1 0 hR',
    ],
    ah: ['xy _ _ _ adj1 0 33333 hc y2', 'xy adj2 25000 75000 _ _ _ x2 b'],
    cxn: ['3cd4 hc t', 'cd2 wd8 y3', 'cd4 hc y2', '0 x10 y3'],
    rect: 'x2 t x9 y2',
    path: [
      [
        'stroke=0', 'M l b', 'L x4 b', 'A wd32 hR cd4 -10800000', 'L x3 y1', 'A wd32 hR cd4 cd2', 'L x8 y2',
        'A wd32 hR 3cd4 cd2', 'L x7 y1', 'A wd32 hR 3cd4 -10800000', 'L r b', 'L x10 y3', 'L r y4', 'L x9 y4',
        'L x9 hR', 'A wd32 hR 0 -5400000', 'L x3 t', 'A wd32 hR 3cd4 -5400000', 'L x2 y4', 'L l y4', 'L wd8 y3', 'Z',
      ],
      [
        'fill=darkenLess stroke=0', 'M x5 y6', 'A wd32 hR 0 -5400000', 'L x3 y1', 'A wd32 hR cd4 cd2', 'L x5 y2', 'Z',
        'M x6 y6', 'A wd32 hR cd2 cd4', 'L x8 y1', 'A wd32 hR cd4 -10800000', 'L x6 y2', 'Z',
      ],
      [
        'fill=none', 'M l b', 'L wd8 y3', 'L l y4', 'L x2 y4', 'L x2 hR', 'A wd32 hR cd2 cd4', 'L x8 t',
        'A wd32 hR 3cd4 cd4', 'L x9 y4', 'L x9 y4', 'L r y4', 'L x10 y3', 'L r b', 'L x7 b', 'A wd32 hR cd4 cd2',
        'L x8 y1', 'A wd32 hR cd4 -10800000', 'L x3 y2', 'A wd32 hR 3cd4 -10800000', 'L x4 y1', 'A wd32 hR 3cd4 cd2',
        'Z', 'M x5 y2', 'L x5 y6', 'M x6 y6', 'L x6 y2', 'M x2 y7', 'L x2 y4', 'M x9 y4', 'L x9 y7',
      ],
    ],
  },
  rightArrow: {
    av: ['adj1 val 50000', 'adj2 val 50000'],
    gd: [
      'maxAdj2 */ 100000 w ss', 'a1 pin 0 adj1 100000', 'a2 pin 0 adj2 maxAdj2', 'dx1 */ ss a2 100000',
      'x1 +- r 0 dx1', 'dy1 */ h a1 200000', 'y1 +- vc 0 dy1', 'y2 +- vc dy1 0', 'dx2 */ y1 dx1 hd2', 'x2 +- x1 dx2 0',
    ],
    ah: ['xy _ _ _ adj1 0 100000 l y1', 'xy adj2 0 maxAdj2 _ _ _ x1 t'],
    cxn: ['3cd4 x1 t', 'cd2 l vc', 'cd4 x1 b', '0 r vc'],
    rect: 'l y1 x2 y2',
    path: [
      ['M l y1', 'L x1 y1', 'L x1 t', 'L r vc', 'L x1 b', 'L x1 y2', 'L l y2', 'Z'],
    ],
  },
  rightArrowCallout: {
    av: ['adj1 val 25000', 'adj2 val 25000', 'adj3 val 25000', 'adj4 val 64977'],
    gd: [
      'maxAdj2 */ 50000 h ss', 'a2 pin 0 adj2 maxAdj2', 'maxAdj1 */ a2 2 1', 'a1 pin 0 adj1 maxAdj1',
      'maxAdj3 */ 100000 w ss', 'a3 pin 0 adj3 maxAdj3', 'q2 */ a3 ss w', 'maxAdj4 +- 100000 0 q2',
      'a4 pin 0 adj4 maxAdj4', 'dy1 */ ss a2 100000', 'dy2 */ ss a1 200000', 'y1 +- vc 0 dy1', 'y2 +- vc 0 dy2',
      'y3 +- vc dy2 0', 'y4 +- vc dy1 0', 'dx3 */ ss a3 100000', 'x3 +- r 0 dx3', 'x2 */ w a4 100000', 'x1 */ x2 1 2',
    ],
    ah: [
      'xy _ _ _ adj1 0 maxAdj1 x3 y2', 'xy _ _ _ adj2 0 maxAdj2 r y1', 'xy adj3 0 maxAdj3 _ _ _ x3 t',
      'xy adj4 0 maxAdj4 _ _ _ x2 b',
    ],
    cxn: ['3cd4 x1 t', 'cd2 l vc', 'cd4 x1 b', '0 r vc'],
    rect: 'l t x2 b',
    path: [
      [
        'M l t', 'L x2 t', 'L x2 y2', 'L x3 y2', 'L x3 y1', 'L r vc', 'L x3 y4', 'L x3 y3', 'L x2 y3', 'L x2 b',
        'L l b', 'Z',
      ],
    ],
  },
  rightBrace: {
    av: ['adj1 val 8333', 'adj2 val 50000'],
    gd: [
      'a2 pin 0 adj2 100000', 'q1 +- 100000 0 a2', 'q2 min q1 a2', 'q3 */ q2 1 2', 'maxAdj1 */ q3 h ss',
      'a1 pin 0 adj1 maxAdj1', 'y1 */ ss a1 100000', 'y3 */ h a2 100000', 'y2 +- y3 0 y1', 'y4 +- b 0 y1',
      'dx1 cos wd2 2700000', 'dy1 sin y1 2700000', 'ir +- l dx1 0', 'it +- y1 0 dy1', 'ib +- b dy1 y1',
    ],
    ah: ['xy _ _ _ adj1 0 maxAdj1 hc y1', 'xy _ _ _ adj2 0 100000 r y3'],
    cxn: ['cd4 l t', 'cd2 r y3', '3cd4 l b'],
    rect: 'l it ir ib',
    path: [
      [
        'stroke=0', 'M l t', 'A wd2 y1 3cd4 cd4', 'L hc y2', 'A wd2 y1 cd2 -5400000', 'A wd2 y1 3cd4 -5400000',
        'L hc y4', 'A wd2 y1 0 cd4', 'Z',
      ],
      [
        'fill=none', 'M l t', 'A wd2 y1 3cd4 cd4', 'L hc y2', 'A wd2 y1 cd2 -5400000', 'A wd2 y1 3cd4 -5400000',
        'L hc y4', 'A wd2 y1 0 cd4',
      ],
    ],
  },
  rightBracket: {
    av: ['adj val 8333'],
    gd: [
      'maxAdj */ 50000 h ss', 'a pin 0 adj maxAdj', 'y1 */ ss a 100000', 'y2 +- b 0 y1', 'dx1 cos w 2700000',
      'dy1 sin y1 2700000', 'ir +- l dx1 0', 'it +- y1 0 dy1', 'ib +- b dy1 y1',
    ],
    ah: ['xy _ _ _ adj 0 maxAdj r y1'],
    cxn: ['cd4 l t', '3cd4 l b', 'cd2 r vc'],
    rect: 'l it ir ib',
    path: [
      ['stroke=0', 'M l t', 'A w y1 3cd4 cd4', 'L r y2', 'A w y1 0 cd4', 'Z'],
      ['fill=none', 'M l t', 'A w y1 3cd4 cd4', 'L r y2', 'A w y1 0 cd4'],
    ],
  },
  round1Rect: {
    av: ['adj val 16667'],
    gd: ['a pin 0 adj 50000', 'dx1 */ ss a 100000', 'x1 +- r 0 dx1', 'idx */ dx1 29289 100000', 'ir +- r 0 idx'],
    ah: ['xy adj 0 50000 _ _ _ x1 t'],
    cxn: ['3cd4 hc t', 'cd2 l vc', 'cd4 hc b', '0 r vc'],
    rect: 'l t ir b',
    path: [
      ['M l t', 'L x1 t', 'A dx1 dx1 3cd4 cd4', 'L r b', 'L l b', 'Z'],
    ],
  },
  round2DiagRect: {
    av: ['adj1 val 16667', 'adj2 val 0'],
    gd: [
      'a1 pin 0 adj1 50000', 'a2 pin 0 adj2 50000', 'x1 */ ss a1 100000', 'y1 +- b 0 x1', 'a */ ss a2 100000',
      'x2 +- r 0 a', 'y2 +- b 0 a', 'dx1 */ x1 29289 100000', 'dx2 */ a 29289 100000', 'd +- dx1 0 dx2',
      'dx ?: d dx1 dx2', 'ir +- r 0 dx', 'ib +- b 0 dx',
    ],
    ah: ['xy adj1 0 50000 _ _ _ x1 t', 'xy adj2 0 50000 _ _ _ x2 t'],
    cxn: ['0 r vc', 'cd4 hc b', 'cd2 l vc', '3cd4 hc t'],
    rect: 'dx dx ir ib',
    path: [
      [
        'M x1 t', 'L x2 t', 'A a a 3cd4 cd4', 'L r y1', 'A x1 x1 0 cd4', 'L a b', 'A a a cd4 cd4', 'L l x1',
        'A x1 x1 cd2 cd4', 'Z',
      ],
    ],
  },
  round2SameRect: {
    av: ['adj1 val 16667', 'adj2 val 0'],
    gd: [
      'a1 pin 0 adj1 50000', 'a2 pin 0 adj2 50000', 'tx1 */ ss a1 100000', 'tx2 +- r 0 tx1', 'bx1 */ ss a2 100000',
      'bx2 +- r 0 bx1', 'by1 +- b 0 bx1', 'd +- tx1 0 bx1', 'tdx */ tx1 29289 100000', 'bdx */ bx1 29289 100000',
      'il ?: d tdx bdx', 'ir +- r 0 il', 'ib +- b 0 bdx',
    ],
    ah: ['xy adj1 0 50000 _ _ _ tx2 t', 'xy adj2 0 50000 _ _ _ bx1 b'],
    cxn: ['0 r vc', 'cd4 hc b', 'cd2 l vc', '3cd4 hc t'],
    rect: 'il tdx ir ib',
    path: [
      [
        'M tx1 t', 'L tx2 t', 'A tx1 tx1 3cd4 cd4', 'L r by1', 'A bx1 bx1 0 cd4', 'L bx1 b', 'A bx1 bx1 cd4 cd4',
        'L l tx1', 'A tx1 tx1 cd2 cd4', 'Z',
      ],
    ],
  },
  roundRect: {
    av: ['adj val 16667'],
    gd: [
      'a pin 0 adj 50000', 'x1 */ ss a 100000', 'x2 +- r 0 x1', 'y2 +- b 0 x1', 'il */ x1 29289 100000',
      'ir +- r 0 il', 'ib +- b 0 il',
    ],
    ah: ['xy adj 0 50000 _ _ _ x1 t'],
    cxn: ['3cd4 hc t', 'cd2 l vc', 'cd4 hc b', '0 r vc'],
    rect: 'il il ir ib',
    path: [
      [
        'M l x1', 'A x1 x1 cd2 cd4', 'L x2 t', 'A x1 x1 3cd4 cd4', 'L r y2', 'A x1 x1 0 cd4', 'L x1 b',
        'A x1 x1 cd4 cd4', 'Z',
      ],
    ],
  },
  rtTriangle: {
    gd: ['it */ h 7 12', 'ir */ w 7 12', 'ib */ h 11 12'],
    cxn: ['3cd4 l t', 'cd2 l vc', 'cd4 l b', 'cd4 hc b', 'cd4 r b', '0 hc vc'],
    rect: 'wd12 it ir ib',
    path: [
      ['M l b', 'L l t', 'L r b', 'Z'],
    ],
  },
  smileyFace: {
    av: ['adj val 4653'],
    gd: [
      'a pin -4653 adj 4653', 'x1 */ w 4969 21699', 'x2 */ w 6215 21600', 'x3 */ w 13135 21600', 'x4 */ w 16640 21600',
      'y1 */ h 7570 21600', 'y3 */ h 16515 21600', 'dy2 */ h a 100000', 'y2 +- y3 0 dy2', 'y4 +- y3 dy2 0',
      'dy3 */ h a 50000', 'y5 +- y4 dy3 0', 'idx cos wd2 2700000', 'idy sin hd2 2700000', 'il +- hc 0 idx',
      'ir +- hc idx 0', 'it +- vc 0 idy', 'ib +- vc idy 0', 'wR */ w 1125 21600', 'hR */ h 1125 21600',
    ],
    ah: ['xy _ _ _ adj -4653 4653 hc y4'],
    cxn: ['3cd4 hc t', '3cd4 il it', 'cd2 l vc', 'cd4 il ib', 'cd4 hc b', 'cd4 ir ib', '0 r vc', '3cd4 ir it'],
    rect: 'il it ir ib',
    path: [
      ['stroke=0', 'M l vc', 'A wd2 hd2 cd2 21600000', 'Z'],
      ['fill=darkenLess', 'M x2 y1', 'A wR hR cd2 21600000', 'M x3 y1', 'A wR hR cd2 21600000'],
      ['fill=none', 'M x1 y2', 'Q hc y5 x4 y2'],
      ['fill=none', 'M l vc', 'A wd2 hd2 cd2 21600000', 'Z'],
    ],
  },
  snip1Rect: {
    av: ['adj val 16667'],
    gd: ['a pin 0 adj 50000', 'dx1 */ ss a 100000', 'x1 +- r 0 dx1', 'it */ dx1 1 2', 'ir +/ x1 r 2'],
    ah: ['xy adj 0 50000 _ _ _ x1 t'],
    cxn: ['0 r vc', 'cd4 hc b', 'cd2 l vc', '3cd4 hc t'],
    rect: 'l it ir b',
    path: [
      ['M l t', 'L x1 t', 'L r dx1', 'L r b', 'L l b', 'Z'],
    ],
  },
  snip2DiagRect: {
    av: ['adj1 val 0', 'adj2 val 16667'],
    gd: [
      'a1 pin 0 adj1 50000', 'a2 pin 0 adj2 50000', 'lx1 */ ss a1 100000', 'lx2 +- r 0 lx1', 'ly1 +- b 0 lx1',
      'rx1 */ ss a2 100000', 'rx2 +- r 0 rx1', 'ry1 +- b 0 rx1', 'd +- lx1 0 rx1', 'dx ?: d lx1 rx1', 'il */ dx 1 2',
      'ir +- r 0 il', 'ib +- b 0 il',
    ],
    ah: ['xy adj1 0 50000 _ _ _ lx1 t', 'xy adj2 0 50000 _ _ _ rx2 t'],
    cxn: ['0 r vc', 'cd4 hc b', 'cd2 l vc', '3cd4 hc t'],
    rect: 'il il ir ib',
    path: [
      ['M lx1 t', 'L rx2 t', 'L r rx1', 'L r ly1', 'L lx2 b', 'L rx1 b', 'L l ry1', 'L l lx1', 'Z'],
    ],
  },
  snip2SameRect: {
    av: ['adj1 val 16667', 'adj2 val 0'],
    gd: [
      'a1 pin 0 adj1 50000', 'a2 pin 0 adj2 50000', 'tx1 */ ss a1 100000', 'tx2 +- r 0 tx1', 'bx1 */ ss a2 100000',
      'bx2 +- r 0 bx1', 'by1 +- b 0 bx1', 'd +- tx1 0 bx1', 'dx ?: d tx1 bx1', 'il */ dx 1 2', 'ir +- r 0 il',
      'it */ tx1 1 2', 'ib +/ by1 b 2',
    ],
    ah: ['xy adj1 0 50000 _ _ _ tx2 t', 'xy adj2 0 50000 _ _ _ bx1 b'],
    cxn: ['0 r vc', 'cd4 hc b', 'cd2 l vc', '3cd4 hc t'],
    rect: 'il it ir ib',
    path: [
      ['M tx1 t', 'L tx2 t', 'L r tx1', 'L r by1', 'L bx2 b', 'L bx1 b', 'L l by1', 'L l tx1', 'Z'],
    ],
  },
  snipRoundRect: {
    av: ['adj1 val 16667', 'adj2 val 16667'],
    gd: [
      'a1 pin 0 adj1 50000', 'a2 pin 0 adj2 50000', 'x1 */ ss a1 100000', 'dx2 */ ss a2 100000', 'x2 +- r 0 dx2',
      'il */ x1 29289 100000', 'ir +/ x2 r 2',
    ],
    ah: ['xy adj1 0 50000 _ _ _ x1 t', 'xy adj2 0 50000 _ _ _ x2 t'],
    cxn: ['0 r vc', 'cd4 hc b', 'cd2 l vc', '3cd4 hc t'],
    rect: 'il il ir b',
    path: [
      ['M x1 t', 'L x2 t', 'L r dx2', 'L r b', 'L l b', 'L l x1', 'A x1 x1 cd2 cd4', 'Z'],
    ],
  },
  squareTabs: {
    gd: ['md mod w h 0', 'dx */ 1 md 20', 'y1 +- 0 b dx', 'x1 +- 0 r dx'],
    cxn: [
      'cd2 l t', 'cd2 l dx', 'cd2 l y1', 'cd2 l b', 'cd2 dx dx', 'cd2 dx x1', '3cd4 dx t', '3cd4 x1 t', 'cd4 dx b',
      'cd4 x1 b', '0 r t', '0 r dx', '0 r y1', '0 r b', '0 x1 dx', '0 x1 y1',
    ],
    rect: 'dx dx x1 y1',
    path: [
      ['M l t', 'L dx t', 'L dx dx', 'L l dx', 'Z'],
      ['M l y1', 'L dx y1', 'L dx b', 'L l b', 'Z'],
      ['M x1 t', 'L r t', 'L r dx', 'L x1 dx', 'Z'],
      ['M x1 y1', 'L r y1', 'L r b', 'L x1 b', 'Z'],
    ],
  },
  star10: {
    av: ['adj val 42533', 'hf val 105146'],
    gd: [
      'a pin 0 adj 50000', 'swd2 */ wd2 hf 100000', 'dx1 */ swd2 95106 100000', 'dx2 */ swd2 58779 100000',
      'x1 +- hc 0 dx1', 'x2 +- hc 0 dx2', 'x3 +- hc dx2 0', 'x4 +- hc dx1 0', 'dy1 */ hd2 80902 100000',
      'dy2 */ hd2 30902 100000', 'y1 +- vc 0 dy1', 'y2 +- vc 0 dy2', 'y3 +- vc dy2 0', 'y4 +- vc dy1 0',
      'iwd2 */ swd2 a 50000', 'ihd2 */ hd2 a 50000', 'sdx1 */ iwd2 80902 100000', 'sdx2 */ iwd2 30902 100000',
      'sdy1 */ ihd2 95106 100000', 'sdy2 */ ihd2 58779 100000', 'sx1 +- hc 0 iwd2', 'sx2 +- hc 0 sdx1',
      'sx3 +- hc 0 sdx2', 'sx4 +- hc sdx2 0', 'sx5 +- hc sdx1 0', 'sx6 +- hc iwd2 0', 'sy1 +- vc 0 sdy1',
      'sy2 +- vc 0 sdy2', 'sy3 +- vc sdy2 0', 'sy4 +- vc sdy1 0', 'yAdj +- vc 0 ihd2',
    ],
    ah: ['xy _ _ _ adj 0 50000 hc yAdj'],
    cxn: [
      '0 x4 y2', '0 x4 y3', 'cd4 x3 y4', 'cd4 hc b', 'cd4 x2 y4', 'cd2 x1 y3', 'cd2 x1 y2', '3cd4 x2 y1', '3cd4 hc t',
      '3cd4 x3 y1',
    ],
    rect: 'sx2 sy2 sx5 sy3',
    path: [
      [
        'M x1 y2', 'L sx2 sy2', 'L x2 y1', 'L sx3 sy1', 'L hc t', 'L sx4 sy1', 'L x3 y1', 'L sx5 sy2', 'L x4 y2',
        'L sx6 vc', 'L x4 y3', 'L sx5 sy3', 'L x3 y4', 'L sx4 sy4', 'L hc b', 'L sx3 sy4', 'L x2 y4', 'L sx2 sy3',
        'L x1 y3', 'L sx1 vc', 'Z',
      ],
    ],
  },
  star12: {
    av: ['adj val 37500'],
    gd: [
      'a pin 0 adj 50000', 'dx1 cos wd2 1800000', 'dy1 sin hd2 3600000', 'x1 +- hc 0 dx1', 'x3 */ w 3 4',
      'x4 +- hc dx1 0', 'y1 +- vc 0 dy1', 'y3 */ h 3 4', 'y4 +- vc dy1 0', 'iwd2 */ wd2 a 50000',
      'ihd2 */ hd2 a 50000', 'sdx1 cos iwd2 900000', 'sdx2 cos iwd2 2700000', 'sdx3 cos iwd2 4500000',
      'sdy1 sin ihd2 4500000', 'sdy2 sin ihd2 2700000', 'sdy3 sin ihd2 900000', 'sx1 +- hc 0 sdx1', 'sx2 +- hc 0 sdx2',
      'sx3 +- hc 0 sdx3', 'sx4 +- hc sdx3 0', 'sx5 +- hc sdx2 0', 'sx6 +- hc sdx1 0', 'sy1 +- vc 0 sdy1',
      'sy2 +- vc 0 sdy2', 'sy3 +- vc 0 sdy3', 'sy4 +- vc sdy3 0', 'sy5 +- vc sdy2 0', 'sy6 +- vc sdy1 0',
      'yAdj +- vc 0 ihd2',
    ],
    ah: ['xy _ _ _ adj 0 50000 hc yAdj'],
    cxn: [
      '0 x4 hd4', '0 r vc', '0 x4 y3', 'cd4 x3 y4', 'cd4 hc b', 'cd4 wd4 y4', 'cd2 x1 y3', 'cd2 l vc', 'cd2 x1 hd4',
      '3cd4 wd4 y1', '3cd4 hc t', '3cd4 x3 y1',
    ],
    rect: 'sx2 sy2 sx5 sy5',
    path: [
      [
        'M l vc', 'L sx1 sy3', 'L x1 hd4', 'L sx2 sy2', 'L wd4 y1', 'L sx3 sy1', 'L hc t', 'L sx4 sy1', 'L x3 y1',
        'L sx5 sy2', 'L x4 hd4', 'L sx6 sy3', 'L r vc', 'L sx6 sy4', 'L x4 y3', 'L sx5 sy5', 'L x3 y4', 'L sx4 sy6',
        'L hc b', 'L sx3 sy6', 'L wd4 y4', 'L sx2 sy5', 'L x1 y3', 'L sx1 sy4', 'Z',
      ],
    ],
  },
  star16: {
    av: ['adj val 37500'],
    gd: [
      'a pin 0 adj 50000', 'dx1 */ wd2 92388 100000', 'dx2 */ wd2 70711 100000', 'dx3 */ wd2 38268 100000',
      'dy1 */ hd2 92388 100000', 'dy2 */ hd2 70711 100000', 'dy3 */ hd2 38268 100000', 'x1 +- hc 0 dx1',
      'x2 +- hc 0 dx2', 'x3 +- hc 0 dx3', 'x4 +- hc dx3 0', 'x5 +- hc dx2 0', 'x6 +- hc dx1 0', 'y1 +- vc 0 dy1',
      'y2 +- vc 0 dy2', 'y3 +- vc 0 dy3', 'y4 +- vc dy3 0', 'y5 +- vc dy2 0', 'y6 +- vc dy1 0', 'iwd2 */ wd2 a 50000',
      'ihd2 */ hd2 a 50000', 'sdx1 */ iwd2 98079 100000', 'sdx2 */ iwd2 83147 100000', 'sdx3 */ iwd2 55557 100000',
      'sdx4 */ iwd2 19509 100000', 'sdy1 */ ihd2 98079 100000', 'sdy2 */ ihd2 83147 100000',
      'sdy3 */ ihd2 55557 100000', 'sdy4 */ ihd2 19509 100000', 'sx1 +- hc 0 sdx1', 'sx2 +- hc 0 sdx2',
      'sx3 +- hc 0 sdx3', 'sx4 +- hc 0 sdx4', 'sx5 +- hc sdx4 0', 'sx6 +- hc sdx3 0', 'sx7 +- hc sdx2 0',
      'sx8 +- hc sdx1 0', 'sy1 +- vc 0 sdy1', 'sy2 +- vc 0 sdy2', 'sy3 +- vc 0 sdy3', 'sy4 +- vc 0 sdy4',
      'sy5 +- vc sdy4 0', 'sy6 +- vc sdy3 0', 'sy7 +- vc sdy2 0', 'sy8 +- vc sdy1 0', 'idx cos iwd2 2700000',
      'idy sin ihd2 2700000', 'il +- hc 0 idx', 'it +- vc 0 idy', 'ir +- hc idx 0', 'ib +- vc idy 0',
      'yAdj +- vc 0 ihd2',
    ],
    ah: ['xy _ _ _ adj 0 50000 hc yAdj'],
    cxn: [
      '0 x5 y2', '0 x6 y3', '0 r vc', '0 x6 y4', '0 x5 y5', 'cd4 x4 y6', 'cd4 hc b', 'cd4 x3 y6', 'cd2 x2 y5',
      'cd2 x1 y4', 'cd2 l vc', 'cd2 x1 y3', 'cd2 x2 y2', '3cd4 x3 y1', '3cd4 hc t', '3cd4 x4 y1',
    ],
    rect: 'il it ir ib',
    path: [
      [
        'M l vc', 'L sx1 sy4', 'L x1 y3', 'L sx2 sy3', 'L x2 y2', 'L sx3 sy2', 'L x3 y1', 'L sx4 sy1', 'L hc t',
        'L sx5 sy1', 'L x4 y1', 'L sx6 sy2', 'L x5 y2', 'L sx7 sy3', 'L x6 y3', 'L sx8 sy4', 'L r vc', 'L sx8 sy5',
        'L x6 y4', 'L sx7 sy6', 'L x5 y5', 'L sx6 sy7', 'L x4 y6', 'L sx5 sy8', 'L hc b', 'L sx4 sy8', 'L x3 y6',
        'L sx3 sy7', 'L x2 y5', 'L sx2 sy6', 'L x1 y4', 'L sx1 sy5', 'Z',
      ],
    ],
  },
  star24: {
    av: ['adj val 37500'],
    gd: [
      'a pin 0 adj 50000', 'dx1 cos wd2 900000', 'dx2 cos wd2 1800000', 'dx3 cos wd2 2700000', 'dx4 val wd4',
      'dx5 cos wd2 4500000', 'dy1 sin hd2 4500000', 'dy2 sin hd2 3600000', 'dy3 sin hd2 2700000', 'dy4 val hd4',
      'dy5 sin hd2 900000', 'x1 +- hc 0 dx1', 'x2 +- hc 0 dx2', 'x3 +- hc 0 dx3', 'x4 +- hc 0 dx4', 'x5 +- hc 0 dx5',
      'x6 +- hc dx5 0', 'x7 +- hc dx4 0', 'x8 +- hc dx3 0', 'x9 +- hc dx2 0', 'x10 +- hc dx1 0', 'y1 +- vc 0 dy1',
      'y2 +- vc 0 dy2', 'y3 +- vc 0 dy3', 'y4 +- vc 0 dy4', 'y5 +- vc 0 dy5', 'y6 +- vc dy5 0', 'y7 +- vc dy4 0',
      'y8 +- vc dy3 0', 'y9 +- vc dy2 0', 'y10 +- vc dy1 0', 'iwd2 */ wd2 a 50000', 'ihd2 */ hd2 a 50000',
      'sdx1 */ iwd2 99144 100000', 'sdx2 */ iwd2 92388 100000', 'sdx3 */ iwd2 79335 100000',
      'sdx4 */ iwd2 60876 100000', 'sdx5 */ iwd2 38268 100000', 'sdx6 */ iwd2 13053 100000',
      'sdy1 */ ihd2 99144 100000', 'sdy2 */ ihd2 92388 100000', 'sdy3 */ ihd2 79335 100000',
      'sdy4 */ ihd2 60876 100000', 'sdy5 */ ihd2 38268 100000', 'sdy6 */ ihd2 13053 100000', 'sx1 +- hc 0 sdx1',
      'sx2 +- hc 0 sdx2', 'sx3 +- hc 0 sdx3', 'sx4 +- hc 0 sdx4', 'sx5 +- hc 0 sdx5', 'sx6 +- hc 0 sdx6',
      'sx7 +- hc sdx6 0', 'sx8 +- hc sdx5 0', 'sx9 +- hc sdx4 0', 'sx10 +- hc sdx3 0', 'sx11 +- hc sdx2 0',
      'sx12 +- hc sdx1 0', 'sy1 +- vc 0 sdy1', 'sy2 +- vc 0 sdy2', 'sy3 +- vc 0 sdy3', 'sy4 +- vc 0 sdy4',
      'sy5 +- vc 0 sdy5', 'sy6 +- vc 0 sdy6', 'sy7 +- vc sdy6 0', 'sy8 +- vc sdy5 0', 'sy9 +- vc sdy4 0',
      'sy10 +- vc sdy3 0', 'sy11 +- vc sdy2 0', 'sy12 +- vc sdy1 0', 'idx cos iwd2 2700000', 'idy sin ihd2 2700000',
      'il +- hc 0 idx', 'it +- vc 0 idy', 'ir +- hc idx 0', 'ib +- vc idy 0', 'yAdj +- vc 0 ihd2',
    ],
    ah: ['xy _ _ _ adj 0 50000 hc yAdj'],
    cxn: ['3cd4 hc t', 'cd2 l vc', 'cd4 hc b', '0 r vc'],
    rect: 'il it ir ib',
    path: [
      [
        'M l vc', 'L sx1 sy6', 'L x1 y5', 'L sx2 sy5', 'L x2 y4', 'L sx3 sy4', 'L x3 y3', 'L sx4 sy3', 'L x4 y2',
        'L sx5 sy2', 'L x5 y1', 'L sx6 sy1', 'L hc t', 'L sx7 sy1', 'L x6 y1', 'L sx8 sy2', 'L x7 y2', 'L sx9 sy3',
        'L x8 y3', 'L sx10 sy4', 'L x9 y4', 'L sx11 sy5', 'L x10 y5', 'L sx12 sy6', 'L r vc', 'L sx12 sy7', 'L x10 y6',
        'L sx11 sy8', 'L x9 y7', 'L sx10 sy9', 'L x8 y8', 'L sx9 sy10', 'L x7 y9', 'L sx8 sy11', 'L x6 y10',
        'L sx7 sy12', 'L hc b', 'L sx6 sy12', 'L x5 y10', 'L sx5 sy11', 'L x4 y9', 'L sx4 sy10', 'L x3 y8',
        'L sx3 sy9', 'L x2 y7', 'L sx2 sy8', 'L x1 y6', 'L sx1 sy7', 'Z',
      ],
    ],
  },
  star32: {
    av: ['adj val 37500'],
    gd: [
      'a pin 0 adj 50000', 'dx1 */ wd2 98079 100000', 'dx2 */ wd2 92388 100000', 'dx3 */ wd2 83147 100000',
      'dx4 cos wd2 2700000', 'dx5 */ wd2 55557 100000', 'dx6 */ wd2 38268 100000', 'dx7 */ wd2 19509 100000',
      'dy1 */ hd2 98079 100000', 'dy2 */ hd2 92388 100000', 'dy3 */ hd2 83147 100000', 'dy4 sin hd2 2700000',
      'dy5 */ hd2 55557 100000', 'dy6 */ hd2 38268 100000', 'dy7 */ hd2 19509 100000', 'x1 +- hc 0 dx1',
      'x2 +- hc 0 dx2', 'x3 +- hc 0 dx3', 'x4 +- hc 0 dx4', 'x5 +- hc 0 dx5', 'x6 +- hc 0 dx6', 'x7 +- hc 0 dx7',
      'x8 +- hc dx7 0', 'x9 +- hc dx6 0', 'x10 +- hc dx5 0', 'x11 +- hc dx4 0', 'x12 +- hc dx3 0', 'x13 +- hc dx2 0',
      'x14 +- hc dx1 0', 'y1 +- vc 0 dy1', 'y2 +- vc 0 dy2', 'y3 +- vc 0 dy3', 'y4 +- vc 0 dy4', 'y5 +- vc 0 dy5',
      'y6 +- vc 0 dy6', 'y7 +- vc 0 dy7', 'y8 +- vc dy7 0', 'y9 +- vc dy6 0', 'y10 +- vc dy5 0', 'y11 +- vc dy4 0',
      'y12 +- vc dy3 0', 'y13 +- vc dy2 0', 'y14 +- vc dy1 0', 'iwd2 */ wd2 a 50000', 'ihd2 */ hd2 a 50000',
      'sdx1 */ iwd2 99518 100000', 'sdx2 */ iwd2 95694 100000', 'sdx3 */ iwd2 88192 100000',
      'sdx4 */ iwd2 77301 100000', 'sdx5 */ iwd2 63439 100000', 'sdx6 */ iwd2 47140 100000',
      'sdx7 */ iwd2 29028 100000', 'sdx8 */ iwd2 9802 100000', 'sdy1 */ ihd2 99518 100000',
      'sdy2 */ ihd2 95694 100000', 'sdy3 */ ihd2 88192 100000', 'sdy4 */ ihd2 77301 100000',
      'sdy5 */ ihd2 63439 100000', 'sdy6 */ ihd2 47140 100000', 'sdy7 */ ihd2 29028 100000',
      'sdy8 */ ihd2 9802 100000', 'sx1 +- hc 0 sdx1', 'sx2 +- hc 0 sdx2', 'sx3 +- hc 0 sdx3', 'sx4 +- hc 0 sdx4',
      'sx5 +- hc 0 sdx5', 'sx6 +- hc 0 sdx6', 'sx7 +- hc 0 sdx7', 'sx8 +- hc 0 sdx8', 'sx9 +- hc sdx8 0',
      'sx10 +- hc sdx7 0', 'sx11 +- hc sdx6 0', 'sx12 +- hc sdx5 0', 'sx13 +- hc sdx4 0', 'sx14 +- hc sdx3 0',
      'sx15 +- hc sdx2 0', 'sx16 +- hc sdx1 0', 'sy1 +- vc 0 sdy1', 'sy2 +- vc 0 sdy2', 'sy3 +- vc 0 sdy3',
      'sy4 +- vc 0 sdy4', 'sy5 +- vc 0 sdy5', 'sy6 +- vc 0 sdy6', 'sy7 +- vc 0 sdy7', 'sy8 +- vc 0 sdy8',
      'sy9 +- vc sdy8 0', 'sy10 +- vc sdy7 0', 'sy11 +- vc sdy6 0', 'sy12 +- vc sdy5 0', 'sy13 +- vc sdy4 0',
      'sy14 +- vc sdy3 0', 'sy15 +- vc sdy2 0', 'sy16 +- vc sdy1 0', 'idx cos iwd2 2700000', 'idy sin ihd2 2700000',
      'il +- hc 0 idx', 'it +- vc 0 idy', 'ir +- hc idx 0', 'ib +- vc idy 0', 'yAdj +- vc 0 ihd2',
    ],
    ah: ['xy _ _ _ adj 0 50000 hc yAdj'],
    cxn: ['3cd4 hc t', 'cd2 l vc', 'cd4 hc b', '0 r vc'],
    rect: 'il it ir ib',
    path: [
      [
        'M l vc', 'L sx1 sy8', 'L x1 y7', 'L sx2 sy7', 'L x2 y6', 'L sx3 sy6', 'L x3 y5', 'L sx4 sy5', 'L x4 y4',
        'L sx5 sy4', 'L x5 y3', 'L sx6 sy3', 'L x6 y2', 'L sx7 sy2', 'L x7 y1', 'L sx8 sy1', 'L hc t', 'L sx9 sy1',
        'L x8 y1', 'L sx10 sy2', 'L x9 y2', 'L sx11 sy3', 'L x10 y3', 'L sx12 sy4', 'L x11 y4', 'L sx13 sy5',
        'L x12 y5', 'L sx14 sy6', 'L x13 y6', 'L sx15 sy7', 'L x14 y7', 'L sx16 sy8', 'L r vc', 'L sx16 sy9',
        'L x14 y8', 'L sx15 sy10', 'L x13 y9', 'L sx14 sy11', 'L x12 y10', 'L sx13 sy12', 'L x11 y11', 'L sx12 sy13',
        'L x10 y12', 'L sx11 sy14', 'L x9 y13', 'L sx10 sy15', 'L x8 y14', 'L sx9 sy16', 'L hc b', 'L sx8 sy16',
        'L x7 y14', 'L sx7 sy15', 'L x6 y13', 'L sx6 sy14', 'L x5 y12', 'L sx5 sy13', 'L x4 y11', 'L sx4 sy12',
        'L x3 y10', 'L sx3 sy11', 'L x2 y9', 'L sx2 sy10', 'L x1 y8', 'L sx1 sy9', 'Z',
      ],
    ],
  },
  star4: {
    av: ['adj val 12500'],
    gd: [
      'a pin 0 adj 50000', 'iwd2 */ wd2 a 50000', 'ihd2 */ hd2 a 50000', 'sdx cos iwd2 2700000',
      'sdy sin ihd2 2700000', 'sx1 +- hc 0 sdx', 'sx2 +- hc sdx 0', 'sy1 +- vc 0 sdy', 'sy2 +- vc sdy 0',
      'yAdj +- vc 0 ihd2',
    ],
    ah: ['xy _ _ _ adj 0 50000 hc yAdj'],
    cxn: ['3cd4 hc t', 'cd2 l vc', 'cd4 hc b', '0 r vc'],
    rect: 'sx1 sy1 sx2 sy2',
    path: [
      ['M l vc', 'L sx1 sy1', 'L hc t', 'L sx2 sy1', 'L r vc', 'L sx2 sy2', 'L hc b', 'L sx1 sy2', 'Z'],
    ],
  },
  star5: {
    av: ['adj val 19098', 'hf val 105146', 'vf val 110557'],
    gd: [
      'a pin 0 adj 50000', 'swd2 */ wd2 hf 100000', 'shd2 */ hd2 vf 100000', 'svc */ vc vf 100000',
      'dx1 cos swd2 1080000', 'dx2 cos swd2 18360000', 'dy1 sin shd2 1080000', 'dy2 sin shd2 18360000',
      'x1 +- hc 0 dx1', 'x2 +- hc 0 dx2', 'x3 +- hc dx2 0', 'x4 +- hc dx1 0', 'y1 +- svc 0 dy1', 'y2 +- svc 0 dy2',
      'iwd2 */ swd2 a 50000', 'ihd2 */ shd2 a 50000', 'sdx1 cos iwd2 20520000', 'sdx2 cos iwd2 3240000',
      'sdy1 sin ihd2 3240000', 'sdy2 sin ihd2 20520000', 'sx1 +- hc 0 sdx1', 'sx2 +- hc 0 sdx2', 'sx3 +- hc sdx2 0',
      'sx4 +- hc sdx1 0', 'sy1 +- svc 0 sdy1', 'sy2 +- svc 0 sdy2', 'sy3 +- svc ihd2 0', 'yAdj +- svc 0 ihd2',
    ],
    ah: ['xy _ _ _ adj 0 50000 hc yAdj'],
    cxn: ['3cd4 hc t', 'cd2 x1 y1', 'cd4 x2 y2', 'cd4 x3 y2', '0 x4 y1'],
    rect: 'sx1 sy1 sx4 sy3',
    path: [
      [
        'M x1 y1', 'L sx2 sy1', 'L hc t', 'L sx3 sy1', 'L x4 y1', 'L sx4 sy2', 'L x3 y2', 'L hc sy3', 'L x2 y2',
        'L sx1 sy2', 'Z',
      ],
    ],
  },
  star6: {
    av: ['adj val 28868', 'hf val 115470'],
    gd: [
      'a pin 0 adj 50000', 'swd2 */ wd2 hf 100000', 'dx1 cos swd2 1800000', 'x1 +- hc 0 dx1', 'x2 +- hc dx1 0',
      'y2 +- vc hd4 0', 'iwd2 */ swd2 a 50000', 'ihd2 */ hd2 a 50000', 'sdx2 */ iwd2 1 2', 'sx1 +- hc 0 iwd2',
      'sx2 +- hc 0 sdx2', 'sx3 +- hc sdx2 0', 'sx4 +- hc iwd2 0', 'sdy1 sin ihd2 3600000', 'sy1 +- vc 0 sdy1',
      'sy2 +- vc sdy1 0', 'yAdj +- vc 0 ihd2',
    ],
    ah: ['xy _ _ _ adj 0 50000 hc yAdj'],
    cxn: ['0 x2 hd4', '0 x2 y2', 'cd4 hc b', 'cd2 x1 y2', 'cd2 x1 hd4', '3cd4 hc t'],
    rect: 'sx1 sy1 sx4 sy2',
    path: [
      [
        'M x1 hd4', 'L sx2 sy1', 'L hc t', 'L sx3 sy1', 'L x2 hd4', 'L sx4 vc', 'L x2 y2', 'L sx3 sy2', 'L hc b',
        'L sx2 sy2', 'L x1 y2', 'L sx1 vc', 'Z',
      ],
    ],
  },
  star7: {
    av: ['adj val 34601', 'hf val 102572', 'vf val 105210'],
    gd: [
      'a pin 0 adj 50000', 'swd2 */ wd2 hf 100000', 'shd2 */ hd2 vf 100000', 'svc */ vc vf 100000',
      'dx1 */ swd2 97493 100000', 'dx2 */ swd2 78183 100000', 'dx3 */ swd2 43388 100000', 'dy1 */ shd2 62349 100000',
      'dy2 */ shd2 22252 100000', 'dy3 */ shd2 90097 100000', 'x1 +- hc 0 dx1', 'x2 +- hc 0 dx2', 'x3 +- hc 0 dx3',
      'x4 +- hc dx3 0', 'x5 +- hc dx2 0', 'x6 +- hc dx1 0', 'y1 +- svc 0 dy1', 'y2 +- svc dy2 0', 'y3 +- svc dy3 0',
      'iwd2 */ swd2 a 50000', 'ihd2 */ shd2 a 50000', 'sdx1 */ iwd2 97493 100000', 'sdx2 */ iwd2 78183 100000',
      'sdx3 */ iwd2 43388 100000', 'sx1 +- hc 0 sdx1', 'sx2 +- hc 0 sdx2', 'sx3 +- hc 0 sdx3', 'sx4 +- hc sdx3 0',
      'sx5 +- hc sdx2 0', 'sx6 +- hc sdx1 0', 'sdy1 */ ihd2 90097 100000', 'sdy2 */ ihd2 22252 100000',
      'sdy3 */ ihd2 62349 100000', 'sy1 +- svc 0 sdy1', 'sy2 +- svc 0 sdy2', 'sy3 +- svc sdy3 0', 'sy4 +- svc ihd2 0',
      'yAdj +- svc 0 ihd2',
    ],
    ah: ['xy _ _ _ adj 0 50000 hc yAdj'],
    cxn: ['0 x5 y1', '0 x6 y2', 'cd4 x4 y3', 'cd4 x3 y3', 'cd2 x1 y2', 'cd2 x2 y1', '3cd4 hc t'],
    rect: 'sx2 sy1 sx5 sy3',
    path: [
      [
        'M x1 y2', 'L sx1 sy2', 'L x2 y1', 'L sx3 sy1', 'L hc t', 'L sx4 sy1', 'L x5 y1', 'L sx6 sy2', 'L x6 y2',
        'L sx5 sy3', 'L x4 y3', 'L hc sy4', 'L x3 y3', 'L sx2 sy3', 'Z',
      ],
    ],
  },
  star8: {
    av: ['adj val 37500'],
    gd: [
      'a pin 0 adj 50000', 'dx1 cos wd2 2700000', 'x1 +- hc 0 dx1', 'x2 +- hc dx1 0', 'dy1 sin hd2 2700000',
      'y1 +- vc 0 dy1', 'y2 +- vc dy1 0', 'iwd2 */ wd2 a 50000', 'ihd2 */ hd2 a 50000', 'sdx1 */ iwd2 92388 100000',
      'sdx2 */ iwd2 38268 100000', 'sdy1 */ ihd2 92388 100000', 'sdy2 */ ihd2 38268 100000', 'sx1 +- hc 0 sdx1',
      'sx2 +- hc 0 sdx2', 'sx3 +- hc sdx2 0', 'sx4 +- hc sdx1 0', 'sy1 +- vc 0 sdy1', 'sy2 +- vc 0 sdy2',
      'sy3 +- vc sdy2 0', 'sy4 +- vc sdy1 0', 'yAdj +- vc 0 ihd2',
    ],
    ah: ['xy _ _ _ adj 0 50000 hc yAdj'],
    cxn: ['0 r vc', 'cd4 x2 y2', 'cd4 hc b', 'cd4 x1 y2', 'cd2 l vc', '3cd4 x1 y1', '3cd4 hc t', '3cd4 x2 y1'],
    rect: 'sx1 sy1 sx4 sy4',
    path: [
      [
        'M l vc', 'L sx1 sy2', 'L x1 y1', 'L sx2 sy1', 'L hc t', 'L sx3 sy1', 'L x2 y1', 'L sx4 sy2', 'L r vc',
        'L sx4 sy3', 'L x2 y2', 'L sx3 sy4', 'L hc b', 'L sx2 sy4', 'L x1 y2', 'L sx1 sy3', 'Z',
      ],
    ],
  },
  straightConnector1: {
    rect: 'l t r b',
    path: [
      ['fill=none', 'M l t', 'L r b'],
    ],
  },
  stripedRightArrow: {
    av: ['adj1 val 50000', 'adj2 val 50000'],
    gd: [
      'maxAdj2 */ 84375 w ss', 'a1 pin 0 adj1 100000', 'a2 pin 0 adj2 maxAdj2', 'x4 */ ss 5 32', 'dx5 */ ss a2 100000',
      'x5 +- r 0 dx5', 'dy1 */ h a1 200000', 'y1 +- vc 0 dy1', 'y2 +- vc dy1 0', 'dx6 */ dy1 dx5 hd2', 'x6 +- r 0 dx6',
    ],
    ah: ['xy _ _ _ adj1 0 100000 l y1', 'xy adj2 0 maxAdj2 _ _ _ x5 t'],
    cxn: ['3cd4 x5 t', 'cd2 l vc', 'cd4 x5 b', '0 r vc'],
    rect: 'x4 y1 x6 y2',
    path: [
      [
        'M l y1', 'L ssd32 y1', 'L ssd32 y2', 'L l y2', 'Z', 'M ssd16 y1', 'L ssd8 y1', 'L ssd8 y2', 'L ssd16 y2', 'Z',
        'M x4 y1', 'L x5 y1', 'L x5 t', 'L r vc', 'L x5 b', 'L x5 y2', 'L x4 y2', 'Z',
      ],
    ],
  },
};
