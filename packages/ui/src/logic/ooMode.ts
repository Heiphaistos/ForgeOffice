/** Profil OnlyOffice actif ? (le DOM porte `data-layout` ; absent en test Node). */
export const isOnlyOffice = (): boolean => typeof document !== 'undefined' && document.documentElement.dataset.layout === 'onlyoffice';
