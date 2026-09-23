import { useState, type ReactNode } from "react";
import { evolucao, resumoMes, type ResumoMes } from "../domain/calculos";
import { nomeMes } from "../domain/meses";
import type { Dados } from "../domain/types";
import { brl, pct } from "../formato";

type Dica = { x: number; y: number; conteudo: ReactNode } | null;

function useDica() {
  const [dica, setDica] = useState<Dica>(null);
  const mostrar = (e: React.PointerEvent, conteudo: ReactNode) => {
    const alvo = (e.currentTarget as Element).closest(".grafico")!.getBoundingClientRect();
    setDica({ x: e.clientX - alvo.left, y: e.clientY - alvo.top, conteudo });
  };
  const el = dica && (
    <div className="dica" style={{ left: dica.x, top: dica.y }} role="tooltip">
      {dica.conteudo}
    </div>
  );
  return { mostrar, esconder: () => setDica(null), el };
}

/** Para onde foi a renda do mês: uma barra 100% com cada categoria + o que ficou sem destino. */
function Distribuicao({ r }: { r: ResumoMes }) {
  const { mostrar, esconder, el } = useDica();
  const segs = [
    ...r.cats.map((c) => ({ key: c.key, nome: c.nome, valor: c.realizado })),
    { key: "sobra", nome: "Sem destino", valor: Math.max(0, r.saldo) },
  ].filter((s) => s.valor > 0);
  const total = segs.reduce((a, s) => a + s.valor, 0);

  return (
    <section className="cartao grafico">
      <header>
        <h2>Para onde foi a renda</h2>
      </header>
      {total === 0 ? (
        <p className="nada">Lance rendas e gastos para ver a distribuição.</p>
      ) : (
        <>
          <div className="empilhada" onPointerLeave={esconder}>
            {segs.map((s) => (
              <div
                key={s.key}
                className={`seg cat-${s.key}`}
                style={{ flexGrow: s.valor }}
                onPointerMove={(e) =>
                  mostrar(e, (
                    <>
                      <b>{s.nome}</b>
                      <br />
                      {brl(s.valor)} · {pct((s.valor / total) * 100)}
                    </>
                  ))
                }
              />
            ))}
          </div>
          <ul className="legenda">
            {segs.map((s) => (
              <li key={s.key}>
                <i className={`cat-${s.key}`} />
                <span>{s.nome}</span>
                <b>{pct((s.valor / total) * 100)}</b>
              </li>
            ))}
          </ul>
          {r.saldo < 0 && <p className="situacao ruim">Os lançamentos passam da renda em {brl(-r.saldo)}.</p>}
        </>
      )}
      {el}
    </section>
  );
}

/** Orçado × realizado por categoria (barra = realizado, traço = orçado). */
function OrcadoRealizado({ r }: { r: ResumoMes }) {
  const { mostrar, esconder, el } = useDica();
  const max = Math.max(1, ...r.cats.flatMap((c) => [c.orcado, c.realizado]));

  return (
    <section className="cartao grafico">
      <header>
        <h2>Orçado × realizado</h2>
      </header>
      <ul className="bullets">
        {r.cats.map((c) => (
          <li
            key={c.key}
            onPointerMove={(e) =>
              mostrar(e, (
                <>
                  <b>{c.nome}</b>
                  <br />
                  Realizado {brl(c.realizado)}
                  <br />
                  Orçado {brl(c.orcado)} ({pct(c.pct)})
                </>
              ))
            }
            onPointerLeave={esconder}
          >
            <div className="rotulo">
              <span>{c.nome}</span>
              <span className={c.estourado ? "ruim" : undefined}>
                {c.estourado && "▲ "}
                {brl(c.realizado)} <small>/ {brl(c.orcado)}</small>
              </span>
            </div>
            <div className="trilho">
              <div className={`preenchido cat-${c.key}`} style={{ width: `${(c.realizado / max) * 100}%` }} />
              <div className="meta" style={{ left: `${(c.orcado / max) * 100}%` }} />
            </div>
          </li>
        ))}
      </ul>
      <p className="nota">
        <span className="meta-amostra" /> orçado · <b className="ruim">▲</b> gasto acima do orçado
      </p>
      {el}
    </section>
  );
}

const SERIES = [
  { key: "renda", nome: "Renda" },
  { key: "gastos", nome: "Gastos" },
  { key: "reservas", nome: "Reservas" },
] as const;

function Evolucao({ dados, mesKey }: { dados: Dados; mesKey: string }) {
  const { mostrar, esconder, el } = useDica();
  const pontos = evolucao(dados, mesKey, 6);
  const [tabela, setTabela] = useState(false);

  const L = 320, A = 180, mEsq = 8, mBase = 22;
  const max = Math.max(1, ...pontos.flatMap((p) => [p.renda, p.gastos, p.reservas]));
  const larguraGrupo = (L - mEsq) / Math.max(pontos.length, 1);
  const larguraBarra = Math.min(18, (larguraGrupo - 12) / 3);
  const altura = (v: number) => (v / max) * (A - mBase - 8);

  return (
    <section className="cartao grafico">
      <header>
        <h2>Evolução mensal</h2>
        {pontos.length > 0 && (
          <button className="link" onClick={() => setTabela(!tabela)}>
            {tabela ? "Ver gráfico" : "Ver tabela"}
          </button>
        )}
      </header>
      {pontos.length === 0 ? (
        <p className="nada">Nenhum mês cadastrado até aqui.</p>
      ) : tabela ? (
        <table className="tabela">
          <thead>
            <tr>
              <th>Mês</th>
              {SERIES.map((s) => (
                <th key={s.key}>{s.nome}</th>
              ))}
              <th>Sem destino</th>
            </tr>
          </thead>
          <tbody>
            {pontos.map((p) => (
              <tr key={p.mes}>
                <td>{nomeMes(p.mes, true)}</td>
                {SERIES.map((s) => (
                  <td key={s.key}>{brl(p[s.key])}</td>
                ))}
                <td className={p.saldo < 0 ? "ruim" : undefined}>{brl(p.saldo)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <>
          <ul className="legenda">
            {SERIES.map((s) => (
              <li key={s.key}>
                <i className={`serie-${s.key}`} />
                <span>{s.nome}</span>
              </li>
            ))}
          </ul>
          <svg viewBox={`0 0 ${L} ${A}`} className="evolucao" onPointerLeave={esconder}>
            <line x1={mEsq} x2={L} y1={A - mBase} y2={A - mBase} className="eixo" />
            {pontos.map((p, i) => {
              const x0 = mEsq + i * larguraGrupo + (larguraGrupo - larguraBarra * 3 - 4) / 2;
              return (
                <g key={p.mes}>
                  {SERIES.map((s, j) => {
                    const h = altura(p[s.key]);
                    const x = x0 + j * (larguraBarra + 2);
                    const y = A - mBase - h;
                    const r = Math.min(4, h / 2, larguraBarra / 2);
                    return h > 0 ? (
                      <path
                        key={s.key}
                        className={`serie-${s.key}`}
                        d={`M${x},${A - mBase} V${y + r} Q${x},${y} ${x + r},${y} H${x + larguraBarra - r} Q${x + larguraBarra},${y} ${x + larguraBarra},${y + r} V${A - mBase} Z`}
                      />
                    ) : null;
                  })}
                  <text x={mEsq + i * larguraGrupo + larguraGrupo / 2} y={A - 6} className="rotulo-eixo">
                    {nomeMes(p.mes, true)}
                  </text>
                  <rect
                    x={mEsq + i * larguraGrupo}
                    y={0}
                    width={larguraGrupo}
                    height={A}
                    className="alvo"
                    onPointerMove={(e) =>
                      mostrar(e, (
                        <>
                          <b>{nomeMes(p.mes)}</b>
                          {SERIES.map((s) => (
                            <div key={s.key} className="linha-dica">
                              <i className={`serie-${s.key}`} /> {s.nome} <b>{brl(p[s.key])}</b>
                            </div>
                          ))}
                          <div className="linha-dica">Sem destino <b>{brl(p.saldo)}</b></div>
                        </>
                      ))
                    }
                  />
                </g>
              );
            })}
          </svg>
        </>
      )}
      {el}
    </section>
  );
}

export function Painel({ dados, mesKey }: { dados: Dados; mesKey: string }) {
  const mes = dados.meses[mesKey];
  return (
    <>
      {mes ? (
        (() => {
          const r = resumoMes(mes, mesKey, dados.config, dados.parcelas);
          return (
            <>
              <section className="destaque">
                <span>{r.saldo < 0 ? "Faltando em" : "Sem destino em"} {nomeMes(mesKey)}</span>
                <strong className={r.saldo < 0 ? "ruim" : undefined}>{brl(r.saldo)}</strong>
                <small>
                  Renda {brl(r.renda)} − gastos {brl(r.gastos)} − reservas {brl(r.reservas)}
                </small>
              </section>
              <Distribuicao r={r} />
              <OrcadoRealizado r={r} />
            </>
          );
        })()
      ) : (
        <p className="nada">{nomeMes(mesKey)} ainda não foi criado. Crie o mês na aba Mês.</p>
      )}
      <Evolucao dados={dados} mesKey={mesKey} />
    </>
  );
}
