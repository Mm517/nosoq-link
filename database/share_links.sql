-- ==========================================================================
-- share_links — لينكات المشاركة التلقائية (منصة nosoq-link)
-- متطبّق فعلاً على مشروع Supabase "nosoq". الملف للتوثيق / إعادة التطبيق.
-- ==========================================================================
create table if not exists public.share_links (
  code        text primary key,
  kind        text not null check (kind in ('product','store')),
  product_id  uuid references public.products(id) on delete cascade,
  store_id    uuid references public.stores(id) on delete cascade,
  target_path text not null,
  title       text,
  description text,
  image_url   text,
  clicks      integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create unique index if not exists share_links_product_uidx on public.share_links(product_id) where product_id is not null;
create unique index if not exists share_links_store_uidx   on public.share_links(store_id)   where store_id   is not null;

alter table public.share_links enable row level security;
drop policy if exists share_links_public_read on public.share_links;
create policy share_links_public_read on public.share_links for select to anon, authenticated using (true);
-- مفيش كتابة من المتصفح؛ الكتابة بس عبر التريجرز والدوال (security definer)

create or replace function public.gen_share_code() returns text
language plpgsql set search_path = public as $$
declare c text;
begin
  loop
    c := substr(md5(random()::text || clock_timestamp()::text), 1, 8);
    exit when not exists (select 1 from public.share_links where code = c);
  end loop;
  return c;
end $$;

create or replace function public.sync_product_share_link() returns trigger
language plpgsql security definer set search_path = public as $$
declare img text;
begin
  img := case when new.photos is not null and array_length(new.photos,1) >= 1 and new.photos[1] not like 'data:%' then new.photos[1] else null end;
  insert into public.share_links(code, kind, product_id, target_path, title, description, image_url)
  values (public.gen_share_code(), 'product', new.id, '/product?id=' || new.legacy_id,
          coalesce(nullif(new.name_ar,''), new.name), left(coalesce(nullif(new.description_ar,''), new.description, ''), 200), img)
  on conflict (product_id) where product_id is not null do update
    set title = excluded.title, description = excluded.description, image_url = excluded.image_url,
        target_path = excluded.target_path, updated_at = now();
  return new;
end $$;

drop trigger if exists trg_products_share_link on public.products;
create trigger trg_products_share_link after insert or update of name, name_ar, description, description_ar, photos, legacy_id
  on public.products for each row execute function public.sync_product_share_link();

create or replace function public.sync_store_share_link() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.slug is null or new.slug = '' then return new; end if;
  insert into public.share_links(code, kind, store_id, target_path, title, description, image_url)
  values (public.gen_share_code(), 'store', new.id, '/store/' || new.slug, new.name, left(coalesce(new.description,''), 200), new.logo_url)
  on conflict (store_id) where store_id is not null do update
    set title = excluded.title, description = excluded.description, image_url = excluded.image_url,
        target_path = excluded.target_path, updated_at = now();
  return new;
end $$;

drop trigger if exists trg_stores_share_link on public.stores;
create trigger trg_stores_share_link after insert or update of name, slug, description, logo_url
  on public.stores for each row execute function public.sync_store_share_link();

create or replace function public.sync_product_share_link_for(p_id uuid) returns void
language sql security definer set search_path = public as $$
  insert into public.share_links(code, kind, product_id, target_path, title, description, image_url)
  select public.gen_share_code(), 'product', p.id, '/product?id=' || p.legacy_id,
         coalesce(nullif(p.name_ar,''), p.name), left(coalesce(nullif(p.description_ar,''), p.description, ''), 200),
         case when p.photos is not null and array_length(p.photos,1) >= 1 and p.photos[1] not like 'data:%' then p.photos[1] end
  from public.products p where p.id = p_id
  on conflict (product_id) where product_id is not null do nothing;
$$;

create or replace function public.sync_store_share_link_for(p_id uuid) returns void
language sql security definer set search_path = public as $$
  insert into public.share_links(code, kind, store_id, target_path, title, description, image_url)
  select public.gen_share_code(), 'store', s.id, '/store/' || s.slug, s.name, left(coalesce(s.description,''), 200), s.logo_url
  from public.stores s where s.id = p_id and s.slug is not null and s.slug <> ''
  on conflict (store_id) where store_id is not null do nothing;
$$;

-- المتصفح بيطلب الكود من هنا (لو لسه مفيش لينك بيتعمل فوراً)
create or replace function public.ensure_share_link(p_kind text, p_ref uuid) returns text
language plpgsql security definer set search_path = public as $$
declare c text; pr public.products; st public.stores;
begin
  if p_kind = 'product' then
    select code into c from public.share_links where product_id = p_ref;
    if c is null then
      select * into pr from public.products where id = p_ref and status = 'active';
      if found then perform public.sync_product_share_link_for(pr.id); select code into c from public.share_links where product_id = p_ref; end if;
    end if;
  elsif p_kind = 'store' then
    select code into c from public.share_links where store_id = p_ref;
    if c is null then
      select * into st from public.stores where id = p_ref and status = 'active';
      if found then perform public.sync_store_share_link_for(st.id); select code into c from public.share_links where store_id = p_ref; end if;
    end if;
  end if;
  return c;
end $$;

create or replace function public.share_link_click(p_code text) returns void
language sql security definer set search_path = public as $$
  update public.share_links set clicks = clicks + 1 where code = p_code;
$$;

revoke all on function public.sync_product_share_link_for(uuid), public.sync_store_share_link_for(uuid), public.gen_share_code() from public, anon, authenticated;
grant execute on function public.ensure_share_link(text, uuid) to anon, authenticated;
grant execute on function public.share_link_click(text) to anon, authenticated;

-- لينكات للمنتجات والمتاجر الموجودة
select public.sync_product_share_link_for(id) from public.products where legacy_id is not null;
select public.sync_store_share_link_for(id) from public.stores where slug is not null and slug <> '';
