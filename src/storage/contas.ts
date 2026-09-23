import { clear, createStore, get, keys, set, type UseStore } from "idb-keyval";

/**
 * Contas locais: cada conta guarda seus dados num banco IndexedDB próprio,
 * separado das demais. A senha (opcional) só controla o acesso pelo app;
 * os dados não são criptografados no navegador.
 */
export type Conta = {
  id: string;
  nome: string;
  criadaEm: string;
  senha?: { hash: string; salt: string };
};

/** Conta criada para os dados que já existiam antes das contas (banco "orcamento"). */
export const ID_LEGADA = "principal";

const K_LISTA = "lista";
const K_SESSAO = "orcamento:conta";

export const nomeDoBanco = (id: string): string => (id === ID_LEGADA ? "orcamento" : `orcamento-${id}`);

export const storeDaConta = (id: string): UseStore => createStore(nomeDoBanco(id), "dados");

/* ---------- senha ---------- */

const b64 = (buf: ArrayBuffer | Uint8Array) => btoa(String.fromCharCode(...new Uint8Array(buf)));
const deB64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

async function derivar(senha: string, salt: Uint8Array): Promise<string> {
  const chave = await crypto.subtle.importKey("raw", new TextEncoder().encode(senha), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: salt as BufferSource, iterations: 150_000, hash: "SHA-256" },
    chave,
    256,
  );
  return b64(bits);
}

export async function gerarSenha(senha: string): Promise<Conta["senha"]> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return { hash: await derivar(senha, salt), salt: b64(salt) };
}

export async function senhaConfere(conta: Conta, senha: string): Promise<boolean> {
  if (!conta.senha) return true;
  return (await derivar(senha, deB64(conta.senha.salt))) === conta.senha.hash;
}

/* ---------- repositório de contas ---------- */

export function criarRepositorioContas(lista: UseStore = createStore("orcamento-contas", "contas")) {
  const ler = async () => (await get<Conta[]>(K_LISTA, lista)) ?? [];
  const gravar = (contas: Conta[]) => set(K_LISTA, contas, lista);

  return {
    /** Lista as contas; no primeiro uso com dados antigos, cria a conta que os recebe. */
    async listar(): Promise<Conta[]> {
      const contas = await ler();
      if (contas.length === 0 && (await keys(storeDaConta(ID_LEGADA))).length > 0) {
        const legada: Conta = { id: ID_LEGADA, nome: "Minha conta", criadaEm: new Date().toISOString() };
        await gravar([legada]);
        return [legada];
      }
      return contas;
    },

    async criar(nome: string, senha: string | undefined, id: string): Promise<Conta> {
      const contas = await ler();
      const nomeLimpo = nome.trim();
      if (!nomeLimpo) throw new Error("Informe um nome para a conta.");
      if (contas.some((c) => c.nome.toLocaleLowerCase("pt-BR") === nomeLimpo.toLocaleLowerCase("pt-BR"))) {
        throw new Error("Já existe uma conta com esse nome.");
      }
      const conta: Conta = { id, nome: nomeLimpo, criadaEm: new Date().toISOString() };
      if (senha) conta.senha = await gerarSenha(senha);
      await gravar([...contas, conta]);
      return conta;
    },

    async alterarSenha(id: string, senha: string | undefined): Promise<Conta> {
      const contas = await ler();
      const conta = contas.find((c) => c.id === id);
      if (!conta) throw new Error("Conta não encontrada.");
      const nova: Conta = { ...conta, senha: senha ? await gerarSenha(senha) : undefined };
      await gravar(contas.map((c) => (c.id === id ? nova : c)));
      return nova;
    },

    /** Apaga a conta e todos os dados dela. */
    async excluir(id: string): Promise<void> {
      await clear(storeDaConta(id));
      await gravar((await ler()).filter((c) => c.id !== id));
    },
  };
}

export type RepositorioContas = ReturnType<typeof criarRepositorioContas>;

/* ---------- sessão (conta aberta neste aparelho) ---------- */

export function contaDaSessao(): string | null {
  try {
    return localStorage.getItem(K_SESSAO);
  } catch {
    return null;
  }
}

export function salvarSessao(id: string | null): void {
  try {
    if (id) localStorage.setItem(K_SESSAO, id);
    else localStorage.removeItem(K_SESSAO);
  } catch {
    /* sem localStorage: a conta só não fica lembrada */
  }
}
