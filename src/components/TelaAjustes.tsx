import { useEffect, useState } from "react";
import { pctsValidos, somaPcts } from "../domain/calculos";
import { CATEGORIAS, configPadrao, CAT_KEYS } from "../domain/categorias";
import { mesValido, nomeMes } from "../domain/meses";
import type { Config, Dados, TipoCat } from "../domain/types";
import { lerValor, pct } from "../formato";
import type { AcoesConta } from "../App";
import { nomeDoUsuario } from "../nuvem";
import { SENHA_MINIMA } from "../validacao";
import { ImportarLocais } from "./ImportarLocais";
import { SenhaInput } from "./SenhaInput";
import type { Orcamento } from "../useOrcamento";

function SecaoConta({ conta, onSair, onAlterarSenha, onExcluirConta }: AcoesConta) {
  const [modo, setModo] = useState<"nada" | "senha" | "excluir">("nada");
  const [atual, setAtual] = useState("");
  const [nova, setNova] = useState("");
  const [confirmacao, setConfirmacao] = useState("");
  const [msg, setMsg] = useState<{ texto: string; ok: boolean } | null>(null);

  const trocar = (m: typeof modo) => {
    setModo(m);
    setAtual("");
    setNova("");
    setConfirmacao("");
    setMsg(null);
  };

  const salvarSenha = async (e: React.FormEvent) => {
    e.preventDefault();
    if (nova.length < SENHA_MINIMA) return setMsg({ texto: `A nova senha precisa ter pelo menos ${SENHA_MINIMA} caracteres.`, ok: false });
    if (nova !== confirmacao) return setMsg({ texto: "A confirmação não confere com a nova senha.", ok: false });
    const erro = await onAlterarSenha(atual, nova);
    if (erro) return setMsg({ texto: erro, ok: false });
    trocar("nada");
    setMsg({ texto: "Senha alterada.", ok: true });
  };

  const excluir = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!confirm(`Excluir a conta de ${nomeDoUsuario(conta)} e TODOS os dados dela? Isso não pode ser desfeito.`)) return;
    const erro = await onExcluirConta(atual);
    if (erro) setMsg({ texto: erro, ok: false });
  };

  return (
    <section className="cartao">
      <header>
        <h2>
          Conta <small>{nomeDoUsuario(conta)}</small>
          <small>{conta.email}</small>
        </h2>
        <button onClick={onSair}>Sair</button>
      </header>
      {msg && <p className={`situacao ${msg.ok ? "ok" : "ruim"}`}>{msg.texto}</p>}
      {modo === "nada" && (
        <div className="acoes">
          <button onClick={() => trocar("senha")}>Alterar senha</button>
          <button className="perigo" onClick={() => trocar("excluir")}>
            Excluir conta
          </button>
        </div>
      )}
      {modo === "senha" && (
        <form className="formulario" onSubmit={salvarSenha}>
          <SenhaInput rotulo="Senha atual" valor={atual} onChange={setAtual} autoComplete="current-password" />
          <SenhaInput rotulo="Nova senha" valor={nova} onChange={setNova} autoComplete="new-password" />
          <SenhaInput rotulo="Confirmação da nova senha" valor={confirmacao} onChange={setConfirmacao} autoComplete="new-password" />
          <div className="acoes">
            <button type="button" onClick={() => trocar("nada")}>
              Cancelar
            </button>
            <button className="primario" disabled={!atual || !nova}>
              Salvar senha
            </button>
          </div>
        </form>
      )}
      {modo === "excluir" && (
        <form className="formulario" onSubmit={excluir}>
          <p className="nota">Apaga a conta e todos os meses, parcelamentos e ajustes dela, na nuvem e neste aparelho.</p>
          <SenhaInput rotulo="Senha da conta" valor={atual} onChange={setAtual} autoComplete="current-password" />
          <div className="acoes">
            <button type="button" onClick={() => trocar("nada")}>
              Cancelar
            </button>
            <button className="perigo" disabled={!atual}>
              Excluir conta
            </button>
          </div>
        </form>
      )}
    </section>
  );
}

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

type Props = { dados: Dados; mesKey: string; orc: Orcamento; contaAcoes: AcoesConta };

export function TelaAjustes({ dados, mesKey, orc, contaAcoes }: Props) {
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
      <SecaoConta {...contaAcoes} />
      <ImportarLocais orc={orc} usuarioId={contaAcoes.conta.id} sempre />
      <section className="cartao">
        <header>
          <h2>Distribuição padrão da renda</h2>
          <strong className={valido ? undefined : "ruim"}>{pct(soma)}</strong>
        </header>
        <p className="nota">Cada categoria recebe um percentual da renda do mês. Os percentuais precisam somar 100%. Este é o padrão de todos os meses; para mudar só um mês, use "Personalizar" na aba Mês.</p>
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
        <p className="nota">Os dados ficam salvos na sua conta (na nuvem) e também neste aparelho, para funcionar sem internet. Só os últimos 13 meses são guardados; para manter o histórico completo, exporte um backup.</p>
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
