import "fake-indexeddb/auto";
import { createStore, get, set } from "idb-keyval";
import { describe, expect, it } from "vitest";
import {
  chaveDeLogin,
  criarRepositorioContas,
  ERRO_LOGIN,
  ID_LEGADA,
  nomeCompleto,
  senhaConfere,
  storeDaConta,
  validarCadastro,
} from "./contas";

const repo = () => criarRepositorioContas(createStore(`contas-${Math.random()}`, "contas"));

describe("cadastro", () => {
  it("valida nome, sobrenome, senha e confirmação", () => {
    expect(validarCadastro("", "Silva", "1234", "1234")).toBe("Informe o nome.");
    expect(validarCadastro("Ana", " ", "1234", "1234")).toBe("Informe o sobrenome.");
    expect(validarCadastro("Ana", "Silva", "123", "123")).toMatch(/pelo menos 4/);
    expect(validarCadastro("Ana", "Silva", "1234", "1243")).toMatch(/confirmação/);
    expect(validarCadastro("Ana", "Silva", "1234", "1234")).toBeNull();
  });

  it("cadastra com senha em hash e entra por nome + sobrenome + senha", async () => {
    const r = repo();
    const ana = await r.cadastrar(" Ana ", " Silva ", "segredo", "ana");
    expect(nomeCompleto(ana)).toBe("Ana Silva");
    expect(JSON.stringify(ana)).not.toContain("segredo");

    expect((await r.entrar("Ana", "Silva", "segredo")).id).toBe("ana");
    expect((await r.entrar("  ana ", "SILVA", "segredo")).id).toBe("ana");
    await expect(r.entrar("Ana", "Silva", "errada")).rejects.toThrow(ERRO_LOGIN);
    await expect(r.entrar("Ana", "Souza", "segredo")).rejects.toThrow(ERRO_LOGIN);
  });

  it("ignora acentos e maiúsculas no login e não deixa repetir o nome completo", async () => {
    const r = repo();
    await r.cadastrar("José", "Conceição", "1234", "jose");
    expect((await r.entrar("jose", "conceicao", "1234")).id).toBe("jose");
    await expect(r.cadastrar("JOSE", "Conceicao", "9999", "outro")).rejects.toThrow("Já existe");
    // mesmo nome com outro sobrenome pode
    await expect(r.cadastrar("José", "Pereira", "9999", "outro")).resolves.toBeTruthy();
    expect(chaveDeLogin(" José  ", "Da  Silva")).toBe("jose da silva");
  });
});

describe("contas separadas", () => {
  it("mantém os dados de cada conta separados e apaga ao excluir", async () => {
    const r = repo();
    await r.cadastrar("Ana", "Silva", "1111", "sep-ana");
    await r.cadastrar("Beto", "Souza", "2222", "sep-beto");
    await set("mes:2026-09", "dados da Ana", storeDaConta("sep-ana"));
    await set("mes:2026-09", "dados do Beto", storeDaConta("sep-beto"));

    await expect(r.excluir("sep-ana", "errada")).rejects.toThrow("Senha incorreta");
    await r.excluir("sep-ana", "1111");
    expect(await get("mes:2026-09", storeDaConta("sep-ana"))).toBeUndefined();
    expect(await get("mes:2026-09", storeDaConta("sep-beto"))).toBe("dados do Beto");
    expect((await r.listar()).map((c) => c.id)).toEqual(["sep-beto"]);
  });

  it("altera a senha só com a senha atual correta", async () => {
    const r = repo();
    await r.cadastrar("Ana", "Silva", "velha", "senha-ana");
    await expect(r.alterarSenha("senha-ana", "errada", "nova1")).rejects.toThrow("atual incorreta");
    await expect(r.alterarSenha("senha-ana", "velha", "123")).rejects.toThrow("pelo menos");
    const c = await r.alterarSenha("senha-ana", "velha", "nova1");
    expect(await senhaConfere(c, "nova1")).toBe(true);
    expect(await senhaConfere(c, "velha")).toBe(false);
  });
});

describe("contas antigas", () => {
  it("dados de antes das contas viram uma conta sem cadastro, que pode ser cadastrada", async () => {
    await set("mes:2026-09", "antigo", storeDaConta(ID_LEGADA));
    const r = repo();
    expect(await r.semCadastro()).toMatchObject([{ id: ID_LEGADA, nome: "Minha conta" }]);
    // sem senha não entra
    await expect(r.entrar("Minha", "conta", "")).rejects.toThrow(ERRO_LOGIN);

    const c = await r.cadastrarExistente(ID_LEGADA, "Oscar", "Lima", "1234");
    expect(nomeCompleto(c)).toBe("Oscar Lima");
    expect(await r.semCadastro()).toEqual([]);
    expect((await r.entrar("Oscar", "Lima", "1234")).id).toBe(ID_LEGADA);
    expect(await get("mes:2026-09", storeDaConta(ID_LEGADA))).toBe("antigo");
    await expect(r.cadastrarExistente(ID_LEGADA, "X", "Y", "1234")).rejects.toThrow("já tem cadastro");
  });
});
