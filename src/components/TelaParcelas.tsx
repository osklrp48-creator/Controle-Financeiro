import { useState } from "react";
import { novoParcelamento, numeroParcela, saldoDevedor, ultimoMesParcela, valorParcela } from "../domain/calculos";
import { CATEGORIAS, catDef } from "../domain/categorias";
import { difMeses, mesValido, nomeMes } from "../domain/meses";
import type { CatKey, Parcelamento } from "../domain/types";
import { brl, lerValor, novoId } from "../formato";
import type { Orcamento } from "../useOrcamento";

function Formulario({ mesKey, onSalvar }: { mesKey: string; onSalvar: (p: Parcelamento) => void }) {
  const [nome, setNome] = useState("");
  const [cat, setCat] = useState<CatKey>("basicas");
  const [inicio, setInicio] = useState(mesKey);
  const [n, setN] = useState("2");
  const [modo, setModo] = useState<"parcela" | "total">("parcela");
  const [valorTxt, setValorTxt] = useState("");

  const qtd = Number(n);
  const valor = lerValor(valorTxt);
  const qtdOk = Number.isInteger(qtd) && qtd >= 1 && qtd <= 120;
  const parcela = valor && qtdOk ? (modo === "parcela" ? valor : valorParcela(valor, qtd)) : null;
  const ok = nome.trim() !== "" && mesValido(inicio) && qtdOk && parcela != null && parcela > 0;

  const salvar = (e: React.FormEvent) => {
    e.preventDefault();
    if (!ok) return;
    onSalvar(novoParcelamento({ nome: nome.trim(), cat, inicio, n: qtd, valor: parcela! }, novoId()));
    setNome("");
    setValorTxt("");
  };

  return (
    <form className="cartao formulario" onSubmit={salvar}>
      <header>
        <h2>Novo parcelamento</h2>
      </header>
      <label>
        Descrição
        <input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Geladeira" />
      </label>
      <label>
        Categoria
        <select value={cat} onChange={(e) => setCat(e.target.value as CatKey)}>
          {CATEGORIAS.map((c) => (
            <option key={c.key} value={c.key}>
              {c.nome}
            </option>
          ))}
        </select>
      </label>
      <div className="linha">
        <label>
          1ª parcela
          <input type="month" value={inicio} onChange={(e) => setInicio(e.target.value)} />
        </label>
        <label>
          Parcelas
          <input inputMode="numeric" value={n} onChange={(e) => setN(e.target.value.replace(/\D/g, ""))} />
        </label>
      </div>
      <div className="alternar" role="radiogroup" aria-label="Informar valor">
        <button type="button" aria-pressed={modo === "parcela"} onClick={() => setModo("parcela")}>
          Valor da parcela
        </button>
        <button type="button" aria-pressed={modo === "total"} onClick={() => setModo("total")}>
          Valor total
        </button>
      </div>
      <label>
        {modo === "parcela" ? "Valor de cada parcela" : "Valor total da compra"}
        <input inputMode="decimal" value={valorTxt} onChange={(e) => setValorTxt(e.target.value)} placeholder="0,00" />
      </label>
      {parcela != null && qtdOk && (
        <p className="nota">
          {qtd}× {brl(parcela)} = {brl(parcela * qtd)}
          {mesValido(inicio) && ` · até ${nomeMes(ultimoMesParcela({ inicio, n: qtd } as Parcelamento))}`}
        </p>
      )}
      <button className="primario" disabled={!ok}>
        Adicionar parcelamento
      </button>
    </form>
  );
}

export function TelaParcelas({ mesKey, parcelas, orc }: { mesKey: string; parcelas: Parcelamento[]; orc: Orcamento }) {
  const ativos = parcelas.filter((p) => difMeses(ultimoMesParcela(p), mesKey) <= 0);
  const encerrados = parcelas.filter((p) => difMeses(ultimoMesParcela(p), mesKey) > 0);
  const comprometido = parcelas.reduce((a, p) => a + (numeroParcela(p, mesKey) ? p.valor : 0), 0);

  const remover = (p: Parcelamento) => {
    if (confirm(`Remover o parcelamento "${p.nome}"? Ele deixa de aparecer em todos os meses.`)) {
      orc.salvarParcelas(parcelas.filter((x) => x.id !== p.id));
    }
  };

  const Lista = ({ itens }: { itens: Parcelamento[] }) => (
    <ul className="lista-parcelas">
      {itens.map((p) => {
        const k = numeroParcela(p, mesKey);
        return (
          <li key={p.id}>
            <div>
              <strong>{p.nome}</strong>
              <small>
                {catDef(p.cat).nome} · {p.n}× {brl(p.valor)} · {nomeMes(p.inicio, true)} a {nomeMes(ultimoMesParcela(p), true)}
              </small>
              <small>
                {k ? `Parcela ${k}/${p.n} neste mês · ` : difMeses(p.inicio, mesKey) < 0 ? "Começa depois · " : "Quitado · "}
                restam {brl(saldoDevedor(p, mesKey))} de {brl(p.total)}
              </small>
            </div>
            <button className="icone remover" aria-label={`Remover ${p.nome}`} onClick={() => remover(p)}>
              ×
            </button>
          </li>
        );
      })}
    </ul>
  );

  return (
    <>
      <section className="destaque">
        <span>Parcelas em {nomeMes(mesKey)}</span>
        <strong>{brl(comprometido)}</strong>
        <small>As parcelas entram automaticamente no realizado da categoria em cada mês.</small>
      </section>
      <Formulario mesKey={mesKey} onSalvar={(p) => orc.salvarParcelas([...parcelas, p])} />
      {ativos.length > 0 && (
        <section className="cartao">
          <header>
            <h2>Em andamento</h2>
          </header>
          <Lista itens={ativos} />
        </section>
      )}
      {encerrados.length > 0 && (
        <section className="cartao">
          <header>
            <h2>Encerrados</h2>
          </header>
          <Lista itens={encerrados} />
        </section>
      )}
    </>
  );
}
