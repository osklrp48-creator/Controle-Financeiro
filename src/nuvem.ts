import { createClient, type AuthError, type User } from "@supabase/supabase-js";
import { createStore } from "idb-keyval";
import type { Remoto } from "./storage/syncStorage";

// Chave "anon" é pública por definição: a segurança vem das regras (RLS) no banco.
const URL_PADRAO = "https://lizdscuxsxswwbzkboqx.supabase.co";
const ANON_PADRAO =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxpemRzY3V4c3hzd3diemtib3F4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAxODk0MTksImV4cCI6MjEwNTc2NTQxOX0.ugVZ8pqQERdHubBTVNOfXPz0PsBpRcYlnMtd3zM0OdU";

/**
 * A sessão fica no sessionStorage: vale enquanto o app/aba está aberto (inclusive ao
 * recarregar) e some quando ele é fechado, obrigando a entrar de novo.
 */
function armazenamentoDaSessao(): Storage | undefined {
  try {
    // Remove sessões gravadas por versões anteriores, que ficavam no localStorage.
    for (const k of Object.keys(localStorage)) if (/^sb-.*-auth-token/.test(k)) localStorage.removeItem(k);
    return sessionStorage;
  } catch {
    return undefined;
  }
}

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL || URL_PADRAO,
  import.meta.env.VITE_SUPABASE_ANON_KEY || ANON_PADRAO,
  {
    auth: {
      persistSession: true,
      storage: armazenamentoDaSessao(),
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  },
);

/** Endereço do app, para onde os links de e-mail (confirmação, nova senha) voltam. */
export const urlDoApp = () => new URL(import.meta.env.BASE_URL, window.location.origin).href;

export type Usuario = { id: string; email: string; nome: string; sobrenome: string };

export function usuarioDe(u: User): Usuario {
  const meta = (u.user_metadata ?? {}) as { nome?: string; sobrenome?: string };
  return { id: u.id, email: u.email ?? "", nome: meta.nome ?? "", sobrenome: meta.sobrenome ?? "" };
}

export const nomeDoUsuario = (u: Usuario) => [u.nome, u.sobrenome].filter(Boolean).join(" ") || u.email;

/** Cópia local (offline) dos dados de cada usuário. */
export const cacheDoUsuario = (id: string) => createStore(`orcamento-u-${id}`, "dados");

export function remotoDoUsuario(userId: string): Remoto {
  const tabela = () => supabase.from("documentos");
  return {
    async listar() {
      const { data, error } = await tabela().select("chave, dados").eq("user_id", userId);
      if (error) throw error;
      return (data ?? []).map((d) => [d.chave as string, d.dados as unknown]);
    },
    async salvar(chave, dados) {
      const { error } = await tabela().upsert(
        { user_id: userId, chave, dados, atualizado_em: new Date().toISOString() },
        { onConflict: "user_id,chave" },
      );
      if (error) throw error;
    },
    async apagar(chave) {
      const { error } = await tabela().delete().eq("user_id", userId).eq("chave", chave);
      if (error) throw error;
    },
  };
}

/** Traduz os erros mais comuns do Supabase Auth para mensagens em português. */
export function mensagemDeErro(e: unknown): string {
  const err = e as Partial<AuthError> & { message?: string };
  const msg = err?.message ?? String(e);
  const codigo = err?.code ?? "";
  if (codigo === "invalid_credentials" || /invalid login credentials/i.test(msg)) return "E-mail ou senha incorretos.";
  if (codigo === "email_not_confirmed" || /email not confirmed/i.test(msg))
    return "Confirme seu e-mail pelo link que enviamos antes de entrar.";
  if (codigo === "user_already_exists" || /already registered|already exists/i.test(msg))
    return "Já existe uma conta com esse e-mail.";
  if (codigo === "weak_password" || /password should be at least/i.test(msg))
    return "Senha fraca: use pelo menos 6 caracteres.";
  if (codigo === "same_password" || /different from the old/i.test(msg)) return "A nova senha precisa ser diferente da atual.";
  if (/rate limit|too many/i.test(msg) || codigo.includes("rate_limit"))
    return "Muitas tentativas em pouco tempo. Aguarde alguns minutos e tente de novo.";
  if (/invalid.*email|email.*invalid/i.test(msg) || codigo === "email_address_invalid") return "E-mail inválido.";
  if (/failed to fetch|network/i.test(msg)) return "Sem conexão com a internet. Tente de novo quando estiver online.";
  return `Não foi possível concluir: ${msg}`;
}
