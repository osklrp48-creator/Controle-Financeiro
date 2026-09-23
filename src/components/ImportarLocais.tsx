import { useEffect, useState } from "react";
import type { Dados } from "../domain/types";
import { nomeMes } from "../domain/meses";
import { criarRepositorioContas, nomeCompleto, senhaConfere, storeDaConta, type Conta } from "../storage/contas";
import { createIdbStorage } from "../storage/idbStorage";
import type { Orcamento } from "../useOrcamento";
import { SenhaInput } from "./SenhaInput";

/** Dados de versões anteriores do app, guardados só neste aparelho (antes das contas online). */
type Candidato = { conta: Conta; dados: Dados; meses: string[] };

const chaveOcultos = (usuarioId: string) => `orcamento:importacao:${usuarioId}`;

function lerOcultos(usuarioId: string): string[] {
  try {
    return JSON.parse(localStorage.getItem(chaveOcultos(usuarioId)) ?? "[]");
  } catch {
    return [];
  }
}

function ocultar(usuarioId: string, ids: string[]) {
  try {
    localStorage.setItem(chaveOcultos(usuarioId), JSON.stringify([...new Set([...lerOcultos(usuarioId), ...ids])]));
  } catch {
    /* sem localStorage: o aviso só volta a aparecer */
  }
}

async function buscarCandidatos(): Promise<Candidato[]> {
  const contas = await criarRepositorioContas().listar();
  const out: Candidato[] = [];
  for (const conta of contas) {
    const dados = await createIdbStorage(() => {
      throw new Error("somente leitura");
    }, storeDaConta(conta.id)).load();
    const meses = Object.keys(dados.meses).sort();
    if (meses.length || dados.parcelas.length) out.push({ conta, dados, meses });
  }
  return out;
}

/**
 * Oferece trazer para a conta online os dados salvos no aparelho por versões anteriores.
 * `sempre`: mostra mesmo os que o usuário dispensou (usado em Ajustes).
 */
export function ImportarLocais({ orc, usuarioId, sempre = false }: { orc: Orcamento; usuarioId: string; sempre?: boolean }) {
  const [candidatos, setCandidatos] = useState<Candidato[]>([]);
  const [ocultos, setOcultos] = useState(() => lerOcultos(usuarioId));
  const [abrindo, setAbrindo] = useState<string | null>(null);
  const [senha, setSenha] = useState("");
  const [msg, setMsg] = useState<{ texto: string; ok: boolean } | null>(null);

  useEffect(() => {
    buscarCandidatos().then(setCandidatos).catch(() => setCandidatos([]));
  }, []);

  const visiveis = candidatos.filter((c) => sempre || !ocultos.includes(c.conta.id));
  if (!visiveis.length && !msg) return null;

  const importar = async (c: Candidato) => {
    if (c.conta.senha && !(await senhaConfere(c.conta, senha))) {
      return setMsg({ texto: "Senha incorreta para esses dados.", ok: false });
    }
    if (!confirm("Trazer esses dados para a sua conta? Os lançamentos atuais da conta serão substituídos por eles.")) return;
    await orc.importar(c.dados);
    ocultar(usuarioId, [c.conta.id]);
    setOcultos(lerOcultos(usuarioId));
    setAbrindo(null);
    setSenha("");
    setMsg({ texto: `Dados de ${nomeCompleto(c.conta)} trazidos para a sua conta.`, ok: true });
  };

  return (
    <section className="cartao importar-locais">
      <header>
        <h2>Dados salvos neste aparelho</h2>
      </header>
      {msg && <p className={`situacao ${msg.ok ? "ok" : "ruim"}`}>{msg.texto}</p>}
      {visiveis.length > 0 && (
        <>
          <p className="nota">
            Encontramos lançamentos de antes da conta online. Traga-os para a sua conta para acessá-los em qualquer aparelho.
          </p>
          <ul className="lista-parcelas">
            {visiveis.map((c) => (
              <li key={c.conta.id}>
                <div>
                  <strong>{nomeCompleto(c.conta)}</strong>
                  <small>
                    {c.meses.length
                      ? `${c.meses.length} ${c.meses.length === 1 ? "mês" : "meses"} (${nomeMes(c.meses[0], true)} a ${nomeMes(c.meses[c.meses.length - 1], true)})`
                      : "só parcelamentos"}
                  </small>
                  {abrindo === c.conta.id && (
                    <form
                      className="formulario"
                      onSubmit={(e) => {
                        e.preventDefault();
                        importar(c);
                      }}
                    >
                      {c.conta.senha && (
                        <SenhaInput rotulo="Senha antiga desses dados" valor={senha} onChange={setSenha} autoComplete="current-password" autoFocus />
                      )}
                      <div className="acoes">
                        <button type="button" onClick={() => setAbrindo(null)}>
                          Cancelar
                        </button>
                        <button className="primario">Trazer para minha conta</button>
                      </div>
                    </form>
                  )}
                </div>
                {abrindo !== c.conta.id && (
                  <button
                    onClick={() => {
                      setMsg(null);
                      setSenha("");
                      setAbrindo(c.conta.id);
                    }}
                  >
                    Trazer
                  </button>
                )}
              </li>
            ))}
          </ul>
          {!sempre && (
            <div className="acoes">
              <button
                className="link"
                onClick={() => {
                  ocultar(usuarioId, visiveis.map((c) => c.conta.id));
                  setOcultos(lerOcultos(usuarioId));
                }}
              >
                Agora não (dá para trazer depois em Ajustes)
              </button>
            </div>
          )}
        </>
      )}
    </section>
  );
}
