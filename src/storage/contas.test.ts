import "fake-indexeddb/auto";
import { createStore, get, set } from "idb-keyval";
import { describe, expect, it } from "vitest";
import { criarRepositorioContas, ID_LEGADA, senhaConfere, storeDaConta } from "./contas";

const repo = () => criarRepositorioContas(createStore(`contas-${Math.random()}`, "contas"));

describe("contas", () => {
  it("cria contas com e sem senha e confere a senha", async () => {
    const r = repo();
    const ana = await r.criar("Ana", "segredo123", "ana");
    const beto = await r.criar("  Beto ", undefined, "beto");

    expect(beto.nome).toBe("Beto");
    expect(beto.senha).toBeUndefined();
    expect(ana.senha?.hash).not.toContain("segredo");
    expect(await senhaConfere(ana, "segredo123")).toBe(true);
    expect(await senhaConfere(ana, "errada")).toBe(false);
    expect(await senhaConfere(beto, "")).toBe(true);
    expect((await r.listar()).map((c) => c.id)).toEqual(["ana", "beto"]);
  });

  it("recusa nome vazio ou repetido", async () => {
    const r = repo();
    await r.criar("Ana", undefined, "a1");
    await expect(r.criar("ana", undefined, "a2")).rejects.toThrow("Já existe");
    await expect(r.criar("   ", undefined, "a3")).rejects.toThrow("nome");
  });

  it("mantém os dados de cada conta separados e apaga ao excluir", async () => {
    const r = repo();
    await r.criar("Ana", undefined, "sep-ana");
    await r.criar("Beto", undefined, "sep-beto");
    await set("mes:2026-09", "dados da Ana", storeDaConta("sep-ana"));
    await set("mes:2026-09", "dados do Beto", storeDaConta("sep-beto"));

    expect(await get("mes:2026-09", storeDaConta("sep-ana"))).toBe("dados da Ana");
    expect(await get("mes:2026-09", storeDaConta("sep-beto"))).toBe("dados do Beto");

    await r.excluir("sep-ana");
    expect(await get("mes:2026-09", storeDaConta("sep-ana"))).toBeUndefined();
    expect(await get("mes:2026-09", storeDaConta("sep-beto"))).toBe("dados do Beto");
    expect((await r.listar()).map((c) => c.id)).toEqual(["sep-beto"]);
  });

  it("altera e remove a senha", async () => {
    const r = repo();
    await r.criar("Ana", "velha", "senha-ana");
    const nova = await r.alterarSenha("senha-ana", "nova");
    expect(await senhaConfere(nova, "nova")).toBe(true);
    expect(await senhaConfere(nova, "velha")).toBe(false);
    expect((await r.alterarSenha("senha-ana", undefined)).senha).toBeUndefined();
  });

  it("transforma os dados de antes das contas em 'Minha conta'", async () => {
    await set("mes:2026-09", "antigo", storeDaConta(ID_LEGADA));
    const contas = await repo().listar();
    expect(contas).toMatchObject([{ id: ID_LEGADA, nome: "Minha conta" }]);
    expect(await get("mes:2026-09", storeDaConta(ID_LEGADA))).toBe("antigo");
  });
});
