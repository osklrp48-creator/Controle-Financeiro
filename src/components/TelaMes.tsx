import { mesAnteriorExistente, parcelasDoMes, resumoMes, type ResumoCategoria } from "../domain/calculos";
import type { Dados, Mes } from "../domain/types";
import { nomeMes } from "../domain/meses";
import { brl, pct } from "../formato";
import type { Orcamento } from "../useOrcamento";
import { ListaItens } from "./ListaItens";

export function Barra({ c }: { c: ResumoCategoria }) {
  const largura = Math.min(100, c.uso * 100);
  return (
    <div className="barra" role="progressbar" aria-valuenow={Math.round(c.uso * 100)} aria-valuemin={0} aria-valuemax={100}>
      <div className={`preenchido cat-${c.key}${c.estourado ? " estourado" : ""}`} style={{ width: `${largura}%` }} />
    </div>
  );
}

function situacao(c: ResumoCategoria): { texto: string; classe: string } {
  if (c.tipo === "GASTO") {
    return c.disponivel < 0
      ? { texto: `Estourou ${brl(-c.disponivel)}`, classe: "ruim" }
      : { texto: `Disponível ${brl(c.disponivel)}`, classe: "ok" };
  }
  return c.disponivel > 0
    ? { texto: `Faltam ${brl(c.disponivel)} para a meta`, classe: "atencao" }
    : { texto: c.disponivel < 0 ? `Meta superada em ${brl(-c.disponivel)}` : "Meta atingida", classe: "ok" };
}

export function TelaMes({ mesKey, dados, orc }: { mesKey: string; dados: Dados; orc: Orcamento }) {
  const mes = dados.meses[mesKey];

  if (!mes) {
    const base = mesAnteriorExistente(dados.meses, mesKey);
    return (
      <section className="vazio">
        <h2>{nomeMes(mesKey)} ainda não foi criado</h2>
        <p>
          {base
            ? `O novo mês copia os itens de ${nomeMes(base)}. Só os itens marcados como fixos (↻) levam o valor junto.`
            : "O novo mês começa com os itens sugeridos de cada categoria, ainda sem valores."}
        </p>
        <button className="primario" onClick={() => orc.criarMes(mesKey)}>
          Criar {nomeMes(mesKey)}
        </button>
      </section>
    );
  }

  const r = resumoMes(mes, mesKey, dados.config, dados.parcelas);
  const alterar = (fn: (m: Mes) => Mes) => orc.alterarMes(mesKey, fn);

  return (
    <>
      <section className="resumo">
        <div>
          <span>Renda</span>
          <strong>{brl(r.renda)}</strong>
        </div>
        <div>
          <span>Gastos</span>
          <strong>{brl(r.gastos)}</strong>
        </div>
        <div>
          <span>Reservas</span>
          <strong>{brl(r.reservas)}</strong>
        </div>
        <div className={r.saldo < 0 ? "negativo" : ""}>
          <span>{r.saldo < 0 ? "Faltando" : "Sem destino"}</span>
          <strong>{brl(r.saldo)}</strong>
        </div>
      </section>
      {r.pendentes > 0 && <p className="aviso">{r.pendentes} {r.pendentes === 1 ? "item ainda sem valor" : "itens ainda sem valor"}.</p>}

      <section className="cartao">
        <header>
          <h2>Rendas</h2>
          <strong>{brl(r.renda)}</strong>
        </header>
        <ListaItens itens={mes.rendas} rotuloNovo="Nova renda" onChange={(rendas) => alterar((m) => ({ ...m, rendas }))} />
      </section>

      {r.cats.map((c) => {
        const s = situacao(c);
        const parcelas = parcelasDoMes(dados.parcelas, mesKey, c.key);
        return (
          <section key={c.key} className={`cartao borda-${c.key}`}>
            <header>
              <h2>
                {c.nome} <small>{pct(c.pct)} · {c.tipo === "GASTO" ? "gasto" : "reserva"}</small>
              </h2>
              <strong>
                {brl(c.realizado)} <small>de {brl(c.orcado)}</small>
              </strong>
            </header>
            <Barra c={c} />
            <p className={`situacao ${s.classe}`}>{s.texto}</p>
            <ListaItens
              itens={mes.cats[c.key]}
              rotuloNovo="Novo item"
              onChange={(itens) => alterar((m) => ({ ...m, cats: { ...m.cats, [c.key]: itens } }))}
            />
            {parcelas.length > 0 && (
              <ul className="parcelas-mes">
                {parcelas.map((p) => (
                  <li key={p.parcelamento.id}>
                    <span>
                      {p.parcelamento.nome} <small>parcela {p.numero}/{p.parcelamento.n}</small>
                    </span>
                    <span>{brl(p.valor)}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        );
      })}
    </>
  );
}
