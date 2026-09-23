const RE_MES = /^(\d{4})-(0[1-9]|1[0-2])$/;

export function mesValido(key: string): boolean {
  return RE_MES.test(key);
}

function partes(key: string): [number, number] {
  const m = RE_MES.exec(key);
  if (!m) throw new Error(`Mês inválido: ${key}`);
  return [Number(m[1]), Number(m[2])];
}

export function mesKey(ano: number, mes: number): string {
  return `${ano}-${String(mes).padStart(2, "0")}`;
}

export function mesAtual(hoje = new Date()): string {
  return mesKey(hoje.getFullYear(), hoje.getMonth() + 1);
}

export function somarMeses(key: string, delta: number): string {
  const [a, m] = partes(key);
  const idx = a * 12 + (m - 1) + delta;
  return mesKey(Math.floor(idx / 12), (idx % 12) + 1);
}

/** Quantos meses separam `de` e `ate` (positivo se `ate` for depois). */
export function difMeses(de: string, ate: string): number {
  const [a1, m1] = partes(de);
  const [a2, m2] = partes(ate);
  return (a2 - a1) * 12 + (m2 - m1);
}

const NOMES = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

export function nomeMes(key: string, curto = false): string {
  const [a, m] = partes(key);
  const nome = NOMES[m - 1];
  if (curto) return `${nome.slice(0, 3)}/${String(a).slice(2)}`;
  return `${nome[0].toUpperCase()}${nome.slice(1)} de ${a}`;
}
