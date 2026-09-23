import { clear, createStore, get, keys, set, type UseStore } from "idb-keyval";

/**
 * Contas locais: cada conta guarda seus dados num banco IndexedDB próprio,
 * separado das demais. O acesso é por nome + sobrenome + senha. A senha só
 * controla o acesso pelo app; os dados não são criptografados no navegador.
 */
export type Conta = {
  id: string;
  nome: string;
  sobrenome?: string;
  criadaEm: string;
  /** Contas de versões antigas podem não ter senha: precisam ser cadastradas antes do uso. */
  senha?: { hash: string; salt: string };
};

/** Conta criada para os dados que já existiam antes das contas (banco "orcamento"). */
export const ID_LEGADA = "principal";

export const SENHA_MINIMA = 4;

const K_LISTA = "lista";
const K_SESSAO = "orcamento:conta";

export const nomeDoBanco = (id: string): string => (id === ID_LEGADA ? "orcamento" : `orcamento-${id}`);

export const storeDaConta = (id: string): UseStore => createStore(nomeDoBanco(id), "dados");

export const nomeCompleto = (c: Pick<Conta, "nome" | "sobrenome">): string =>
  [c.nome, c.sobrenome].filter(Boolean).join(" ");

/** Chave de login: sem diferença de maiúsculas, acentos e espaços extras ("José  Silva" = "jose silva"). */
export const chaveDeLogin = (nome: string, sobrenome = ""): string =>
  `${nome} ${sobrenome}`
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLocaleLowerCase("pt-BR")
    .replace(/\s+/g, " ")
    .trim();

const chaveDaConta = (c: Conta) => chaveDeLogin(c.nome, c.sobrenome);

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

async function gerarSenha(senha: string): Promise<NonNullable<Conta["senha"]>> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return { hash: await derivar(senha, salt), salt: b64(salt) };
}

export async function senhaConfere(conta: Conta, senha: string): Promise<boolean> {
  if (!conta.senha) return false;
  return (await derivar(senha, deB64(conta.senha.salt))) === conta.senha.hash;
}

/** Valida os campos do cadastro; devolve a mensagem de erro ou null. */
export function validarCadastro(nome: string, sobrenome: string, senha: string, confirmacao: string): string | null {
  if (!nome.trim()) return "Informe o nome.";
  if (!sobrenome.trim()) return "Informe o sobrenome.";
  if (senha.length < SENHA_MINIMA) return `A senha precisa ter pelo menos ${SENHA_MINIMA} caracteres.`;
  if (senha !== confirmacao) return "A confirmação não confere com a senha.";
  return null;
}

/* ---------- repositório de contas ---------- */

export const ERRO_LOGIN = "Nome, sobrenome ou senha incorretos.";

export function criarRepositorioContas(lista: UseStore = createStore("orcamento-contas", "contas")) {
  const ler = async () => (await get<Conta[]>(K_LISTA, lista)) ?? [];
  const gravar = (contas: Conta[]) => set(K_LISTA, contas, lista);

  const garantirNomeLivre = (contas: Conta[], nome: string, sobrenome: string, exceto?: string) => {
    const chave = chaveDeLogin(nome, sobrenome);
    if (contas.some((c) => c.id !== exceto && chaveDaConta(c) === chave)) {
      throw new Error("Já existe uma conta com esse nome e sobrenome neste aparelho.");
    }
  };

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

    /** Contas antigas, sem senha, que precisam de cadastro para serem usadas. */
    async semCadastro(): Promise<Conta[]> {
      return (await this.listar()).filter((c) => !c.senha);
    },

    async entrar(nome: string, sobrenome: string, senha: string): Promise<Conta> {
      const chave = chaveDeLogin(nome, sobrenome);
      const conta = (await ler()).find((c) => c.senha && chaveDaConta(c) === chave);
      if (!conta || !(await senhaConfere(conta, senha))) throw new Error(ERRO_LOGIN);
      return conta;
    },

    async cadastrar(nome: string, sobrenome: string, senha: string, id: string): Promise<Conta> {
      const contas = await ler();
      garantirNomeLivre(contas, nome, sobrenome);
      const conta: Conta = {
        id,
        nome: nome.trim(),
        sobrenome: sobrenome.trim(),
        criadaEm: new Date().toISOString(),
        senha: await gerarSenha(senha),
      };
      await gravar([...contas, conta]);
      return conta;
    },

    /** Dá nome, sobrenome e senha a uma conta antiga (sem senha), mantendo os dados dela. */
    async cadastrarExistente(id: string, nome: string, sobrenome: string, senha: string): Promise<Conta> {
      const contas = await ler();
      const antiga = contas.find((c) => c.id === id);
      if (!antiga) throw new Error("Conta não encontrada.");
      if (antiga.senha) throw new Error("Essa conta já tem cadastro.");
      garantirNomeLivre(contas, nome, sobrenome, id);
      const conta: Conta = { ...antiga, nome: nome.trim(), sobrenome: sobrenome.trim(), senha: await gerarSenha(senha) };
      await gravar(contas.map((c) => (c.id === id ? conta : c)));
      return conta;
    },

    async alterarSenha(id: string, senhaAtual: string, nova: string): Promise<Conta> {
      const contas = await ler();
      const conta = contas.find((c) => c.id === id);
      if (!conta) throw new Error("Conta não encontrada.");
      if (!(await senhaConfere(conta, senhaAtual))) throw new Error("Senha atual incorreta.");
      if (nova.length < SENHA_MINIMA) throw new Error(`A nova senha precisa ter pelo menos ${SENHA_MINIMA} caracteres.`);
      const atualizada: Conta = { ...conta, senha: await gerarSenha(nova) };
      await gravar(contas.map((c) => (c.id === id ? atualizada : c)));
      return atualizada;
    },

    /** Apaga a conta e todos os dados dela (exige a senha). */
    async excluir(id: string, senha: string): Promise<void> {
      const contas = await ler();
      const conta = contas.find((c) => c.id === id);
      if (!conta) throw new Error("Conta não encontrada.");
      if (!(await senhaConfere(conta, senha))) throw new Error("Senha incorreta.");
      await clear(storeDaConta(id));
      await gravar(contas.filter((c) => c.id !== id));
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
