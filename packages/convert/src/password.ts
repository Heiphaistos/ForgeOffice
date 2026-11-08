// Fichiers proteges par mot de passe : reconnaitre l'erreur des paquets de la suite (docx, xlsx, pptx) pour redemander le mot de passe.
export type PasswordReason = 'required' | 'wrong';

/** « required » (mot de passe absent) ou « wrong » (refuse) si l'erreur vient d'un fichier chiffre, sinon null. */
export function passwordReason(err: unknown): PasswordReason | null {
  if (!(err instanceof Error) || !('reason' in err)) return null;
  return err.reason === 'required' || err.reason === 'wrong' ? err.reason : null;
}
