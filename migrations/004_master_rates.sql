alter table production_rates add column if not exists variant_key text;
alter table production_rates add column if not exists trade text not null default '';
alter table production_rates add column if not exists is_default boolean not null default false;

update production_rates
set variant_key = activity_key
where variant_key is null or variant_key = '';

update production_rates
set is_default = true
where variant_key = activity_key;

alter table production_rates drop constraint if exists production_rates_owner_id_activity_key_key;

create unique index if not exists production_rates_owner_variant_idx
  on production_rates (owner_id, variant_key);
