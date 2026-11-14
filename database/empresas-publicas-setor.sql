begin;

create or replace view public.empresas_publicas as
select id_empresa, nome_fantasia, logo_url, categoria_empresa
from public.empresas
where status_conta = 'Ativo';

grant select on public.empresas_publicas to anon, authenticated;

notify pgrst, 'reload schema';
commit;
