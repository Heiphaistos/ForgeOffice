// Gabarit de numero de liste : « %n » ne peut viser qu'un niveau deja defini (1 a niveau courant + 1).
export const templateValid = (text: string, level: number): boolean => [...text.matchAll(/%(\d)/g)].every((m) => Number(m[1]) >= 1 && Number(m[1]) <= level + 1);
