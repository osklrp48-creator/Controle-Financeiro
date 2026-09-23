import { describe, expect, it } from "vitest";
import { configPadrao, CAT_KEYS } from "./categorias";
import {
  aplicarRetencao,
  criarMes,
  deveCriarAutomaticamente,
  primeiroMesGuardado,
  evolucao,
  mesAPartirDe,
  mesVazio,
  novoParcelamento,
  numeroParcela,
  parcelasDoMes,
  pctsValidos,
  resumoMes,
  saldoDevedor,
  somaPcts,
  somar,
  ultimoMesParcela,
  valorParcela,
} from "./calculos";
import { difMeses, nomeMes, somarMeses } from "./meses";
import type { Dados, Item, Mes, Parcelamento } from "./types";

let seq = 0;
const id = () => `id${++seq}`;
const item = (nome: string, real: number | null, fixa?: boolean): Item => ({ id: id(), nome, real, fixa });

function mesCom(rendas: (number | null)[], valores: Partial<Record<keyof Mes["cats"], (number | null)[]>> = {}): Mes {
  const cats = {} as Mes["cats"];
  for (const k of CAT_KEYS) cats[k] = (valores[k] ?? []).map((v, i) => item(`${k}${i}`, v));
  return { rendas: rendas.map((v, i) => item(`renda${i}`, v)), cats };
}

describe("meses", () => {
  it("soma meses atravessando o ano", () => {
    expect(somarMeses("2026-11", 3)).toBe("2027-02");
    expect(somarMeses("2026-01", -1)).toBe("2025-12");
    expect(somarMeses("2026-05", 0)).toBe("2026-05");
  });
  it("calcula diferença entre meses", () => {
    expect(difMeses("2025-12", "2026-02")).toBe(2);
    expect(difMeses("2026-03", "2026-01")).toBe(-2);
  });
  it("formata o nome do mês", () => {
    expect(nomeMes("2026-03")).toBe("Março de 2026");
    expect(nomeMes("2026-03", true)).toBe("mar/26");
  });
});

describe("somas em dinheiro", () => {
  it("trata null como zero e evita erro de ponto flutuante", () => {
    expect(somar([0.1, 0.2, null])).toBe(0.3);
    expect(somar([])).toBe(0);
  });
});

describe("configuração", () => {
  it("padrão soma 100%", () => {
    const c = configPadrao();
    expect(somaPcts(c)).toBe(100);
    expect(pctsValidos(c)).toBe(true);
    expect(c.pcts).toEqual({ basicas: 50, nao: 10, prof: 5, metas: 17.5, reserva: 17.5 });
    expect(c.tipos).toEqual({ basicas: "GASTO", nao: "GASTO", prof: "GASTO", metas: "RESERVA", reserva: "RESERVA" });
  });
  it("é inválida quando não fecha 100%", () => {
    const c = configPadrao();
    c.pcts.nao = 12;
    expect(somaPcts(c)).toBe(102);
    expect(pctsValidos(c)).toBe(false);
  });
});

describe("parcelamentos", () => {
  const p: Parcelamento = novoParcelamento(
    { nome: "Geladeira", cat: "basicas", inicio: "2026-11", n: 4, valor: 250.5 },
    "p1",
  );

  it("total = parcela × n", () => {
    expect(p.total).toBe(1002);
  });
  it("numera as parcelas por mês e ignora meses fora da vigência", () => {
    expect(numeroParcela(p, "2026-10")).toBeNull();
    expect(numeroParcela(p, "2026-11")).toBe(1);
    expect(numeroParcela(p, "2027-02")).toBe(4);
    expect(numeroParcela(p, "2027-03")).toBeNull();
    expect(ultimoMesParcela(p)).toBe("2027-02");
  });
  it("filtra por categoria", () => {
    const outra = { ...p, id: "p2", cat: "nao" as const };
    expect(parcelasDoMes([p, outra], "2026-12")).toHaveLength(2);
    expect(parcelasDoMes([p, outra], "2026-12", "nao")).toEqual([{ parcelamento: outra, numero: 2, valor: 250.5 }]);
  });
  it("calcula saldo devedor", () => {
    expect(saldoDevedor(p, "2026-09")).toBe(1002);
    expect(saldoDevedor(p, "2026-12")).toBe(751.5);
    expect(saldoDevedor(p, "2027-02")).toBe(250.5);
    expect(saldoDevedor(p, "2027-03")).toBe(0);
  });
  it("valor da parcela a partir do total", () => {
    expect(valorParcela(1000, 3)).toBe(333.33);
  });
});

describe("resumo do mês", () => {
  const config = configPadrao();

  it("orçado = renda × %, realizado = itens + parcelas", () => {
    const mes = mesCom([8000, 2000], { basicas: [3000, 1500.25, null], nao: [900], metas: [1000] });
    const parc = novoParcelamento({ nome: "TV", cat: "nao", inicio: "2026-08", n: 10, valor: 300 }, "p");
    const r = resumoMes(mes, "2026-09", config, [parc]);

    expect(r.renda).toBe(10000);
    const basicas = r.cats.find((c) => c.key === "basicas")!;
    expect(basicas.orcado).toBe(5000);
    expect(basicas.realizado).toBe(4500.25);
    expect(basicas.disponivel).toBe(499.75);
    expect(basicas.pendentes).toBe(1);
    expect(basicas.estourado).toBe(false);

    const nao = r.cats.find((c) => c.key === "nao")!;
    expect(nao.orcado).toBe(1000);
    expect(nao.itens).toBe(900);
    expect(nao.parcelas).toBe(300);
    expect(nao.realizado).toBe(1200);
    expect(nao.disponivel).toBe(-200);
    expect(nao.estourado).toBe(true);
    expect(nao.uso).toBeCloseTo(1.2);

    expect(r.gastos).toBe(5700.25);
    expect(r.reservas).toBe(1000);
    expect(r.saldo).toBe(3299.75);
    expect(r.orcadoTotal).toBe(10000);
    expect(r.pendentes).toBe(1);
  });

  it("reserva acima do orçado não conta como estouro", () => {
    const mes = mesCom([1000], { metas: [500] });
    const metas = resumoMes(mes, "2026-09", config, []).cats.find((c) => c.key === "metas")!;
    expect(metas.orcado).toBe(175);
    expect(metas.disponivel).toBe(-325);
    expect(metas.estourado).toBe(false);
  });

  it("respeita o tipo configurado", () => {
    const c = configPadrao();
    c.tipos.prof = "RESERVA";
    const r = resumoMes(mesCom([1000], { prof: [100], basicas: [200] }), "2026-09", c, []);
    expect(r.gastos).toBe(200);
    expect(r.reservas).toBe(100);
  });

  it("mês sem renda tem orçado zero e uso zero", () => {
    const r = resumoMes(mesCom([null], { basicas: [50] }), "2026-09", config, []);
    const basicas = r.cats[0];
    expect(basicas.orcado).toBe(0);
    expect(basicas.uso).toBe(0);
    expect(basicas.estourado).toBe(true);
    expect(r.saldo).toBe(-50);
    expect(r.pendentes).toBe(1);
  });
});

describe("criação de mês", () => {
  it("mês vazio traz os itens sugeridos e uma renda, todos sem valor", () => {
    const m = mesVazio(id);
    expect(m.rendas).toMatchObject([{ nome: "Salário", real: null }]);
    expect(m.cats.basicas.map((i) => i.nome)).toContain("Aluguel / financiamento");
    expect(m.cats.reserva.map((i) => i.nome)).toEqual(["Investimentos", "Previdência / aposentadoria"]);
    expect(Object.values(m.cats).flat().every((i) => i.real === null)).toBe(true);
  });

  it("copia a estrutura do mês anterior levando só os valores fixos", () => {
    const base = mesCom([], {});
    base.rendas = [item("Salário", 5000, true), item("Freela", 800)];
    base.cats.basicas = [item("Aluguel", 1500, true), item("Mercado", 900)];
    const novo = mesAPartirDe(base, id);

    expect(novo.rendas.map((r) => [r.nome, r.real, r.fixa])).toEqual([
      ["Salário", 5000, true],
      ["Freela", null, undefined],
    ]);
    expect(novo.cats.basicas.map((r) => [r.nome, r.real])).toEqual([
      ["Aluguel", 1500],
      ["Mercado", null],
    ]);
    expect(novo.cats.basicas[0].id).not.toBe(base.cats.basicas[0].id);
  });

  it("usa o mês existente mais recente antes do novo", () => {
    const dados: Dados = {
      config: configPadrao(),
      parcelas: [],
      meses: {
        "2026-01": { ...mesCom([]), rendas: [item("Antigo", 1, true)] },
        "2026-03": { ...mesCom([]), rendas: [item("Recente", 2, true)] },
        "2026-07": { ...mesCom([]), rendas: [item("Futuro", 3, true)] },
      },
    };
    expect(criarMes(dados, "2026-05", id).rendas[0].nome).toBe("Recente");
    expect(criarMes({ ...dados, meses: {} }, "2026-05", id).rendas[0].nome).toBe("Salário");
  });
});

describe("criação automática de mês", () => {
  const m = () => mesCom([]);

  it("cria meses seguintes a um mês cadastrado", () => {
    const meses = { "2026-09": m() };
    expect(deveCriarAutomaticamente(meses, "2026-10", "2026-09")).toBe(true);
    expect(deveCriarAutomaticamente(meses, "2027-03", "2026-09")).toBe(true);
  });
  it("não recria mês existente", () => {
    expect(deveCriarAutomaticamente({ "2026-09": m() }, "2026-09", "2026-09")).toBe(false);
  });
  it("não cria meses anteriores ao primeiro cadastrado", () => {
    expect(deveCriarAutomaticamente({ "2026-09": m() }, "2026-08", "2026-09")).toBe(false);
  });
  it("no primeiro uso cria só o mês atual", () => {
    expect(deveCriarAutomaticamente({}, "2026-09", "2026-09")).toBe(true);
    expect(deveCriarAutomaticamente({}, "2026-10", "2026-09")).toBe(false);
    expect(deveCriarAutomaticamente({}, "2026-08", "2026-09")).toBe(false);
  });
});

describe("retenção de 13 meses", () => {
  const m = () => mesCom([]);

  it("guarda o mês atual e os 12 anteriores", () => {
    expect(primeiroMesGuardado("2026-09")).toBe("2025-09");
    expect(primeiroMesGuardado("2026-01")).toBe("2025-01");
  });

  it("remove meses mais antigos e mantém os recentes e futuros", () => {
    const dados: Dados = {
      config: configPadrao(),
      parcelas: [],
      meses: { "2025-07": m(), "2025-08": m(), "2025-09": m(), "2026-09": m(), "2026-12": m() },
    };
    const r = aplicarRetencao(dados, "2026-09");
    expect(r.mesesRemovidos).toEqual(["2025-07", "2025-08"]);
    expect(Object.keys(r.dados.meses).sort()).toEqual(["2025-09", "2026-09", "2026-12"]);
  });

  it("remove só parcelamentos quitados antes do período", () => {
    const quitado = novoParcelamento({ nome: "A", cat: "nao", inicio: "2025-01", n: 3, valor: 10 }, "a");
    const ativo = novoParcelamento({ nome: "B", cat: "nao", inicio: "2025-01", n: 24, valor: 10 }, "b");
    const r = aplicarRetencao({ config: configPadrao(), meses: {}, parcelas: [quitado, ativo] }, "2026-09");
    expect(r.dados.parcelas).toEqual([ativo]);
    expect(r.parcelasRemovidas).toBe(1);
  });

  it("não mexe em nada quando está tudo dentro do período", () => {
    const dados: Dados = { config: configPadrao(), parcelas: [], meses: { "2026-09": m() } };
    expect(aplicarRetencao(dados, "2026-09").dados).toBe(dados);
  });

  it("não cria automaticamente meses fora do período", () => {
    expect(deveCriarAutomaticamente({ "2024-01": m() }, "2024-02", "2026-09")).toBe(false);
  });
});

describe("evolução", () => {
  it("lista os últimos meses cadastrados até o mês atual", () => {
    const meses: Dados["meses"] = {};
    for (let i = 1; i <= 8; i++) meses[`2026-0${i}`] = mesCom([1000 * i], { basicas: [100], metas: [50] });
    const ev = evolucao({ meses, config: configPadrao(), parcelas: [] }, "2026-07", 3);
    expect(ev.map((p) => p.mes)).toEqual(["2026-05", "2026-06", "2026-07"]);
    expect(ev[2]).toEqual({ mes: "2026-07", renda: 7000, gastos: 100, reservas: 50, saldo: 6850 });
  });
});
