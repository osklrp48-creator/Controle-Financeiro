import { describe, expect, it } from "vitest";
import { abrirComPin, criarRegistro, decifrar, MAX_TENTATIVAS, pinFraco, pinValido, regravarToken } from "./pin";

const dono = { userId: "u1", email: "ana@exemplo.com", nome: "Ana", sobrenome: "Silva" };

describe("PIN", () => {
  it("valida tamanho e só números", () => {
    expect(pinValido("1234")).toBe(true);
    expect(pinValido("123456")).toBe(true);
    expect(pinValido("123")).toBe(false);
    expect(pinValido("1234567")).toBe(false);
    expect(pinValido("12a4")).toBe(false);
  });

  it("recusa PINs óbvios", () => {
    expect(pinFraco("1111")).toBe(true);
    expect(pinFraco("1234")).toBe(true);
    expect(pinFraco("4321")).toBe(true);
    expect(pinFraco("7391")).toBe(false);
  });

  it("guarda o token cifrado e só abre com o PIN certo", async () => {
    const { registro } = await criarRegistro("7391", dono, "token-secreto");
    expect(JSON.stringify(registro)).not.toContain("token-secreto");
    expect(registro).toMatchObject({ ...dono, digitos: 4, tentativas: 0 });

    const certo = await abrirComPin("7391", registro);
    expect(certo.ok && certo.refreshToken).toBe("token-secreto");

    const errado = await abrirComPin("7392", registro);
    expect(errado.ok).toBe(false);
    if (!errado.ok) {
      expect(errado.erro.message).toBe(`PIN incorreto. Restam ${MAX_TENTATIVAS - 1} tentativas.`);
      expect(errado.registro?.tentativas).toBe(1);
    }
  }, 20_000);

  it("apaga o acesso depois de errar o limite de vezes e zera ao acertar", async () => {
    let { registro } = await criarRegistro("7391", dono, "t");
    registro = { ...registro, tentativas: MAX_TENTATIVAS - 2 };
    const penultima = await abrirComPin("0000", registro);
    expect(!penultima.ok && penultima.erro.message).toBe("PIN incorreto. Resta 1 tentativa.");
    const ultima = await abrirComPin("0000", penultima.registro!);
    expect(!ultima.ok && ultima.registro).toBeNull();

    const acerto = await abrirComPin("7391", penultima.registro!);
    expect(acerto.ok && acerto.registro.tentativas).toBe(0);
  }, 20_000);

  it("regrava o token novo com a mesma chave (sessão renovada)", async () => {
    const { registro, chave } = await criarRegistro("7391", dono, "token-1");
    const novo = await regravarToken(chave, registro, "token-2");
    expect(novo.iv).not.toBe(registro.iv);
    expect(await decifrar(chave, novo)).toBe("token-2");
    const aberto = await abrirComPin("7391", novo);
    expect(aberto.ok && aberto.refreshToken).toBe("token-2");
  }, 20_000);
});
