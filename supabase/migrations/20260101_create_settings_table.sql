-- Create settings key/value store for connectorVersionSettings edge function
create table if not exists public.settings (
  id bigserial primary key,
  key text not null unique,
  value text not null default '{}'::text,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

-- Ensure consistent update timestamps
create or replace function public.set_settings_updated_at()
returns trigger as $$
begin
  new.updated_at = timezone('utc'::text, now());
  return new;
end;
$$ language plpgsql;

drop trigger if exists set_settings_updated_at on public.settings;
create trigger set_settings_updated_at
before update on public.settings
for each row execute function public.set_settings_updated_at();

-- Optional seed for connector_version key
insert into public.settings (key, value)
values ('connector_version', '{"version": null, "url": null}')
on conflict (key) do nothing;
