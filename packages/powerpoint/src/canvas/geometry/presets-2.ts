// Formes predefinies DrawingML (partie 2/5), transcrites de presetShapeDefinitions.xml (ECMA-376 partie 1).
// Format : voir PresetDef dans types.ts. Fichier genere : ne pas reformater a la main.
import type { PresetDef } from './types.ts';

export const PRESETS_2: Readonly<Record<string, PresetDef>> = {
  circularArrow: {
    av: ['adj1 val 12500', 'adj2 val 1142319', 'adj3 val 20457681', 'adj4 val 10800000', 'adj5 val 12500'],
    gd: [
      'a5 pin 0 adj5 25000', 'maxAdj1 */ a5 2 1', 'a1 pin 0 adj1 maxAdj1', 'enAng pin 1 adj3 21599999',
      'stAng pin 0 adj4 21599999', 'th */ ss a1 100000', 'thh */ ss a5 100000', 'th2 */ th 1 2', 'rw1 +- wd2 th2 thh',
      'rh1 +- hd2 th2 thh', 'rw2 +- rw1 0 th', 'rh2 +- rh1 0 th', 'rw3 +- rw2 th2 0', 'rh3 +- rh2 th2 0',
      'wtH sin rw3 enAng', 'htH cos rh3 enAng', 'dxH cat2 rw3 htH wtH', 'dyH sat2 rh3 htH wtH', 'xH +- hc dxH 0',
      'yH +- vc dyH 0', 'rI min rw2 rh2', 'u1 */ dxH dxH 1', 'u2 */ dyH dyH 1', 'u3 */ rI rI 1', 'u4 +- u1 0 u3',
      'u5 +- u2 0 u3', 'u6 */ u4 u5 u1', 'u7 */ u6 1 u2', 'u8 +- 1 0 u7', 'u9 sqrt u8', 'u10 */ u4 1 dxH',
      'u11 */ u10 1 dyH', 'u12 +/ 1 u9 u11', 'u13 at2 1 u12', 'u14 +- u13 21600000 0', 'u15 ?: u13 u13 u14',
      'u16 +- u15 0 enAng', 'u17 +- u16 21600000 0', 'u18 ?: u16 u16 u17', 'u19 +- u18 0 cd2', 'u20 +- u18 0 21600000',
      'u21 ?: u19 u20 u18', 'maxAng abs u21', 'aAng pin 0 adj2 maxAng', 'ptAng +- enAng aAng 0', 'wtA sin rw3 ptAng',
      'htA cos rh3 ptAng', 'dxA cat2 rw3 htA wtA', 'dyA sat2 rh3 htA wtA', 'xA +- hc dxA 0', 'yA +- vc dyA 0',
      'wtE sin rw1 stAng', 'htE cos rh1 stAng', 'dxE cat2 rw1 htE wtE', 'dyE sat2 rh1 htE wtE', 'xE +- hc dxE 0',
      'yE +- vc dyE 0', 'dxG cos thh ptAng', 'dyG sin thh ptAng', 'xG +- xH dxG 0', 'yG +- yH dyG 0',
      'dxB cos thh ptAng', 'dyB sin thh ptAng', 'xB +- xH 0 dxB 0', 'yB +- yH 0 dyB 0', 'sx1 +- xB 0 hc',
      'sy1 +- yB 0 vc', 'sx2 +- xG 0 hc', 'sy2 +- yG 0 vc', 'rO min rw1 rh1', 'x1O */ sx1 rO rw1', 'y1O */ sy1 rO rh1',
      'x2O */ sx2 rO rw1', 'y2O */ sy2 rO rh1', 'dxO +- x2O 0 x1O', 'dyO +- y2O 0 y1O', 'dO mod dxO dyO 0',
      'q1 */ x1O y2O 1', 'q2 */ x2O y1O 1', 'DO +- q1 0 q2', 'q3 */ rO rO 1', 'q4 */ dO dO 1', 'q5 */ q3 q4 1',
      'q6 */ DO DO 1', 'q7 +- q5 0 q6', 'q8 max q7 0', 'sdelO sqrt q8', 'ndyO */ dyO -1 1', 'sdyO ?: ndyO -1 1',
      'q9 */ sdyO dxO 1', 'q10 */ q9 sdelO 1', 'q11 */ DO dyO 1', 'dxF1 +/ q11 q10 q4', 'q12 +- q11 0 q10',
      'dxF2 */ q12 1 q4', 'adyO abs dyO', 'q13 */ adyO sdelO 1', 'q14 */ DO dxO -1', 'dyF1 +/ q14 q13 q4',
      'q15 +- q14 0 q13', 'dyF2 */ q15 1 q4', 'q16 +- x2O 0 dxF1', 'q17 +- x2O 0 dxF2', 'q18 +- y2O 0 dyF1',
      'q19 +- y2O 0 dyF2', 'q20 mod q16 q18 0', 'q21 mod q17 q19 0', 'q22 +- q21 0 q20', 'dxF ?: q22 dxF1 dxF2',
      'dyF ?: q22 dyF1 dyF2', 'sdxF */ dxF rw1 rO', 'sdyF */ dyF rh1 rO', 'xF +- hc sdxF 0', 'yF +- vc sdyF 0',
      'x1I */ sx1 rI rw2', 'y1I */ sy1 rI rh2', 'x2I */ sx2 rI rw2', 'y2I */ sy2 rI rh2', 'dxI +- x2I 0 x1I',
      'dyI +- y2I 0 y1I', 'dI mod dxI dyI 0', 'v1 */ x1I y2I 1', 'v2 */ x2I y1I 1', 'DI +- v1 0 v2', 'v3 */ rI rI 1',
      'v4 */ dI dI 1', 'v5 */ v3 v4 1', 'v6 */ DI DI 1', 'v7 +- v5 0 v6', 'v8 max v7 0', 'sdelI sqrt v8',
      'v9 */ sdyO dxI 1', 'v10 */ v9 sdelI 1', 'v11 */ DI dyI 1', 'dxC1 +/ v11 v10 v4', 'v12 +- v11 0 v10',
      'dxC2 */ v12 1 v4', 'adyI abs dyI', 'v13 */ adyI sdelI 1', 'v14 */ DI dxI -1', 'dyC1 +/ v14 v13 v4',
      'v15 +- v14 0 v13', 'dyC2 */ v15 1 v4', 'v16 +- x1I 0 dxC1', 'v17 +- x1I 0 dxC2', 'v18 +- y1I 0 dyC1',
      'v19 +- y1I 0 dyC2', 'v20 mod v16 v18 0', 'v21 mod v17 v19 0', 'v22 +- v21 0 v20', 'dxC ?: v22 dxC1 dxC2',
      'dyC ?: v22 dyC1 dyC2', 'sdxC */ dxC rw2 rI', 'sdyC */ dyC rh2 rI', 'xC +- hc sdxC 0', 'yC +- vc sdyC 0',
      'ist0 at2 sdxC sdyC', 'ist1 +- ist0 21600000 0', 'istAng ?: ist0 ist0 ist1', 'isw1 +- stAng 0 istAng',
      'isw2 +- isw1 0 21600000', 'iswAng ?: isw1 isw2 isw1', 'p1 +- xF 0 xC', 'p2 +- yF 0 yC', 'p3 mod p1 p2 0',
      'p4 */ p3 1 2', 'p5 +- p4 0 thh', 'xGp ?: p5 xF xG', 'yGp ?: p5 yF yG', 'xBp ?: p5 xC xB', 'yBp ?: p5 yC yB',
      'en0 at2 sdxF sdyF', 'en1 +- en0 21600000 0', 'en2 ?: en0 en0 en1', 'sw0 +- en2 0 stAng',
      'sw1 +- sw0 21600000 0', 'swAng ?: sw0 sw0 sw1', 'wtI sin rw3 stAng', 'htI cos rh3 stAng',
      'dxI cat2 rw3 htI wtI', 'dyI sat2 rh3 htI wtI', 'xI +- hc dxI 0', 'yI +- vc dyI 0', 'aI +- stAng 0 cd4',
      'aA +- ptAng cd4 0', 'aB +- ptAng cd2 0', 'idx cos rw1 2700000', 'idy sin rh1 2700000', 'il +- hc 0 idx',
      'ir +- hc idx 0', 'it +- vc 0 idy', 'ib +- vc idy 0',
    ],
    ah: [
      'polar _ _ _ adj2 0 maxAng xA yA', 'polar _ _ _ adj4 0 21599999 xE yE',
      'polar adj1 0 maxAdj1 adj3 0 21599999 xF yF', 'polar adj5 0 25000 _ _ _ xB yB',
    ],
    cxn: ['aI xI yI', 'ptAng xGp yGp', 'aA xA yA', 'aB xBp yBp'],
    rect: 'il it ir ib',
    path: [
      [
        'M xE yE', 'A rw1 rh1 stAng swAng', 'L xGp yGp', 'L xA yA', 'L xBp yBp', 'L xC yC', 'A rw2 rh2 istAng iswAng',
        'Z',
      ],
    ],
  },
  cloud: {
    gd: [
      'il */ w 2977 21600', 'it */ h 3262 21600', 'ir */ w 17087 21600', 'ib */ h 17337 21600', 'g27 */ w 67 21600',
      'g28 */ h 21577 21600', 'g29 */ w 21582 21600', 'g30 */ h 1235 21600',
    ],
    cxn: ['0 g29 vc', 'cd4 hc g28', 'cd2 g27 vc', '3cd4 hc g30'],
    rect: 'il it ir ib',
    path: [
      [
        'w=43200 h=43200', 'M 3900 14370', 'A 6753 9190 -11429249 7426832', 'A 5333 7267 -8646143 5396714',
        'A 4365 5945 -8748475 5983381', 'A 4857 6595 -7859164 7034504', 'A 5333 7273 -4722533 6541615',
        'A 6775 9220 -2776035 7816140', 'A 5785 7867 37501 6842000', 'A 6752 9215 1347096 6910353',
        'A 7720 10543 3974558 4542661', 'A 4360 5918 -16496525 8804134', 'A 4345 5945 -14809710 9151131', 'Z',
      ],
      [
        'w=43200 h=43200 fill=none', 'M 4693 26177', 'A 4345 5945 5204520 1585770', 'M 6928 34899',
        'A 4360 5918 4416628 686848', 'M 16478 39090', 'A 6752 9215 8257449 844866', 'M 28827 34751',
        'A 6752 9215 387196 959901', 'M 34129 22954', 'A 5785 7867 -4217541 4255042', 'M 41798 15354',
        'A 5333 7273 1819082 1665090', 'M 38324 5426', 'A 4857 6595 -824660 891534', 'M 29078 3952',
        'A 4857 6595 -8950887 1091722', 'M 22141 4720', 'A 4365 5945 -9809656 1061181', 'M 14000 5192',
        'A 6753 9190 -4002417 739161', 'M 4127 15789', 'A 6753 9190 9459261 711490',
      ],
    ],
  },
  cloudCallout: {
    av: ['adj1 val -20833', 'adj2 val 62500'],
    gd: [
      'dxPos */ w adj1 100000', 'dyPos */ h adj2 100000', 'xPos +- hc dxPos 0', 'yPos +- vc dyPos 0',
      'ht cat2 hd2 dxPos dyPos', 'wt sat2 wd2 dxPos dyPos', 'g2 cat2 wd2 ht wt', 'g3 sat2 hd2 ht wt', 'g4 +- hc g2 0',
      'g5 +- vc g3 0', 'g6 +- g4 0 xPos', 'g7 +- g5 0 yPos', 'g8 mod g6 g7 0', 'g9 */ ss 6600 21600', 'g10 +- g8 0 g9',
      'g11 */ g10 1 3', 'g12 */ ss 1800 21600', 'g13 +- g11 g12 0', 'g14 */ g13 g6 g8', 'g15 */ g13 g7 g8',
      'g16 +- g14 xPos 0', 'g17 +- g15 yPos 0', 'g18 */ ss 4800 21600', 'g19 */ g11 2 1', 'g20 +- g18 g19 0',
      'g21 */ g20 g6 g8', 'g22 */ g20 g7 g8', 'g23 +- g21 xPos 0', 'g24 +- g22 yPos 0', 'g25 */ ss 1200 21600',
      'g26 */ ss 600 21600', 'x23 +- xPos g26 0', 'x24 +- g16 g25 0', 'x25 +- g23 g12 0', 'il */ w 2977 21600',
      'it */ h 3262 21600', 'ir */ w 17087 21600', 'ib */ h 17337 21600', 'g27 */ w 67 21600', 'g28 */ h 21577 21600',
      'g29 */ w 21582 21600', 'g30 */ h 1235 21600', 'pang at2 dxPos dyPos',
    ],
    ah: ['xy adj1 -2147483647 2147483647 adj2 -2147483647 2147483647 xPos yPos'],
    cxn: ['cd2 g27 vc', 'cd4 hc g28', '0 g29 vc', '3cd4 hc g30', 'pang xPos yPos'],
    rect: 'il it ir ib',
    path: [
      [
        'w=43200 h=43200', 'M 3900 14370', 'A 6753 9190 -11429249 7426832', 'A 5333 7267 -8646143 5396714',
        'A 4365 5945 -8748475 5983381', 'A 4857 6595 -7859164 7034504', 'A 5333 7273 -4722533 6541615',
        'A 6775 9220 -2776035 7816140', 'A 5785 7867 37501 6842000', 'A 6752 9215 1347096 6910353',
        'A 7720 10543 3974558 4542661', 'A 4360 5918 -16496525 8804134', 'A 4345 5945 -14809710 9151131', 'Z',
      ],
      ['M x23 yPos', 'A g26 g26 0 21600000', 'Z'],
      ['M x24 g17', 'A g25 g25 0 21600000', 'Z'],
      ['M x25 g24', 'A g12 g12 0 21600000', 'Z'],
      [
        'w=43200 h=43200 fill=none', 'M 4693 26177', 'A 4345 5945 5204520 1585770', 'M 6928 34899',
        'A 4360 5918 4416628 686848', 'M 16478 39090', 'A 6752 9215 8257449 844866', 'M 28827 34751',
        'A 6752 9215 387196 959901', 'M 34129 22954', 'A 5785 7867 -4217541 4255042', 'M 41798 15354',
        'A 5333 7273 1819082 1665090', 'M 38324 5426', 'A 4857 6595 -824660 891534', 'M 29078 3952',
        'A 4857 6595 -8950887 1091722', 'M 22141 4720', 'A 4365 5945 -9809656 1061181', 'M 14000 5192',
        'A 6753 9190 -4002417 739161', 'M 4127 15789', 'A 6753 9190 9459261 711490',
      ],
    ],
  },
  corner: {
    av: ['adj1 val 50000', 'adj2 val 50000'],
    gd: [
      'maxAdj1 */ 100000 h ss', 'maxAdj2 */ 100000 w ss', 'a1 pin 0 adj1 maxAdj1', 'a2 pin 0 adj2 maxAdj2',
      'x1 */ ss a2 100000', 'dy1 */ ss a1 100000', 'y1 +- b 0 dy1', 'cx1 */ x1 1 2', 'cy1 +/ y1 b 2', 'd +- w 0 h',
      'it ?: d y1 t', 'ir ?: d r x1',
    ],
    ah: ['xy _ _ _ adj1 0 maxAdj1 l y1', 'xy adj2 0 maxAdj2 _ _ _ x1 t'],
    cxn: ['0 r cy1', 'cd4 hc b', 'cd2 l vc', '3cd4 cx1 t'],
    rect: 'l it ir b',
    path: [
      ['M l t', 'L x1 t', 'L x1 y1', 'L r y1', 'L r b', 'L l b', 'Z'],
    ],
  },
  cornerTabs: {
    gd: ['md mod w h 0', 'dx */ 1 md 20', 'y1 +- 0 b dx', 'x1 +- 0 r dx'],
    cxn: [
      'cd2 l t', 'cd2 l dx', 'cd2 l y1', 'cd2 l b', '3cd4 dx t', '3cd4 x1 t', 'cd4 dx b', 'cd4 x1 b', '0 r t',
      '0 r dx', '0 r y1', '0 r b',
    ],
    rect: 'dx dx x1 y1',
    path: [
      ['M l t', 'L dx t', 'L l dx', 'Z'],
      ['M l y1', 'L dx b', 'L l b', 'Z'],
      ['M x1 t', 'L r t', 'L r dx', 'Z'],
      ['M r y1', 'L r b', 'L x1 b', 'Z'],
    ],
  },
  cube: {
    av: ['adj val 25000'],
    gd: [
      'a pin 0 adj 100000', 'y1 */ ss a 100000', 'y4 +- b 0 y1', 'y2 */ y4 1 2', 'y3 +/ y1 b 2', 'x4 +- r 0 y1',
      'x2 */ x4 1 2', 'x3 +/ y1 r 2',
    ],
    ah: ['xy _ _ _ adj 0 100000 l y1'],
    cxn: ['3cd4 x3 t', '3cd4 x2 y1', 'cd2 l y3', 'cd4 x2 b', '0 x4 y3', '0 r y2'],
    rect: 'l y1 x4 b',
    path: [
      ['stroke=0', 'M l y1', 'L x4 y1', 'L x4 b', 'L l b', 'Z'],
      ['fill=darkenLess stroke=0', 'M x4 y1', 'L r t', 'L r y4', 'L x4 b', 'Z'],
      ['fill=lightenLess stroke=0', 'M l y1', 'L y1 t', 'L r t', 'L x4 y1', 'Z'],
      [
        'fill=none', 'M l y1', 'L y1 t', 'L r t', 'L r y4', 'L x4 b', 'L l b', 'Z', 'M l y1', 'L x4 y1', 'L r t',
        'M x4 y1', 'L x4 b',
      ],
    ],
  },
  curvedConnector2: {
    rect: 'l t r b',
    path: [
      ['fill=none', 'M l t', 'C wd2 t r hd2 r b'],
    ],
  },
  curvedConnector3: {
    av: ['adj1 val 50000'],
    gd: ['x2 */ w adj1 100000', 'x1 +/ l x2 2', 'x3 +/ r x2 2', 'y3 */ h 3 4'],
    ah: ['xy adj1 -2147483647 2147483647 _ _ _ x2 vc'],
    rect: 'l t r b',
    path: [
      ['fill=none', 'M l t', 'C x1 t x2 hd4 x2 vc', 'C x2 y3 x3 b r b'],
    ],
  },
  curvedConnector4: {
    av: ['adj1 val 50000', 'adj2 val 50000'],
    gd: [
      'x2 */ w adj1 100000', 'x1 +/ l x2 2', 'x3 +/ r x2 2', 'x4 +/ x2 x3 2', 'x5 +/ x3 r 2', 'y4 */ h adj2 100000',
      'y1 +/ t y4 2', 'y2 +/ t y1 2', 'y3 +/ y1 y4 2', 'y5 +/ b y4 2',
    ],
    ah: ['xy adj1 -2147483647 2147483647 _ _ _ x2 y1', 'xy _ _ _ adj2 -2147483647 2147483647 x3 y4'],
    rect: 'l t r b',
    path: [
      ['fill=none', 'M l t', 'C x1 t x2 y2 x2 y1', 'C x2 y3 x4 y4 x3 y4', 'C x5 y4 r y5 r b'],
    ],
  },
  curvedConnector5: {
    av: ['adj1 val 50000', 'adj2 val 50000', 'adj3 val 50000'],
    gd: [
      'x3 */ w adj1 100000', 'x6 */ w adj3 100000', 'x1 +/ x3 x6 2', 'x2 +/ l x3 2', 'x4 +/ x3 x1 2', 'x5 +/ x6 x1 2',
      'x7 +/ x6 r 2', 'y4 */ h adj2 100000', 'y1 +/ t y4 2', 'y2 +/ t y1 2', 'y3 +/ y1 y4 2', 'y5 +/ b y4 2',
      'y6 +/ y5 y4 2', 'y7 +/ y5 b 2',
    ],
    ah: [
      'xy adj1 -2147483647 2147483647 _ _ _ x3 y1', 'xy _ _ _ adj2 -2147483647 2147483647 x1 y4',
      'xy adj3 -2147483647 2147483647 _ _ _ x6 y5',
    ],
    rect: 'l t r b',
    path: [
      ['fill=none', 'M l t', 'C x2 t x3 y2 x3 y1', 'C x3 y3 x4 y4 x1 y4', 'C x5 y4 x6 y6 x6 y5', 'C x6 y7 x7 b r b'],
    ],
  },
  curvedDownArrow: {
    av: ['adj1 val 25000', 'adj2 val 50000', 'adj3 val 25000'],
    gd: [
      'maxAdj2 */ 50000 w ss', 'a2 pin 0 adj2 maxAdj2', 'a1 pin 0 adj1 100000', 'th */ ss a1 100000',
      'aw */ ss a2 100000', 'q1 +/ th aw 4', 'wR +- wd2 0 q1', 'q7 */ wR 2 1', 'q8 */ q7 q7 1', 'q9 */ th th 1',
      'q10 +- q8 0 q9', 'q11 sqrt q10', 'idy */ q11 h q7', 'maxAdj3 */ 100000 idy ss', 'a3 pin 0 adj3 maxAdj3',
      'ah */ ss adj3 100000', 'x3 +- wR th 0', 'q2 */ h h 1', 'q3 */ ah ah 1', 'q4 +- q2 0 q3', 'q5 sqrt q4',
      'dx */ q5 wR h', 'x5 +- wR dx 0', 'x7 +- x3 dx 0', 'q6 +- aw 0 th', 'dh */ q6 1 2', 'x4 +- x5 0 dh',
      'x8 +- x7 dh 0', 'aw2 */ aw 1 2', 'x6 +- r 0 aw2', 'y1 +- b 0 ah', 'swAng at2 ah dx', 'mswAng +- 0 0 swAng',
      'iy +- b 0 idy', 'ix +/ wR x3 2', 'q12 */ th 1 2', 'dang2 at2 idy q12', 'stAng +- 3cd4 swAng 0',
      'stAng2 +- 3cd4 0 dang2', 'swAng2 +- dang2 0 cd4', 'swAng3 +- cd4 dang2 0',
    ],
    ah: ['xy adj1 0 adj2 _ _ _ x7 y1', 'xy adj2 0 maxAdj2 _ _ _ x4 b', 'xy _ _ _ adj3 0 maxAdj3 r y1'],
    cxn: ['3cd4 ix t', 'cd4 q12 b', 'cd4 x4 y1', 'cd4 x6 b', '0 x8 y1'],
    rect: 'l t r b',
    path: [
      [
        'stroke=0', 'M x6 b', 'L x4 y1', 'L x5 y1', 'A wR h stAng mswAng', 'L x3 t', 'A wR h 3cd4 swAng', 'L x8 y1',
        'Z',
      ],
      ['fill=darkenLess stroke=0', 'M ix iy', 'A wR h stAng2 swAng2', 'L l b', 'A wR h cd2 swAng3', 'Z'],
      [
        'fill=none', 'M ix iy', 'A wR h stAng2 swAng2', 'L l b', 'A wR h cd2 cd4', 'L x3 t', 'A wR h 3cd4 swAng',
        'L x8 y1', 'L x6 b', 'L x4 y1', 'L x5 y1', 'A wR h stAng mswAng',
      ],
    ],
  },
  curvedLeftArrow: {
    av: ['adj1 val 25000', 'adj2 val 50000', 'adj3 val 25000'],
    gd: [
      'maxAdj2 */ 50000 h ss', 'a2 pin 0 adj2 maxAdj2', 'a1 pin 0 adj1 a2', 'th */ ss a1 100000', 'aw */ ss a2 100000',
      'q1 +/ th aw 4', 'hR +- hd2 0 q1', 'q7 */ hR 2 1', 'q8 */ q7 q7 1', 'q9 */ th th 1', 'q10 +- q8 0 q9',
      'q11 sqrt q10', 'idx */ q11 w q7', 'maxAdj3 */ 100000 idx ss', 'a3 pin 0 adj3 maxAdj3', 'ah */ ss a3 100000',
      'y3 +- hR th 0', 'q2 */ w w 1', 'q3 */ ah ah 1', 'q4 +- q2 0 q3', 'q5 sqrt q4', 'dy */ q5 hR w', 'y5 +- hR dy 0',
      'y7 +- y3 dy 0', 'q6 +- aw 0 th', 'dh */ q6 1 2', 'y4 +- y5 0 dh', 'y8 +- y7 dh 0', 'aw2 */ aw 1 2',
      'y6 +- b 0 aw2', 'x1 +- l ah 0', 'swAng at2 ah dy', 'mswAng +- 0 0 swAng', 'ix +- l idx 0', 'iy +/ hR y3 2',
      'q12 */ th 1 2', 'dang2 at2 idx q12', 'swAng2 +- dang2 0 swAng', 'swAng3 +- swAng dang2 0',
      'stAng3 +- 0 0 dang2',
    ],
    ah: ['xy _ _ _ adj1 0 a2 x1 y5', 'xy _ _ _ adj2 0 maxAdj2 r y4', 'xy adj3 0 maxAdj3 _ _ _ x1 b'],
    cxn: ['cd2 l q12', 'cd2 x1 y4', 'cd3 l y6', 'cd4 x1 y8', '0 r iy'],
    rect: 'l t r b',
    path: [
      ['stroke=0', 'M l y6', 'L x1 y4', 'L x1 y5', 'A w hR swAng swAng2', 'A w hR stAng3 swAng3', 'L x1 y8', 'Z'],
      ['fill=darkenLess stroke=0', 'M r y3', 'A w hR 0 -5400000', 'L l t', 'A w hR 3cd4 cd4', 'Z'],
      [
        'fill=none', 'M r y3', 'A w hR 0 -5400000', 'L l t', 'A w hR 3cd4 cd4', 'L r y3', 'A w hR 0 swAng', 'L x1 y8',
        'L l y6', 'L x1 y4', 'L x1 y5', 'A w hR swAng swAng2',
      ],
    ],
  },
  curvedRightArrow: {
    av: ['adj1 val 25000', 'adj2 val 50000', 'adj3 val 25000'],
    gd: [
      'maxAdj2 */ 50000 h ss', 'a2 pin 0 adj2 maxAdj2', 'a1 pin 0 adj1 a2', 'th */ ss a1 100000', 'aw */ ss a2 100000',
      'q1 +/ th aw 4', 'hR +- hd2 0 q1', 'q7 */ hR 2 1', 'q8 */ q7 q7 1', 'q9 */ th th 1', 'q10 +- q8 0 q9',
      'q11 sqrt q10', 'idx */ q11 w q7', 'maxAdj3 */ 100000 idx ss', 'a3 pin 0 adj3 maxAdj3', 'ah */ ss a3 100000',
      'y3 +- hR th 0', 'q2 */ w w 1', 'q3 */ ah ah 1', 'q4 +- q2 0 q3', 'q5 sqrt q4', 'dy */ q5 hR w', 'y5 +- hR dy 0',
      'y7 +- y3 dy 0', 'q6 +- aw 0 th', 'dh */ q6 1 2', 'y4 +- y5 0 dh', 'y8 +- y7 dh 0', 'aw2 */ aw 1 2',
      'y6 +- b 0 aw2', 'x1 +- r 0 ah', 'swAng at2 ah dy', 'stAng +- cd2 0 swAng', 'mswAng +- 0 0 swAng',
      'ix +- r 0 idx', 'iy +/ hR y3 2', 'q12 */ th 1 2', 'dang2 at2 idx q12', 'swAng2 +- dang2 0 cd4',
      'swAng3 +- cd4 dang2 0', 'stAng3 +- cd2 0 dang2',
    ],
    ah: ['xy _ _ _ adj1 0 a2 x1 y5', 'xy _ _ _ adj2 0 maxAdj2 r y4', 'xy adj3 0 maxAdj3 _ _ _ x1 b'],
    cxn: ['cd2 l iy', 'cd4 x1 y8', '0 r y6', '0 x1 y4', '0 r q12'],
    rect: 'l t r b',
    path: [
      [
        'stroke=0', 'M l hR', 'A w hR cd2 mswAng', 'L x1 y4', 'L r y6', 'L x1 y8', 'L x1 y7', 'A w hR stAng swAng',
        'Z',
      ],
      ['fill=darkenLess stroke=0', 'M r th', 'A w hR 3cd4 swAng2', 'A w hR stAng3 swAng3', 'Z'],
      [
        'fill=none', 'M l hR', 'A w hR cd2 mswAng', 'L x1 y4', 'L r y6', 'L x1 y8', 'L x1 y7', 'A w hR stAng swAng',
        'L l hR', 'A w hR cd2 cd4', 'L r th', 'A w hR 3cd4 swAng2',
      ],
    ],
  },
  curvedUpArrow: {
    av: ['adj1 val 25000', 'adj2 val 50000', 'adj3 val 25000'],
    gd: [
      'maxAdj2 */ 50000 w ss', 'a2 pin 0 adj2 maxAdj2', 'a1 pin 0 adj1 100000', 'th */ ss a1 100000',
      'aw */ ss a2 100000', 'q1 +/ th aw 4', 'wR +- wd2 0 q1', 'q7 */ wR 2 1', 'q8 */ q7 q7 1', 'q9 */ th th 1',
      'q10 +- q8 0 q9', 'q11 sqrt q10', 'idy */ q11 h q7', 'maxAdj3 */ 100000 idy ss', 'a3 pin 0 adj3 maxAdj3',
      'ah */ ss adj3 100000', 'x3 +- wR th 0', 'q2 */ h h 1', 'q3 */ ah ah 1', 'q4 +- q2 0 q3', 'q5 sqrt q4',
      'dx */ q5 wR h', 'x5 +- wR dx 0', 'x7 +- x3 dx 0', 'q6 +- aw 0 th', 'dh */ q6 1 2', 'x4 +- x5 0 dh',
      'x8 +- x7 dh 0', 'aw2 */ aw 1 2', 'x6 +- r 0 aw2', 'y1 +- t ah 0', 'swAng at2 ah dx', 'mswAng +- 0 0 swAng',
      'iy +- t idy 0', 'ix +/ wR x3 2', 'q12 */ th 1 2', 'dang2 at2 idy q12', 'swAng2 +- dang2 0 swAng',
      'mswAng2 +- 0 0 swAng2', 'stAng3 +- cd4 0 swAng', 'swAng3 +- swAng dang2 0', 'stAng2 +- cd4 0 dang2',
    ],
    ah: ['xy adj1 0 a2 _ _ _ x7 y1', 'xy adj2 0 maxAdj2 _ _ _ x4 t', 'xy _ _ _ adj3 0 maxAdj3 r y1'],
    cxn: ['3cd4 x6 t', '3cd4 x4 y1', '3cd4 q12 t', 'cd4 ix b', '0 x8 y1'],
    rect: 'l t r b',
    path: [
      ['stroke=0', 'M x6 t', 'L x8 y1', 'L x7 y1', 'A wR h stAng3 swAng3', 'A wR h stAng2 swAng2', 'L x4 y1', 'Z'],
      ['fill=darkenLess stroke=0', 'M wR b', 'A wR h cd4 cd4', 'L th t', 'A wR h cd2 -5400000', 'Z'],
      [
        'fill=none', 'M ix iy', 'A wR h stAng2 swAng2', 'L x4 y1', 'L x6 t', 'L x8 y1', 'L x7 y1',
        'A wR h stAng3 swAng', 'L wR b', 'A wR h cd4 cd4', 'L th t', 'A wR h cd2 -5400000',
      ],
    ],
  },
  decagon: {
    av: ['vf val 105146'],
    gd: [
      'shd2 */ hd2 vf 100000', 'dx1 cos wd2 2160000', 'dx2 cos wd2 4320000', 'x1 +- hc 0 dx1', 'x2 +- hc 0 dx2',
      'x3 +- hc dx2 0', 'x4 +- hc dx1 0', 'dy1 sin shd2 4320000', 'dy2 sin shd2 2160000', 'y1 +- vc 0 dy1',
      'y2 +- vc 0 dy2', 'y3 +- vc dy2 0', 'y4 +- vc dy1 0',
    ],
    cxn: [
      '0 x4 y2', '0 r vc', '0 x4 y3', 'cd4 x3 y4', 'cd4 x2 y4', 'cd2 x1 y3', 'cd2 l vc', 'cd2 x1 y2', '3cd4 x2 y1',
      '3cd4 x3 y1',
    ],
    rect: 'x1 y2 x4 y3',
    path: [
      [
        'M l vc', 'L x1 y2', 'L x2 y1', 'L x3 y1', 'L x4 y2', 'L r vc', 'L x4 y3', 'L x3 y4', 'L x2 y4', 'L x1 y3',
        'Z',
      ],
    ],
  },
  diagStripe: {
    av: ['adj val 50000'],
    gd: [
      'a pin 0 adj 100000', 'x2 */ w a 100000', 'x1 */ x2 1 2', 'x3 +/ x2 r 2', 'y2 */ h a 100000', 'y1 */ y2 1 2',
      'y3 +/ y2 b 2',
    ],
    ah: ['xy _ _ _ adj 0 100000 l y2'],
    cxn: ['0 hc vc', 'cd2 l y3', 'cd2 x1 y1', '3cd4 x3 t'],
    rect: 'l t x3 y3',
    path: [
      ['M l y2', 'L x2 t', 'L r t', 'L l b', 'Z'],
    ],
  },
  diamond: {
    gd: ['ir */ w 3 4', 'ib */ h 3 4'],
    cxn: ['3cd4 hc t', 'cd2 l vc', 'cd4 hc b', '0 r vc'],
    rect: 'wd4 hd4 ir ib',
    path: [
      ['M l vc', 'L hc t', 'L r vc', 'L hc b', 'Z'],
    ],
  },
  dodecagon: {
    gd: [
      'x1 */ w 2894 21600', 'x2 */ w 7906 21600', 'x3 */ w 13694 21600', 'x4 */ w 18706 21600', 'y1 */ h 2894 21600',
      'y2 */ h 7906 21600', 'y3 */ h 13694 21600', 'y4 */ h 18706 21600',
    ],
    cxn: [
      '0 x4 y1', '0 r y2', '0 r y3', '0 x4 y4', 'cd4 x3 b', 'cd4 x2 b', 'cd2 x1 y4', 'cd2 l y3', 'cd2 l y2',
      'cd2 x1 y1', '3cd4 x2 t', '3cd4 x3 t',
    ],
    rect: 'x1 y1 x4 y4',
    path: [
      [
        'M l y2', 'L x1 y1', 'L x2 t', 'L x3 t', 'L x4 y1', 'L r y2', 'L r y3', 'L x4 y4', 'L x3 b', 'L x2 b',
        'L x1 y4', 'L l y3', 'Z',
      ],
    ],
  },
  donut: {
    av: ['adj val 25000'],
    gd: [
      'a pin 0 adj 50000', 'dr */ ss a 100000', 'iwd2 +- wd2 0 dr', 'ihd2 +- hd2 0 dr', 'idx cos wd2 2700000',
      'idy sin hd2 2700000', 'il +- hc 0 idx', 'ir +- hc idx 0', 'it +- vc 0 idy', 'ib +- vc idy 0',
    ],
    ah: ['polar adj 0 50000 _ _ _ dr vc'],
    cxn: ['3cd4 hc t', '3cd4 il it', 'cd2 l vc', 'cd4 il ib', 'cd4 hc b', 'cd4 ir ib', '0 r vc', '3cd4 ir it'],
    rect: 'il it ir ib',
    path: [
      [
        'M l vc', 'A wd2 hd2 cd2 cd4', 'A wd2 hd2 3cd4 cd4', 'A wd2 hd2 0 cd4', 'A wd2 hd2 cd4 cd4', 'Z', 'M dr vc',
        'A iwd2 ihd2 cd2 -5400000', 'A iwd2 ihd2 cd4 -5400000', 'A iwd2 ihd2 0 -5400000', 'A iwd2 ihd2 3cd4 -5400000',
        'Z',
      ],
    ],
  },
  doubleWave: {
    av: ['adj1 val 6250', 'adj2 val 0'],
    gd: [
      'a1 pin 0 adj1 12500', 'a2 pin -10000 adj2 10000', 'y1 */ h a1 100000', 'dy2 */ y1 10 3', 'y2 +- y1 0 dy2',
      'y3 +- y1 dy2 0', 'y4 +- b 0 y1', 'y5 +- y4 0 dy2', 'y6 +- y4 dy2 0', 'dx1 */ w a2 100000', 'of2 */ w a2 50000',
      'x1 abs dx1', 'dx2 ?: of2 0 of2', 'x2 +- l 0 dx2', 'dx8 ?: of2 of2 0', 'x8 +- r 0 dx8', 'dx3 +/ dx2 x8 6',
      'x3 +- x2 dx3 0', 'dx4 +/ dx2 x8 3', 'x4 +- x2 dx4 0', 'x5 +/ x2 x8 2', 'x6 +- x5 dx3 0', 'x7 +/ x6 x8 2',
      'x9 +- l dx8 0', 'x15 +- r dx2 0', 'x10 +- x9 dx3 0', 'x11 +- x9 dx4 0', 'x12 +/ x9 x15 2', 'x13 +- x12 dx3 0',
      'x14 +/ x13 x15 2', 'x16 +- r 0 x1', 'xAdj +- hc dx1 0', 'il max x2 x9', 'ir min x8 x15', 'it */ h a1 50000',
      'ib +- b 0 it',
    ],
    ah: ['xy _ _ _ adj1 0 12500 l y1', 'xy adj2 -10000 10000 _ _ _ xAdj b'],
    cxn: ['cd4 x12 y1', 'cd2 x1 vc', '3cd4 x5 y4', '0 x16 vc'],
    rect: 'il it ir ib',
    path: [
      [
        'M x2 y1', 'C x3 y2 x4 y3 x5 y1', 'C x6 y2 x7 y3 x8 y1', 'L x15 y4', 'C x14 y6 x13 y5 x12 y4',
        'C x11 y6 x10 y5 x9 y4', 'Z',
      ],
    ],
  },
  downArrow: {
    av: ['adj1 val 50000', 'adj2 val 50000'],
    gd: [
      'maxAdj2 */ 100000 h ss', 'a1 pin 0 adj1 100000', 'a2 pin 0 adj2 maxAdj2', 'dy1 */ ss a2 100000',
      'y1 +- b 0 dy1', 'dx1 */ w a1 200000', 'x1 +- hc 0 dx1', 'x2 +- hc dx1 0', 'dy2 */ x1 dy1 wd2', 'y2 +- y1 dy2 0',
    ],
    ah: ['xy adj1 0 100000 _ _ _ x1 t', 'xy _ _ _ adj2 0 maxAdj2 l y1'],
    cxn: ['3cd4 hc t', 'cd2 l y1', 'cd4 hc b', '0 r y1'],
    rect: 'x1 t x2 y2',
    path: [
      ['M l y1', 'L x1 y1', 'L x1 t', 'L x2 t', 'L x2 y1', 'L r y1', 'L hc b', 'Z'],
    ],
  },
  downArrowCallout: {
    av: ['adj1 val 25000', 'adj2 val 25000', 'adj3 val 25000', 'adj4 val 64977'],
    gd: [
      'maxAdj2 */ 50000 w ss', 'a2 pin 0 adj2 maxAdj2', 'maxAdj1 */ a2 2 1', 'a1 pin 0 adj1 maxAdj1',
      'maxAdj3 */ 100000 h ss', 'a3 pin 0 adj3 maxAdj3', 'q2 */ a3 ss h', 'maxAdj4 +- 100000 0 q2',
      'a4 pin 0 adj4 maxAdj4', 'dx1 */ ss a2 100000', 'dx2 */ ss a1 200000', 'x1 +- hc 0 dx1', 'x2 +- hc 0 dx2',
      'x3 +- hc dx2 0', 'x4 +- hc dx1 0', 'dy3 */ ss a3 100000', 'y3 +- b 0 dy3', 'y2 */ h a4 100000', 'y1 */ y2 1 2',
    ],
    ah: [
      'xy adj1 0 maxAdj1 _ _ _ x2 y3', 'xy adj2 0 maxAdj2 _ _ _ x1 b', 'xy _ _ _ adj3 0 maxAdj3 r y3',
      'xy _ _ _ adj4 0 maxAdj4 l y2',
    ],
    cxn: ['3cd4 hc t', 'cd2 l y1', 'cd4 hc b', '0 r y1'],
    rect: 'l t r y2',
    path: [
      [
        'M l t', 'L r t', 'L r y2', 'L x3 y2', 'L x3 y3', 'L x4 y3', 'L hc b', 'L x1 y3', 'L x2 y3', 'L x2 y2',
        'L l y2', 'Z',
      ],
    ],
  },
  ellipse: {
    gd: [
      'idx cos wd2 2700000', 'idy sin hd2 2700000', 'il +- hc 0 idx', 'ir +- hc idx 0', 'it +- vc 0 idy',
      'ib +- vc idy 0',
    ],
    cxn: ['3cd4 hc t', '3cd4 il it', 'cd2 l vc', 'cd4 il ib', 'cd4 hc b', 'cd4 ir ib', '0 r vc', '3cd4 ir it'],
    rect: 'il it ir ib',
    path: [
      ['M l vc', 'A wd2 hd2 cd2 cd4', 'A wd2 hd2 3cd4 cd4', 'A wd2 hd2 0 cd4', 'A wd2 hd2 cd4 cd4', 'Z'],
    ],
  },
  ellipseRibbon: {
    av: ['adj1 val 25000', 'adj2 val 50000', 'adj3 val 12500'],
    gd: [
      'a1 pin 0 adj1 100000', 'a2 pin 25000 adj2 75000', 'q10 +- 100000 0 a1', 'q11 */ q10 1 2', 'q12 +- a1 0 q11',
      'minAdj3 max 0 q12', 'a3 pin minAdj3 adj3 a1', 'dx2 */ w a2 200000', 'x2 +- hc 0 dx2', 'x3 +- x2 wd8 0',
      'x4 +- r 0 x3', 'x5 +- r 0 x2', 'x6 +- r 0 wd8', 'dy1 */ h a3 100000', 'f1 */ 4 dy1 w', 'q1 */ x3 x3 w',
      'q2 +- x3 0 q1', 'y1 */ f1 q2 1', 'cx1 */ x3 1 2', 'cy1 */ f1 cx1 1', 'cx2 +- r 0 cx1', 'q1 */ h a1 100000',
      'dy3 +- q1 0 dy1', 'q3 */ x2 x2 w', 'q4 +- x2 0 q3', 'q5 */ f1 q4 1', 'y3 +- q5 dy3 0', 'q6 +- dy1 dy3 y3',
      'q7 +- q6 dy1 0', 'cy3 +- q7 dy3 0', 'rh +- b 0 q1', 'q8 */ dy1 14 16', 'y2 +/ q8 rh 2', 'y5 +- q5 rh 0',
      'y6 +- y3 rh 0', 'cx4 */ x2 1 2', 'q9 */ f1 cx4 1', 'cy4 +- q9 rh 0', 'cx5 +- r 0 cx4', 'cy6 +- cy3 rh 0',
      'y7 +- y1 dy3 0', 'cy7 +- q1 q1 y7', 'y8 +- b 0 dy1',
    ],
    ah: ['xy _ _ _ adj1 0 100000 hc q1', 'xy adj2 25000 75000 _ _ _ x2 b', 'xy _ _ _ adj3 minAdj3 a1 l y8'],
    cxn: ['3cd4 hc q1', 'cd2 wd8 y2', 'cd4 hc b', '0 x6 y2'],
    rect: 'x2 q1 x5 y6',
    path: [
      [
        'stroke=0', 'M l t', 'Q cx1 cy1 x3 y1', 'L x2 y3', 'Q hc cy3 x5 y3', 'L x4 y1', 'Q cx2 cy1 r t', 'L x6 y2',
        'L r rh', 'Q cx5 cy4 x5 y5', 'L x5 y6', 'Q hc cy6 x2 y6', 'L x2 y5', 'Q cx4 cy4 l rh', 'L wd8 y2', 'Z',
      ],
      [
        'fill=darkenLess stroke=0', 'M x3 y7', 'L x3 y1', 'L x2 y3', 'Q hc cy3 x5 y3', 'L x4 y1', 'L x4 y7',
        'Q hc cy7 x3 y7', 'Z',
      ],
      [
        'fill=none', 'M l t', 'Q cx1 cy1 x3 y1', 'L x2 y3', 'Q hc cy3 x5 y3', 'L x4 y1', 'Q cx2 cy1 r t', 'L x6 y2',
        'L r rh', 'Q cx5 cy4 x5 y5', 'L x5 y6', 'Q hc cy6 x2 y6', 'L x2 y5', 'Q cx4 cy4 l rh', 'L wd8 y2', 'Z',
        'M x2 y5', 'L x2 y3', 'M x5 y3', 'L x5 y5', 'M x3 y1', 'L x3 y7', 'M x4 y7', 'L x4 y1',
      ],
    ],
  },
  ellipseRibbon2: {
    av: ['adj1 val 25000', 'adj2 val 50000', 'adj3 val 12500'],
    gd: [
      'a1 pin 0 adj1 100000', 'a2 pin 25000 adj2 75000', 'q10 +- 100000 0 a1', 'q11 */ q10 1 2', 'q12 +- a1 0 q11',
      'minAdj3 max 0 q12', 'a3 pin minAdj3 adj3 a1', 'dx2 */ w a2 200000', 'x2 +- hc 0 dx2', 'x3 +- x2 wd8 0',
      'x4 +- r 0 x3', 'x5 +- r 0 x2', 'x6 +- r 0 wd8', 'dy1 */ h a3 100000', 'f1 */ 4 dy1 w', 'q1 */ x3 x3 w',
      'q2 +- x3 0 q1', 'u1 */ f1 q2 1', 'y1 +- b 0 u1', 'cx1 */ x3 1 2', 'cu1 */ f1 cx1 1', 'cy1 +- b 0 cu1',
      'cx2 +- r 0 cx1', 'q1 */ h a1 100000', 'dy3 +- q1 0 dy1', 'q3 */ x2 x2 w', 'q4 +- x2 0 q3', 'q5 */ f1 q4 1',
      'u3 +- q5 dy3 0', 'y3 +- b 0 u3', 'q6 +- dy1 dy3 u3', 'q7 +- q6 dy1 0', 'cu3 +- q7 dy3 0', 'cy3 +- b 0 cu3',
      'rh +- b 0 q1', 'q8 */ dy1 14 16', 'u2 +/ q8 rh 2', 'y2 +- b 0 u2', 'u5 +- q5 rh 0', 'y5 +- b 0 u5',
      'u6 +- u3 rh 0', 'y6 +- b 0 u6', 'cx4 */ x2 1 2', 'q9 */ f1 cx4 1', 'cu4 +- q9 rh 0', 'cy4 +- b 0 cu4',
      'cx5 +- r 0 cx4', 'cu6 +- cu3 rh 0', 'cy6 +- b 0 cu6', 'u7 +- u1 dy3 0', 'y7 +- b 0 u7', 'cu7 +- q1 q1 u7',
      'cy7 +- b 0 cu7',
    ],
    ah: ['xy _ _ _ adj1 0 100000 hc rh', 'xy adj2 25000 100000 _ _ _ x2 t', 'xy _ _ _ adj3 minAdj3 a1 l dy1'],
    cxn: ['3cd4 hc t', 'cd2 wd8 y2', 'cd4 hc rh', '0 x6 y2'],
    rect: 'x2 y6 x5 rh',
    path: [
      [
        'stroke=0', 'M l b', 'Q cx1 cy1 x3 y1', 'L x2 y3', 'Q hc cy3 x5 y3', 'L x4 y1', 'Q cx2 cy1 r b', 'L x6 y2',
        'L r q1', 'Q cx5 cy4 x5 y5', 'L x5 y6', 'Q hc cy6 x2 y6', 'L x2 y5', 'Q cx4 cy4 l q1', 'L wd8 y2', 'Z',
      ],
      [
        'fill=darkenLess stroke=0', 'M x3 y7', 'L x3 y1', 'L x2 y3', 'Q hc cy3 x5 y3', 'L x4 y1', 'L x4 y7',
        'Q hc cy7 x3 y7', 'Z',
      ],
      [
        'fill=none', 'M l b', 'L wd8 y2', 'L l q1', 'Q cx4 cy4 x2 y5', 'L x2 y6', 'Q hc cy6 x5 y6', 'L x5 y5',
        'Q cx5 cy4 r q1', 'L x6 y2', 'L r b', 'Q cx2 cy1 x4 y1', 'L x5 y3', 'Q hc cy3 x2 y3', 'L x3 y1',
        'Q cx1 cy1 l b', 'Z', 'M x2 y3', 'L x2 y5', 'M x5 y5', 'L x5 y3', 'M x3 y7', 'L x3 y1', 'M x4 y1', 'L x4 y7',
      ],
    ],
  },
  flowChartAlternateProcess: {
    gd: ['x2 +- r 0 ssd6', 'y2 +- b 0 ssd6', 'il */ ssd6 29289 100000', 'ir +- r 0 il', 'ib +- b 0 il'],
    cxn: ['3cd4 hc t', 'cd2 l vc', 'cd4 hc b', '0 r vc'],
    rect: 'il il ir ib',
    path: [
      [
        'M l ssd6', 'A ssd6 ssd6 cd2 cd4', 'L x2 t', 'A ssd6 ssd6 3cd4 cd4', 'L r y2', 'A ssd6 ssd6 0 cd4', 'L ssd6 b',
        'A ssd6 ssd6 cd4 cd4', 'Z',
      ],
    ],
  },
  flowChartCollate: {
    gd: ['ir */ w 3 4', 'ib */ h 3 4'],
    cxn: ['3cd4 hc t', '3cd4 hc vc', 'cd4 hc b'],
    rect: 'wd4 hd4 ir ib',
    path: [
      ['w=2 h=2', 'M 0 0', 'L 2 0', 'L 1 1', 'L 2 2', 'L 0 2', 'L 1 1', 'Z'],
    ],
  },
  flowChartConnector: {
    gd: [
      'idx cos wd2 2700000', 'idy sin hd2 2700000', 'il +- hc 0 idx', 'ir +- hc idx 0', 'it +- vc 0 idy',
      'ib +- vc idy 0',
    ],
    cxn: ['3cd4 hc t', '3cd4 il it', 'cd2 l vc', 'cd4 il ib', 'cd4 hc b', 'cd4 ir ib', '0 r vc', '3cd4 ir it'],
    rect: 'il it ir ib',
    path: [
      ['M l vc', 'A wd2 hd2 cd2 cd4', 'A wd2 hd2 3cd4 cd4', 'A wd2 hd2 0 cd4', 'A wd2 hd2 cd4 cd4', 'Z'],
    ],
  },
  flowChartDecision: {
    gd: ['ir */ w 3 4', 'ib */ h 3 4'],
    cxn: ['3cd4 hc t', 'cd2 l vc', 'cd4 hc b', '0 r vc'],
    rect: 'wd4 hd4 ir ib',
    path: [
      ['w=2 h=2', 'M 0 1', 'L 1 0', 'L 2 1', 'L 1 2', 'Z'],
    ],
  },
  flowChartDelay: {
    gd: ['idx cos wd2 2700000', 'idy sin hd2 2700000', 'ir +- hc idx 0', 'it +- vc 0 idy', 'ib +- vc idy 0'],
    cxn: ['3cd4 hc t', 'cd2 l vc', 'cd4 hc b', '0 r vc'],
    rect: 'l it ir ib',
    path: [
      ['M l t', 'L hc t', 'A wd2 hd2 3cd4 cd2', 'L l b', 'Z'],
    ],
  },
  flowChartDisplay: {
    gd: ['x2 */ w 5 6'],
    cxn: ['3cd4 hc t', 'cd2 l vc', 'cd4 hc b', '0 r vc'],
    rect: 'wd6 t x2 b',
    path: [
      ['w=6 h=6', 'M 0 3', 'L 1 0', 'L 5 0', 'A 1 3 3cd4 cd2', 'L 1 6', 'Z'],
    ],
  },
  flowChartDocument: {
    gd: ['y1 */ h 17322 21600', 'y2 */ h 20172 21600'],
    cxn: ['3cd4 hc t', 'cd2 l vc', 'cd4 hc y2', '0 r vc'],
    rect: 'l t r y1',
    path: [
      ['w=21600 h=21600', 'M 0 0', 'L 21600 0', 'L 21600 17322', 'C 10800 17322 10800 23922 0 20172', 'Z'],
    ],
  },
  flowChartExtract: {
    gd: ['x2 */ w 3 4'],
    cxn: ['3cd4 hc t', 'cd2 wd4 vc', 'cd4 hc b', '0 x2 vc'],
    rect: 'wd4 vc x2 b',
    path: [
      ['w=2 h=2', 'M 0 2', 'L 1 0', 'L 2 2', 'Z'],
    ],
  },
  flowChartInputOutput: {
    gd: ['x3 */ w 2 5', 'x4 */ w 3 5', 'x5 */ w 4 5', 'x6 */ w 9 10'],
    cxn: ['3cd4 x4 t', '3cd4 hc t', 'cd2 wd10 vc', 'cd4 x3 b', 'cd4 hc b', '0 x6 vc'],
    rect: 'wd5 t x5 b',
    path: [
      ['w=5 h=5', 'M 0 5', 'L 1 0', 'L 5 0', 'L 4 5', 'Z'],
    ],
  },
  flowChartInternalStorage: {
    cxn: ['3cd4 hc t', 'cd2 l vc', 'cd4 hc b', '0 r vc'],
    rect: 'wd8 hd8 r b',
    path: [
      ['w=1 h=1 stroke=0', 'M 0 0', 'L 1 0', 'L 1 1', 'L 0 1', 'Z'],
      ['w=8 h=8 fill=none', 'M 1 0', 'L 1 8', 'M 0 1', 'L 8 1'],
      ['w=1 h=1 fill=none', 'M 0 0', 'L 1 0', 'L 1 1', 'L 0 1', 'Z'],
    ],
  },
  flowChartMagneticDisk: {
    gd: ['y3 */ h 5 6'],
    cxn: ['3cd4 hc hd3', '3cd4 hc t', 'cd2 l vc', 'cd4 hc b', '0 r vc'],
    rect: 'l hd3 r y3',
    path: [
      ['w=6 h=6 stroke=0', 'M 0 1', 'A 3 1 cd2 cd2', 'L 6 5', 'A 3 1 0 cd2', 'Z'],
      ['w=6 h=6 fill=none', 'M 6 1', 'A 3 1 0 cd2'],
      ['w=6 h=6 fill=none', 'M 0 1', 'A 3 1 cd2 cd2', 'L 6 5', 'A 3 1 0 cd2', 'Z'],
    ],
  },
  flowChartMagneticDrum: {
    gd: ['x2 */ w 2 3'],
    cxn: ['3cd4 hc t', 'cd2 l vc', 'cd4 hc b', '0 x2 vc', '0 r vc'],
    rect: 'wd6 t x2 b',
    path: [
      ['w=6 h=6 stroke=0', 'M 1 0', 'L 5 0', 'A 1 3 3cd4 cd2', 'L 1 6', 'A 1 3 cd4 cd2', 'Z'],
      ['w=6 h=6 fill=none', 'M 5 6', 'A 1 3 cd4 cd2'],
      ['w=6 h=6 fill=none', 'M 1 0', 'L 5 0', 'A 1 3 3cd4 cd2', 'L 1 6', 'A 1 3 cd4 cd2', 'Z'],
    ],
  },
  flowChartMagneticTape: {
    gd: [
      'idx cos wd2 2700000', 'idy sin hd2 2700000', 'il +- hc 0 idx', 'ir +- hc idx 0', 'it +- vc 0 idy',
      'ib +- vc idy 0', 'ang1 at2 w h',
    ],
    cxn: ['3cd4 hc t', 'cd2 l vc', 'cd4 hc b', '0 r vc'],
    rect: 'il it ir ib',
    path: [
      [
        'M hc b', 'A wd2 hd2 cd4 cd4', 'A wd2 hd2 cd2 cd4', 'A wd2 hd2 3cd4 cd4', 'A wd2 hd2 0 ang1', 'L r ib',
        'L r b', 'Z',
      ],
    ],
  },
  flowChartManualInput: {
    cxn: ['3cd4 hc hd10', 'cd2 l vc', 'cd4 hc b', '0 r vc'],
    rect: 'l hd5 r b',
    path: [
      ['w=5 h=5', 'M 0 1', 'L 5 0', 'L 5 5', 'L 0 5', 'Z'],
    ],
  },
  flowChartManualOperation: {
    gd: ['x3 */ w 4 5', 'x4 */ w 9 10'],
    cxn: ['3cd4 hc t', 'cd2 wd10 vc', 'cd4 hc b', '0 x4 vc'],
    rect: 'wd5 t x3 b',
    path: [
      ['w=5 h=5', 'M 0 0', 'L 5 0', 'L 4 5', 'L 1 5', 'Z'],
    ],
  },
  flowChartMerge: {
    gd: ['x2 */ w 3 4'],
    cxn: ['3cd4 hc t', 'cd2 wd4 vc', 'cd4 hc b', '0 x2 vc'],
    rect: 'wd4 t x2 vc',
    path: [
      ['w=2 h=2', 'M 0 0', 'L 2 0', 'L 1 2', 'Z'],
    ],
  },
  flowChartMultidocument: {
    gd: ['y2 */ h 3675 21600', 'y8 */ h 20782 21600', 'x3 */ w 9298 21600', 'x4 */ w 12286 21600', 'x5 */ w 18595 21600'],
    cxn: ['3cd4 x4 t', 'cd2 l vc', 'cd4 x3 y8', '0 r vc'],
    rect: 'l y2 x5 y8',
    path: [
      [
        'w=21600 h=21600 stroke=0', 'M 0 20782', 'C 9298 23542 9298 18022 18595 18022', 'L 18595 3675', 'L 0 3675',
        'Z', 'M 1532 3675', 'L 1532 1815', 'L 20000 1815', 'L 20000 16252', 'C 19298 16252 18595 16352 18595 16352',
        'L 18595 3675', 'Z', 'M 2972 1815', 'L 2972 0', 'L 21600 0', 'L 21600 14392',
        'C 20800 14392 20000 14467 20000 14467', 'L 20000 1815', 'Z',
      ],
      [
        'w=21600 h=21600 fill=none', 'M 0 3675', 'L 18595 3675', 'L 18595 18022', 'C 9298 18022 9298 23542 0 20782',
        'Z', 'M 1532 3675', 'L 1532 1815', 'L 20000 1815', 'L 20000 16252', 'C 19298 16252 18595 16352 18595 16352',
        'M 2972 1815', 'L 2972 0', 'L 21600 0', 'L 21600 14392', 'C 20800 14392 20000 14467 20000 14467',
      ],
      [
        'w=21600 h=21600 fill=none stroke=0', 'M 0 20782', 'C 9298 23542 9298 18022 18595 18022', 'L 18595 16352',
        'C 18595 16352 19298 16252 20000 16252', 'L 20000 14467', 'C 20000 14467 20800 14392 21600 14392', 'L 21600 0',
        'L 2972 0', 'L 2972 1815', 'L 1532 1815', 'L 1532 3675', 'L 0 3675', 'Z',
      ],
    ],
  },
  flowChartOfflineStorage: {
    gd: ['x4 */ w 3 4'],
    cxn: ['0 x4 vc', 'cd4 hc b', 'cd2 wd4 vc', '3cd4 hc t'],
    rect: 'wd4 t x4 vc',
    path: [
      ['w=2 h=2 stroke=0', 'M 0 0', 'L 2 0', 'L 1 2', 'Z'],
      ['w=5 h=5 fill=none', 'M 2 4', 'L 3 4'],
      ['w=2 h=2 fill=none', 'M 0 0', 'L 2 0', 'L 1 2', 'Z'],
    ],
  },
  flowChartOffpageConnector: {
    gd: ['y1 */ h 4 5'],
    cxn: ['3cd4 hc t', 'cd2 l vc', 'cd4 hc b', '0 r vc'],
    rect: 'l t r y1',
    path: [
      ['w=10 h=10', 'M 0 0', 'L 10 0', 'L 10 8', 'L 5 10', 'L 0 8', 'Z'],
    ],
  },
  flowChartOnlineStorage: {
    gd: ['x2 */ w 5 6'],
    cxn: ['3cd4 hc t', 'cd2 l vc', 'cd4 hc b', '0 x2 vc'],
    rect: 'wd6 t x2 b',
    path: [
      ['w=6 h=6', 'M 1 0', 'L 6 0', 'A 1 3 3cd4 -10800000', 'L 1 6', 'A 1 3 cd4 cd2', 'Z'],
    ],
  },
  flowChartOr: {
    gd: [
      'idx cos wd2 2700000', 'idy sin hd2 2700000', 'il +- hc 0 idx', 'ir +- hc idx 0', 'it +- vc 0 idy',
      'ib +- vc idy 0',
    ],
    cxn: ['3cd4 hc t', '3cd4 il it', 'cd2 l vc', 'cd4 il ib', 'cd4 hc b', 'cd4 ir ib', '0 r vc', '3cd4 ir it'],
    rect: 'il it ir ib',
    path: [
      ['stroke=0', 'M l vc', 'A wd2 hd2 cd2 cd4', 'A wd2 hd2 3cd4 cd4', 'A wd2 hd2 0 cd4', 'A wd2 hd2 cd4 cd4', 'Z'],
      ['fill=none', 'M hc t', 'L hc b', 'M l vc', 'L r vc'],
      ['fill=none', 'M l vc', 'A wd2 hd2 cd2 cd4', 'A wd2 hd2 3cd4 cd4', 'A wd2 hd2 0 cd4', 'A wd2 hd2 cd4 cd4', 'Z'],
    ],
  },
  flowChartPredefinedProcess: {
    gd: ['x2 */ w 7 8'],
    cxn: ['3cd4 hc t', 'cd2 l vc', 'cd4 hc b', '0 r vc'],
    rect: 'wd8 t x2 b',
    path: [
      ['w=1 h=1 stroke=0', 'M 0 0', 'L 1 0', 'L 1 1', 'L 0 1', 'Z'],
      ['w=8 h=8 fill=none', 'M 1 0', 'L 1 8', 'M 7 0', 'L 7 8'],
      ['w=1 h=1 fill=none', 'M 0 0', 'L 1 0', 'L 1 1', 'L 0 1', 'Z'],
    ],
  },
  flowChartPreparation: {
    gd: ['x2 */ w 4 5'],
    cxn: ['3cd4 hc t', 'cd2 l vc', 'cd4 hc b', '0 r vc'],
    rect: 'wd5 t x2 b',
    path: [
      ['w=10 h=10', 'M 0 5', 'L 2 0', 'L 8 0', 'L 10 5', 'L 8 10', 'L 2 10', 'Z'],
    ],
  },
  flowChartProcess: {
    cxn: ['3cd4 hc t', 'cd2 l vc', 'cd4 hc b', '0 r vc'],
    rect: 'l t r b',
    path: [
      ['w=1 h=1', 'M 0 0', 'L 1 0', 'L 1 1', 'L 0 1', 'Z'],
    ],
  },
  flowChartPunchedCard: {
    cxn: ['3cd4 hc t', 'cd2 l vc', 'cd4 hc b', '0 r vc'],
    rect: 'l hd5 r b',
    path: [
      ['w=5 h=5', 'M 0 1', 'L 1 0', 'L 5 0', 'L 5 5', 'L 0 5', 'Z'],
    ],
  },
  flowChartPunchedTape: {
    gd: ['y2 */ h 9 10', 'ib */ h 4 5'],
    cxn: ['3cd4 hc hd10', 'cd2 l vc', 'cd4 hc y2', '0 r vc'],
    rect: 'l hd5 r ib',
    path: [
      [
        'w=20 h=20', 'M 0 2', 'A 5 2 cd2 -10800000', 'A 5 2 cd2 cd2', 'L 20 18', 'A 5 2 0 -10800000', 'A 5 2 0 cd2',
        'Z',
      ],
    ],
  },
};
