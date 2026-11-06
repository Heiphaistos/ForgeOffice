// Motifs de tirets predefinis (en multiples de l'epaisseur du trait), partages avec l'export PDF.
export const DASHES: Readonly<Record<string, number[]>> = {
  dot: [1, 1], sysDot: [1, 1], dash: [4, 3], sysDash: [3, 1], lgDash: [8, 3], dashDot: [4, 3, 1, 3], sysDashDot: [3, 1, 1, 1],
  lgDashDot: [8, 3, 1, 3], lgDashDotDot: [8, 3, 1, 3, 1, 3], sysDashDotDot: [3, 1, 1, 1, 1, 1],
};
