import { useState } from "react";

type Props = {
  rotulo: string;
  valor: string;
  onChange: (v: string) => void;
  autoComplete: "current-password" | "new-password";
  autoFocus?: boolean;
};

/** Campo de senha com botão para mostrar/ocultar o que foi digitado. */
export function SenhaInput({ rotulo, valor, onChange, autoComplete, autoFocus }: Props) {
  const [visivel, setVisivel] = useState(false);
  return (
    <label>
      {rotulo}
      <span className="campo-senha">
        <input
          type={visivel ? "text" : "password"}
          value={valor}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete}
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          autoFocus={autoFocus}
        />
        <button
          type="button"
          className="ver-senha"
          aria-label={visivel ? `Ocultar ${rotulo.toLowerCase()}` : `Mostrar ${rotulo.toLowerCase()}`}
          aria-pressed={visivel}
          title={visivel ? "Ocultar senha" : "Mostrar senha"}
          onClick={() => setVisivel(!visivel)}
        >
          {visivel ? (
            <svg viewBox="0 0 24 24" aria-hidden>
              <path d="M3 3l18 18M10.6 6.1A10.7 10.7 0 0 1 12 6c5 0 9 4.5 10 6-.5.8-1.6 2.2-3.2 3.5M6.6 7.6C4.6 8.9 3.1 10.8 2 12c1 1.5 5 6 10 6 1.6 0 3-.4 4.3-1.1M9.9 9.9a3 3 0 0 0 4.2 4.2" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" aria-hidden>
              <path d="M2 12c1-1.5 5-6 10-6s9 4.5 10 6c-1 1.5-5 6-10 6S3 13.5 2 12z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          )}
        </button>
      </span>
    </label>
  );
}
