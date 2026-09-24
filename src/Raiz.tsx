import { useCallback, useEffect, useRef, useState } from "react";
import { App } from "./App";
import { TelaPin } from "./components/Pin";
import { NovaSenha, TelaEntrada, type AcoesEntrada } from "./components/TelaEntrada";
import { EVENTO_SESSAO, cacheDoUsuario, esquecerSessaoLocal, mensagemDeErro, supabase, urlDoApp, usuarioDe, type Usuario } from "./nuvem";
import { abrirComPin, criarRegistro, decifrar, lerRegistro, regravarToken, salvarRegistro, type RegistroPin } from "./pin";
import { limparCache } from "./storage/syncStorage";

const erroDeRede = (e: { message?: string; name?: string; status?: number } | null) =>
  !!e && (e.name === "AuthRetryableFetchError" || e.status === 0 || /fetch|network|tempo/i.test(e.message ?? ""));

/**
 * Renova a sessão com o token salvo pelo PIN. Sem internet não tenta (a biblioteca
 * ficaria repetindo por até ~30 s); com internet lenta, desiste em 8 s.
 */
async function renovar(refreshToken: string) {
  if (!navigator.onLine) return { data: { session: null }, error: { name: "AuthRetryableFetchError", message: "offline" } };
  const limite = new Promise<{ data: { session: null }; error: { message: string } }>((res) =>
    setTimeout(() => res({ data: { session: null }, error: { message: "tempo esgotado" } }), 8000),
  );
  return Promise.race([supabase.auth.refreshSession({ refresh_token: refreshToken }), limite]);
}

/** Login/cadastro pelo Supabase, acesso por PIN; com um usuário logado, mostra o app. */
export function Raiz() {
  const [usuario, setUsuario] = useState<Usuario | null | undefined>(undefined);
  const [recuperando, setRecuperando] = useState(false);
  const [aviso, setAviso] = useState<string | undefined>();
  const [registro, setRegistro] = useState<RegistroPin | null>(() => lerRegistro());
  const [usarSenha, setUsarSenha] = useState(false);
  /** Chave do PIN em memória, para regravar o token quando a sessão renovar. */
  const chave = useRef<CryptoKey | null>(null);
  /** Entrou pelo PIN sem internet: usa os dados do aparelho até conseguir renovar a sessão. */
  const semSessao = useRef(false);

  const guardarRegistro = (r: RegistroPin | null) => {
    salvarRegistro(r);
    setRegistro(r);
    if (!r) chave.current = null;
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setUsuario(data.session ? usuarioDe(data.session.user) : null));
    const { data } = supabase.auth.onAuthStateChange((evento, sessao) => {
      if (evento === "PASSWORD_RECOVERY") setRecuperando(true);
      if (sessao) {
        semSessao.current = false;
        setUsuario(usuarioDe(sessao.user));
        // A sessão renovou: regrava o token salvo pelo PIN (o anterior deixa de valer).
        const r = lerRegistro();
        if (chave.current && r?.userId === sessao.user.id && sessao.refresh_token) {
          const k = chave.current;
          setTimeout(() => void regravarToken(k, r, sessao.refresh_token).then(salvarRegistro), 0);
        }
      } else if (!semSessao.current) {
        setUsuario(null);
      }
    });
    return () => data.subscription.unsubscribe();
  }, []);

  /** Quando a internet volta depois de entrar pelo PIN offline, renova a sessão e sincroniza. */
  useEffect(() => {
    const aoVoltar = async () => {
      const r = lerRegistro();
      if (!semSessao.current || !chave.current || !r) return;
      if ((await supabase.auth.getSession()).data.session) {
        window.dispatchEvent(new Event(EVENTO_SESSAO));
        return;
      }
      const token = await decifrar(chave.current, r);
      const { error } = await renovar(token);
      if (!error) window.dispatchEvent(new Event(EVENTO_SESSAO));
      else if (!erroDeRede(error)) {
        semSessao.current = false;
        guardarRegistro(null);
        setAviso("Seu acesso por PIN expirou. Entre com e-mail e senha.");
        setUsuario(null);
      }
    };
    window.addEventListener("online", aoVoltar);
    return () => window.removeEventListener("online", aoVoltar);
  }, []);

  const entrarComPin = useCallback(async (pin: string): Promise<string | null> => {
    const r = lerRegistro();
    if (!r) return "Acesso por PIN não encontrado.";
    const res = await abrirComPin(pin, r);
    guardarRegistro(res.registro);
    if (!res.ok) {
      if (!res.registro) {
        setUsarSenha(true);
        setAviso("PIN incorreto várias vezes: o acesso por PIN foi removido deste aparelho. Entre com e-mail e senha.");
      }
      return res.erro.message;
    }
    chave.current = res.chave;
    const { data, error } = await renovar(res.refreshToken);
    if (error) {
      if (erroDeRede(error)) {
        // Sem internet: abre com os dados guardados no aparelho.
        semSessao.current = true;
        setUsuario({ id: r.userId, email: r.email, nome: r.nome, sobrenome: r.sobrenome });
        return null;
      }
      guardarRegistro(null);
      setUsarSenha(true);
      setAviso("Seu acesso por PIN expirou. Entre com e-mail e senha e crie o PIN de novo.");
      return null;
    }
    if (data.session) guardarRegistro(await regravarToken(res.chave, res.registro, data.session.refresh_token));
    return null;
  }, []);

  const acoes: AcoesEntrada = {
    async onEntrar(email, senha) {
      const { error } = await supabase.auth.signInWithPassword({ email, password: senha });
      if (!error) setUsarSenha(false);
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
  if (!usuario) {
    if (registro && !usarSenha) {
      return (
        <TelaPin
          nome={registro.nome || registro.email}
          digitos={registro.digitos}
          aviso={aviso}
          onConfirmar={entrarComPin}
          onUsarSenha={() => {
            setAviso(undefined);
            setUsarSenha(true);
          }}
          onEsquecer={() => guardarRegistro(null)}
        />
      );
    }
    return <TelaEntrada key={aviso} acoes={acoes} aviso={aviso} />;
  }

  const pinDesteUsuario = registro?.userId === usuario.id;

  return (
    <App
      key={usuario.id}
      conta={usuario}
      pinAtivo={pinDesteUsuario}
      onCriarPin={async (pin) => {
        const { data } = await supabase.auth.getSession();
        if (!data.session) return "Sem conexão com a conta agora. Tente de novo quando estiver online.";
        const { registro: r, chave: k } = await criarRegistro(pin, { userId: usuario.id, email: usuario.email, nome: usuario.nome, sobrenome: usuario.sobrenome }, data.session.refresh_token);
        chave.current = k;
        guardarRegistro(r);
        return null;
      }}
      onRemoverPin={() => guardarRegistro(null)}
      onSair={async () => {
        setAviso(undefined);
        setUsarSenha(false);
        if (pinDesteUsuario) {
          // Com PIN: só "tranca" o app. A sessão salva pelo PIN continua valendo para a próxima entrada.
          esquecerSessaoLocal();
          window.location.reload();
          return;
        }
        // "local": não derruba o acesso (e o PIN) em outros aparelhos.
        await supabase.auth.signOut({ scope: "local" });
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
        if (pinDesteUsuario) guardarRegistro(null);
        setAviso("Conta excluída.");
        setUsarSenha(true);
        await supabase.auth.signOut({ scope: "local" });
        return null;
      }}
    />
  );
}
