// Source des noms et tableaux proposes a la frappe d'une formule, fournie par l'application a la barre de formule et a l'editeur de cellule.
import { createContext, useContext } from 'react';
import { EMPTY_SOURCE, type CompletionSource } from '../../logic/formulas/completion.ts';

export const CompletionContext = createContext<CompletionSource>(EMPTY_SOURCE);
export const useCompletionSource = (): CompletionSource => useContext(CompletionContext);
