import type { Dados } from "../domain/types";

/**
 * Persistência do app. As operações de escrita recebem só a chave: o valor
 * atual é lido do estado do app (via `snapshot`, passado na construção),
 * o que permite trocar IndexedDB por um backend sem mexer na UI.
 */
export interface Storage {
  load(): Promise<Dados>;
  saveMonth(key: string): Promise<void>;
  saveConfig(): Promise<void>;
  saveParcelas(): Promise<void>;
  deleteMonth(key: string): Promise<void>;
}

/** Função que devolve o estado atual do app. */
export type Snapshot = () => Dados;
