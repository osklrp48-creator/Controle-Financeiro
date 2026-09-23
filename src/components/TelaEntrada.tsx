import { useState } from "react";
import { SENHA_MINIMA, emailValido, validarCadastro, validarSenha } from "../validacao";
import { SenhaInput } from "./SenhaInput";

/** As ações devolvem uma mensagem de erro, ou null se deu certo. */
export type AcoesEntrada = {
  onEntrar: (email: string, senha: string) => Promise<string | null>;
  /** Devolve `{ confirmar: true }` quando o e-mail precisa ser confirmado antes do login. */
  onCadastrar: (c: { nome: string; sobrenome: string; email: string; senha: string }) => Promise<{ erro?: string; confirmar?: boolean }>;
  onEsqueci: (email: string) => Promise<string | null>;
  onNovaSenha: (senha: string) => Promise<string | null>;
};

type Tela =
  | { modo: "login"; aviso?: string }
  | { modo: "cadastro" }
  | { modo: "esqueci" }
  | { modo: "enviado"; email: string; motivo: "confirmar" | "recuperar" };

function useEnvio() {
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const enviar = async (fn: () => Promise<string | null | undefined>) => {
    setEnviando(true);
    setErro(null);
    try {
      setErro((await fn()) ?? null);
    } finally {
      setEnviando(false);
    }
  };
  return { erro, setErro, enviando, enviar };
}

const Erro = ({ texto }: { texto: string | null }) =>
  texto ? (
    <p className="situacao ruim" role="alert">
      {texto}
    </p>
  ) : null;

function Login({ aviso, acoes, ir }: { aviso?: string; acoes: AcoesEntrada; ir: (t: Tela) => void }) {
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const { erro, enviando, enviar } = useEnvio();

  return (
    <form
      className="cartao formulario"
      onSubmit={(e) => {
        e.preventDefault();
        enviar(() => acoes.onEntrar(email.trim(), senha));
      }}
    >
      <header>
        <h2>Entrar</h2>
      </header>
      {aviso && <p className="situacao ok">{aviso}</p>}
      <label>
        E-mail
        <input type="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" autoFocus />
      </label>
      <SenhaInput rotulo="Senha" valor={senha} onChange={setSenha} autoComplete="current-password" />
      <Erro texto={erro} />
      <button className="primario" disabled={!emailValido(email) || !senha || enviando}>
        {enviando ? "Entrando…" : "Entrar"}
      </button>
      <p className="alternativa">
        <button type="button" className="link" onClick={() => ir({ modo: "esqueci" })}>
          Esqueci minha senha
        </button>
      </p>
      <p className="alternativa">
        Ainda não tem conta?{" "}
        <button type="button" className="link" onClick={() => ir({ modo: "cadastro" })}>
          Cadastre-se
        </button>
      </p>
    </form>
  );
}

function Cadastro({ acoes, ir }: { acoes: AcoesEntrada; ir: (t: Tela) => void }) {
  const [c, setC] = useState({ nome: "", sobrenome: "", email: "", senha: "", confirmacao: "" });
  const { erro, setErro, enviando, enviar } = useEnvio();
  const campo = (k: keyof typeof c) => (v: string) => setC({ ...c, [k]: v });

  return (
    <form
      className="cartao formulario"
      onSubmit={(e) => {
        e.preventDefault();
        const invalido = validarCadastro(c);
        if (invalido) return setErro(invalido);
        enviar(async () => {
          const email = c.email.trim();
          const r = await acoes.onCadastrar({ nome: c.nome.trim(), sobrenome: c.sobrenome.trim(), email, senha: c.senha });
          if (r.confirmar) ir({ modo: "enviado", email, motivo: "confirmar" });
          return r.erro ?? null;
        });
      }}
    >
      <header>
        <h2>Criar conta</h2>
      </header>
      <div className="linha">
        <label>
          Nome
          <input value={c.nome} onChange={(e) => campo("nome")(e.target.value)} autoComplete="given-name" autoFocus />
        </label>
        <label>
          Sobrenome
          <input value={c.sobrenome} onChange={(e) => campo("sobrenome")(e.target.value)} autoComplete="family-name" />
        </label>
      </div>
      <label>
        E-mail
        <input type="email" inputMode="email" value={c.email} onChange={(e) => campo("email")(e.target.value)} autoComplete="email" />
      </label>
      <SenhaInput rotulo="Senha" valor={c.senha} onChange={campo("senha")} autoComplete="new-password" />
      <SenhaInput rotulo="Confirmação de senha" valor={c.confirmacao} onChange={campo("confirmacao")} autoComplete="new-password" />
      <p className="nota">
        A senha precisa ter pelo menos {SENHA_MINIMA} caracteres. O e-mail é usado para entrar e para recuperar a senha.
      </p>
      {c.confirmacao && c.senha !== c.confirmacao && <p className="situacao atencao">A confirmação ainda não confere.</p>}
      <Erro texto={erro} />
      <button className="primario" disabled={enviando}>
        {enviando ? "Criando…" : "Criar conta"}
      </button>
      <p className="alternativa">
        <button type="button" className="link" onClick={() => ir({ modo: "login" })}>
          ← Voltar para o login
        </button>
      </p>
    </form>
  );
}

function Esqueci({ acoes, ir }: { acoes: AcoesEntrada; ir: (t: Tela) => void }) {
  const [email, setEmail] = useState("");
  const { erro, enviando, enviar } = useEnvio();
  return (
    <form
      className="cartao formulario"
      onSubmit={(e) => {
        e.preventDefault();
        enviar(async () => {
          const falha = await acoes.onEsqueci(email.trim());
          if (!falha) ir({ modo: "enviado", email: email.trim(), motivo: "recuperar" });
          return falha;
        });
      }}
    >
      <header>
        <h2>Recuperar senha</h2>
      </header>
      <p className="nota">Informe o e-mail do cadastro. Vamos enviar um link para você criar uma senha nova.</p>
      <label>
        E-mail
        <input type="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" autoFocus />
      </label>
      <Erro texto={erro} />
      <button className="primario" disabled={!emailValido(email) || enviando}>
        {enviando ? "Enviando…" : "Enviar link"}
      </button>
      <p className="alternativa">
        <button type="button" className="link" onClick={() => ir({ modo: "login" })}>
          ← Voltar para o login
        </button>
      </p>
    </form>
  );
}

function Enviado({ email, motivo, ir }: { email: string; motivo: "confirmar" | "recuperar"; ir: (t: Tela) => void }) {
  return (
    <section className="cartao formulario">
      <header>
        <h2>Verifique seu e-mail</h2>
      </header>
      <p>
        {motivo === "confirmar" ? (
          <>
            Enviamos um link de confirmação para <b>{email}</b>. Abra o e-mail e toque no link para ativar a conta; depois é só
            entrar.
          </>
        ) : (
          <>
            Se existir uma conta com <b>{email}</b>, enviamos um link para criar uma senha nova. Abra o e-mail neste aparelho e
            toque no link.
          </>
        )}
      </p>
      <p className="nota">Não chegou? Confira a caixa de spam ou lixo eletrônico.</p>
      <button className="primario" onClick={() => ir({ modo: "login" })}>
        Voltar para o login
      </button>
    </section>
  );
}

/** Tela aberta pelo link de recuperação do e-mail. */
export function NovaSenha({ onNovaSenha }: Pick<AcoesEntrada, "onNovaSenha">) {
  const [senha, setSenha] = useState("");
  const [confirmacao, setConfirmacao] = useState("");
  const { erro, setErro, enviando, enviar } = useEnvio();
  return (
    <Moldura>
      <form
        className="cartao formulario"
        onSubmit={(e) => {
          e.preventDefault();
          const invalido = validarSenha(senha, confirmacao);
          if (invalido) return setErro(invalido);
          enviar(() => onNovaSenha(senha));
        }}
      >
        <header>
          <h2>Criar senha nova</h2>
        </header>
        <SenhaInput rotulo="Nova senha" valor={senha} onChange={setSenha} autoComplete="new-password" autoFocus />
        <SenhaInput rotulo="Confirmação da nova senha" valor={confirmacao} onChange={setConfirmacao} autoComplete="new-password" />
        {confirmacao && senha !== confirmacao && <p className="situacao atencao">A confirmação ainda não confere.</p>}
        <Erro texto={erro} />
        <button className="primario" disabled={enviando}>
          Salvar senha
        </button>
      </form>
    </Moldura>
  );
}

function Moldura({ children }: { children: React.ReactNode }) {
  return (
    <div className="app entrada">
      <header className="topo">
        <h1>Orçamento</h1>
      </header>
      <main>{children}</main>
    </div>
  );
}

export function TelaEntrada({ acoes, aviso }: { acoes: AcoesEntrada; aviso?: string }) {
  const [tela, setTela] = useState<Tela>({ modo: "login", aviso });
  return (
    <Moldura>
      {tela.modo === "login" ? (
        <Login aviso={tela.aviso} acoes={acoes} ir={setTela} />
      ) : tela.modo === "cadastro" ? (
        <Cadastro acoes={acoes} ir={setTela} />
      ) : tela.modo === "esqueci" ? (
        <Esqueci acoes={acoes} ir={setTela} />
      ) : (
        <Enviado email={tela.email} motivo={tela.motivo} ir={setTela} />
      )}
    </Moldura>
  );
}
