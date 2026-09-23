import { useEffect, useState } from "react";
import { Painel } from "./components/Painel";
import { TelaAjustes } from "./components/TelaAjustes";
import { TelaMes } from "./components/TelaMes";
import { TelaParcelas } from "./components/TelaParcelas";
import { mesAtual, nomeMes, somarMeses } from "./domain/meses";
import { useOrcamento } from "./useOrcamento";

const ABAS = [
  { key: "mes", nome: "Mês", icone: "▤" },
  { key: "painel", nome: "Painel", icone: "◔" },
  { key: "parcelas", nome: "Parcelas", icone: "▦" },
  { key: "ajustes", nome: "Ajustes", icone: "⚙" },
] as const;
type Aba = (typeof ABAS)[number]["key"];

export function App() {
  const orc = useOrcamento();
  const [mesKey, setMesKey] = useState(mesAtual());
  const [aba, setAba] = useState<Aba>("mes");
  const { dados } = orc;

  // Ao chegar num mês que ainda não existe, cria sozinho (copiando o mês anterior).
  useEffect(() => {
    if (dados) orc.criarMesAutomatico(mesKey);
  }, [dados, mesKey, orc]);

  return (
    <div className="app">
      <header className="topo">
        <h1>Orçamento</h1>
        <nav className="navegador-mes" aria-label="Mês">
          <button aria-label="Mês anterior" onClick={() => setMesKey(somarMeses(mesKey, -1))}>
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
          <TelaMes mesKey={mesKey} dados={dados} orc={orc} />
        ) : aba === "painel" ? (
          <Painel mesKey={mesKey} dados={dados} />
        ) : aba === "parcelas" ? (
          <TelaParcelas mesKey={mesKey} parcelas={dados.parcelas} orc={orc} />
        ) : (
          <TelaAjustes mesKey={mesKey} dados={dados} orc={orc} />
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
