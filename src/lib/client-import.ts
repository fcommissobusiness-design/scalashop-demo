import type { Client } from "./data";

// Demo ScalaShop: import clienti reali rimosso. Nessun cliente viene precaricato.
// Le firme di CLIENT_IMPORT_V7 e applyClientImportV7 sono mantenute per compatibilità con store.ts.
export const CLIENT_IMPORT_V7: { name: string; phones: string[]; segment: "inattivi"|"nuovi"|"occasionali"|"abituali"|"top" }[] = [];

export function applyClientImportV7(existing: Client[]): Client[] {
  return existing;
}
