import { CATEGORIAS, CAT_KEYS } from "./categorias";
import { difMeses, somarMeses } from "./meses";
import type { CatKey, Config, Dados, Item, Mes, Parcelamento, TipoCat } from "./types";

/* ---------- dinheiro: tudo é somado em centavos para evitar erro de ponto flutuante ---------- */

export const centavos = (v: number): number => Math.round(v * 100);
export const reais = (c: number): number => c / 100;

/** Soma valores em reais; `null` (ainda não lançado) conta como zero. */
export function somar(valores: (number | null | undefined)[]): number {
  return reais(valores.reduce<number>((acc, v) => acc + (v == null ? 0 : centavos(v)), 0));
}

export const somaItens = (itens: Item[]): number => somar(itens.map((i) => i.real));

export const arred = (v: number): number => reais(centavos(v));

/* ---------- configuração ---------- */

export const somaPcts = (config: Config): number => arred(somar(CAT_KEYS.map((k) => config.pcts[k])));

/** A distribuição só é válida quando os percentuais fecham exatamente 100%. */
export const pctsValidos = (config: Config): boolean => somaPcts(config) === 100;

/* ---------- parcelamentos ---------- */

/** Número da parcela (1..n) que cai no mês, ou `null` se o parcelamento não está vigente nele. */
export function numeroParcela(p: Parcelamento, mesKey: string): number | null {
  const k = difMeses(p.inicio, mesKey) + 1;
  return k >= 1 && k <= p.n ? k : null;
}

export const ultimoMesParcela = (p: Parcelamento): string => somarMeses(p.inicio, p.n - 1);

export type ParcelaDoMes = { parcelamento: Parcelamento; numero: number; valor: number };

export function parcelasDoMes(parcelas: Parcelamento[], mesKey: string, cat?: CatKey): ParcelaDoMes[] {
  const out: ParcelaDoMes[] = [];
  for (const p of parcelas) {
    if (cat && p.cat !== cat) continue;
    const numero = numeroParcela(p, mesKey);
    if (numero != null) out.push({ parcelamento: p, numero, valor: p.valor });
  }
  return out;
}

/** Quanto ainda falta pagar de um parcelamento a partir do mês informado (inclusive). */
export function saldoDevedor(p: Parcelamento, mesKey: string): number {
  const k = difMeses(p.inicio, mesKey) + 1;
  const restantes = Math.max(0, Math.min(p.n, p.n - k + 1));
  return arred(restantes * p.valor);
}

/** Cria um parcelamento a partir do valor da parcela (total = valor × n). */
export function novoParcelamento(
  dados: Omit<Parcelamento, "id" | "total">,
  id: string,
): Parcelamento {
  return { ...dados, id, total: arred(dados.valor * dados.n) };
}

/** Valor da parcela a partir do total, arredondado ao centavo. */
export const valorParcela = (total: number, n: number): number => arred(total / n);

/* ---------- resumo do mês ---------- */

export type ResumoCategoria = {
  key: CatKey;
  nome: string;
  tipo: TipoCat;
  pct: number;
  /** Renda × pct. */
  orcado: number;
  /** Itens lançados + parcelas vigentes. */
  realizado: number;
  itens: number;
  parcelas: number;
  /** orcado − realizado (negativo = estourou / passou da meta). */
  disponivel: number;
  /** realizado / orcado (0..∞); 0 se não há orçamento. */
  uso: number;
  /** GASTO: realizado > orçado. RESERVA: nunca "estoura" (guardar a mais é bom). */
  estourado: boolean;
  /** Itens ainda sem valor lançado. */
  pendentes: number;
};

export type ResumoMes = {
  renda: number;
  cats: ResumoCategoria[];
  gastos: number;
  reservas: number;
  /** renda − gastos − reservas: dinheiro ainda sem destino. */
  saldo: number;
  /** Soma do orçado de todas as categorias. */
  orcadoTotal: number;
  pendentes: number;
};

export function resumoMes(mes: Mes, mesKey: string, config: Config, parcelas: Parcelamento[]): ResumoMes {
  const renda = somaItens(mes.rendas);
  const cats: ResumoCategoria[] = CATEGORIAS.map(({ key, nome }) => {
    const pct = config.pcts[key];
    const tipo = config.tipos[key];
    const orcado = arred((renda * pct) / 100);
    const itens = somaItens(mes.cats[key]);
    const parc = somar(parcelasDoMes(parcelas, mesKey, key).map((p) => p.valor));
    const realizado = somar([itens, parc]);
    return {
      key,
      nome,
      tipo,
      pct,
      orcado,
      realizado,
      itens,
      parcelas: parc,
      disponivel: somar([orcado, -realizado]),
      uso: orcado > 0 ? realizado / orcado : 0,
      estourado: tipo === "GASTO" && centavos(realizado) > centavos(orcado),
      pendentes: mes.cats[key].filter((i) => i.real == null).length,
    };
  });
  const gastos = somar(cats.filter((c) => c.tipo === "GASTO").map((c) => c.realizado));
  const reservas = somar(cats.filter((c) => c.tipo === "RESERVA").map((c) => c.realizado));
  return {
    renda,
    cats,
    gastos,
    reservas,
    saldo: somar([renda, -gastos, -reservas]),
    orcadoTotal: somar(cats.map((c) => c.orcado)),
    pendentes: cats.reduce((a, c) => a + c.pendentes, 0) + mes.rendas.filter((r) => r.real == null).length,
  };
}

/* ---------- criação de mês ---------- */

export type GeradorId = () => string;

export function mesVazio(novoId: GeradorId): Mes {
  const cats = {} as Mes["cats"];
  for (const c of CATEGORIAS) {
    cats[c.key] = c.sugeridos.map((nome) => ({ id: novoId(), nome, real: null }));
  }
  return { rendas: [{ id: novoId(), nome: "Salário", real: null }], cats };
}

/**
 * Novo mês a partir de um mês anterior: mantém os mesmos itens (e rendas);
 * itens marcados como fixos levam o valor junto, os demais começam sem valor.
 */
export function mesAPartirDe(base: Mes, novoId: GeradorId): Mes {
  const copiar = (i: Item): Item => ({
    id: novoId(),
    nome: i.nome,
    real: i.fixa ? i.real : null,
    ...(i.fixa ? { fixa: true } : {}),
  });
  const cats = {} as Mes["cats"];
  for (const k of CAT_KEYS) cats[k] = (base.cats[k] ?? []).map(copiar);
  return { rendas: base.rendas.map(copiar), cats };
}

/** Mês existente mais recente anterior a `mesKey`, se houver. */
export function mesAnteriorExistente(meses: Dados["meses"], mesKey: string): string | null {
  const anteriores = Object.keys(meses).filter((k) => k < mesKey).sort();
  return anteriores.length ? anteriores[anteriores.length - 1] : null;
}

/**
 * Um mês é criado sozinho, sem o usuário apertar botão, quando ainda não existe e:
 * - já há um mês anterior cadastrado para servir de base (meses seguintes), ou
 * - é o primeiro uso (nenhum mês cadastrado) e o mês é o atual.
 * Meses anteriores ao primeiro cadastrado continuam exigindo o botão "Criar",
 * para que navegar para trás não encha o histórico de meses vazios.
 */
export function deveCriarAutomaticamente(meses: Dados["meses"], mesKey: string, atual: string): boolean {
  if (meses[mesKey]) return false;
  if (mesAnteriorExistente(meses, mesKey)) return true;
  return Object.keys(meses).length === 0 && mesKey === atual;
}

export function criarMes(dados: Dados, mesKey: string, novoId: GeradorId): Mes {
  const base = mesAnteriorExistente(dados.meses, mesKey);
  return base ? mesAPartirDe(dados.meses[base], novoId) : mesVazio(novoId);
}

/* ---------- evolução ---------- */

export type PontoEvolucao = { mes: string; renda: number; gastos: number; reservas: number; saldo: number };

/** Os últimos `qtd` meses cadastrados até `ate` (inclusive), em ordem cronológica. */
export function evolucao(dados: Dados, ate: string, qtd = 6): PontoEvolucao[] {
  return Object.keys(dados.meses)
    .filter((k) => k <= ate)
    .sort()
    .slice(-qtd)
    .map((k) => {
      const r = resumoMes(dados.meses[k], k, dados.config, dados.parcelas);
      return { mes: k, renda: r.renda, gastos: r.gastos, reservas: r.reservas, saldo: r.saldo };
    });
}
