/** Mínimo exigido pelo Supabase Auth (configuração padrão do projeto). */
export const SENHA_MINIMA = 6;

const RE_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const emailValido = (email: string): boolean => RE_EMAIL.test(email.trim());

export function validarSenha(senha: string, confirmacao: string): string | null {
  if (senha.length < SENHA_MINIMA) return `A senha precisa ter pelo menos ${SENHA_MINIMA} caracteres.`;
  if (senha !== confirmacao) return "A confirmação não confere com a senha.";
  return null;
}

/** Valida os campos do cadastro; devolve a mensagem de erro ou null. */
export function validarCadastro(c: {
  nome: string;
  sobrenome: string;
  email: string;
  senha: string;
  confirmacao: string;
}): string | null {
  if (!c.nome.trim()) return "Informe o nome.";
  if (!c.sobrenome.trim()) return "Informe o sobrenome.";
  if (!emailValido(c.email)) return "Informe um e-mail válido.";
  return validarSenha(c.senha, c.confirmacao);
}
