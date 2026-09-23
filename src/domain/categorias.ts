import type { CatKey, Config, TipoCat } from "./types";

export type CategoriaDef = {
  key: CatKey;
  nome: string;
  pct: number;
  tipo: TipoCat;
  sugeridos: string[];
};

export const CATEGORIAS: CategoriaDef[] = [
  {
    key: "basicas",
    nome: "Despesas básicas",
    pct: 50,
    tipo: "GASTO",
    sugeridos: [
      "Aluguel / financiamento",
      "Condomínio",
      "Energia",
      "Água",
      "Internet / telefone",
      "Mercado",
      "Transporte / combustível",
      "Saúde / plano",
      "Educação",
    ],
  },
  {
    key: "nao",
    nome: "Despesas não essenciais",
    pct: 10,
    tipo: "GASTO",
    sugeridos: ["Restaurantes / delivery", "Lazer", "Assinaturas / streaming", "Compras pessoais"],
  },
  {
    key: "prof",
    nome: "Investimento profissional",
    pct: 5,
    tipo: "GASTO",
    sugeridos: ["Cursos", "Livros", "Ferramentas / equipamentos"],
  },
  {
    key: "metas",
    nome: "Metas",
    pct: 17.5,
    tipo: "RESERVA",
    sugeridos: ["Reserva de emergência", "Viagem"],
  },
  {
    key: "reserva",
    nome: "Reserva financeira",
    pct: 17.5,
    tipo: "RESERVA",
    sugeridos: ["Investimentos", "Previdência / aposentadoria"],
  },
];

export const CAT_KEYS: CatKey[] = CATEGORIAS.map((c) => c.key);

export const catDef = (key: CatKey): CategoriaDef => CATEGORIAS.find((c) => c.key === key)!;

export function configPadrao(): Config {
  const pcts = {} as Config["pcts"];
  const tipos = {} as Config["tipos"];
  for (const c of CATEGORIAS) {
    pcts[c.key] = c.pct;
    tipos[c.key] = c.tipo;
  }
  return { pcts, tipos };
}
