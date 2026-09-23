import { describe, expect, it } from "vitest";
import { emailValido, validarCadastro, validarSenha } from "./validacao";

const ok = { nome: "Ana", sobrenome: "Silva", email: "ana@exemplo.com", senha: "123456", confirmacao: "123456" };

describe("validação do cadastro", () => {
  it("aceita um cadastro completo", () => {
    expect(validarCadastro(ok)).toBeNull();
  });
  it("exige nome, sobrenome e e-mail válido", () => {
    expect(validarCadastro({ ...ok, nome: " " })).toBe("Informe o nome.");
    expect(validarCadastro({ ...ok, sobrenome: "" })).toBe("Informe o sobrenome.");
    expect(validarCadastro({ ...ok, email: "ana@" })).toBe("Informe um e-mail válido.");
  });
  it("exige senha de 6+ caracteres e confirmação igual", () => {
    expect(validarSenha("12345", "12345")).toMatch(/pelo menos 6/);
    expect(validarSenha("123456", "123457")).toMatch(/confirmação/);
    expect(validarSenha("123456", "123456")).toBeNull();
  });
  it("valida formato de e-mail", () => {
    expect(emailValido(" ana@exemplo.com.br ")).toBe(true);
    expect(emailValido("ana exemplo.com")).toBe(false);
  });
});
