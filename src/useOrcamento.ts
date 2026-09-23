import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { criarMes as gerarMes } from "./domain/calculos";
import type { Config, Dados, Mes, Parcelamento } from "./domain/types";
import { novoId } from "./formato";
import { createIdbStorage } from "./storage/idbStorage";
import type { Storage } from "./storage/Storage";

export function useOrcamento() {
  const ref = useRef<Dados | null>(null);
  const [dados, setDados] = useState<Dados | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const storage = useMemo(() => createIdbStorage(() => ref.current!), []);

  useEffect(() => {
    storage
      .load()
      .then((d) => {
        ref.current = d;
        setDados(d);
      })
      .catch((e) => setErro(`Não foi possível abrir os dados: ${e}`));
  }, [storage]);

  const commit = useCallback(
    (novo: Dados, salvar: (s: Storage) => Promise<void>) => {
      ref.current = novo;
      setDados(novo);
      salvar(storage).catch((e) => setErro(`Falha ao salvar: ${e}`));
    },
    [storage],
  );

  const atual = () => ref.current!;

  return {
    dados,
    erro,
    limparErro: () => setErro(null),

    alterarMes(key: string, fn: (m: Mes) => Mes) {
      const d = atual();
      commit({ ...d, meses: { ...d.meses, [key]: fn(d.meses[key]) } }, (s) => s.saveMonth(key));
    },

    criarMes(key: string) {
      const d = atual();
      commit({ ...d, meses: { ...d.meses, [key]: gerarMes(d, key, novoId) } }, (s) => s.saveMonth(key));
    },

    excluirMes(key: string) {
      const d = atual();
      const meses = { ...d.meses };
      delete meses[key];
      commit({ ...d, meses }, (s) => s.deleteMonth(key));
    },

    salvarConfig(config: Config) {
      commit({ ...atual(), config }, (s) => s.saveConfig());
    },

    salvarParcelas(parcelas: Parcelamento[]) {
      commit({ ...atual(), parcelas }, (s) => s.saveParcelas());
    },

    /** Substitui tudo (restauração de backup). */
    async importar(novo: Dados) {
      const antigos = Object.keys(atual().meses);
      commit(novo, async (s) => {
        await Promise.all(antigos.filter((k) => !(k in novo.meses)).map((k) => s.deleteMonth(k)));
        await Promise.all(Object.keys(novo.meses).map((k) => s.saveMonth(k)));
        await s.saveConfig();
        await s.saveParcelas();
      });
    },
  };
}

export type Orcamento = ReturnType<typeof useOrcamento>;
