import { useEffect, useState } from "react";
import { pctsValidos, somaPcts } from "../domain/calculos";
import { CATEGORIAS, configPadrao, CAT_KEYS } from "../domain/categorias";
import { mesValido, nomeMes } from "../domain/meses";
import type { Config, Dados, TipoCat } from "../domain/types";
import { lerValor, pct } from "../formato";
import type { Orcamento } from "../useOrcamento";

function validarBackup(x: unknown): x is Dados {
  const d = x as Dados;
  return (
    !!d &&
    typeof d.meses === "object" &&
    Object.keys(d.meses).every(mesValido) &&
    Array.isArray(d.parcelas) &&
    !!d.config &&
    CAT_KEYS.every((k) => typeof d.config.pcts?.[k] === "number" && ["GASTO", "RESERVA"].includes(d.config.tipos?.[k]))
  );
}

export function TelaAjustes({ dados, mesKey, orc }: { dados: Dados; mesKey: string; orc: Orcamento }) {
  const [rascunho, setRascunho] = useState<Config>(dados.config);
  const [txt, setTxt] = useState<Record<string, string>>({});
  useEffect(() => setRascunho(dados.config), [dados.config]);

  const soma = somaPcts(rascunho);
  const valido = pctsValidos(rascunho);
  const alterado = JSON.stringify(rascunho) !== JSON.stringify(dados.config);

  const setPct = (k: string, s: string) => {
    setTxt({ ...txt, [k]: s });
    const v = lerValor(s);
    setRascunho({ ...rascunho, pcts: { ...rascunho.pcts, [k]: v ?? 0 } });
  };

  const exportar = () => {
    const blob = new Blob([JSON.stringify(dados, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `orcamento-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const importar = async (arquivo: File) => {
    try {
      const d = JSON.parse(await arquivo.text());
      if (!validarBackup(d)) throw new Error("formato inválido");
      if (confirm("Restaurar este backup? Todos os dados atuais serão substituídos.")) await orc.importar(d);
    } catch (e) {
      alert(`Não foi possível ler o backup: ${(e as Error).message}`);
    }
  };

  return (
    <>
      <section className="cartao">
        <header>
          <h2>Distribuição da renda</h2>
          <strong className={valido ? undefined : "ruim"}>{pct(soma)}</strong>
        </header>
        <p className="nota">Cada categoria recebe um percentual da renda do mês. Os percentuais precisam somar 100%.</p>
        <ul className="config">
          {CATEGORIAS.map((c) => (
            <li key={c.key}>
              <span className={`marcador cat-${c.key}`} />
              <span className="nome-cat">{c.nome}</span>
              <label className="pct">
                <input
                  inputMode="decimal"
                  aria-label={`Percentual de ${c.nome}`}
                  value={txt[c.key] ?? String(rascunho.pcts[c.key]).replace(".", ",")}
                  onChange={(e) => setPct(c.key, e.target.value)}
                />
                %
              </label>
              <select
                aria-label={`Tipo de ${c.nome}`}
                value={rascunho.tipos[c.key]}
                onChange={(e) => setRascunho({ ...rascunho, tipos: { ...rascunho.tipos, [c.key]: e.target.value as TipoCat } })}
              >
                <option value="GASTO">Gasto</option>
                <option value="RESERVA">Reserva</option>
              </select>
            </li>
          ))}
        </ul>
        {!valido && (
          <p className="situacao ruim">
            A soma está em {pct(soma)}; {soma > 100 ? `sobram ${pct(soma - 100)}` : `faltam ${pct(100 - soma)}`}.
          </p>
        )}
        <div className="acoes">
          <button
            onClick={() => {
              setTxt({});
              setRascunho(configPadrao());
            }}
          >
            Restaurar padrão
          </button>
          <button
            className="primario"
            disabled={!valido || !alterado}
            onClick={() => {
              setTxt({});
              orc.salvarConfig(rascunho);
            }}
          >
            Salvar
          </button>
        </div>
      </section>

      <section className="cartao">
        <header>
          <h2>Backup</h2>
        </header>
        <p className="nota">Os dados ficam só neste aparelho. Exporte um backup de vez em quando.</p>
        <div className="acoes">
          <button onClick={exportar}>Exportar JSON</button>
          <label className="botao">
            Importar JSON
            <input
              type="file"
              accept="application/json,.json"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) importar(f);
                e.target.value = "";
              }}
            />
          </label>
        </div>
      </section>

      {dados.meses[mesKey] && (
        <section className="cartao">
          <header>
            <h2>Excluir mês</h2>
          </header>
          <p className="nota">Apaga todos os lançamentos de {nomeMes(mesKey)}. Os parcelamentos não são afetados.</p>
          <div className="acoes">
            <button
              className="perigo"
              onClick={() => confirm(`Excluir ${nomeMes(mesKey)}? Isso não pode ser desfeito.`) && orc.excluirMes(mesKey)}
            >
              Excluir {nomeMes(mesKey)}
            </button>
          </div>
        </section>
      )}
    </>
  );
}
