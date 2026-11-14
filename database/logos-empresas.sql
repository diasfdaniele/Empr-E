begin;

alter table public.empresas
  add column if not exists logo_url text;

insert into storage.buckets (id, name, public)
values ('ImagensEmpresas', 'ImagensEmpresas', true)
on conflict (id) do update set public = true;

grant select on public.usuarios to authenticated;

drop policy if exists "Empresa envia propria logo" on storage.objects;
create policy "Empresa envia propria logo" on storage.objects
for insert to authenticated with check (
  bucket_id = 'ImagensEmpresas'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and exists (
    select 1 from public.usuarios u
    where u.id_auth = (select auth.uid()) and u.tipo_pessoa = 'pj'
  )
);

drop policy if exists "Empresa remove propria logo" on storage.objects;
create policy "Empresa remove propria logo" on storage.objects
for delete to authenticated using (
  bucket_id = 'ImagensEmpresas'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

create or replace view public.empresas_publicas as
select id_empresa, nome_fantasia, logo_url, categoria_empresa
from public.empresas
where status_conta = 'Ativo';

grant select on public.empresas_publicas to anon, authenticated;

notify pgrst, 'reload schema';
commit;
