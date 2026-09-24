import { useEffect, useRef, useState } from "react";
import { MAX_TENTATIVAS, PIN_MAX, PIN_MIN, pinFraco, pinValido } from "../pin";
import { SenhaInput } from "./SenhaInput";

type TelaPinProps = {
  nome: string;
  digitos: number;
  /** Devolve a mensagem de erro, ou null se entrou. */
  onConfirmar: (pin: string) => Promise<string | null>;
  onUsarSenha: () => void;
  onEsquecer: () => void;
  aviso?: string;
};

const TECLAS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "⌫"];

/** Tela de desbloqueio com teclado numérico. Confere sozinha ao completar os dígitos. */
export function TelaPin({ nome, digitos, onConfirmar, onUsarSenha, onEsquecer, aviso }: TelaPinProps) {
  const [pin, setPin] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [conferindo, setConferindo] = useState(false);
  const confirmar = useRef(onConfirmar);
  confirmar.current = onConfirmar;

  const teclar = (t: string) => {
    if (conferindo) return;
    setErro(null);
    if (t === "⌫") setPin((p) => p.slice(0, -1));
    else if (/\d/.test(t)) setPin((p) => (p.length < digitos ? p + t : p));
  };

  useEffect(() => {
    const aoTeclar = (e: KeyboardEvent) => {
      if (/^\d$/.test(e.key)) teclar(e.key);
      else if (e.key === "Backspace") teclar("⌫");
    };
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  });

  useEffect(() => {
    if (pin.length !== digitos) return;
    setConferindo(true);
    confirmar.current(pin).then((falha) => {
      setConferindo(false);
      if (falha) {
        setErro(falha);
        setPin("");
      }
    });
  }, [pin, digitos]);

  return (
    <div className="app entrada">
      <header className="topo">
        <h1>Orçamento</h1>
      </header>
      <main>
        <section className="cartao tela-pin">
          <p className="ola">Olá, {nome}</p>
          <h2>Digite seu PIN</h2>
          {aviso && <p className="situacao atencao">{aviso}</p>}
          <div className={`pontos${erro ? " errou" : ""}`} aria-label={`${pin.length} de ${digitos} números digitados`}>
            {Array.from({ length: digitos }, (_, i) => (
              <span key={i} className={i < pin.length ? "cheio" : undefined} />
            ))}
          </div>
          <p className="situacao ruim msg-pin" role="alert">
            {erro ?? (conferindo ? "" : " ")}
          </p>
          <div className="teclado">
            {TECLAS.map((t, i) =>
              t ? (
                <button
                  key={i}
                  type="button"
                  className={t === "⌫" ? "apagar" : undefined}
                  aria-label={t === "⌫" ? "Apagar" : t}
                  disabled={conferindo}
                  onClick={() => teclar(t)}
                >
                  {t}
                </button>
              ) : (
                <span key={i} />
              ),
            )}
          </div>
          {conferindo && <p className="nota">Entrando…</p>}
          <p className="alternativa">
            <button type="button" className="link" onClick={onUsarSenha}>
              Entrar com e-mail e senha
            </button>
          </p>
          <p className="alternativa">
            <button
              type="button"
              className="link discreto"
              onClick={() => confirm(`Remover o acesso por PIN de ${nome} deste aparelho?`) && onEsquecer()}
            >
              Não é você? Remover deste aparelho
            </button>
          </p>
        </section>
      </main>
    </div>
  );
}

/** Formulário para criar (ou trocar) o PIN deste aparelho. */
export function CriarPin({ onCriar, onCancelar }: { onCriar: (pin: string) => Promise<string | null>; onCancelar?: () => void }) {
  const [pin, setPin] = useState("");
  const [confirmacao, setConfirmacao] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  return (
    <form
      className="formulario"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!pinValido(pin)) return setErro(`O PIN precisa ter de ${PIN_MIN} a ${PIN_MAX} números.`);
        if (pinFraco(pin)) return setErro("Esse PIN é fácil de adivinhar. Evite números repetidos ou em sequência.");
        if (pin !== confirmacao) return setErro("A confirmação não confere com o PIN.");
        setSalvando(true);
        setErro(await onCriar(pin));
        setSalvando(false);
      }}
    >
      <div className="linha">
        <SenhaInput rotulo="PIN" valor={pin} onChange={setPin} autoComplete="new-password" numerico autoFocus />
        <SenhaInput rotulo="Confirme o PIN" valor={confirmacao} onChange={setConfirmacao} autoComplete="new-password" numerico />
      </div>
      <p className="nota">
        De {PIN_MIN} a {PIN_MAX} números. Vale só neste aparelho; depois de {MAX_TENTATIVAS} erros seguidos ele é apagado e será preciso entrar com
        e-mail e senha.
      </p>
      {erro && (
        <p className="situacao ruim" role="alert">
          {erro}
        </p>
      )}
      <div className="acoes">
        {onCancelar && (
          <button type="button" onClick={onCancelar}>
            Cancelar
          </button>
        )}
        <button className="primario" disabled={salvando}>
          {salvando ? "Salvando…" : "Salvar PIN"}
        </button>
      </div>
    </form>
  );
}

const chaveDispensa = (usuarioId: string) => `orcamento:pin-dispensado:${usuarioId}`;

/** Convite, depois do login, para criar um PIN neste aparelho. */
export function SugestaoPin({ usuarioId, onCriar }: { usuarioId: string; onCriar: (pin: string) => Promise<string | null> }) {
  const [dispensado, setDispensado] = useState(() => {
    try {
      return localStorage.getItem(chaveDispensa(usuarioId)) === "1";
    } catch {
      return false;
    }
  });
  const [criando, setCriando] = useState(false);
  if (dispensado) return null;

  const dispensar = () => {
    try {
      localStorage.setItem(chaveDispensa(usuarioId), "1");
    } catch {
      /* só volta a aparecer */
    }
    setDispensado(true);
  };

  return (
    <section className="cartao sugestao-pin">
      <header>
        <h2>Entre mais rápido com um PIN</h2>
      </header>
      {criando ? (
        <CriarPin onCriar={onCriar} onCancelar={() => setCriando(false)} />
      ) : (
        <>
          <p className="nota">Ao abrir o app neste aparelho, digite só o PIN em vez do e-mail e da senha.</p>
          <div className="acoes">
            <button className="link" onClick={dispensar}>
              Agora não
            </button>
            <button className="primario" onClick={() => setCriando(true)}>
              Criar PIN
            </button>
          </div>
        </>
      )}
    </section>
  );
}

/** Seção de Ajustes: criar, trocar ou remover o PIN deste aparelho. */
export function SecaoPin({ ativo, onCriar, onRemover }: { ativo: boolean; onCriar: (pin: string) => Promise<string | null>; onRemover: () => void }) {
  const [editando, setEditando] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <section className="cartao">
      <header>
        <h2>
          Acesso por PIN <small>{ativo ? "ativo neste aparelho" : "desativado"}</small>
        </h2>
      </header>
      {msg && <p className="situacao ok">{msg}</p>}
      {editando ? (
        <CriarPin
          onCriar={async (pin) => {
            const falha = await onCriar(pin);
            if (!falha) {
              setEditando(false);
              setMsg(ativo ? "PIN alterado." : "PIN criado. Na próxima vez, entre só com ele.");
            }
            return falha;
          }}
          onCancelar={() => setEditando(false)}
        />
      ) : (
        <>
          <p className="nota">
            {ativo
              ? "Ao abrir o app, basta digitar o PIN. Tocar em Sair apenas tranca o app; o PIN continua valendo."
              : "Crie um PIN para entrar neste aparelho sem digitar e-mail e senha."}
          </p>
          <div className="acoes">
            {ativo && (
              <button
                className="perigo"
                onClick={() => {
                  if (!confirm("Remover o PIN deste aparelho? Depois será preciso entrar com e-mail e senha.")) return;
                  onRemover();
                  setMsg("PIN removido deste aparelho.");
                }}
              >
                Remover PIN
              </button>
            )}
            <button
              className={ativo ? undefined : "primario"}
              onClick={() => {
                setMsg(null);
                setEditando(true);
              }}
            >
              {ativo ? "Trocar PIN" : "Criar PIN"}
            </button>
          </div>
        </>
      )}
    </section>
  );
}
