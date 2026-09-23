import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { aplicarRetencao, criarMes as gerarMes, deveCriarAutomaticamente } from "./domain/calculos";
import { mesAtual } from "./domain/meses";
import type { Config, Dados, Mes, Parcelamento } from "./domain/types";
import { novoId } from "./formato";
import { storeDaConta } from "./storage/contas";
import { createIdbStorage } from "./storage/idbStorage";
import type { Storage } from "./storage/Storage";

/** Estado e persistência dos dados de uma conta. */
export function useOrcamento(contaId: string) {
  const ref = useRef<Dados | null>(null);
  const [dados, setDados] = useState<Dados | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const storage = useMemo(() => createIdbStorage(() => ref.current!, storeDaConta(contaId)), [contaId]);
  /** Meses excluídos nesta sessão: não são recriados automaticamente ao continuar na tela. */
  const excluidos = useRef(new Set<string>());

  useEffect(() => {
    storage
      .load()
      .then(async (carregados) => {
        // Meses fora dos últimos 13 (e parcelamentos quitados antes disso) são apagados.
        const { dados: d, mesesRemovidos, parcelasRemovidas } = aplicarRetencao(carregados, mesAtual());
        ref.current = d;
        setDados(d);
        await Promise.all(mesesRemovidos.map((k) => storage.deleteMonth(k)));
        if (parcelasRemovidas) await storage.saveParcelas();
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

  const criarMes = (key: string) => {
    const d = atual();
    if (d.meses[key]) return;
    excluidos.current.delete(key);
    commit({ ...d, meses: { ...d.meses, [key]: gerarMes(d, key, novoId) } }, (s) => s.saveMonth(key));
  };

  return {
    dados,
    erro,
    limparErro: () => setErro(null),

    alterarMes(key: string, fn: (m: Mes) => Mes) {
      const d = atual();
      commit({ ...d, meses: { ...d.meses, [key]: fn(d.meses[key]) } }, (s) => s.saveMonth(key));
    },

    criarMes,

    /** Cria o mês sozinho quando a regra permite (ver `deveCriarAutomaticamente`). */
    criarMesAutomatico(key: string) {
      const d = atual();
      if (!d || excluidos.current.has(key) || !deveCriarAutomaticamente(d.meses, key, mesAtual())) return;
      criarMes(key);
    },

    excluirMes(key: string) {
      excluidos.current.add(key);
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
    async importar(backup: Dados) {
      const novo = aplicarRetencao(backup, mesAtual()).dados;
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
