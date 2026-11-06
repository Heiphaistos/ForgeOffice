// Fonctions de LibreOffice : EASTERSUNDAY, calendrier, *_ADD, SINGLE, FOURIER.
import { describe } from 'node:test';
import { E, runCases, type Case } from './helpers.ts';

describe('EASTERSUNDAY (dates de Paques connues)', () => {
  const easter: [number, number, number, number][] = [
    [1999, 4, 4, 0], [2000, 4, 23, 0], [2024, 3, 31, 0], [2025, 4, 20, 0], [2026, 4, 5, 0], [2038, 4, 25, 0], [1583, 4, 10, 0],
  ];
  const cases: Case[] = easter.map(([y, m, d]) => [`EASTERSUNDAY(${y})=DATE(${y},${m},${d})`, true]);
  cases.push(['EASTERSUNDAY(1500)', E('#NUM!')], ['EASTERSUNDAY("a")', E('#VALUE!')], ['EASTERSUNDAY(2024.9)=DATE(2024,3,31)', true]);
  runCases(cases);
});

describe('calendrier LibreOffice', () => {
  runCases([
    ['DAYSINMONTH(DATE(2024,2,10))', 29], ['DAYSINMONTH(DATE(2023,2,10))', 28], ['DAYSINMONTH(DATE(2023,12,1))', 31],
    ['DAYSINYEAR(DATE(2024,6,1))', 366], ['DAYSINYEAR(DATE(2023,6,1))', 365],
    ['ISLEAPYEAR(DATE(2000,1,1))', true], ['ISLEAPYEAR(DATE(1900,1,1))', false],
    ['WEEKSINYEAR(DATE(2020,6,1))', 53], ['WEEKSINYEAR(DATE(2015,6,1))', 53], ['WEEKSINYEAR(DATE(2024,6,1))', 52], ['WEEKSINYEAR(DATE(2026,6,1))', 53],
    ['MONTHS(DATE(2024,1,31),DATE(2024,3,30),0)', 1], ['MONTHS(DATE(2024,1,31),DATE(2024,3,30),1)', 2], ['MONTHS(DATE(2024,3,30),DATE(2024,1,31))', -1],
    ['YEARS(DATE(2020,6,15),DATE(2024,6,14),0)', 3], ['YEARS(DATE(2020,6,15),DATE(2024,6,14),1)', 4], ['YEARS(DATE(2020,6,15),DATE(2024,6,15))', 4],
    ['WEEKS(DATE(2024,1,1),DATE(2024,1,20),0)', 2], ['WEEKS(DATE(2024,1,5),DATE(2024,1,8),1)', 1], ['WEEKS(DATE(2024,1,8),DATE(2024,1,5),1)', -1],
    ['MONTHS(DATE(2024,1,1),DATE(2024,2,1),2)', E('#NUM!')],
  ]);
});

describe('variantes *_ADD et SINGLE', () => {
  runCases([
    ['GCD_ADD(12,18)', 6], ['LCM_ADD(4,6)', 12], ['CONVERT_ADD(1,"km","m")', 1000],
    ['WEEKNUM_ADD(DATE(2024,1,8),2)', 2], ['ISOWEEKNUM_ADD(DATE(2024,1,8))', 2],
    ['SINGLE(A3)', 3], ['SINGLE(A2:A5)', E('#VALUE!')], ['SINGLE(7)', 7],
  ]);
});

describe('FOURIER', () => {
  // Serie reelle {1,2,3,4} : X0 = 10, X1 = -2+2i, X2 = -2, X3 = -2-2i.
  const col = 'FOURIER({1;2;3;4})';
  runCases([
    [col, [[10, 0], [-2, 2], [-2, 0], [-2, -2]], 1e-9],
    ['FOURIER({1,2,3,4},FALSE)', [[10, 0], [-2, 2], [-2, 0], [-2, -2]], 1e-9],
    ['FOURIER(FOURIER({1;2;3;4}),TRUE,TRUE)', [[1, 0], [2, 0], [3, 0], [4, 0]], 1e-9],
    ['FOURIER({1;0;0;0},TRUE,FALSE,TRUE)', [[1, 0], [1, 0], [1, 0], [1, 0]], 1e-9],
    ['FOURIER({0;1;0;-1},TRUE,FALSE,TRUE)', [[0, 0], [2, -Math.PI / 2], [0, 0], [2, Math.PI / 2]], 1e-9],
    ['FOURIER({1,2,3})', E('#VALUE!')],
  ]);
});
