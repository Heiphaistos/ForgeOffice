// Adresses qu'un clic (diaporama, lecture) peut ouvrir hors de l'application : web et courriel seulement.
// Un lien importe d'un .pptx peut viser file:, smb:, ms-*: ou une autre appli : il est refuse a l'ouverture.

/** Adresse externe sure : https:, http: ou mailto: (espaces et caracteres de controle ignores, comme le font les navigateurs). */
export function isOpenableUrl(url: string): boolean {
  return /^(https?:|mailto:)/i.test(url.replace(/[\u0000- \u007f-\u009f]/g, ''));
}

/** Ouvre `url` dans un nouvel onglet si elle est sure ; renvoie false sinon. */
export function openExternal(url: string): boolean {
  if (!isOpenableUrl(url)) return false;
  window.open(url.trim(), '_blank', 'noopener,noreferrer');
  return true;
}
