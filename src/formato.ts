const fmtBRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const fmtNum = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtPct = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });

export const brl = (v: number): string => fmtBRL.format(v);
export const num = (v: number | null): string => (v == null ? "" : fmtNum.format(v));
export const pct = (v: number): string => `${fmtPct.format(v)}%`;

/** Converte texto digitado ("1.234,56", "1234.56", "R$ 10") em número; vazio → null; inválido → undefined. */
export function lerValor(txt: string): number | null | undefined {
  let s = txt.replace(/[R$\s]/g, "");
  if (s === "") return null;
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  else if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, "");
  const v = Number(s);
  return Number.isFinite(v) ? Math.round(v * 100) / 100 : undefined;
}

export function novoId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
