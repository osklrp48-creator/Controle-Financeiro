import "fake-indexeddb/auto";
import { createStore, get } from "idb-keyval";
import { describe, expect, it } from "vitest";
import { mesVazio } from "../domain/calculos";
import { configPadrao } from "../domain/categorias";
import type { Dados } from "../domain/types";
import { createSyncStorage, type Remoto } from "./syncStorage";

let n = 0;
const id = () => `i${++n}`;

/** Nuvem de mentira: um Map, que pode ficar "offline". */
function nuvem() {
  const docs = new Map<string, unknown>();
  let online = true;
  const checar = async () => {
    if (!online) throw new TypeError("Failed to fetch");
  };
  const remoto: Remoto = {
    async listar() {
      await checar();
      return [...docs].map(([k, v]) => [k, structuredClone(v)] as [string, unknown]);
    },
    async salvar(k, v) {
      await checar();
      docs.set(k, structuredClone(v));
    },
    async apagar(k) {
      await checar();
      docs.delete(k);
    },
  };
  return { docs, remoto, setOnline: (v: boolean) => (online = v) };
}

const novoEstado = (): Dados => ({ meses: {}, config: configPadrao(), parcelas: [] });
const cache = () => createStore(`sync-${Math.random()}`, "dados");

describe("createSyncStorage", () => {
  it("grava no aparelho e na nuvem", async () => {
    const { docs, remoto } = nuvem();
    const estado = novoEstado();
    const c = cache();
    const s = createSyncStorage(() => estado, remoto, c);
    estado.meses["2026-09"] = mesVazio(id);
    await s.saveMonth("2026-09");
    await s.saveConfig();
    expect(docs.get("mes:2026-09")).toEqual(estado.meses["2026-09"]);
    expect(docs.has("config")).toBe(true);
    expect(await get("mes:2026-09", c)).toEqual(estado.meses["2026-09"]);
  });

  it("sem internet guarda no aparelho e envia depois", async () => {
    const { docs, remoto, setOnline } = nuvem();
    const estado = novoEstado();
    const c = cache();
    const s = createSyncStorage(() => estado, remoto, c);
    estado.meses["2026-09"] = mesVazio(id);
    await s.saveMonth("2026-09");

    setOnline(false);
    estado.meses["2026-09"].rendas[0].real = 5000;
    await s.saveMonth("2026-09");
    await s.deleteMonth("2026-09"); // apagar também fica pendente
    estado.meses["2026-10"] = mesVazio(id);
    await s.saveMonth("2026-10");
    expect(docs.has("mes:2026-09")).toBe(true);
    expect(docs.has("mes:2026-10")).toBe(false);

    // offline: load devolve o que está no aparelho
    const offline = await s.load();
    expect(Object.keys(offline.meses)).toEqual(["2026-10"]);
    expect(await s.sincronizar()).toBe(false);

    setOnline(true);
    expect(await s.sincronizar()).toBe(true);
    expect(docs.has("mes:2026-09")).toBe(false);
    expect(docs.get("mes:2026-10")).toEqual(estado.meses["2026-10"]);
  });

  it("ao carregar com internet, a nuvem manda (outro aparelho alterou)", async () => {
    const { docs, remoto } = nuvem();
    const estado = novoEstado();
    const c = cache();
    const s = createSyncStorage(() => estado, remoto, c);
    estado.meses["2026-09"] = mesVazio(id);
    await s.saveMonth("2026-09");

    // outro aparelho: mudou setembro e criou outubro
    const setembro = structuredClone(estado.meses["2026-09"]);
    setembro.rendas[0].real = 9999;
    docs.set("mes:2026-09", setembro);
    docs.set("mes:2026-10", mesVazio(id));

    const d = await s.load();
    expect(d.meses["2026-09"].rendas[0].real).toBe(9999);
    expect(Object.keys(d.meses).sort()).toEqual(["2026-09", "2026-10"]);
    expect(await get("mes:2026-10", c)).toBeTruthy(); // cache atualizado
  });

  it("pendências do aparelho sobem antes de ler a nuvem", async () => {
    const { docs, remoto, setOnline } = nuvem();
    const estado = novoEstado();
    const c = cache();
    const s = createSyncStorage(() => estado, remoto, c);
    setOnline(false);
    estado.meses["2026-09"] = mesVazio(id);
    estado.meses["2026-09"].rendas[0].real = 1234;
    await s.saveMonth("2026-09");
    setOnline(true);

    const d = await s.load();
    expect(d.meses["2026-09"].rendas[0].real).toBe(1234);
    expect((docs.get("mes:2026-09") as Dados["meses"][string]).rendas[0].real).toBe(1234);
  });
});
