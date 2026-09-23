import { useEffect, useMemo, useState } from "react";
import { App } from "./App";
import { TelaEntrada } from "./components/TelaEntrada";
import { novoId } from "./formato";
import { contaDaSessao, criarRepositorioContas, salvarSessao, senhaConfere, type Conta } from "./storage/contas";

/** Escolha/criação de conta; com uma conta aberta, mostra o app com os dados dela. */
export function Raiz() {
  const repo = useMemo(() => criarRepositorioContas(), []);
  const [contas, setContas] = useState<Conta[] | null>(null);
  const [ativa, setAtiva] = useState<Conta | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    repo
      .listar()
      .then((lista) => {
        setContas(lista);
        const sessao = contaDaSessao();
        setAtiva(lista.find((c) => c.id === sessao) ?? null);
      })
      .catch((e) => setErro(`Não foi possível abrir as contas: ${e}`));
  }, [repo]);

  const abrir = (c: Conta | null) => {
    salvarSessao(c?.id ?? null);
    setAtiva(c);
  };

  if (erro) return <p className="nada">{erro}</p>;
  if (!contas) return <p className="nada">Carregando…</p>;

  if (!ativa) {
    return (
      <TelaEntrada
        contas={contas}
        onEntrar={async (c, senha) => {
          if (!(await senhaConfere(c, senha))) return "Senha incorreta.";
          abrir(c);
          return null;
        }}
        onCriar={async (nome, senha) => {
          try {
            const c = await repo.criar(nome, senha, novoId());
            setContas([...contas, c]);
            abrir(c);
            return null;
          } catch (e) {
            return (e as Error).message;
          }
        }}
      />
    );
  }

  return (
    <App
      key={ativa.id}
      conta={ativa}
      onSair={() => abrir(null)}
      onAlterarSenha={async (senhaAtual, nova) => {
        if (!(await senhaConfere(ativa, senhaAtual))) return "Senha atual incorreta.";
        const c = await repo.alterarSenha(ativa.id, nova);
        setContas(contas.map((x) => (x.id === c.id ? c : x)));
        setAtiva(c);
        return null;
      }}
      onExcluirConta={async (senha) => {
        if (!(await senhaConfere(ativa, senha))) return "Senha incorreta.";
        await repo.excluir(ativa.id);
        setContas(contas.filter((x) => x.id !== ativa.id));
        abrir(null);
        return null;
      }}
    />
  );
}
