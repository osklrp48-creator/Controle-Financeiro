/**
 * Acesso por PIN: guarda neste aparelho o "refresh token" da sessão do Supabase,
 * cifrado (AES-GCM) com uma chave derivada do PIN (PBKDF2). Ao abrir o app, o PIN
 * decifra o token e a sessão é renovada sem pedir e-mail e senha.
 *
 * O PIN é uma comodidade do aparelho, como em apps de banco: quem tiver o aparelho
 * e o PIN entra na conta. Depois de MAX_TENTATIVAS erros o acesso salvo é apagado.
 */

export const PIN_MIN = 4;
export const PIN_MAX = 6;
export const MAX_TENTATIVAS = 5;
const ITERACOES = 310_000;
const K_REGISTRO = "orcamento:pin";

export type RegistroPin = {
  userId: string;
  email: string;
  nome: string;
  sobrenome: string;
  digitos: number;
  salt: string;
  iv: string;
  cifrado: string;
  tentativas: number;
};

export const pinValido = (pin: string): boolean => new RegExp(`^\\d{${PIN_MIN},${PIN_MAX}}$`).test(pin);

/** Recusa PINs fáceis demais de adivinhar (todos iguais ou sequência). */
export function pinFraco(pin: string): boolean {
  if (/^(\d)\1+$/.test(pin)) return true;
  const seq = "01234567890";
  const inv = "09876543210";
  return seq.includes(pin) || inv.includes(pin);
}

const b64 = (buf: ArrayBuffer | Uint8Array) => btoa(String.fromCharCode(...new Uint8Array(buf)));
const deB64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

async function derivarChave(pin: string, salt: Uint8Array): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey("raw", new TextEncoder().encode(pin), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: salt as BufferSource, iterations: ITERACOES, hash: "SHA-256" },
    base,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

async function cifrar(chave: CryptoKey, texto: string): Promise<{ iv: string; cifrado: string }> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const dados = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, chave, new TextEncoder().encode(texto));
  return { iv: b64(iv), cifrado: b64(dados) };
}

type Dono = Pick<RegistroPin, "userId" | "email" | "nome" | "sobrenome">;

/** Cria o registro do PIN; devolve também a chave, para regravar o token quando a sessão renovar. */
export async function criarRegistro(pin: string, dono: Dono, refreshToken: string) {
  if (!pinValido(pin)) throw new Error(`O PIN precisa ter de ${PIN_MIN} a ${PIN_MAX} números.`);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const chave = await derivarChave(pin, salt);
  const registro: RegistroPin = {
    ...dono,
    digitos: pin.length,
    salt: b64(salt),
    ...(await cifrar(chave, refreshToken)),
    tentativas: 0,
  };
  return { registro, chave };
}

export class PinIncorreto extends Error {
  constructor(public restantes: number) {
    super(restantes > 0 ? `PIN incorreto. ${restantes === 1 ? "Resta 1 tentativa" : `Restam ${restantes} tentativas`}.` : "PIN incorreto.");
  }
}

/** Decifra com a chave (sem contar tentativa). Lança se a chave não confere. */
export async function decifrar(chave: CryptoKey, registro: RegistroPin): Promise<string> {
  const texto = await crypto.subtle.decrypt({ name: "AES-GCM", iv: deB64(registro.iv) }, chave, deB64(registro.cifrado));
  return new TextDecoder().decode(texto);
}

/**
 * Confere o PIN. Acertando, zera as tentativas e devolve o token e a chave.
 * Errando, conta a tentativa; ao chegar no limite, `registro` volta como null (apagar).
 */
export async function abrirComPin(
  pin: string,
  registro: RegistroPin,
): Promise<{ ok: true; refreshToken: string; chave: CryptoKey; registro: RegistroPin } | { ok: false; erro: PinIncorreto; registro: RegistroPin | null }> {
  const chave = await derivarChave(pin, deB64(registro.salt));
  try {
    const refreshToken = await decifrar(chave, registro);
    return { ok: true, refreshToken, chave, registro: { ...registro, tentativas: 0 } };
  } catch {
    const tentativas = registro.tentativas + 1;
    const restantes = MAX_TENTATIVAS - tentativas;
    return { ok: false, erro: new PinIncorreto(restantes), registro: restantes > 0 ? { ...registro, tentativas } : null };
  }
}

/** Troca o token guardado (a sessão renovou) mantendo o mesmo PIN. */
export async function regravarToken(chave: CryptoKey, registro: RegistroPin, refreshToken: string): Promise<RegistroPin> {
  return { ...registro, ...(await cifrar(chave, refreshToken)) };
}

/* ---------- persistência no aparelho ---------- */

export function lerRegistro(): RegistroPin | null {
  try {
    const r = JSON.parse(localStorage.getItem(K_REGISTRO) ?? "null");
    return r && typeof r.cifrado === "string" ? r : null;
  } catch {
    return null;
  }
}

export function salvarRegistro(r: RegistroPin | null): void {
  try {
    if (r) localStorage.setItem(K_REGISTRO, JSON.stringify(r));
    else localStorage.removeItem(K_REGISTRO);
  } catch {
    /* sem localStorage: o PIN simplesmente não fica salvo */
  }
}
