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

## Publicação

- **CI** (`.github/workflows/ci.yml`): testes e build em todo PR e push na `main`.
- **GitHub Pages** (`.github/workflows/deploy.yml`): cada push na `main` publica o app em
  `https://<usuário>.github.io/<repositório>/`. No celular, abra o endereço e use
  "Adicionar à tela inicial" / "Instalar app". Se a publicação falhar na primeira vez, ative
  em Settings → Pages → Source: **GitHub Actions** e rode o workflow de novo.

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
- **Criação automática:** ao abrir o app ou navegar para um mês que ainda não existe, ele é criado
  sozinho quando já há um mês anterior cadastrado (ou, no primeiro uso, quando é o mês atual).
  Meses antes do primeiro cadastrado e meses excluídos na sessão continuam com o botão "Criar".

## Contas

- O app abre na **página de login**: nome, sobrenome e senha. A lista de contas não é mostrada.
  O login não diferencia maiúsculas, acentos nem espaços extras.
- **Cadastro:** nome, sobrenome, senha e confirmação de senha (mínimo de 4 caracteres). Não pode
  haver duas contas com o mesmo nome completo no aparelho.
- Todos os campos de senha têm um botão para **mostrar/ocultar** o que foi digitado.
- Cada conta tem seus próprios meses, parcelamentos e ajustes, num banco IndexedDB separado
  (`orcamento-<id>`). A conta aberta fica lembrada até tocar em **Sair** (em Ajustes), onde também
  dá para alterar a senha e excluir a conta.
- A senha fica guardada como hash PBKDF2 e só controla o acesso pelo app: os dados **não** são
  criptografados no navegador e ficam apenas no aparelho, sem sincronizar entre aparelhos.
- Dados de versões anteriores (sem cadastro) aparecem na página de login com o botão
  **Cadastrar**, que dá nome, sobrenome e senha a eles sem perder nada.

## Retenção de 13 meses

Para o app não ficar pesado, só ficam guardados o mês atual e os **12 anteriores** (e os meses
futuros). Ao abrir uma conta, meses mais antigos são apagados, assim como parcelamentos que
terminaram antes desse período. Não dá para navegar nem criar meses antes do limite. Para manter
o histórico completo, exporte um backup antes.

## Backup

Em **Ajustes** dá para exportar e importar todos os dados em JSON.
