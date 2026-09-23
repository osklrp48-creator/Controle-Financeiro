import { useState } from "react";
import type { Conta } from "../storage/contas";

type Props = {
  contas: Conta[];
  onEntrar: (conta: Conta, senha: string) => Promise<string | null>;
  onCriar: (nome: string, senha: string | undefined) => Promise<string | null>;
};

function NovaConta({ onCriar, onCancelar }: { onCriar: Props["onCriar"]; onCancelar?: () => void }) {
  const [nome, setNome] = useState("");
  const [senha, setSenha] = useState("");
  const [confirmacao, setConfirmacao] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (senha !== confirmacao) return setErro("As senhas não conferem.");
    setEnviando(true);
    setErro(await onCriar(nome, senha || undefined));
    setEnviando(false);
  };

  return (
    <form className="cartao formulario" onSubmit={enviar}>
      <header>
        <h2>Nova conta</h2>
      </header>
      <label>
        Nome
        <input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Ana" autoFocus autoComplete="username" />
      </label>
      <div className="linha">
        <label>
          Senha (opcional)
          <input type="password" value={senha} onChange={(e) => setSenha(e.target.value)} autoComplete="new-password" />
        </label>
        <label>
          Repita a senha
          <input type="password" value={confirmacao} onChange={(e) => setConfirmacao(e.target.value)} autoComplete="new-password" />
        </label>
      </div>
      <p className="nota">Cada conta tem seus próprios meses, parcelamentos e ajustes. Os dados ficam só neste aparelho.</p>
      {erro && <p className="situacao ruim">{erro}</p>}
      <div className="acoes">
        {onCancelar && (
          <button type="button" onClick={onCancelar}>
            Cancelar
          </button>
        )}
        <button className="primario" disabled={!nome.trim() || enviando}>
          Criar conta
        </button>
      </div>
    </form>
  );
}

export function TelaEntrada({ contas, onEntrar, onCriar }: Props) {
  const [criando, setCriando] = useState(contas.length === 0);
  const [escolhida, setEscolhida] = useState<Conta | null>(null);
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState<string | null>(null);

  const escolher = async (c: Conta) => {
    setErro(null);
    setSenha("");
    if (c.senha) setEscolhida(c);
    else setErro(await onEntrar(c, ""));
  };

  const entrarComSenha = async (e: React.FormEvent) => {
    e.preventDefault();
    if (escolhida) setErro(await onEntrar(escolhida, senha));
  };

  return (
    <div className="app entrada">
      <header className="topo">
        <h1>Orçamento</h1>
      </header>
      <main>
        {criando ? (
          <NovaConta onCriar={onCriar} onCancelar={contas.length ? () => setCriando(false) : undefined} />
        ) : (
          <section className="cartao">
            <header>
              <h2>Escolha a conta</h2>
            </header>
            <ul className="lista-contas">
              {contas.map((c) => (
                <li key={c.id}>
                  <button className={escolhida?.id === c.id ? "ativa" : undefined} onClick={() => escolher(c)}>
                    <span className="avatar" aria-hidden>
                      {c.nome.slice(0, 1).toUpperCase()}
                    </span>
                    <span className="nome-conta">{c.nome}</span>
                    {c.senha && <span title="Protegida por senha">🔒</span>}
                  </button>
                  {escolhida?.id === c.id && (
                    <form className="senha-conta" onSubmit={entrarComSenha}>
                      <input
                        type="password"
                        aria-label={`Senha de ${c.nome}`}
                        placeholder="Senha"
                        value={senha}
                        onChange={(e) => setSenha(e.target.value)}
                        autoComplete="current-password"
                        autoFocus
                      />
                      <button className="primario">Entrar</button>
                    </form>
                  )}
                </li>
              ))}
            </ul>
            {erro && <p className="situacao ruim">{erro}</p>}
            <button className="adicionar" onClick={() => setCriando(true)}>
              + Nova conta
            </button>
          </section>
        )}
      </main>
    </div>
  );
}
