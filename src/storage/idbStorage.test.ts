import "fake-indexeddb/auto";
import { createStore } from "idb-keyval";
import { describe, expect, it } from "vitest";
import { mesVazio } from "../domain/calculos";
import { configPadrao } from "../domain/categorias";
import type { Dados } from "../domain/types";
import { createIdbStorage } from "./idbStorage";

let n = 0;
const id = () => `i${++n}`;

describe("createIdbStorage", () => {
  it("salva e recarrega meses, config e parcelas", async () => {
    const store = createStore(`teste-${Math.random()}`, "dados");
    const estado: Dados = { meses: {}, config: configPadrao(), parcelas: [] };
    const storage = createIdbStorage(() => estado, store);

    expect(await storage.load()).toEqual(estado);

    estado.meses["2026-09"] = mesVazio(id);
    estado.meses["2026-10"] = mesVazio(id);
    estado.meses["2026-09"].pcts = { basicas: 40, nao: 10, prof: 5, metas: 30, reserva: 15 };
    estado.config.pcts.basicas = 45;
    estado.config.pcts.nao = 15;
    estado.parcelas = [{ id: "p", nome: "TV", cat: "nao", inicio: "2026-09", n: 2, valor: 10, total: 20 }];
    await storage.saveMonth("2026-09");
    await storage.saveMonth("2026-10");
    await storage.saveConfig();
    await storage.saveParcelas();
    await storage.deleteMonth("2026-10");

    const outro = createIdbStorage(() => estado, store);
    const lido = await outro.load();
    expect(Object.keys(lido.meses)).toEqual(["2026-09"]);
    expect(lido.meses["2026-09"]).toEqual(estado.meses["2026-09"]);
    expect(lido.config).toEqual(estado.config);
    expect(lido.parcelas).toEqual(estado.parcelas);
  });

  it("falha ao salvar um mês que não existe no estado", async () => {
    const storage = createIdbStorage(() => ({ meses: {}, config: configPadrao(), parcelas: [] }), createStore("x", "y"));
    await expect(storage.saveMonth("2026-01")).rejects.toThrow();
  });
});
