// Formes predefinies DrawingML (partie 5/5), transcrites de presetShapeDefinitions.xml (ECMA-376 partie 1).
// Format : voir PresetDef dans types.ts. Fichier genere : ne pas reformater a la main.
import type { PresetDef } from './types.ts';

export const PRESETS_5: Readonly<Record<string, PresetDef>> = {
  sun: {
    av: ['adj val 25000'],
    gd: [
      'a pin 12500 adj 46875', 'g0 +- 50000 0 a', 'g1 */ g0 30274 32768', 'g2 */ g0 12540 32768', 'g3 +- g1 50000 0',
      'g4 +- g2 50000 0', 'g5 +- 50000 0 g1', 'g6 +- 50000 0 g2', 'g7 */ g0 23170 32768', 'g8 +- 50000 g7 0',
      'g9 +- 50000 0 g7', 'g10 */ g5 3 4', 'g11 */ g6 3 4', 'g12 +- g10 3662 0', 'g13 +- g11 3662 0',
      'g14 +- g11 12500 0', 'g15 +- 100000 0 g10', 'g16 +- 100000 0 g12', 'g17 +- 100000 0 g13', 'g18 +- 100000 0 g14',
      'ox1 */ w 18436 21600', 'oy1 */ h 3163 21600', 'ox2 */ w 3163 21600', 'oy2 */ h 18436 21600',
      'x8 */ w g8 100000', 'x9 */ w g9 100000', 'x10 */ w g10 100000', 'x12 */ w g12 100000', 'x13 */ w g13 100000',
      'x14 */ w g14 100000', 'x15 */ w g15 100000', 'x16 */ w g16 100000', 'x17 */ w g17 100000',
      'x18 */ w g18 100000', 'x19 */ w a 100000', 'wR */ w g0 100000', 'hR */ h g0 100000', 'y8 */ h g8 100000',
      'y9 */ h g9 100000', 'y10 */ h g10 100000', 'y12 */ h g12 100000', 'y13 */ h g13 100000', 'y14 */ h g14 100000',
      'y15 */ h g15 100000', 'y16 */ h g16 100000', 'y17 */ h g17 100000', 'y18 */ h g18 100000',
    ],
    ah: ['xy adj 12500 46875 _ _ _ x19 vc'],
    cxn: ['3cd4 hc t', 'cd2 l vc', 'cd4 hc b', '0 r vc'],
    rect: 'x9 y9 x8 y8',
    path: [
      [
        'M r vc', 'L x15 y18', 'L x15 y14', 'Z', 'M ox1 oy1', 'L x16 y13', 'L x17 y12', 'Z', 'M hc t', 'L x18 y10',
        'L x14 y10', 'Z', 'M ox2 oy1', 'L x13 y12', 'L x12 y13', 'Z', 'M l vc', 'L x10 y14', 'L x10 y18', 'Z',
        'M ox2 oy2', 'L x12 y17', 'L x13 y16', 'Z', 'M hc b', 'L x14 y15', 'L x18 y15', 'Z', 'M ox1 oy2', 'L x17 y16',
        'L x16 y17', 'Z', 'M x19 vc', 'A wR hR cd2 21600000', 'Z',
      ],
    ],
  },
  swooshArrow: {
    av: ['adj1 val 25000', 'adj2 val 16667'],
    gd: [
      'a1 pin 1 adj1 75000', 'maxAdj2 */ 70000 w ss', 'a2 pin 0 adj2 maxAdj2', 'ad1 */ h a1 100000',
      'ad2 */ ss a2 100000', 'xB +- r 0 ad2', 'yB +- t ssd8 0', 'alfa */ cd4 1 14', 'dx0 tan ssd8 alfa',
      'xC +- xB 0 dx0', 'dx1 tan ad1 alfa', 'yF +- yB ad1 0', 'xF +- xB dx1 0', 'xE +- xF dx0 0', 'yE +- yF ssd8 0',
      'dy2 +- yE 0 t', 'dy22 */ dy2 1 2', 'dy3 */ h 1 20', 'yD +- t dy22 dy3', 'dy4 */ hd6 1 1', 'yP1 +- hd6 dy4 0',
      'xP1 val wd6', 'dy5 */ hd6 1 2', 'yP2 +- yF dy5 0', 'xP2 val wd4',
    ],
    ah: ['xy _ _ _ adj1 1 75000 xF yF', 'xy adj2 0 maxAdj2 _ _ _ xB yB'],
    cxn: ['cd4 l b', '3cd4 xC t', '0 r yD', 'cd4 xE yE'],
    rect: 'l t r b',
    path: [
      ['M l b', 'Q xP1 yP1 xB yB', 'L xC t', 'L r yD', 'L xE yE', 'L xF yF', 'Q xP2 yP2 l b', 'Z'],
    ],
  },
  teardrop: {
    av: ['adj val 100000'],
    gd: [
      'a pin 0 adj 200000', 'r2 sqrt 2', 'tw */ wd2 r2 1', 'th */ hd2 r2 1', 'sw */ tw a 100000', 'sh */ th a 100000',
      'dx1 cos sw 2700000', 'dy1 sin sh 2700000', 'x1 +- hc dx1 0', 'y1 +- vc 0 dy1', 'x2 +/ hc x1 2', 'y2 +/ vc y1 2',
      'idx cos wd2 2700000', 'idy sin hd2 2700000', 'il +- hc 0 idx', 'ir +- hc idx 0', 'it +- vc 0 idy',
      'ib +- vc idy 0',
    ],
    ah: ['xy adj 0 200000 _ _ _ x1 t'],
    cxn: ['0 r vc', 'cd4 ir ib', 'cd4 hc b', 'cd4 il ib', 'cd2 l vc', '3cd4 il it', '3cd4 hc t', '3cd4 x1 y1'],
    rect: 'il it ir ib',
    path: [
      ['M l vc', 'A wd2 hd2 cd2 cd4', 'Q x2 t x1 y1', 'Q r y2 r vc', 'A wd2 hd2 0 cd4', 'A wd2 hd2 cd4 cd4', 'Z'],
    ],
  },
  trapezoid: {
    av: ['adj val 25000'],
    gd: [
      'maxAdj */ 50000 w ss', 'a pin 0 adj maxAdj', 'x1 */ ss a 200000', 'x2 */ ss a 100000', 'x3 +- r 0 x2',
      'x4 +- r 0 x1', 'il */ wd3 a maxAdj', 'it */ hd3 a maxAdj', 'ir +- r 0 il',
    ],
    ah: ['xy adj 0 maxAdj _ _ _ x2 t'],
    cxn: ['3cd4 hc t', 'cd2 x1 vc', 'cd4 hc b', '0 x4 vc'],
    rect: 'il it ir b',
    path: [
      ['M l b', 'L x2 t', 'L x3 t', 'L r b', 'Z'],
    ],
  },
  triangle: {
    av: ['adj val 50000'],
    gd: ['a pin 0 adj 100000', 'x1 */ w a 200000', 'x2 */ w a 100000', 'x3 +- x1 wd2 0'],
    ah: ['xy adj 0 100000 _ _ _ x2 t'],
    cxn: ['3cd4 x2 t', 'cd2 x1 vc', 'cd4 l b', 'cd4 x2 b', 'cd4 r b', '0 x3 vc'],
    rect: 'x1 vc x3 b',
    path: [
      ['M l b', 'L x2 t', 'L r b', 'Z'],
    ],
  },
  upArrowCallout: {
    av: ['adj1 val 25000', 'adj2 val 25000', 'adj3 val 25000', 'adj4 val 64977'],
    gd: [
      'maxAdj2 */ 50000 w ss', 'a2 pin 0 adj2 maxAdj2', 'maxAdj1 */ a2 2 1', 'a1 pin 0 adj1 maxAdj1',
      'maxAdj3 */ 100000 h ss', 'a3 pin 0 adj3 maxAdj3', 'q2 */ a3 ss h', 'maxAdj4 +- 100000 0 q2',
      'a4 pin 0 adj4 maxAdj4', 'dx1 */ ss a2 100000', 'dx2 */ ss a1 200000', 'x1 +- hc 0 dx1', 'x2 +- hc 0 dx2',
      'x3 +- hc dx2 0', 'x4 +- hc dx1 0', 'y1 */ ss a3 100000', 'dy2 */ h a4 100000', 'y2 +- b 0 dy2', 'y3 +/ y2 b 2',
    ],
    ah: [
      'xy adj1 0 maxAdj1 _ _ _ x2 y1', 'xy adj2 0 maxAdj2 _ _ _ x1 t', 'xy _ _ _ adj3 0 maxAdj3 r y1',
      'xy _ _ _ adj4 0 maxAdj4 l y2',
    ],
    cxn: ['3cd4 hc t', 'cd2 l y2', 'cd4 hc b', '0 r y2'],
    rect: 'l y2 r b',
    path: [
      [
        'M l y2', 'L x2 y2', 'L x2 y1', 'L x1 y1', 'L hc t', 'L x4 y1', 'L x3 y1', 'L x3 y2', 'L r y2', 'L r b',
        'L l b', 'Z',
      ],
    ],
  },
  upDownArrow: {
    av: ['adj1 val 50000', 'adj2 val 50000'],
    gd: [
      'maxAdj2 */ 50000 h ss', 'a1 pin 0 adj1 100000', 'a2 pin 0 adj2 maxAdj2', 'y2 */ ss a2 100000', 'y3 +- b 0 y2',
      'dx1 */ w a1 200000', 'x1 +- hc 0 dx1', 'x2 +- hc dx1 0', 'dy1 */ x1 y2 wd2', 'y1 +- y2 0 dy1', 'y4 +- y3 dy1 0',
    ],
    ah: ['xy adj1 0 100000 _ _ _ x1 y3', 'xy _ _ _ adj2 0 maxAdj2 l y2'],
    cxn: ['3cd4 hc t', 'cd2 l y2', 'cd2 x1 vc', 'cd2 l y3', 'cd4 hc b', '0 r y3', '0 x2 vc', '0 r y2'],
    rect: 'x1 y1 x2 y4',
    path: [
      ['M l y2', 'L hc t', 'L r y2', 'L x2 y2', 'L x2 y3', 'L r y3', 'L hc b', 'L l y3', 'L x1 y3', 'L x1 y2', 'Z'],
    ],
  },
  upArrow: {
    av: ['adj1 val 50000', 'adj2 val 50000'],
    gd: [
      'maxAdj2 */ 100000 h ss', 'a1 pin 0 adj1 100000', 'a2 pin 0 adj2 maxAdj2', 'dy2 */ ss a2 100000',
      'y2 +- t dy2 0', 'dx1 */ w a1 200000', 'x1 +- hc 0 dx1', 'x2 +- hc dx1 0', 'dy1 */ x1 dy2 wd2', 'y1 +- y2 0 dy1',
    ],
    ah: ['xy adj1 0 100000 _ _ _ x1 b', 'xy _ _ _ adj2 0 maxAdj2 l y2'],
    cxn: ['3cd4 hc t', 'cd2 l y2', 'cd4 hc b', '0 r y2'],
    rect: 'x1 y1 x2 b',
    path: [
      ['M l y2', 'L hc t', 'L r y2', 'L x2 y2', 'L x2 b', 'L x1 b', 'L x1 y2', 'Z'],
    ],
  },
  upDownArrowCallout: {
    av: ['adj1 val 25000', 'adj2 val 25000', 'adj3 val 25000', 'adj4 val 48123'],
    gd: [
      'maxAdj2 */ 50000 w ss', 'a2 pin 0 adj2 maxAdj2', 'maxAdj1 */ a2 2 1', 'a1 pin 0 adj1 maxAdj1',
      'maxAdj3 */ 50000 h ss', 'a3 pin 0 adj3 maxAdj3', 'q2 */ a3 ss hd2', 'maxAdj4 +- 100000 0 q2',
      'a4 pin 0 adj4 maxAdj4', 'dx1 */ ss a2 100000', 'dx2 */ ss a1 200000', 'x1 +- hc 0 dx1', 'x2 +- hc 0 dx2',
      'x3 +- hc dx2 0', 'x4 +- hc dx1 0', 'y1 */ ss a3 100000', 'y4 +- b 0 y1', 'dy2 */ h a4 200000', 'y2 +- vc 0 dy2',
      'y3 +- vc dy2 0',
    ],
    ah: [
      'xy adj1 0 maxAdj1 _ _ _ x2 y1', 'xy adj2 0 maxAdj2 _ _ _ x1 t', 'xy _ _ _ adj3 0 maxAdj3 r y1',
      'xy _ _ _ adj4 0 maxAdj4 l y2',
    ],
    cxn: ['3cd4 hc t', 'cd2 l vc', 'cd4 hc b', '0 r vc'],
    rect: 'l y2 r y3',
    path: [
      [
        'M l y2', 'L x2 y2', 'L x2 y1', 'L x1 y1', 'L hc t', 'L x4 y1', 'L x3 y1', 'L x3 y2', 'L r y2', 'L r y3',
        'L x3 y3', 'L x3 y4', 'L x4 y4', 'L hc b', 'L x1 y4', 'L x2 y4', 'L x2 y3', 'L l y3', 'Z',
      ],
    ],
  },
  uturnArrow: {
    av: ['adj1 val 25000', 'adj2 val 25000', 'adj3 val 25000', 'adj4 val 43750', 'adj5 val 75000'],
    gd: [
      'a2 pin 0 adj2 25000', 'maxAdj1 */ a2 2 1', 'a1 pin 0 adj1 maxAdj1', 'q2 */ a1 ss h', 'q3 +- 100000 0 q2',
      'maxAdj3 */ q3 h ss', 'a3 pin 0 adj3 maxAdj3', 'q1 +- a3 a1 0', 'minAdj5 */ q1 ss h',
      'a5 pin minAdj5 adj5 100000', 'th */ ss a1 100000', 'aw2 */ ss a2 100000', 'th2 */ th 1 2', 'dh2 +- aw2 0 th2',
      'y5 */ h a5 100000', 'ah */ ss a3 100000', 'y4 +- y5 0 ah', 'x9 +- r 0 dh2', 'bw */ x9 1 2', 'bs min bw y4',
      'maxAdj4 */ bs 100000 ss', 'a4 pin 0 adj4 maxAdj4', 'bd */ ss a4 100000', 'bd3 +- bd 0 th', 'bd2 max bd3 0',
      'x3 +- th bd2 0', 'x8 +- r 0 aw2', 'x6 +- x8 0 aw2', 'x7 +- x6 dh2 0', 'x4 +- x9 0 bd', 'x5 +- x7 0 bd2',
      'cx +/ th x7 2',
    ],
    ah: [
      'xy adj1 0 maxAdj1 _ _ _ th b', 'xy adj2 0 25000 _ _ _ x6 b', 'xy _ _ _ adj3 0 maxAdj3 x6 y4',
      'xy adj4 0 maxAdj4 _ _ _ bd t', 'xy _ _ _ adj5 minAdj5 100000 r y5',
    ],
    cxn: ['cd4 x6 y4', 'cd4 x8 y5', '0 r y4', '3cd4 cx t', 'cd4 th2 b'],
    rect: 'l t r b',
    path: [
      [
        'M l b', 'L l bd', 'A bd bd cd2 cd4', 'L x4 t', 'A bd bd 3cd4 cd4', 'L x9 y4', 'L r y4', 'L x8 y5', 'L x6 y4',
        'L x7 y4', 'L x7 x3', 'A bd2 bd2 0 -5400000', 'L x3 th', 'A bd2 bd2 3cd4 -5400000', 'L th b', 'Z',
      ],
    ],
  },
  verticalScroll: {
    av: ['adj val 12500'],
    gd: [
      'a pin 0 adj 25000', 'ch */ ss a 100000', 'ch2 */ ch 1 2', 'ch4 */ ch 1 4', 'x3 +- ch ch2 0', 'x4 +- ch ch 0',
      'x6 +- r 0 ch', 'x7 +- r 0 ch2', 'x5 +- x6 0 ch2', 'y3 +- b 0 ch', 'y4 +- b 0 ch2',
    ],
    ah: ['xy _ _ _ adj 0 25000 l ch'],
    cxn: ['3cd4 hc t', '0 ch vc', 'cd4 hc b', 'cd2 x6 vc'],
    rect: 'ch ch x6 y4',
    path: [
      [
        'stroke=0', 'M ch2 b', 'A ch2 ch2 cd4 -5400000', 'L ch2 y4', 'A ch4 ch4 cd4 -10800000', 'L ch y3', 'L ch ch2',
        'A ch2 ch2 cd2 cd4', 'L x7 t', 'A ch2 ch2 3cd4 cd2', 'L x6 ch', 'L x6 y4', 'A ch2 ch2 0 cd4', 'Z', 'M x4 ch2',
        'A ch2 ch2 0 cd4', 'A ch4 ch4 cd4 cd2', 'Z',
      ],
      [
        'fill=darkenLess stroke=0', 'M x4 ch2', 'A ch2 ch2 0 cd4', 'A ch4 ch4 cd4 cd2', 'Z', 'M ch y4',
        'A ch2 ch2 0 3cd4', 'A ch4 ch4 3cd4 cd2', 'Z',
      ],
      [
        'fill=none', 'M ch y3', 'L ch ch2', 'A ch2 ch2 cd2 cd4', 'L x7 t', 'A ch2 ch2 3cd4 cd2', 'L x6 ch', 'L x6 y4',
        'A ch2 ch2 0 cd4', 'L ch2 b', 'A ch2 ch2 cd4 cd2', 'Z', 'M x3 t', 'A ch2 ch2 3cd4 cd2', 'A ch4 ch4 cd4 cd2',
        'L x4 ch2', 'M x6 ch', 'L x3 ch', 'M ch2 y3', 'A ch4 ch4 3cd4 cd2', 'L ch y4', 'M ch2 b',
        'A ch2 ch2 cd4 -5400000', 'L ch y3',
      ],
    ],
  },
  wave: {
    av: ['adj1 val 12500', 'adj2 val 0'],
    gd: [
      'a1 pin 0 adj1 20000', 'a2 pin -10000 adj2 10000', 'y1 */ h a1 100000', 'dy2 */ y1 10 3', 'y2 +- y1 0 dy2',
      'y3 +- y1 dy2 0', 'y4 +- b 0 y1', 'y5 +- y4 0 dy2', 'y6 +- y4 dy2 0', 'dx1 */ w a2 100000', 'of2 */ w a2 50000',
      'x1 abs dx1', 'dx2 ?: of2 0 of2', 'x2 +- l 0 dx2', 'dx5 ?: of2 of2 0', 'x5 +- r 0 dx5', 'dx3 +/ dx2 x5 3',
      'x3 +- x2 dx3 0', 'x4 +/ x3 x5 2', 'x6 +- l dx5 0', 'x10 +- r dx2 0', 'x7 +- x6 dx3 0', 'x8 +/ x7 x10 2',
      'x9 +- r 0 x1', 'xAdj +- hc dx1 0', 'xAdj2 +- hc 0 dx1', 'il max x2 x6', 'ir min x5 x10', 'it */ h a1 50000',
      'ib +- b 0 it',
    ],
    ah: ['xy _ _ _ adj1 0 20000 l y1', 'xy adj2 -10000 10000 _ _ _ xAdj b'],
    cxn: ['cd4 xAdj2 y1', 'cd2 x1 vc', '3cd4 xAdj y4', '0 x9 vc'],
    rect: 'il it ir ib',
    path: [
      ['M x2 y1', 'C x3 y2 x4 y3 x5 y1', 'L x10 y4', 'C x8 y6 x7 y5 x6 y4', 'Z'],
    ],
  },
  wedgeEllipseCallout: {
    av: ['adj1 val -20833', 'adj2 val 62500'],
    gd: [
      'dxPos */ w adj1 100000', 'dyPos */ h adj2 100000', 'xPos +- hc dxPos 0', 'yPos +- vc dyPos 0',
      'sdx */ dxPos h 1', 'sdy */ dyPos w 1', 'pang at2 sdx sdy', 'stAng +- pang 660000 0', 'enAng +- pang 0 660000',
      'dx1 cos wd2 stAng', 'dy1 sin hd2 stAng', 'x1 +- hc dx1 0', 'y1 +- vc dy1 0', 'dx2 cos wd2 enAng',
      'dy2 sin hd2 enAng', 'x2 +- hc dx2 0', 'y2 +- vc dy2 0', 'stAng1 at2 dx1 dy1', 'enAng1 at2 dx2 dy2',
      'swAng1 +- enAng1 0 stAng1', 'swAng2 +- swAng1 21600000 0', 'swAng ?: swAng1 swAng1 swAng2',
      'idx cos wd2 2700000', 'idy sin hd2 2700000', 'il +- hc 0 idx', 'ir +- hc idx 0', 'it +- vc 0 idy',
      'ib +- vc idy 0',
    ],
    ah: ['xy adj1 -2147483647 2147483647 adj2 -2147483647 2147483647 xPos yPos'],
    cxn: ['3cd4 hc t', '3cd4 il it', 'cd4 il ib', 'cd4 hc b', 'cd4 ir ib', '0 r vc', '3cd4 ir it', 'pang xPos yPos'],
    rect: 'il it ir ib',
    path: [
      ['M xPos yPos', 'L x1 y1', 'A wd2 hd2 stAng1 swAng', 'Z'],
    ],
  },
  wedgeRectCallout: {
    av: ['adj1 val -20833', 'adj2 val 62500'],
    gd: [
      'dxPos */ w adj1 100000', 'dyPos */ h adj2 100000', 'xPos +- hc dxPos 0', 'yPos +- vc dyPos 0',
      'dx +- xPos 0 hc', 'dy +- yPos 0 vc', 'dq */ dxPos h w', 'ady abs dyPos', 'adq abs dq', 'dz +- ady 0 adq',
      'xg1 ?: dxPos 7 2', 'xg2 ?: dxPos 10 5', 'x1 */ w xg1 12', 'x2 */ w xg2 12', 'yg1 ?: dyPos 7 2',
      'yg2 ?: dyPos 10 5', 'y1 */ h yg1 12', 'y2 */ h yg2 12', 't1 ?: dxPos l xPos', 'xl ?: dz l t1',
      't2 ?: dyPos x1 xPos', 'xt ?: dz t2 x1', 't3 ?: dxPos xPos r', 'xr ?: dz r t3', 't4 ?: dyPos xPos x1',
      'xb ?: dz t4 x1', 't5 ?: dxPos y1 yPos', 'yl ?: dz y1 t5', 't6 ?: dyPos t yPos', 'yt ?: dz t6 t',
      't7 ?: dxPos yPos y1', 'yr ?: dz y1 t7', 't8 ?: dyPos yPos b', 'yb ?: dz t8 b',
    ],
    ah: ['xy adj1 -2147483647 2147483647 adj2 -2147483647 2147483647 xPos yPos'],
    cxn: ['3cd4 hc t', 'cd2 l vc', 'cd4 hc b', '0 r vc', 'cd4 xPos yPos'],
    rect: 'l t r b',
    path: [
      [
        'M l t', 'L x1 t', 'L xt yt', 'L x2 t', 'L r t', 'L r y1', 'L xr yr', 'L r y2', 'L r b', 'L x2 b', 'L xb yb',
        'L x1 b', 'L l b', 'L l y2', 'L xl yl', 'L l y1', 'Z',
      ],
    ],
  },
  wedgeRoundRectCallout: {
    av: ['adj1 val -20833', 'adj2 val 62500', 'adj3 val 16667'],
    gd: [
      'dxPos */ w adj1 100000', 'dyPos */ h adj2 100000', 'xPos +- hc dxPos 0', 'yPos +- vc dyPos 0',
      'dq */ dxPos h w', 'ady abs dyPos', 'adq abs dq', 'dz +- ady 0 adq', 'xg1 ?: dxPos 7 2', 'xg2 ?: dxPos 10 5',
      'x1 */ w xg1 12', 'x2 */ w xg2 12', 'yg1 ?: dyPos 7 2', 'yg2 ?: dyPos 10 5', 'y1 */ h yg1 12', 'y2 */ h yg2 12',
      't1 ?: dxPos l xPos', 'xl ?: dz l t1', 't2 ?: dyPos x1 xPos', 'xt ?: dz t2 x1', 't3 ?: dxPos xPos r',
      'xr ?: dz r t3', 't4 ?: dyPos xPos x1', 'xb ?: dz t4 x1', 't5 ?: dxPos y1 yPos', 'yl ?: dz y1 t5',
      't6 ?: dyPos t yPos', 'yt ?: dz t6 t', 't7 ?: dxPos yPos y1', 'yr ?: dz y1 t7', 't8 ?: dyPos yPos b',
      'yb ?: dz t8 b', 'u1 */ ss adj3 100000', 'u2 +- r 0 u1', 'v2 +- b 0 u1', 'il */ u1 29289 100000', 'ir +- r 0 il',
      'ib +- b 0 il',
    ],
    ah: ['xy adj1 -2147483647 2147483647 adj2 -2147483647 2147483647 xPos yPos'],
    cxn: ['3cd4 hc t', 'cd2 l vc', 'cd4 hc b', '0 r vc', 'cd4 xPos yPos'],
    rect: 'il il ir ib',
    path: [
      [
        'M l u1', 'A u1 u1 cd2 cd4', 'L x1 t', 'L xt yt', 'L x2 t', 'L u2 t', 'A u1 u1 3cd4 cd4', 'L r y1', 'L xr yr',
        'L r y2', 'L r v2', 'A u1 u1 0 cd4', 'L x2 b', 'L xb yb', 'L x1 b', 'L u1 b', 'A u1 u1 cd4 cd4', 'L l y2',
        'L xl yl', 'L l y1', 'Z',
      ],
    ],
  },
};
