begin;

alter table public.produtos enable row level security;
alter table public."produtosImagens" enable row level security;

grant select, insert, update, delete on public.produtos, public."produtosImagens" to authenticated;
grant select on public.usuarios, public.empresas, public.categorias to authenticated;

do $$
declare
  v_sequence text;
begin
  v_sequence := pg_get_serial_sequence('public.produtos', 'id_produto');
  if v_sequence is not null then
    execute format('grant usage, select on sequence %s to authenticated', v_sequence);
  end if;
  v_sequence := pg_get_serial_sequence('public."produtosImagens"', 'idImagem');
  if v_sequence is not null then
    execute format('grant usage, select on sequence %s to authenticated', v_sequence);
  end if;
end;
$$;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'produtos' and policyname = 'seller_reads_own_products') then
    create policy seller_reads_own_products on public.produtos for select to authenticated
    using (exists (
      select 1 from public.empresas e join public.usuarios u on u.id_usuario = e.id_usuario
      where e.id_empresa = produtos.fk_vendedor and u.id_auth = (select auth.uid())
        and u.tipo_pessoa = 'pj' and e.status_conta = 'Ativo'
    ));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'produtosImagens' and policyname = 'seller_reads_own_product_images') then
    create policy seller_reads_own_product_images on public."produtosImagens" for select to authenticated
    using (exists (
      select 1 from public.produtos p join public.empresas e on e.id_empresa = p.fk_vendedor
        join public.usuarios u on u.id_usuario = e.id_usuario
      where p.id_produto = "produtosImagens"."idProduto" and u.id_auth = (select auth.uid())
        and u.tipo_pessoa = 'pj' and e.status_conta = 'Ativo'
    ));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'seller_reads_own_image_objects') then
    create policy seller_reads_own_image_objects on storage.objects for select to authenticated
    using (bucket_id = 'ImagensProdutos' and (storage.foldername(name))[1] = (select auth.uid())::text);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'seller_deletes_own_image_objects') then
    create policy seller_deletes_own_image_objects on storage.objects for delete to authenticated
    using (
      bucket_id = 'ImagensProdutos' and (storage.foldername(name))[1] = (select auth.uid())::text
      and exists (
        select 1 from public.empresas e join public.usuarios u on u.id_usuario = e.id_usuario
        where u.id_auth = (select auth.uid()) and u.tipo_pessoa = 'pj' and e.status_conta = 'Ativo'
      )
    );
  end if;
end;
$$;

drop policy if exists "Vendedor ativo envia imagens na propria pasta" on storage.objects;
create policy "Vendedor ativo envia imagens na propria pasta" on storage.objects
for insert to authenticated with check (
  bucket_id = 'ImagensProdutos' and (storage.foldername(name))[1] = (select auth.uid())::text
  and exists (
    select 1 from public.empresas e join public.usuarios u on u.id_usuario = e.id_usuario
    where u.id_auth = (select auth.uid()) and u.tipo_pessoa = 'pj' and e.status_conta = 'Ativo'
  )
);

create or replace function public.salvar_produto_vendedor(
  p_produto_id bigint,
  p_dados jsonb,
  p_imagens jsonb default '[]'::jsonb,
  p_remover_imagens bigint[] default '{}'::bigint[]
) returns bigint
language plpgsql security invoker set search_path = ''
as $$
declare
  v_empresa bigint;
  v_produto bigint;
  v_imagem jsonb;
  v_caminho text;
  v_variacao text;
  v_total integer;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  select e.id_empresa into v_empresa
    from public.empresas e join public.usuarios u on u.id_usuario = e.id_usuario
    where u.id_auth = auth.uid() and u.tipo_pessoa = 'pj' and e.status_conta = 'Ativo';
  if v_empresa is null then raise exception 'Active seller required' using errcode = '42501'; end if;

  if jsonb_typeof(p_dados) is distinct from 'object'
    or nullif(btrim(p_dados->>'nome_produto'), '') is null
    or length(p_dados->>'nome_produto') > 160
    or nullif(btrim(p_dados->>'descricao'), '') is null
    or length(p_dados->>'descricao') > 5000
    or coalesce(p_dados->>'tipo_compra', '') not in ('Compra', 'Sob Consulta')
    or jsonb_typeof(p_dados->'ativo') is distinct from 'boolean'
    or p_dados->>'fk_categoria' is null
    or p_dados->>'preco_unitario' is null
    or p_dados->>'estoque_atual' is null
    or p_dados->>'estoque_minimo' is null then
    raise exception 'Invalid product fields' using errcode = '22023';
  end if;
  if (p_dados->>'fk_categoria')::bigint < 1
    or (p_dados->>'preco_unitario')::numeric < 0
    or (p_dados->>'preco_unitario')::numeric > 99999999.99
    or round((p_dados->>'preco_unitario')::numeric, 2) <> (p_dados->>'preco_unitario')::numeric
    or (p_dados->>'preco_unitario')::numeric::text in ('NaN', 'Infinity', '-Infinity')
    or ((p_dados->>'tipo_compra') = 'Compra' and (p_dados->>'preco_unitario')::numeric <= 0)
    or (p_dados->>'estoque_atual')::integer < 0
    or (p_dados->>'estoque_minimo')::integer < 0 then
    raise exception 'Invalid price or stock' using errcode = '22023';
  end if;
  if jsonb_typeof(p_imagens) is distinct from 'array' or jsonb_array_length(p_imagens) > 6 then
    raise exception 'Invalid images' using errcode = '22023';
  end if;
  p_remover_imagens := coalesce(p_remover_imagens, '{}'::bigint[]);

  if p_produto_id is null then
    if cardinality(p_remover_imagens) > 0 then raise exception 'Invalid image removal' using errcode = '22023'; end if;
    insert into public.produtos (
      fk_vendedor, fk_categoria, nome_produto, descricao, preco_unitario,
      estoque_atual, estoque_minimo, tipo_compra, ativo
    ) values (
      v_empresa, (p_dados->>'fk_categoria')::bigint, btrim(p_dados->>'nome_produto'),
      btrim(p_dados->>'descricao'), (p_dados->>'preco_unitario')::numeric,
      (p_dados->>'estoque_atual')::integer, (p_dados->>'estoque_minimo')::integer,
      p_dados->>'tipo_compra', (p_dados->>'ativo')::boolean
    ) returning id_produto into v_produto;
  else
    select p.id_produto into v_produto from public.produtos p
      where p.id_produto = p_produto_id and p.fk_vendedor = v_empresa for update;
    if v_produto is null then raise exception 'Product not owned by seller' using errcode = '42501'; end if;
    update public.produtos set
      fk_categoria = (p_dados->>'fk_categoria')::bigint,
      nome_produto = btrim(p_dados->>'nome_produto'), descricao = btrim(p_dados->>'descricao'),
      preco_unitario = (p_dados->>'preco_unitario')::numeric,
      estoque_atual = (p_dados->>'estoque_atual')::integer,
      estoque_minimo = (p_dados->>'estoque_minimo')::integer,
      tipo_compra = p_dados->>'tipo_compra', ativo = (p_dados->>'ativo')::boolean
      where id_produto = v_produto and fk_vendedor = v_empresa;
  end if;

  if exists (
    select 1 from unnest(p_remover_imagens) as removida(id)
    where not exists (select 1 from public."produtosImagens" pi where pi."idImagem" = removida.id and pi."idProduto" = v_produto)
  ) then raise exception 'Image not owned by product' using errcode = '42501'; end if;

  delete from public."produtosImagens" where "idProduto" = v_produto and "idImagem" = any(p_remover_imagens);

  for v_imagem in select value from jsonb_array_elements(p_imagens) loop
    v_variacao := btrim(v_imagem->>'nome_variacao');
    v_caminho := split_part(v_imagem->>'caminho_arquivo', '/storage/v1/object/public/ImagensProdutos/', 2);
    if nullif(v_variacao, '') is null or length(v_variacao) > 80
      or coalesce(v_imagem->>'caminho_arquivo', '') not like 'https://%/storage/v1/object/public/ImagensProdutos/%'
      or coalesce(v_caminho, '') !~ ('^' || auth.uid()::text || '/[0-9a-f-]{36}\.(jpg|png|webp)$')
      or not exists (select 1 from storage.objects o where o.bucket_id = 'ImagensProdutos' and o.name = v_caminho) then
      raise exception 'Invalid image or storage ownership' using errcode = '22023';
    end if;
    if exists (select 1 from public."produtosImagens" pi where pi."idProduto" = v_produto and lower(btrim(pi.nome_variacao)) = lower(v_variacao)) then
      raise exception 'Duplicate variation' using errcode = '22023';
    end if;
    insert into public."produtosImagens" ("idProduto", nome_arquivo, caminho_arquivo, nome_variacao)
      values (v_produto, split_part(v_caminho, '/', 2), v_imagem->>'caminho_arquivo', v_variacao);
  end loop;

  select count(*) into v_total from public."produtosImagens" where "idProduto" = v_produto;
  if v_total < 1 or v_total > 6 then raise exception 'Product requires one to six images' using errcode = '22023'; end if;
  return v_produto;
end;
$$;

create or replace function public.excluir_produto_vendedor(p_produto_id bigint)
returns void language plpgsql security invoker set search_path = ''
as $$
declare
  v_empresa bigint;
  v_produto bigint;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  select e.id_empresa into v_empresa
    from public.empresas e join public.usuarios u on u.id_usuario = e.id_usuario
    where u.id_auth = auth.uid() and u.tipo_pessoa = 'pj' and e.status_conta = 'Ativo';
  if v_empresa is null then raise exception 'Active seller required' using errcode = '42501'; end if;
  select p.id_produto into v_produto from public.produtos p
    where p.id_produto = p_produto_id and p.fk_vendedor = v_empresa for update;
  if v_produto is null then raise exception 'Product not owned by seller' using errcode = '42501'; end if;
  delete from public."produtosImagens" where "idProduto" = v_produto;
  delete from public.produtos where id_produto = v_produto and fk_vendedor = v_empresa;
end;
$$;

revoke all on function public.salvar_produto_vendedor(bigint, jsonb, jsonb, bigint[]) from public, anon;
revoke all on function public.excluir_produto_vendedor(bigint) from public, anon;
grant execute on function public.salvar_produto_vendedor(bigint, jsonb, jsonb, bigint[]) to authenticated;
grant execute on function public.excluir_produto_vendedor(bigint) to authenticated;

notify pgrst, 'reload schema';
commit;