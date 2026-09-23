import { createStore, del, entries, set, type UseStore } from "idb-keyval";
import { configPadrao, CAT_KEYS } from "../domain/categorias";
import { mesValido } from "../domain/meses";
import type { Config, Dados, Mes, Parcelamento } from "../domain/types";
import type { Snapshot, Storage } from "./Storage";

export const PREFIXO_MES = "mes:";
export const K_CONFIG = "config";
export const K_PARCELAS = "parcelas";

/** Completa configs antigas/parciais com os valores padrão. */
function normalizarConfig(c: Partial<Config> | undefined): Config {
  const base = configPadrao();
  return {
    pcts: { ...base.pcts, ...c?.pcts },
    tipos: { ...base.tipos, ...c?.tipos },
  };
}

function normalizarMes(m: Mes): Mes {
  const cats = { ...m.cats };
  for (const k of CAT_KEYS) cats[k] ??= [];
  return { rendas: m.rendas ?? [], cats, ...(m.pcts ? { pcts: m.pcts } : {}) };
}

/**
 * Monta os dados do app a partir de pares (chave, valor) no formato de armazenamento:
 * "mes:AAAA-MM", "config" e "parcelas". Usado pelo IndexedDB e pelo Supabase.
 */
export function montarDados(pares: Iterable<[string, unknown]>): Dados {
  const meses: Dados["meses"] = {};
  let config: Config | undefined;
  let parcelas: Parcelamento[] = [];
  for (const [k, v] of pares) {
    if (k === K_CONFIG) config = v as Config;
    else if (k === K_PARCELAS) parcelas = v as Parcelamento[];
    else if (k.startsWith(PREFIXO_MES)) {
      const key = k.slice(PREFIXO_MES.length);
      if (mesValido(key)) meses[key] = normalizarMes(v as Mes);
    }
  }
  return { meses, config: normalizarConfig(config), parcelas };
}

export function createIdbStorage(snapshot: Snapshot, store?: UseStore): Storage {
  const db = store ?? createStore("orcamento", "dados");

  return {
    async load(): Promise<Dados> {
      return montarDados(await entries<string, unknown>(db));
    },

    async saveMonth(key) {
      const mes = snapshot().meses[key];
      if (!mes) throw new Error(`Mês ${key} não existe no estado`);
      await set(PREFIXO_MES + key, mes, db);
    },

    async saveConfig() {
      await set(K_CONFIG, snapshot().config, db);
    },

    async saveParcelas() {
      await set(K_PARCELAS, snapshot().parcelas, db);
    },

    async deleteMonth(key) {
      await del(PREFIXO_MES + key, db);
    },
  };
}
