import { useState } from "react";
import { SENHA_MINIMA, validarCadastro, type Conta } from "../storage/contas";
import { SenhaInput } from "./SenhaInput";

/** Todas as ações devolvem uma mensagem de erro, ou null se deu certo. */
type Props = {
  semCadastro: Conta[];
  onEntrar: (nome: string, sobrenome: string, senha: string) => Promise<string | null>;
  onCadastrar: (nome: string, sobrenome: string, senha: string, contaAntiga?: Conta) => Promise<string | null>;
};

function Login({ onEntrar, onIrCadastro }: { onEntrar: Props["onEntrar"]; onIrCadastro: () => void }) {
  const [nome, setNome] = useState("");
  const [sobrenome, setSobrenome] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    setEnviando(true);
    setErro(await onEntrar(nome, sobrenome, senha));
    setEnviando(false);
  };

  return (
    <form className="cartao formulario" onSubmit={enviar}>
      <header>
        <h2>Entrar</h2>
      </header>
      <div className="linha">
        <label>
          Nome
          <input value={nome} onChange={(e) => setNome(e.target.value)} autoComplete="given-name" autoFocus />
        </label>
        <label>
          Sobrenome
          <input value={sobrenome} onChange={(e) => setSobrenome(e.target.value)} autoComplete="family-name" />
        </label>
      </div>
      <SenhaInput rotulo="Senha" valor={senha} onChange={setSenha} autoComplete="current-password" />
      {erro && (
        <p className="situacao ruim" role="alert">
          {erro}
        </p>
      )}
      <button className="primario" disabled={!nome.trim() || !sobrenome.trim() || !senha || enviando}>
        Entrar
      </button>
      <p className="alternativa">
        Ainda não tem conta?{" "}
        <button type="button" className="link" onClick={onIrCadastro}>
          Cadastre-se
        </button>
      </p>
    </form>
  );
}

function Cadastro({
  contaAntiga,
  onCadastrar,
  onVoltar,
}: {
  contaAntiga?: Conta;
  onCadastrar: Props["onCadastrar"];
  onVoltar: () => void;
}) {
  const [nome, setNome] = useState("");
  const [sobrenome, setSobrenome] = useState("");
  const [senha, setSenha] = useState("");
  const [confirmacao, setConfirmacao] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    const invalido = validarCadastro(nome, sobrenome, senha, confirmacao);
    if (invalido) return setErro(invalido);
    setEnviando(true);
    setErro(await onCadastrar(nome, sobrenome, senha, contaAntiga));
    setEnviando(false);
  };

  return (
    <form className="cartao formulario" onSubmit={enviar}>
      <header>
        <h2>{contaAntiga ? "Cadastrar dados existentes" : "Criar conta"}</h2>
      </header>
      {contaAntiga && (
        <p className="nota">
          Os lançamentos de <b>{contaAntiga.nome}</b> serão mantidos e passam a ser acessados com o nome, sobrenome e senha
          abaixo.
        </p>
      )}
      <div className="linha">
        <label>
          Nome
          <input value={nome} onChange={(e) => setNome(e.target.value)} autoComplete="given-name" autoFocus />
        </label>
        <label>
          Sobrenome
          <input value={sobrenome} onChange={(e) => setSobrenome(e.target.value)} autoComplete="family-name" />
        </label>
      </div>
      <SenhaInput rotulo="Senha" valor={senha} onChange={setSenha} autoComplete="new-password" />
      <SenhaInput rotulo="Confirmação de senha" valor={confirmacao} onChange={setConfirmacao} autoComplete="new-password" />
      <p className="nota">
        A senha precisa ter pelo menos {SENHA_MINIMA} caracteres. Cada conta tem seus próprios dados, que ficam só neste
        aparelho.
      </p>
      {confirmacao && senha !== confirmacao && <p className="situacao atencao">A confirmação ainda não confere.</p>}
      {erro && (
        <p className="situacao ruim" role="alert">
          {erro}
        </p>
      )}
      <button className="primario" disabled={enviando}>
        {contaAntiga ? "Cadastrar e entrar" : "Criar conta"}
      </button>
      <p className="alternativa">
        <button type="button" className="link" onClick={onVoltar}>
          ← Voltar para o login
        </button>
      </p>
    </form>
  );
}

export function TelaEntrada({ semCadastro, onEntrar, onCadastrar }: Props) {
  const [tela, setTela] = useState<{ modo: "login" } | { modo: "cadastro"; contaAntiga?: Conta }>({ modo: "login" });

  return (
    <div className="app entrada">
      <header className="topo">
        <h1>Orçamento</h1>
      </header>
      <main>
        {tela.modo === "login" ? (
          <>
            <Login onEntrar={onEntrar} onIrCadastro={() => setTela({ modo: "cadastro" })} />
            {semCadastro.length > 0 && (
              <section className="cartao aviso-antigo">
                <p>
                  Há lançamentos salvos neste aparelho antes do cadastro. Crie o acesso para continuar usando esses dados:
                </p>
                {semCadastro.map((c) => (
                  <button key={c.id} onClick={() => setTela({ modo: "cadastro", contaAntiga: c })}>
                    Cadastrar “{c.nome}”
                  </button>
                ))}
              </section>
            )}
          </>
        ) : (
          <Cadastro
            key={tela.contaAntiga?.id ?? "nova"}
            contaAntiga={tela.contaAntiga}
            onCadastrar={onCadastrar}
            onVoltar={() => setTela({ modo: "login" })}
          />
        )}
      </main>
    </div>
  );
}
