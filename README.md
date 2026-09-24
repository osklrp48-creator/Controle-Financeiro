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
- **Vercel** (endereço principal): https://controlefinanceiro-nu-five.vercel.app/ — publica sozinha
  a cada push na `main`, com o app na raiz do domínio (sem `BASE_PATH`).
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
    syncStorage.ts IndexedDB + nuvem, com fila de pendências offline
    contas.ts      contas locais antigas (só para importar dados)
  nuvem.ts         cliente Supabase, sessão e erros traduzidos
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
- **Percentuais por mês:** em Ajustes fica o padrão de todos os meses. Na aba Mês, "Personalizar"
  define percentuais só para aquele mês (também precisam somar 100%); "Voltar ao padrão" desfaz.
  Um mês novo sempre começa usando o padrão, mesmo que o anterior fosse personalizado.
- **Parcelamentos:** a parcela *k* cai no mês `inicio + (k − 1)`, para *k* de 1 a *n*, e entra
  como valor da parcela no realizado da categoria. Total = parcela × n. Se o usuário informar o
  total, a parcela é total ÷ n, arredondada ao centavo.
- **Novo mês:** copia rendas e itens do mês cadastrado mais recente anterior a ele. Só itens
  marcados como **fixos** (↻) levam o valor; os demais começam sem valor. Se não houver mês anterior,
  começa com os itens sugeridos e uma renda "Salário".
- **Criação automática:** ao abrir o app ou navegar para um mês que ainda não existe, ele é criado
  sozinho quando já há um mês anterior cadastrado (ou, no primeiro uso, quando é o mês atual).
  Meses antes do primeiro cadastrado e meses excluídos na sessão continuam com o botão "Criar".

## Contas (Supabase)

O login e os dados ficam no [Supabase](https://supabase.com) (projeto configurado em `src/nuvem.ts`;
pode ser trocado pelas variáveis `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`).

- **Cadastro:** nome, sobrenome, e-mail, senha e confirmação (mínimo de 6 caracteres).
- **Login:** e-mail e senha. **Esqueci minha senha** envia um link por e-mail que abre o app na
  tela "Criar senha nova".
- Todos os campos de senha têm botão para **mostrar/ocultar**.
- **Ajustes:** sair, alterar senha (pede a atual) e excluir a conta (apaga a conta e todos os dados).
- **Sessão só com o app aberto:** a sessão fica no `sessionStorage`. Recarregar a página mantém o
  login, mas ao fechar o app (ou a aba) a pessoa sai da conta e precisa entrar de novo.
- **Sincronização:** os dados de cada usuário ficam na tabela `documentos` (um documento por mês,
  mais `config` e `parcelas`) e numa cópia no aparelho (IndexedDB). Sem internet, o app continua
  funcionando; as alterações ficam pendentes e são enviadas quando a conexão volta
  (`src/storage/syncStorage.ts`). Ao abrir com internet, vale o que está na nuvem.
- **Dados antigos:** lançamentos salvos no aparelho por versões anteriores (antes do login online)
  aparecem no card **Dados salvos neste aparelho**, com a opção de trazê-los para a conta.

### Configuração do projeto Supabase

1. Rode `supabase/schema.sql` no **SQL Editor** (cria a tabela, as regras de acesso e a função de
   excluir conta).
2. Em **Authentication → URL Configuration**, use o endereço do app
   (hoje `https://controlefinanceiro-nu-five.vercel.app/`) como **Site URL** e em **Redirect URLs**, para que
   os links de confirmação e de nova senha abram o app.
3. Por padrão o Supabase pede **confirmação de e-mail** no cadastro; o app avisa a pessoa para
   confirmar antes de entrar. O envio de e-mails do plano gratuito tem limite de poucos e-mails
   por hora; para uso maior, configure um SMTP próprio em **Authentication → Emails**.

## Retenção de 13 meses

Para o app não ficar pesado, só ficam guardados o mês atual e os **12 anteriores** (e os meses
futuros). Ao abrir uma conta, meses mais antigos são apagados, assim como parcelamentos que
terminaram antes desse período. Não dá para navegar nem criar meses antes do limite. Para manter
o histórico completo, exporte um backup antes.

## Backup

Em **Ajustes** dá para exportar e importar todos os dados em JSON.
