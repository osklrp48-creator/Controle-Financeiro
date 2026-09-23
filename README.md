# Orçamento

App web (PWA) de orçamento mensal pessoal, em português do Brasil. Funciona offline e guarda os dados só no aparelho (IndexedDB).

## Rodando

```bash
npm install
npm run dev        # desenvolvimento
npm test           # testes das regras (Vitest)
npm run build      # typecheck + build de produção em dist/ (com service worker)
npm run preview    # serve o build (o PWA/offline só funciona no build)
```

## Estrutura

```
src/
  domain/          regras de negócio puras (sem React) + testes
    types.ts       Item, Mes, Config, Parcelamento, Dados
    categorias.ts  categorias fixas, % e tipos padrão, itens sugeridos
    meses.ts       aritmética de chaves "AAAA-MM"
    calculos.ts    resumo do mês, parcelas, criação de mês, evolução
  storage/
    Storage.ts     interface de persistência (trocável por backend)
    idbStorage.ts  implementação em IndexedDB via idb-keyval
  useOrcamento.ts  estado do app + chamadas ao Storage
  components/      telas: Mês, Painel, Parcelas, Ajustes
```

### Trocando a persistência

`Storage` tem `load()`, `saveMonth(key)`, `saveConfig()`, `saveParcelas()` e `deleteMonth(key)`.
As escritas recebem só a chave; a implementação lê o valor atual do estado por uma função
`snapshot()` passada na construção (`createIdbStorage(snapshot)`). Para usar um backend
(ex.: Supabase), basta implementar essa interface e trocar a chamada em `useOrcamento.ts`.

## Categorias

| Chave | Nome | % padrão | Tipo padrão |
|---|---|---|---|
| `basicas` | Despesas básicas | 50 | GASTO |
| `nao` | Despesas não essenciais | 10 | GASTO |
| `prof` | Investimento profissional | 5 | GASTO |
| `metas` | Metas | 17,5 | RESERVA |
| `reserva` | Reserva financeira | 17,5 | RESERVA |

## Regras de cálculo

- **Valores:** somados em centavos para evitar erro de ponto flutuante. `real: null` significa
  "ainda não lançado" e conta como zero, mas aparece como pendente.
- **Renda do mês:** soma das rendas.
- **Orçado da categoria:** renda × % da categoria.
- **Realizado da categoria:** itens do mês + parcelas vigentes da categoria naquele mês.
- **Disponível:** orçado − realizado.
  - GASTO: negativo = **estourou** (alerta vermelho).
  - RESERVA: positivo = **falta para a meta**; guardar acima do orçado não é estouro.
- **Gastos / Reservas:** soma do realizado das categorias de cada tipo (o tipo vem da configuração).
- **Sem destino (saldo):** renda − gastos − reservas. Negativo = lançamentos acima da renda.
- **Configuração:** os percentuais precisam somar exatamente 100% para serem salvos.
- **Parcelamentos:** a parcela *k* cai no mês `inicio + (k − 1)`, para *k* de 1 a *n*, e entra
  como valor da parcela no realizado da categoria. Total = parcela × n. Se o usuário informar o
  total, a parcela é total ÷ n, arredondada ao centavo.
- **Novo mês:** copia rendas e itens do mês cadastrado mais recente anterior a ele. Só itens
  marcados como **fixos** (↻) levam o valor; os demais começam sem valor. Se não houver mês anterior,
  começa com os itens sugeridos e uma renda "Salário".

## Backup

Em **Ajustes** dá para exportar e importar todos os dados em JSON.
