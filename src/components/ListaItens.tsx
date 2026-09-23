import { useEffect, useState } from "react";
import type { Item } from "../domain/types";
import { lerValor, novoId, num } from "../formato";

function ValorInput({ valor, onChange, rotulo }: { valor: number | null; onChange: (v: number | null) => void; rotulo: string }) {
  const [txt, setTxt] = useState(num(valor));
  const [invalido, setInvalido] = useState(false);
  useEffect(() => setTxt(num(valor)), [valor]);

  const confirmar = () => {
    const v = lerValor(txt);
    if (v === undefined) return setInvalido(true);
    setInvalido(false);
    if (v !== valor) onChange(v);
    else setTxt(num(valor));
  };

  return (
    <input
      className={`valor${invalido ? " invalido" : ""}`}
      inputMode="decimal"
      placeholder="—"
      aria-label={`Valor de ${rotulo}`}
      aria-invalid={invalido}
      value={txt}
      onChange={(e) => setTxt(e.target.value)}
      onBlur={confirmar}
      onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
    />
  );
}

function NomeInput({ nome, onChange }: { nome: string; onChange: (n: string) => void }) {
  const [txt, setTxt] = useState(nome);
  useEffect(() => setTxt(nome), [nome]);
  return (
    <input
      className="nome"
      aria-label="Nome do item"
      value={txt}
      onChange={(e) => setTxt(e.target.value)}
      onBlur={() => (txt.trim() && txt !== nome ? onChange(txt.trim()) : setTxt(nome))}
      onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
    />
  );
}

type Props = {
  itens: Item[];
  onChange: (itens: Item[]) => void;
  rotuloNovo: string;
};

export function ListaItens({ itens, onChange, rotuloNovo }: Props) {
  const alterar = (id: string, patch: Partial<Item>) =>
    onChange(itens.map((i) => (i.id === id ? { ...i, ...patch } : i)));

  return (
    <>
      <ul className="itens">
        {itens.map((i) => (
          <li key={i.id} className={i.real == null ? "pendente" : undefined}>
            <NomeInput nome={i.nome} onChange={(nome) => alterar(i.id, { nome })} />
            <ValorInput valor={i.real} rotulo={i.nome} onChange={(real) => alterar(i.id, { real })} />
            <button
              className={`icone fixa${i.fixa ? " ativo" : ""}`}
              title={i.fixa ? "Fixo: o valor se repete nos próximos meses" : "Marcar como fixo (repete o valor nos próximos meses)"}
              aria-label={`Valor fixo de ${i.nome}`}
              aria-pressed={!!i.fixa}
              onClick={() => alterar(i.id, { fixa: !i.fixa || undefined })}
            >
              ↻
            </button>
            <button
              className="icone remover"
              title="Remover"
              aria-label={`Remover ${i.nome}`}
              onClick={() => onChange(itens.filter((x) => x.id !== i.id))}
            >
              ×
            </button>
          </li>
        ))}
      </ul>
      <button className="adicionar" onClick={() => onChange([...itens, { id: novoId(), nome: rotuloNovo, real: null }])}>
        + Adicionar
      </button>
    </>
  );
}
