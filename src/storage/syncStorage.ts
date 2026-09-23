import { clear, get, set, setMany, update, type UseStore } from "idb-keyval";
import { K_CONFIG, K_PARCELAS, PREFIXO_MES, createIdbStorage, montarDados } from "./idbStorage";
import type { Snapshot, Storage } from "./Storage";

/** Onde os dados ficam na nuvem: documentos (chave, valor) da conta logada. */
export interface Remoto {
  listar(): Promise<[string, unknown][]>;
  salvar(chave: string, dados: unknown): Promise<void>;
  apagar(chave: string): Promise<void>;
}

/** Chaves alteradas no aparelho que ainda não chegaram à nuvem (ex.: sem internet). */
const K_PENDENTES = "__pendentes";

export type SyncStorage = Storage & {
  /** Envia as alterações pendentes; devolve true se não sobrou nada pendente. */
  sincronizar(): Promise<boolean>;
};

/**
 * Storage que grava primeiro no aparelho (IndexedDB, funciona offline) e depois
 * na nuvem. O que não puder ser enviado fica pendente e é reenviado em
 * `sincronizar()` ou no próximo `load()`. Ao carregar com internet, a nuvem
 * é a fonte da verdade (depois de enviar as pendências deste aparelho).
 */
export function createSyncStorage(snapshot: Snapshot, remoto: Remoto, cache: UseStore): SyncStorage {
  const local = createIdbStorage(snapshot, cache);

  const pendentes = async () => (await get<string[]>(K_PENDENTES, cache)) ?? [];
  const marcar = (chave: string) =>
    update<string[]>(K_PENDENTES, (atual = []) => (atual.includes(chave) ? atual : [...atual, chave]), cache);
  const desmarcar = (chave: string) =>
    update<string[]>(K_PENDENTES, (atual = []) => atual.filter((c) => c !== chave), cache);

  /** Envia o valor local atual da chave (ou apaga na nuvem, se não existe mais). */
  const enviar = async (chave: string) => {
    const valor = await get(chave, cache);
    if (valor === undefined) await remoto.apagar(chave);
    else await remoto.salvar(chave, valor);
  };

  const gravar = async (chave: string, escreverLocal: () => Promise<void>) => {
    await escreverLocal();
    try {
      await enviar(chave);
    } catch {
      await marcar(chave);
    }
  };

  const sincronizar = async () => {
    for (const chave of await pendentes()) {
      try {
        await enviar(chave);
        await desmarcar(chave);
      } catch {
        return false;
      }
    }
    return true;
  };

  return {
    sincronizar,

    async load() {
      const doAparelho = await local.load();
      try {
        await sincronizar();
        const daNuvem = await remoto.listar();
        const aindaPendentes = new Set(await pendentes());
        // O que ainda não subiu continua valendo a versão do aparelho.
        const locais = new Map<string, unknown>();
        for (const chave of aindaPendentes) {
          const v = await get(chave, cache);
          if (v !== undefined) locais.set(chave, v);
        }
        const pares = daNuvem.filter(([k]) => !aindaPendentes.has(k)).concat([...locais]);
        await clear(cache);
        await setMany([...pares, [K_PENDENTES, [...aindaPendentes]]], cache);
        return montarDados(pares);
      } catch {
        return doAparelho; // sem internet: usa o que está no aparelho
      }
    },

    saveMonth: (key) => gravar(PREFIXO_MES + key, () => local.saveMonth(key)),
    saveConfig: () => gravar(K_CONFIG, () => local.saveConfig()),
    saveParcelas: () => gravar(K_PARCELAS, () => local.saveParcelas()),
    deleteMonth: (key) => gravar(PREFIXO_MES + key, () => local.deleteMonth(key)),
  };
}

/** Apaga a cópia local (ao sair ou excluir a conta). */
export const limparCache = (cache: UseStore) => clear(cache);

/** Marca para envio todas as chaves de dados atuais (usado ao importar dados antigos). */
export async function marcarTudoPendente(cache: UseStore, chaves: string[]) {
  await set(K_PENDENTES, chaves, cache);
}
