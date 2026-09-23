import { useEffect, useState } from "react";
import { App } from "./App";
import { NovaSenha, TelaEntrada, type AcoesEntrada } from "./components/TelaEntrada";
import { cacheDoUsuario, mensagemDeErro, supabase, urlDoApp, usuarioDe, type Usuario } from "./nuvem";
import { limparCache } from "./storage/syncStorage";

/** Login/cadastro pelo Supabase; com um usuário logado, mostra o app com os dados dele. */
export function Raiz() {
  const [usuario, setUsuario] = useState<Usuario | null | undefined>(undefined);
  const [recuperando, setRecuperando] = useState(false);
  const [aviso, setAviso] = useState<string | undefined>();

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setUsuario(data.session ? usuarioDe(data.session.user) : null));
    const { data } = supabase.auth.onAuthStateChange((evento, sessao) => {
      if (evento === "PASSWORD_RECOVERY") setRecuperando(true);
      setUsuario(sessao ? usuarioDe(sessao.user) : null);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  const acoes: AcoesEntrada = {
    async onEntrar(email, senha) {
      const { error } = await supabase.auth.signInWithPassword({ email, password: senha });
      return error ? mensagemDeErro(error) : null;
    },
    async onCadastrar({ nome, sobrenome, email, senha }) {
      const { data, error } = await supabase.auth.signUp({
        email,
        password: senha,
        options: { data: { nome, sobrenome }, emailRedirectTo: urlDoApp() },
      });
      if (error) return { erro: mensagemDeErro(error) };
      // Com confirmação de e-mail ativa, o Supabase devolve um usuário sem identidades se o e-mail já existe.
      if (data.user && data.user.identities?.length === 0) return { erro: "Já existe uma conta com esse e-mail." };
      return data.session ? {} : { confirmar: true };
    },
    async onEsqueci(email) {
      const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: urlDoApp() });
      return error ? mensagemDeErro(error) : null;
    },
    async onNovaSenha(senha) {
      const { error } = await supabase.auth.updateUser({ password: senha });
      if (error) return mensagemDeErro(error);
      setRecuperando(false);
      return null;
    },
  };

  /** Confere a senha atual entrando de novo com ela. */
  const conferirSenha = async (u: Usuario, senha: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email: u.email, password: senha });
    return error ? (/invalid login/i.test(error.message) ? "Senha incorreta." : mensagemDeErro(error)) : null;
  };

  if (usuario === undefined) return <p className="nada">Carregando…</p>;
  if (recuperando) return <NovaSenha onNovaSenha={acoes.onNovaSenha} />;
  if (!usuario) return <TelaEntrada acoes={acoes} aviso={aviso} />;

  return (
    <App
      key={usuario.id}
      conta={usuario}
      onSair={async () => {
        setAviso(undefined);
        await supabase.auth.signOut();
      }}
      onAlterarSenha={async (atual, nova) => {
        const falha = await conferirSenha(usuario, atual);
        if (falha) return falha;
        const { error } = await supabase.auth.updateUser({ password: nova });
        return error ? mensagemDeErro(error) : null;
      }}
      onExcluirConta={async (senha) => {
        const falha = await conferirSenha(usuario, senha);
        if (falha) return falha;
        const { error } = await supabase.rpc("excluir_minha_conta");
        if (error) return mensagemDeErro(error);
        await limparCache(cacheDoUsuario(usuario.id));
        setAviso("Conta excluída.");
        await supabase.auth.signOut();
        return null;
      }}
    />
  );
}
