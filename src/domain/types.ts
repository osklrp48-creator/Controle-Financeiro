export type CatKey = "basicas" | "nao" | "prof" | "metas" | "reserva";
export type TipoCat = "GASTO" | "RESERVA";

export type Item = { id: string; nome: string; real: number | null; fixa?: boolean };

/**
 * Chave do mês: "AAAA-MM". `pcts`, quando presente, substitui só neste mês
 * os percentuais padrão da configuração.
 */
export type Mes = { rendas: Item[]; cats: Record<CatKey, Item[]>; pcts?: Record<CatKey, number> };

export type Config = { pcts: Record<CatKey, number>; tipos: Record<CatKey, TipoCat> };

export type Parcelamento = {
  id: string;
  nome: string;
  cat: CatKey;
  /** Mês da 1ª parcela, "AAAA-MM". */
  inicio: string;
  n: number;
  /** Valor de cada parcela. */
  valor: number;
  total: number;
};

export type Dados = {
  meses: Record<string, Mes>;
  config: Config;
  parcelas: Parcelamento[];
};
