-- Esquema do app Orçamento no Supabase. Rode no SQL Editor do projeto.

-- Documentos de cada usuário: "mes:AAAA-MM", "config" e "parcelas".
create table public.documentos (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  chave text not null,
  dados jsonb not null,
  atualizado_em timestamptz not null default now(),
  primary key (user_id, chave)
);

-- Cada usuário só enxerga e altera os próprios documentos.
alter table public.documentos enable row level security;

create policy "dono lê"     on public.documentos for select using (auth.uid() = user_id);
create policy "dono insere" on public.documentos for insert with check (auth.uid() = user_id);
create policy "dono altera" on public.documentos for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "dono apaga"  on public.documentos for delete using (auth.uid() = user_id);

-- Permite que o próprio usuário exclua a conta (e, em cascata, os documentos).
create function public.excluir_minha_conta() returns void
language sql security definer set search_path = public as $$
  delete from auth.users where id = auth.uid();
$$;
revoke execute on function public.excluir_minha_conta() from public, anon;
grant execute on function public.excluir_minha_conta() to authenticated;
