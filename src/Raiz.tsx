import { useEffect, useMemo, useState } from "react";
import { App } from "./App";
import { TelaEntrada } from "./components/TelaEntrada";
import { novoId } from "./formato";
import { contaDaSessao, criarRepositorioContas, salvarSessao, type Conta } from "./storage/contas";

const mensagem = (e: unknown) => (e instanceof Error ? e.message : String(e));

/** Página de login/cadastro; com uma conta aberta, mostra o app com os dados dela. */
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
        // Só reabre sozinha uma conta com cadastro completo (com senha).
        const sessao = lista.find((c) => c.id === contaDaSessao() && c.senha);
        setAtiva(sessao ?? null);
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
        semCadastro={contas.filter((c) => !c.senha)}
        onEntrar={async (nome, sobrenome, senha) => {
          try {
            abrir(await repo.entrar(nome, sobrenome, senha));
            return null;
          } catch (e) {
            return mensagem(e);
          }
        }}
        onCadastrar={async (nome, sobrenome, senha, contaAntiga) => {
          try {
            const c = contaAntiga
              ? await repo.cadastrarExistente(contaAntiga.id, nome, sobrenome, senha)
              : await repo.cadastrar(nome, sobrenome, senha, novoId());
            setContas([...contas.filter((x) => x.id !== c.id), c]);
            abrir(c);
            return null;
          } catch (e) {
            return mensagem(e);
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
      onAlterarSenha={async (atual, nova) => {
        try {
          const c = await repo.alterarSenha(ativa.id, atual, nova);
          setContas(contas.map((x) => (x.id === c.id ? c : x)));
          setAtiva(c);
          return null;
        } catch (e) {
          return mensagem(e);
        }
      }}
      onExcluirConta={async (senha) => {
        try {
          await repo.excluir(ativa.id, senha);
          setContas(contas.filter((x) => x.id !== ativa.id));
          abrir(null);
          return null;
        } catch (e) {
          return mensagem(e);
        }
      }}
    />
  );
}
