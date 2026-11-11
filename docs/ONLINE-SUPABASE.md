# Tabla global del Averno (Supabase)

El juego guarda los récords del Averno en una base de datos gratuita de Supabase. No hace falta servidor
propio: el juego (en GitHub Pages) habla directamente con Supabase usando la clave **pública** «anon».
Nadie puede escribir en la tabla directamente: sólo a través de la función `submit_averno`, que comprueba los
valores, guarda sólo el mejor récord de cada jugador y exige el «secreto» que cada partida genera.

## 1. Crear el proyecto

1. Entra en https://supabase.com, crea una cuenta (gratis) y un proyecto nuevo (cualquier nombre y región).
2. Cuando esté listo, abre **SQL Editor → New query**, pega todo el bloque de abajo y pulsa **Run**.

```sql
create extension if not exists pgcrypto with schema extensions;

create table if not exists public.averno_scores (
  player_id   uuid primary key,
  secret_hash text not null,
  name        text not null check (char_length(name) between 1 and 20),
  floors      int  not null check (floors between 0 and 5000),
  maps        int  not null check (maps between 0 and 1000),
  level       int  not null check (level between 1 and 200),
  team        jsonb not null default '[]'::jsonb check (jsonb_typeof(team) = 'array' and jsonb_array_length(team) <= 6),
  version     text check (char_length(version) <= 16),
  updated_at  timestamptz not null default now()
);

-- Nadie lee ni escribe la tabla directamente (no hay políticas): sólo la vista y la función de abajo
alter table public.averno_scores enable row level security;
revoke all on public.averno_scores from anon, authenticated;

-- Lo que se ve en el juego (sin el secreto)
create or replace view public.averno_board as
  select player_id, name, floors, maps, level, team, version, updated_at from public.averno_scores;
grant select on public.averno_board to anon;

-- Enviar un récord: comprueba los datos, el secreto del jugador y sólo mejora el récord
create or replace function public.submit_averno(
  p_id uuid, p_secret text, p_name text, p_floors int, p_maps int, p_level int, p_team jsonb, p_version text
) returns text
language plpgsql security definer set search_path = public, extensions as $$
declare
  r public.averno_scores;
  h text;
begin
  if p_secret is null or char_length(p_secret) < 16 then return 'bad'; end if;
  if p_floors is null or p_floors < 0 or p_floors > 5000 or p_maps < 0 or p_maps > p_floors
     or p_level < 1 or p_level > 200 or coalesce(char_length(trim(p_name)), 0) = 0 then return 'bad'; end if;
  if p_team is null or jsonb_typeof(p_team) <> 'array' or jsonb_array_length(p_team) > 6 then p_team := '[]'::jsonb; end if;
  h := encode(digest(p_secret, 'sha256'), 'hex');
  select * into r from public.averno_scores where player_id = p_id;
  if not found then
    insert into public.averno_scores (player_id, secret_hash, name, floors, maps, level, team, version)
      values (p_id, h, left(trim(p_name), 20), p_floors, p_maps, p_level, p_team, left(p_version, 16));
    return 'new';
  end if;
  if r.secret_hash <> h then return 'denied'; end if;
  if now() - r.updated_at < interval '20 seconds' then return 'slow'; end if;
  update public.averno_scores set
    name = left(trim(p_name), 20), version = left(p_version, 16), updated_at = now(),
    floors = greatest(r.floors, p_floors),
    maps   = case when p_floors > r.floors then p_maps  else r.maps  end,
    level  = case when p_floors > r.floors then p_level else r.level end,
    team   = case when p_floors > r.floors then p_team  else r.team  end
  where player_id = p_id;
  return case when p_floors > r.floors then 'best' else 'kept' end;
end $$;

revoke all on function public.submit_averno(uuid, text, text, int, int, int, jsonb, text) from public;
grant execute on function public.submit_averno(uuid, text, text, int, int, int, jsonb, text) to anon;
```

## 2. Conectar el juego

En Supabase: **Project Settings → API Keys** (también sale en el botón **Connect** de arriba). Copia:

- **Project URL** (algo como `https://abcdefgh.supabase.co`; está en **Connect** o en **Project Settings → Data API**)
- la **Publishable key** (empieza por `sb_publishable_…`). Vale también la antigua **anon public** de la pestaña
  «Legacy API Keys» (empieza por `eyJ…`). *Nunca* la **Secret key** (`sb_secret_…`) ni la `service_role`.
- La **contraseña de la base de datos** no hace falta para nada: es para conectarse directamente a Postgres.
  No la pongas en el juego ni la compartas.

Pégalas en `js/data/config.js`:

```js
online: { supabaseUrl: 'https://abcdefgh.supabase.co', supabaseKey: 'sb_publishable_...' },
```

Sube el cambio a GitHub Pages y listo: la tabla aparece en el Averno («Tabla global») y en el resumen de
cada bajada. La primera vez que un jugador termina una bajada, el juego le pregunta si quiere publicar su
récord (se publica con el nombre de su partida y su equipo: especies y niveles).

## Notas

- La clave anon es pública por diseño (va en el código del juego); lo que protege los datos es que la tabla
  no se puede escribir directamente y la función sólo acepta valores razonables.
- Como todo el juego corre en el navegador, alguien con conocimientos podría enviar un récord falso. La
  función limita los valores y la frecuencia, pero no puede comprobar la partida. Si hace falta, puedes
  borrar una fila desde **Table Editor → averno_scores**.
- Plan gratuito: de sobra para esto (miles de jugadores). Un proyecto gratuito sin uso durante una semana
  se pausa; se reactiva desde el panel.

## 3. Temporadas (v5.34)

La tabla es **por temporada**, la misma que la de la Senda (`data/endgame.js → seasons`: empieza el 2026-11-02 y
dura 42 días). Al empezar una temporada nueva la tabla aparece vacía; las anteriores se guardan y en el juego se
puede ver la temporada anterior. La temporada la calcula el servidor (`averno_season()`, hora de Madrid), así que
nadie puede enviar récords a otra.

Si ya habías ejecutado el SQL del apartado 1, ejecuta también este (una vez; no borra nada: los récords que ya
hubiera quedan en la temporada 1). **Si cambias `seasons` en el juego, cambia también la fecha y los 42 días de
`averno_season()`.**

```sql
-- v5.34: tabla por temporadas (se ejecuta una vez; se puede repetir sin problema)
alter table public.averno_scores add column if not exists season int not null default 1;
alter table public.averno_scores drop constraint if exists averno_scores_pkey;
alter table public.averno_scores add primary key (player_id, season);

-- Temporada actual: la misma cuenta que el juego (data/endgame.js → seasons: empieza el 2026-11-02, dura 42 días)
create or replace function public.averno_season() returns int
language sql stable as $$
  select greatest(1, ((now() at time zone 'Europe/Madrid')::date - date '2026-11-02') / 42 + 1)::int
$$;

drop view if exists public.averno_board;
create view public.averno_board as
  select player_id, season, name, floors, maps, level, team, version, updated_at from public.averno_scores;
grant select on public.averno_board to anon;

create or replace function public.submit_averno(
  p_id uuid, p_secret text, p_name text, p_floors int, p_maps int, p_level int, p_team jsonb, p_version text
) returns text
language plpgsql security definer set search_path = public, extensions as $$
declare
  r public.averno_scores;
  h text;
  prev text;
  s int := public.averno_season();
begin
  if p_secret is null or char_length(p_secret) < 16 then return 'bad'; end if;
  if p_floors is null or p_floors < 0 or p_floors > 5000 or p_maps < 0 or p_maps > p_floors
     or p_level < 1 or p_level > 200 or coalesce(char_length(trim(p_name)), 0) = 0 then return 'bad'; end if;
  if p_team is null or jsonb_typeof(p_team) <> 'array' or jsonb_array_length(p_team) > 6 then p_team := '[]'::jsonb; end if;
  h := encode(digest(p_secret, 'sha256'), 'hex');
  -- el secreto del jugador vale para todas las temporadas
  select secret_hash into prev from public.averno_scores where player_id = p_id limit 1;
  if prev is not null and prev <> h then return 'denied'; end if;
  select * into r from public.averno_scores where player_id = p_id and season = s;
  if not found then
    insert into public.averno_scores (player_id, season, secret_hash, name, floors, maps, level, team, version)
      values (p_id, s, h, left(trim(p_name), 20), p_floors, p_maps, p_level, p_team, left(p_version, 16));
    return 'new';
  end if;
  if now() - r.updated_at < interval '20 seconds' then return 'slow'; end if;
  update public.averno_scores set
    name = left(trim(p_name), 20), version = left(p_version, 16), updated_at = now(),
    floors = greatest(r.floors, p_floors),
    maps   = case when p_floors > r.floors then p_maps  else r.maps  end,
    level  = case when p_floors > r.floors then p_level else r.level end,
    team   = case when p_floors > r.floors then p_team  else r.team  end
  where player_id = p_id and season = s;
  return case when p_floors > r.floors then 'best' else 'kept' end;
end $$;

revoke all on function public.submit_averno(uuid, text, text, int, int, int, jsonb, text) from public;
grant execute on function public.submit_averno(uuid, text, text, int, int, int, jsonb, text) to anon;
```
