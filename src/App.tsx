import { useEffect, useState } from "react";
import { ImportarLocais } from "./components/ImportarLocais";
import { Painel } from "./components/Painel";
import { SugestaoPin } from "./components/Pin";
import { TelaAjustes } from "./components/TelaAjustes";
import { TelaMes } from "./components/TelaMes";
import { TelaParcelas } from "./components/TelaParcelas";
import { primeiroMesGuardado } from "./domain/calculos";
import { mesAtual, nomeMes, somarMeses } from "./domain/meses";
import { nomeDoUsuario, type Usuario } from "./nuvem";
import { useOrcamento } from "./useOrcamento";

const ABAS = [
  { key: "mes", nome: "Mês", icone: "▤" },
  { key: "painel", nome: "Painel", icone: "◔" },
  { key: "parcelas", nome: "Parcelas", icone: "▦" },
  { key: "ajustes", nome: "Ajustes", icone: "⚙" },
] as const;
type Aba = (typeof ABAS)[number]["key"];

export type AcoesConta = {
  conta: Usuario;
  onSair: () => void | Promise<void>;
  /** PIN salvo neste aparelho para esta conta. */
  pinAtivo: boolean;
  onCriarPin: (pin: string) => Promise<string | null>;
  onRemoverPin: () => void;
  /** Devolvem uma mensagem de erro, ou null se deu certo. */
  onAlterarSenha: (senhaAtual: string, nova: string) => Promise<string | null>;
  onExcluirConta: (senha: string) => Promise<string | null>;
};

export function App(props: AcoesConta) {
  const { conta } = props;
  const orc = useOrcamento(conta.id);
  const [mesKey, setMesKey] = useState(mesAtual());
  const [aba, setAba] = useState<Aba>("mes");
  const { dados } = orc;
  const [online, setOnline] = useState(() => navigator.onLine);
  useEffect(() => {
    const atualizar = () => setOnline(navigator.onLine);
    window.addEventListener("online", atualizar);
    window.addEventListener("offline", atualizar);
    return () => {
      window.removeEventListener("online", atualizar);
      window.removeEventListener("offline", atualizar);
    };
  }, []);

  // Ao chegar num mês que ainda não existe, cria sozinho (copiando o mês anterior).
  useEffect(() => {
    if (dados) orc.criarMesAutomatico(mesKey);
  }, [dados, mesKey, orc]);

  return (
    <div className="app">
      <header className="topo">
        <div className="marca">
          <h1>Orçamento</h1>
          <button className="conta-atual" onClick={() => setAba("ajustes")} title="Conta">
            {nomeDoUsuario(conta)}
            {!online && (
              <span className="offline" title="As alterações ficam salvas no aparelho e são enviadas quando a internet voltar">
                sem internet
              </span>
            )}
          </button>
        </div>
        <nav className="navegador-mes" aria-label="Mês">
          <button
            aria-label="Mês anterior"
            disabled={mesKey <= primeiroMesGuardado(mesAtual())}
            title={mesKey <= primeiroMesGuardado(mesAtual()) ? "Só os últimos 13 meses ficam guardados" : undefined}
            onClick={() => setMesKey(somarMeses(mesKey, -1))}
          >
            ‹
          </button>
          <button className="mes-atual" onClick={() => setMesKey(mesAtual())} title="Ir para o mês atual">
            {nomeMes(mesKey)}
          </button>
          <button aria-label="Próximo mês" onClick={() => setMesKey(somarMeses(mesKey, 1))}>
            ›
          </button>
        </nav>
      </header>

      {orc.erro && (
        <div className="erro" role="alert">
          {orc.erro}
          <button className="icone" aria-label="Fechar" onClick={orc.limparErro}>
            ×
          </button>
        </div>
      )}

      <main>
        {!dados ? (
          <p className="nada">Carregando…</p>
        ) : aba === "mes" ? (
          <>
            {!props.pinAtivo && <SugestaoPin usuarioId={conta.id} onCriar={props.onCriarPin} />}
            <ImportarLocais orc={orc} usuarioId={conta.id} />
            <TelaMes mesKey={mesKey} dados={dados} orc={orc} />
          </>
        ) : aba === "painel" ? (
          <Painel mesKey={mesKey} dados={dados} />
        ) : aba === "parcelas" ? (
          <TelaParcelas mesKey={mesKey} parcelas={dados.parcelas} orc={orc} />
        ) : (
          <TelaAjustes mesKey={mesKey} dados={dados} orc={orc} contaAcoes={props} />
        )}
      </main>

      <nav className="abas" aria-label="Seções">
        {ABAS.map((a) => (
          <button key={a.key} aria-current={aba === a.key ? "page" : undefined} onClick={() => setAba(a.key)}>
            <span aria-hidden>{a.icone}</span>
            {a.nome}
          </button>
        ))}
      </nav>
    </div>
  );
}
