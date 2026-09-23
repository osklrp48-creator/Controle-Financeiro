import { useState } from "react";
import { pctsDoMes, pctsFecham, somaDosPcts } from "../domain/calculos";
import { CATEGORIAS } from "../domain/categorias";
import type { Config, Mes } from "../domain/types";
import { lerValor, pct } from "../formato";

type Props = {
  mes: Mes;
  config: Config;
  /** `undefined` volta a usar os percentuais padrão. */
  onSalvar: (pcts: Config["pcts"] | undefined) => void;
};

const texto = (v: number) => String(v).replace(".", ",");

/** Percentuais do mês: mostra os que estão valendo e permite personalizar só este mês. */
export function DistribuicaoMes({ mes, config, onSalvar }: Props) {
  const vigentes = pctsDoMes(mes, config);
  const proprios = mes.pcts != null;
  const [editando, setEditando] = useState(false);
  const [txt, setTxt] = useState<Record<string, string>>({});

  const rascunho = { ...vigentes };
  for (const [k, s] of Object.entries(txt)) rascunho[k as keyof typeof rascunho] = lerValor(s) ?? 0;
  const soma = somaDosPcts(rascunho);
  const fecha = pctsFecham(rascunho);

  const abrir = () => {
    setTxt({});
    setEditando(true);
  };

  return (
    <section className="cartao distribuicao-mes">
      <header>
        <h2>
          Distribuição do mês{" "}
          <small>{proprios ? "personalizada para este mês" : "usando o padrão de Ajustes"}</small>
        </h2>
        {!editando && (
          <button className="link" onClick={abrir}>
            {proprios ? "Editar" : "Personalizar"}
          </button>
        )}
      </header>

      {!editando ? (
        <ul className="chips-pct">
          {CATEGORIAS.map((c) => (
            <li key={c.key}>
              <i className={`cat-${c.key}`} aria-hidden />
              <span>{c.nome}</span>
              <b className={proprios && vigentes[c.key] !== config.pcts[c.key] ? "diferente" : undefined}>
                {pct(vigentes[c.key])}
              </b>
            </li>
          ))}
        </ul>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!fecha) return;
            onSalvar(rascunho);
            setEditando(false);
          }}
        >
          <ul className="config">
            {CATEGORIAS.map((c) => (
              <li key={c.key}>
                <span className={`marcador cat-${c.key}`} />
                <span className="nome-cat">
                  {c.nome}
                  <small className="padrao"> padrão {pct(config.pcts[c.key])}</small>
                </span>
                <label className="pct">
                  <input
                    inputMode="decimal"
                    aria-label={`Percentual de ${c.nome} neste mês`}
                    value={txt[c.key] ?? texto(vigentes[c.key])}
                    onChange={(e) => setTxt({ ...txt, [c.key]: e.target.value })}
                  />
                  %
                </label>
              </li>
            ))}
          </ul>
          <p className={`situacao ${fecha ? "ok" : "ruim"}`}>
            Soma: {pct(soma)}
            {!fecha && (soma > 100 ? ` — sobram ${pct(soma - 100)}` : ` — faltam ${pct(100 - soma)}`)}
          </p>
          <div className="acoes">
            {proprios && (
              <button
                type="button"
                onClick={() => {
                  onSalvar(undefined);
                  setEditando(false);
                }}
              >
                Voltar ao padrão
              </button>
            )}
            <button type="button" onClick={() => setEditando(false)}>
              Cancelar
            </button>
            <button className="primario" disabled={!fecha}>
              Salvar para este mês
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
