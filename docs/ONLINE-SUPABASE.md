# Tablas globales, perfiles y amigos (Supabase)

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

## 4. Relé de los intercambios (v5.37)

Los intercambios usan la misma base de datos como «buzón»: cada jugador deja sus mensajes en la sala (código de 6
caracteres) y recoge los del otro cada segundo. Así funcionan en cualquier red (también de móvil a móvil, donde las
conexiones directas suelen fallar) y aunque uno salga un momento de la app para pasar el código. Los mensajes se
borran solos a las 3 horas. Si este SQL no está ejecutado, el juego usa la conexión directa (PeerJS) como antes.

```sql
-- v5.37: relé para los intercambios (funciona de móvil a móvil y aunque salgas un momento de la app)
create table if not exists public.trade_msgs (
  id         bigint generated always as identity primary key,
  room       text not null check (room ~ '^[A-Z0-9]{6}$'),
  sender     text not null check (char_length(sender) between 4 and 40),
  body       jsonb not null,
  created_at timestamptz not null default now()
);
create index if not exists trade_msgs_room_id on public.trade_msgs (room, id);
create index if not exists trade_msgs_created on public.trade_msgs (created_at);
alter table public.trade_msgs enable row level security;
revoke all on public.trade_msgs from anon, authenticated;

-- Dejar un mensaje en una sala (con límite de mensajes por minuto; los de hace más de 3 horas se borran)
create or replace function public.trade_send(p_room text, p_sender text, p_body jsonb) returns bigint
language plpgsql security definer set search_path = public as $$
declare n int; new_id bigint;
begin
  if p_room is null or p_room !~ '^[A-Z0-9]{6}$' or p_sender is null or char_length(p_sender) not between 4 and 40
     or p_body is null or pg_column_size(p_body) > 20000 then return -1; end if;
  select count(*) into n from public.trade_msgs where room = p_room and created_at > now() - interval '1 minute';
  if n > 200 then return -2; end if;
  delete from public.trade_msgs where created_at < now() - interval '3 hours';
  insert into public.trade_msgs (room, sender, body) values (p_room, p_sender, p_body) returning id into new_id;
  return new_id;
end $$;

-- Recoger los mensajes de una sala posteriores a uno dado
create or replace function public.trade_poll(p_room text, p_after bigint) returns table (id bigint, sender text, body jsonb)
language sql stable security definer set search_path = public as $$
  select m.id, m.sender, m.body from public.trade_msgs m
  where m.room = p_room and m.id > coalesce(p_after, 0) and m.created_at > now() - interval '3 hours'
  order by m.id limit 100
$$;

revoke all on function public.trade_send(text, text, jsonb) from public;
revoke all on function public.trade_poll(text, bigint) from public;
grant execute on function public.trade_send(text, text, jsonb) to anon;
grant execute on function public.trade_poll(text, bigint) to anon;
```


## 5. Perfiles, más tablas, amigos y buzón (v5.39)

Ejecuta este bloque **una vez** en *SQL Editor → New query*. Se puede volver a ejecutar sin romper nada.
Añade:

- **players**: perfil público por ID de entrenador (nombre, título, avatar, daskai favorito, equipo y récords). Cada partida tiene un secreto; el servidor sólo guarda su huella.
- **scores**: cuatro tablas nuevas, cada una con su periodo: `depth` (expedición más profunda), `abyss` (jefes seguidos), `shiny` (variocolores de la temporada) y `weekly` (desafío semanal, se reinicia cada lunes). Guarda el equipo completo (atributos, ataques, talentos, equipo) y las reliquias.
- **Averno**: ahora también guarda las reliquias y comprueba el tiempo de juego.
- **friends / inbox**: amigos por ID; regalos (una poción al día por amigo), mensajes de 140 caracteres e invitaciones a intercambiar. Sólo entre amigos mutuos; los mensajes y las invitaciones se borran a las 24 h y los regalos a los 7 días.
- **Contra las trampas**: topes por tabla, récords imposibles según el tiempo de juego (y el tiempo de juego no puede crecer más rápido que el reloj), un envío cada 15 s, saltos sospechosos marcados (`flagged`) y ocultos hasta revisarlos, denuncias (`reports`) y baneo por ID (`bans`). En el juego, la partida se firma al guardar: si alguien la edita a mano deja de publicar.

```sql
-- =====================================================================
-- Daskai v5.39: perfiles públicos, más tablas, amigos, buzón y contramedidas contra trampas.
-- Se ejecuta UNA vez (se puede repetir sin problema: no borra datos).
-- =====================================================================
create extension if not exists pgcrypto with schema extensions;

-- ---------- Bloqueos (para banear un ID de entrenador) ----------
-- Para banear:    insert into public.bans (trainer_id, reason) values ('ABC123', 'trampas');
-- Para perdonar:  delete from public.bans where trainer_id = 'ABC123';
create table if not exists public.bans (
  trainer_id text primary key,
  reason     text,
  created_at timestamptz not null default now()
);
alter table public.bans enable row level security;
revoke all on public.bans from anon, authenticated;

-- ---------- Perfiles públicos ----------
create table if not exists public.players (
  player_id   uuid primary key,
  trainer_id  text not null unique check (trainer_id ~ '^[A-Z0-9]{6}$'),
  secret_hash text not null,
  name        text not null check (char_length(name) between 1 and 20),
  title       text check (char_length(title) <= 40),
  avatar      jsonb check (coalesce(pg_column_size(avatar), 0) < 2000),
  fav         jsonb check (coalesce(pg_column_size(fav), 0) < 6000),
  team        jsonb check (coalesce(pg_column_size(team), 0) < 30000),
  records     jsonb check (coalesce(pg_column_size(records), 0) < 4000),
  playtime    int not null default 0,
  updated_at  timestamptz not null default now(),
  created_at  timestamptz not null default now()
);
alter table public.players enable row level security;
revoke all on public.players from anon, authenticated;

create or replace view public.players_public as
  select p.trainer_id, p.name, p.title, p.avatar, p.fav, p.team, p.records, p.playtime, p.updated_at, p.created_at
  from public.players p where not exists (select 1 from public.bans b where b.trainer_id = p.trainer_id);
grant select on public.players_public to anon;

-- Comprueba el secreto de un jugador (y que no esté baneado). Uso interno.
create or replace function public._dk_me(p_id uuid, p_secret text) returns public.players
language plpgsql security definer set search_path = public, extensions as $$
declare r public.players;
begin
  select * into r from public.players where player_id = p_id;
  if not found then raise exception 'noprofile'; end if;
  if r.secret_hash <> encode(digest(coalesce(p_secret, ''), 'sha256'), 'hex') then raise exception 'denied'; end if;
  if exists (select 1 from public.bans b where b.trainer_id = r.trainer_id) then raise exception 'banned'; end if;
  return r;
end $$;
revoke all on function public._dk_me(uuid, text) from public, anon, authenticated;

-- Crear o actualizar tu perfil público
create or replace function public.profile_save(
  p_id uuid, p_secret text, p_tid text, p_name text, p_title text, p_avatar jsonb, p_fav jsonb, p_team jsonb, p_records jsonb, p_playtime int
) returns text
language plpgsql security definer set search_path = public, extensions as $$
declare r public.players; h text := encode(digest(coalesce(p_secret, ''), 'sha256'), 'hex'); pt int;
begin
  if p_secret is null or char_length(p_secret) < 16 or p_tid is null or p_tid !~ '^[A-Z0-9]{6}$'
     or coalesce(char_length(trim(p_name)), 0) = 0 then return 'bad'; end if;
  if exists (select 1 from public.bans b where b.trainer_id = p_tid) then return 'banned'; end if;
  select * into r from public.players where player_id = p_id;
  if not found then
    if exists (select 1 from public.players where trainer_id = p_tid) then return 'tid_taken'; end if;
    -- el mismo secreto que ya usaba en la tabla del Averno (si tenía récords)
    if exists (select 1 from public.averno_scores a where a.player_id = p_id and a.secret_hash <> h) then return 'denied'; end if;
    insert into public.players (player_id, trainer_id, secret_hash, name, title, avatar, fav, team, records, playtime)
      values (p_id, p_tid, h, left(trim(p_name), 20), left(p_title, 40), p_avatar, p_fav, p_team, p_records, greatest(0, least(coalesce(p_playtime, 0), 10000000)));
    return 'new';
  end if;
  if r.secret_hash <> h then return 'denied'; end if;
  if exists (select 1 from public.bans b where b.trainer_id = r.trainer_id) then return 'banned'; end if;
  if now() - r.updated_at < interval '10 seconds' then return 'slow'; end if;
  if p_tid <> r.trainer_id and exists (select 1 from public.players where trainer_id = p_tid) then return 'tid_taken'; end if;
  -- el tiempo de juego no puede crecer más deprisa que el tiempo real
  pt := least(greatest(r.playtime, coalesce(p_playtime, 0)), r.playtime + extract(epoch from (now() - r.updated_at))::int + 120);
  update public.players set trainer_id = p_tid, name = left(trim(p_name), 20), title = left(p_title, 40), avatar = p_avatar,
    fav = p_fav, team = p_team, records = p_records, playtime = pt, updated_at = now()
  where player_id = p_id;
  return 'ok';
end $$;

-- ---------- Más tablas: profundidad, desafío semanal, Abismo y variocolores ----------
create table if not exists public.scores (
  player_id  uuid not null references public.players(player_id) on delete cascade,
  board      text not null check (board in ('depth', 'weekly', 'abyss', 'shiny')),
  period     int  not null,
  value      int  not null check (value >= 0),
  build      jsonb check (coalesce(pg_column_size(build), 0) < 30000),
  flagged    boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (player_id, board, period)
);
create index if not exists scores_board_idx on public.scores (board, period, value desc);
alter table public.scores enable row level security;
revoke all on public.scores from anon, authenticated;

-- Semana del desafío semanal (la misma cuenta que el juego: empieza el lunes 2026-01-05)
create or replace function public.dk_week() returns int
language sql stable as $$ select (((now() at time zone 'Europe/Madrid')::date - date '2026-01-05') / 7 + 1)::int $$;

-- Las tablas que se ven: sin baneados ni récords marcados como sospechosos
create or replace view public.scores_board as
  select s.board, s.period, s.value, s.build, s.updated_at, p.trainer_id, p.name, p.avatar, p.title
  from public.scores s join public.players p on p.player_id = s.player_id
  where not s.flagged and not exists (select 1 from public.bans b where b.trainer_id = p.trainer_id);
grant select on public.scores_board to anon;

-- Enviar un récord. Comprueba: secreto, baneo, topes, que sea posible con tu tiempo de juego, frecuencia,
-- y marca como sospechoso (no se ve hasta revisarlo) un salto demasiado grande respecto a tu récord anterior.
create or replace function public.submit_score(p_id uuid, p_secret text, p_board text, p_value int, p_build jsonb, p_playtime int)
returns text
language plpgsql security definer set search_path = public, extensions as $$
declare me public.players; per int; cap int; maxv numeric; mins numeric; old public.scores; pt int;
begin
  begin me := public._dk_me(p_id, p_secret); exception when others then return sqlerrm; end;
  if p_board not in ('depth', 'weekly', 'abyss', 'shiny') or p_value is null or p_value < 0 then return 'bad'; end if;
  per := case when p_board = 'weekly' then public.dk_week() else public.averno_season() end;
  -- tiempo de juego: el que diga el juego, pero nunca más del que pudo pasar desde la última vez
  pt := least(greatest(me.playtime, coalesce(p_playtime, 0)), me.playtime + extract(epoch from (now() - me.updated_at))::int + 120);
  update public.players set playtime = pt where player_id = p_id;
  mins := pt / 60.0;
  cap := case p_board when 'depth' then 300 when 'abyss' then 1000 when 'shiny' then 3000 else 200000 end;
  maxv := case p_board when 'depth' then 3 + mins / 2 when 'abyss' then 3 + mins when 'shiny' then 5 + mins / 2 else 3000 + mins * 400 end;
  if p_value > cap or p_value > maxv then return 'bad'; end if;
  select * into old from public.scores where player_id = p_id and board = p_board and period = per;
  if not found then
    insert into public.scores (player_id, board, period, value, build) values (p_id, p_board, per, p_value, p_build);
    return 'new';
  end if;
  if now() - old.updated_at < interval '15 seconds' then return 'slow'; end if;
  if p_value <= old.value then return 'kept'; end if;
  update public.scores set value = p_value, build = p_build, updated_at = now(),
    flagged = old.flagged or (old.value > 0 and p_value > old.value * 4 + 30)
  where player_id = p_id and board = p_board and period = per;
  return 'best';
end $$;

-- ---------- El Averno: mismas contramedidas (baneo, tiempo de juego) y reliquias del récord ----------
alter table public.averno_scores add column if not exists relics jsonb not null default '[]'::jsonb;
alter table public.averno_scores add column if not exists flagged boolean not null default false;

drop view if exists public.averno_board;
create view public.averno_board as
  select a.player_id, a.season, a.name, a.floors, a.maps, a.level, a.team, a.relics, a.version, a.updated_at, p.trainer_id
  from public.averno_scores a left join public.players p on p.player_id = a.player_id
  where not a.flagged and (p.trainer_id is null or not exists (select 1 from public.bans b where b.trainer_id = p.trainer_id));
grant select on public.averno_board to anon;

drop function if exists public.submit_averno(uuid, text, text, int, int, int, jsonb, text);
create or replace function public.submit_averno(
  p_id uuid, p_secret text, p_name text, p_floors int, p_maps int, p_level int, p_team jsonb, p_version text,
  p_relics jsonb default '[]'::jsonb, p_playtime int default null
) returns text
language plpgsql security definer set search_path = public, extensions as $$
declare
  r public.averno_scores; h text; prev text; s int := public.averno_season(); pl public.players; pt int;
begin
  if p_secret is null or char_length(p_secret) < 16 then return 'bad'; end if;
  if p_floors is null or p_floors < 0 or p_floors > 5000 or p_maps < 0 or p_maps > p_floors
     or p_level < 1 or p_level > 200 or coalesce(char_length(trim(p_name)), 0) = 0 then return 'bad'; end if;
  if p_team is null or jsonb_typeof(p_team) <> 'array' or jsonb_array_length(p_team) > 6 or pg_column_size(p_team) > 30000 then p_team := '[]'::jsonb; end if;
  if p_relics is null or jsonb_typeof(p_relics) <> 'array' or jsonb_array_length(p_relics) > 60 then p_relics := '[]'::jsonb; end if;
  h := encode(digest(p_secret, 'sha256'), 'hex');
  select secret_hash into prev from public.averno_scores where player_id = p_id limit 1;
  if prev is not null and prev <> h then return 'denied'; end if;
  -- si tiene perfil: baneo y tiempo de juego (cada piso lleva su tiempo)
  select * into pl from public.players where player_id = p_id;
  if found then
    if pl.secret_hash <> h then return 'denied'; end if;
    if exists (select 1 from public.bans b where b.trainer_id = pl.trainer_id) then return 'banned'; end if;
    pt := least(greatest(pl.playtime, coalesce(p_playtime, 0)), pl.playtime + extract(epoch from (now() - pl.updated_at))::int + 120);
    update public.players set playtime = pt where player_id = p_id;
    if p_floors > 30 + (pt / 60.0) * 6 then return 'bad'; end if;
  elsif p_playtime is not null and p_floors > 30 + (p_playtime / 60.0) * 6 then return 'bad';
  end if;
  select * into r from public.averno_scores where player_id = p_id and season = s;
  if not found then
    insert into public.averno_scores (player_id, season, secret_hash, name, floors, maps, level, team, relics, version)
      values (p_id, s, h, left(trim(p_name), 20), p_floors, p_maps, p_level, p_team, p_relics, left(p_version, 16));
    return 'new';
  end if;
  if now() - r.updated_at < interval '20 seconds' then return 'slow'; end if;
  update public.averno_scores set
    name = left(trim(p_name), 20), version = left(p_version, 16), updated_at = now(),
    floors = greatest(r.floors, p_floors),
    maps   = case when p_floors > r.floors then p_maps   else r.maps   end,
    level  = case when p_floors > r.floors then p_level  else r.level  end,
    team   = case when p_floors > r.floors then p_team   else r.team   end,
    relics = case when p_floors > r.floors then p_relics else r.relics end,
    flagged = r.flagged or (p_floors > r.floors and r.floors > 0 and p_floors > r.floors * 4 + 30)
  where player_id = p_id and season = s;
  return case when p_floors > r.floors then 'best' else 'kept' end;
end $$;

-- ---------- Amigos ----------
create table if not exists public.friends (
  player_id  uuid not null references public.players(player_id) on delete cascade,
  friend_tid text not null check (friend_tid ~ '^[A-Z0-9]{6}$'),
  created_at timestamptz not null default now(),
  primary key (player_id, friend_tid)
);
alter table public.friends enable row level security;
revoke all on public.friends from anon, authenticated;

create or replace function public.friend_add(p_id uuid, p_secret text, p_tid text) returns text
language plpgsql security definer set search_path = public, extensions as $$
declare me public.players;
begin
  begin me := public._dk_me(p_id, p_secret); exception when others then return sqlerrm; end;
  if p_tid is null or p_tid !~ '^[A-Z0-9]{6}$' or p_tid = me.trainer_id then return 'bad'; end if;
  if not exists (select 1 from public.players_public where trainer_id = p_tid) then return 'notfound'; end if;
  if (select count(*) from public.friends where player_id = p_id) >= 100 then return 'full'; end if;
  insert into public.friends (player_id, friend_tid) values (p_id, p_tid) on conflict do nothing;
  return 'ok';
end $$;

create or replace function public.friend_remove(p_id uuid, p_secret text, p_tid text) returns text
language plpgsql security definer set search_path = public, extensions as $$
declare me public.players;
begin
  begin me := public._dk_me(p_id, p_secret); exception when others then return sqlerrm; end;
  delete from public.friends where player_id = p_id and friend_tid = p_tid;
  return 'ok';
end $$;

-- Tus amigos (con su perfil y si también te tienen a ti: «mutuo»)
create or replace function public.friend_list(p_id uuid, p_secret text)
returns table (trainer_id text, name text, title text, avatar jsonb, fav jsonb, records jsonb, updated_at timestamptz, mutual boolean)
language plpgsql security definer set search_path = public, extensions as $$
declare me public.players;
begin
  me := public._dk_me(p_id, p_secret);
  return query
    select pp.trainer_id, pp.name, pp.title, pp.avatar, pp.fav, pp.records, pp.updated_at,
      exists (select 1 from public.friends f2 join public.players p2 on p2.player_id = f2.player_id where p2.trainer_id = pp.trainer_id and f2.friend_tid = me.trainer_id)
    from public.friends f join public.players_public pp on pp.trainer_id = f.friend_tid
    where f.player_id = p_id order by f.created_at;
end $$;

-- ---------- Buzón: mensajes (24 h), regalos (1 al día por amigo, 7 días para recogerlos) e invitaciones ----------
create table if not exists public.inbox (
  id         bigint generated always as identity primary key,
  to_tid     text not null,
  from_tid   text not null,
  from_name  text not null,
  kind       text not null check (kind in ('msg', 'gift', 'trade')),
  body       jsonb not null default '{}'::jsonb check (pg_column_size(body) < 2000),
  created_at timestamptz not null default now()
);
create index if not exists inbox_to_idx on public.inbox (to_tid, id);
create index if not exists inbox_created_idx on public.inbox (created_at);
alter table public.inbox enable row level security;
revoke all on public.inbox from anon, authenticated;

create table if not exists public.gift_log (
  from_tid text not null, to_tid text not null, day date not null,
  primary key (from_tid, to_tid, day)
);
alter table public.gift_log enable row level security;
revoke all on public.gift_log from anon, authenticated;

create or replace function public.inbox_send(p_id uuid, p_secret text, p_to text, p_kind text, p_body jsonb) returns text
language plpgsql security definer set search_path = public, extensions as $$
declare me public.players; txt text; today date := (now() at time zone 'Europe/Madrid')::date;
begin
  begin me := public._dk_me(p_id, p_secret); exception when others then return sqlerrm; end;
  if p_kind not in ('msg', 'gift', 'trade') or p_to is null or p_to !~ '^[A-Z0-9]{6}$' or p_to = me.trainer_id then return 'bad'; end if;
  -- sólo entre amigos mutuos (los dos se han añadido)
  if not exists (select 1 from public.friends where player_id = p_id and friend_tid = p_to)
     or not exists (select 1 from public.friends f join public.players p on p.player_id = f.player_id where p.trainer_id = p_to and f.friend_tid = me.trainer_id)
  then return 'notfriends'; end if;
  if exists (select 1 from public.bans b where b.trainer_id = p_to) then return 'notfriends'; end if;
  -- frecuencia: como mucho 40 envíos por hora
  if (select count(*) from public.inbox where from_tid = me.trainer_id and created_at > now() - interval '1 hour') >= 40 then return 'slow'; end if;
  delete from public.inbox where (kind <> 'gift' and created_at < now() - interval '24 hours') or created_at < now() - interval '7 days';
  delete from public.gift_log where day < today - 2;
  if p_kind = 'msg' then
    txt := left(regexp_replace(coalesce(p_body ->> 'text', ''), '[[:cntrl:]]', '', 'g'), 140);
    if char_length(trim(txt)) = 0 then return 'bad'; end if;
    p_body := jsonb_build_object('text', txt);
  elsif p_kind = 'gift' then
    if exists (select 1 from public.gift_log where from_tid = me.trainer_id and to_tid = p_to and day = today) then return 'giftdone'; end if;
    insert into public.gift_log values (me.trainer_id, p_to, today);
    p_body := jsonb_build_object('item', 'pocion', 'n', 1);
  else
    if coalesce(p_body ->> 'code', '') !~ '^[A-Z0-9]{6}$' then return 'bad'; end if;
    p_body := jsonb_build_object('code', p_body ->> 'code');
  end if;
  insert into public.inbox (to_tid, from_tid, from_name, kind, body) values (p_to, me.trainer_id, me.name, p_kind, p_body);
  return 'ok';
end $$;

create or replace function public.inbox_fetch(p_id uuid, p_secret text)
returns table (id bigint, from_tid text, from_name text, kind text, body jsonb, created_at timestamptz)
language plpgsql security definer set search_path = public, extensions as $$
declare me public.players;
begin
  me := public._dk_me(p_id, p_secret);
  return query select i.id, i.from_tid, i.from_name, i.kind, i.body, i.created_at from public.inbox i
    where i.to_tid = me.trainer_id and ((i.kind <> 'gift' and i.created_at > now() - interval '24 hours') or (i.kind = 'gift' and i.created_at > now() - interval '7 days'))
    order by i.id desc limit 100;
end $$;

-- Borra mensajes tuyos; con un regalo, devuelve 'claimed' sólo la primera vez (no se puede cobrar dos veces)
create or replace function public.inbox_take(p_id uuid, p_secret text, p_msg bigint) returns text
language plpgsql security definer set search_path = public, extensions as $$
declare me public.players; k text;
begin
  begin me := public._dk_me(p_id, p_secret); exception when others then return sqlerrm; end;
  delete from public.inbox where id = p_msg and to_tid = me.trainer_id returning kind into k;
  if k is null then return 'gone'; end if;
  return case when k = 'gift' then 'claimed' else 'ok' end;
end $$;

-- ---------- Denuncias ----------
create table if not exists public.reports (
  id          bigint generated always as identity primary key,
  reporter    text not null,
  target_tid  text not null,
  reason      text,
  created_at  timestamptz not null default now()
);
alter table public.reports enable row level security;
revoke all on public.reports from anon, authenticated;

create or replace function public.report_player(p_id uuid, p_secret text, p_tid text, p_reason text) returns text
language plpgsql security definer set search_path = public, extensions as $$
declare me public.players;
begin
  begin me := public._dk_me(p_id, p_secret); exception when others then return sqlerrm; end;
  if p_tid is null or p_tid !~ '^[A-Z0-9]{6}$' then return 'bad'; end if;
  if (select count(*) from public.reports where reporter = me.trainer_id and created_at > now() - interval '1 day') >= 10 then return 'slow'; end if;
  insert into public.reports (reporter, target_tid, reason) values (me.trainer_id, p_tid, left(p_reason, 200));
  return 'ok';
end $$;

-- ---------- Permisos: sólo estas funciones se pueden llamar desde el juego ----------
revoke all on function public.profile_save(uuid, text, text, text, text, jsonb, jsonb, jsonb, jsonb, int) from public;
revoke all on function public.submit_score(uuid, text, text, int, jsonb, int) from public;
revoke all on function public.submit_averno(uuid, text, text, int, int, int, jsonb, text, jsonb, int) from public;
revoke all on function public.friend_add(uuid, text, text) from public;
revoke all on function public.friend_remove(uuid, text, text) from public;
revoke all on function public.friend_list(uuid, text) from public;
revoke all on function public.inbox_send(uuid, text, text, text, jsonb) from public;
revoke all on function public.inbox_fetch(uuid, text) from public;
revoke all on function public.inbox_take(uuid, text, bigint) from public;
revoke all on function public.report_player(uuid, text, text, text) from public;
grant execute on function public.profile_save(uuid, text, text, text, text, jsonb, jsonb, jsonb, jsonb, int) to anon;
grant execute on function public.submit_score(uuid, text, text, int, jsonb, int) to anon;
grant execute on function public.submit_averno(uuid, text, text, int, int, int, jsonb, text, jsonb, int) to anon;
grant execute on function public.friend_add(uuid, text, text) to anon;
grant execute on function public.friend_remove(uuid, text, text) to anon;
grant execute on function public.friend_list(uuid, text) to anon;
grant execute on function public.inbox_send(uuid, text, text, text, jsonb) to anon;
grant execute on function public.inbox_fetch(uuid, text) to anon;
grant execute on function public.inbox_take(uuid, text, bigint) to anon;
grant execute on function public.report_player(uuid, text, text, text) to anon;
grant execute on function public.dk_week() to anon;
grant execute on function public.averno_season() to anon;

-- ---------- Para revisar (desde el panel de Supabase, SQL Editor) ----------
-- Récords marcados como sospechosos:  select * from public.scores where flagged;  select * from public.averno_scores where flagged;
-- Darlos por buenos:                   update public.scores set flagged = false where player_id = '...';
-- Denuncias:                           select target_tid, count(*) from public.reports group by 1 order by 2 desc;
-- Banear un ID de entrenador (desaparece de todas las tablas y ya no puede enviar nada):
--                                      insert into public.bans (trainer_id, reason) values ('ABC123', 'trampas');
-- Quitar el baneo:                     delete from public.bans where trainer_id = 'ABC123';
-- Quitar un récord concreto:           delete from public.scores where player_id = (select player_id from public.players where trainer_id = 'ABC123') and board = 'depth';
```

### Moderación rápida

- Banear: `insert into public.bans (trainer_id, reason) values ('ABC123', 'trampas');`
- Quitar el baneo: `delete from public.bans where trainer_id = 'ABC123';`
- Revisar sospechosos: `select * from public.scores where flagged;` y `select * from public.averno_scores where flagged;`
- Denuncias: `select target_tid, count(*) from public.reports group by 1 order by 2 desc;`


## 6. Solicitudes de amistad, buzón con noticias, soporte y panel de admin (v5.40)

Ejecuta este bloque **una vez** en *SQL Editor → New query* (después de la sección 5). Se puede repetir.

- **Amistad por solicitudes**: `friend_add` envía una solicitud (llega al buzón del otro como `friend`); si el otro ya te la había enviado, sois amigos (`accepted`). `friend_reject` la rechaza y `friend_remove` borra la amistad en los dos sentidos.
- **Buzón**: además de mensajes, regalos e invitaciones, guarda solicitudes (30 días), avisos de «ha aceptado» (7 días), mensajes del equipo (`admin`) y regalos del equipo (`agift`, 60 días). Los regalos se cobran una sola vez (`inbox_take` → `claimed`).
- **Noticias** (`news`, vista `news_public`): las publica el admin y las ven todos; pueden llevar un regalo que cada jugador recoge una vez (`news_claim`).
- **Soporte** (`support`): el jugador escribe al equipo desde su buzón; el admin responde desde el panel.
- **Datos privados del perfil** (`players.private`): todos los daskai (especie, nivel, variocolor, mote, estrellas), monedas, emblemas y la bolsa de casa. **No** salen en `players_public`: sólo los ve el admin.
- **Panel de admin** (`admin.html`): funciones `admin_*` que sólo funcionan con una sesión de Supabase Auth de un usuario que esté en `public.admins`. Todo lo que hace el admin queda en `admin_log`.

### Hacerte admin (una vez)

1. Supabase → **Authentication → Users → Add user → Create new user**: tu email y una contraseña larga; marca *Auto Confirm User*.
2. En el SQL Editor (cambia el email):
   ```sql
   insert into public.admins (user_id, note) select id, 'yo' from auth.users where email = 'TU_EMAIL';
   ```
3. Recomendado: **Authentication → Sign In / Providers → desactiva «Allow new users to sign up»** (aunque alguien se registrase, sin estar en `admins` no puede hacer nada).
4. Abre `https://<tu-usuario>.github.io/<repo>/admin.html` y entra con ese email y contraseña.

```sql
-- =====================================================================
-- Daskai v5.40: solicitudes de amistad, buzón con noticias, chat con el admin y PANEL DE ADMIN.
-- Requiere haber ejecutado antes la v5.39 (perfiles, tablas, amigos y buzón).
-- Se ejecuta UNA vez (se puede repetir sin problema: no borra datos).
--
-- Después, para hacerte admin (una sola vez):
--   1) Supabase → Authentication → Users → Add user → Create new user (tu email y una contraseña;
--      marca «Auto Confirm User»).
--   2) En el SQL Editor:  insert into public.admins (user_id, note)
--                           select id, 'yo' from auth.users where email = 'TU_EMAIL';
--   3) Recomendado: Authentication → Sign In / Providers → desactiva «Allow new users to sign up».
-- =====================================================================
create extension if not exists pgcrypto with schema extensions;

-- ---------- Administradores (usuarios de Supabase Auth) ----------
create table if not exists public.admins (
  user_id    uuid primary key,
  note       text,
  created_at timestamptz not null default now()
);
alter table public.admins enable row level security;
revoke all on public.admins from anon, authenticated;

create or replace function public._dk_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select auth.uid() is not null and exists (select 1 from public.admins a where a.user_id = auth.uid())
$$;
create or replace function public._dk_need_admin() returns void
language plpgsql stable security definer set search_path = public as $$
begin if not public._dk_admin() then raise exception 'notadmin'; end if; end $$;

-- Registro de todo lo que hace el admin
create table if not exists public.admin_log (
  id      bigint generated always as identity primary key,
  at      timestamptz not null default now(),
  admin   uuid,
  action  text not null,
  target  text,
  detail  jsonb
);
alter table public.admin_log enable row level security;
revoke all on public.admin_log from anon, authenticated;
create or replace function public._dk_log(p_action text, p_target text, p_detail jsonb default null) returns void
language sql security definer set search_path = public as $$
  insert into public.admin_log (admin, action, target, detail) values (auth.uid(), p_action, p_target, p_detail)
$$;

-- ---------- Perfil: datos privados (sólo los ve el admin) y nombre bloqueado ----------
alter table public.players add column if not exists private jsonb check (coalesce(pg_column_size(private), 0) < 400000);
alter table public.players add column if not exists name_locked boolean not null default false;
alter table public.players add column if not exists version text;

drop function if exists public.profile_save(uuid, text, text, text, text, jsonb, jsonb, jsonb, jsonb, int);
create or replace function public.profile_save(
  p_id uuid, p_secret text, p_tid text, p_name text, p_title text, p_avatar jsonb, p_fav jsonb, p_team jsonb, p_records jsonb, p_playtime int,
  p_private jsonb default null, p_version text default null
) returns text
language plpgsql security definer set search_path = public, extensions as $$
declare r public.players; h text := encode(digest(coalesce(p_secret, ''), 'sha256'), 'hex'); pt int;
begin
  if p_secret is null or char_length(p_secret) < 16 or p_tid is null or p_tid !~ '^[A-Z0-9]{6}$'
     or coalesce(char_length(trim(p_name)), 0) = 0 then return 'bad'; end if;
  if exists (select 1 from public.bans b where b.trainer_id = p_tid) then return 'banned'; end if;
  if p_private is not null and pg_column_size(p_private) >= 400000 then p_private := null; end if;
  select * into r from public.players where player_id = p_id;
  if not found then
    if exists (select 1 from public.players where trainer_id = p_tid) then return 'tid_taken'; end if;
    if exists (select 1 from public.averno_scores a where a.player_id = p_id and a.secret_hash <> h) then return 'denied'; end if;
    insert into public.players (player_id, trainer_id, secret_hash, name, title, avatar, fav, team, records, playtime, private, version)
      values (p_id, p_tid, h, left(trim(p_name), 20), left(p_title, 40), p_avatar, p_fav, p_team, p_records,
              greatest(0, least(coalesce(p_playtime, 0), 10000000)), p_private, left(p_version, 16));
    return 'new';
  end if;
  if r.secret_hash <> h then return 'denied'; end if;
  if exists (select 1 from public.bans b where b.trainer_id = r.trainer_id) then return 'banned'; end if;
  if now() - r.updated_at < interval '10 seconds' then return 'slow'; end if;
  if p_tid <> r.trainer_id and exists (select 1 from public.players where trainer_id = p_tid) then return 'tid_taken'; end if;
  pt := least(greatest(r.playtime, coalesce(p_playtime, 0)), r.playtime + extract(epoch from (now() - r.updated_at))::int + 120);
  update public.players set trainer_id = p_tid,
    name = case when r.name_locked then r.name else left(trim(p_name), 20) end,
    title = left(p_title, 40), avatar = p_avatar, fav = p_fav, team = p_team, records = p_records, playtime = pt,
    private = coalesce(p_private, r.private), version = coalesce(left(p_version, 16), r.version), updated_at = now()
  where player_id = p_id;
  return 'ok';
end $$;

-- ---------- Buzón: más tipos ----------
-- friend (solicitud de amistad) · friendok (la han aceptado) · admin (mensaje del equipo) · agift (regalo del equipo)
alter table public.inbox drop constraint if exists inbox_kind_check;
alter table public.inbox add constraint inbox_kind_check check (kind in ('msg', 'gift', 'trade', 'friend', 'friendok', 'admin', 'agift'));
alter table public.inbox drop constraint if exists inbox_body_check;
alter table public.inbox add constraint inbox_body_check check (pg_column_size(body) < 6000);

-- Limpieza: mensajes e invitaciones 24 h · regalos y avisos 7 días · solicitudes 30 días · del equipo 60 días
create or replace function public._dk_clean() returns void
language sql security definer set search_path = public as $$
  delete from public.inbox where
       (kind in ('msg', 'trade') and created_at < now() - interval '24 hours')
    or (kind in ('gift', 'friendok') and created_at < now() - interval '7 days')
    or (kind = 'friend' and created_at < now() - interval '30 days')
    or (kind in ('admin', 'agift') and created_at < now() - interval '60 days');
$$;

-- ---------- Amistad por solicitudes ----------
-- friends(player_id → friend_tid) = «he pedido / acepto ser amigo de». Amigos = las dos filas.
-- Devuelve: sent (solicitud enviada) · accepted (ya te la había pedido él: sois amigos) · pending (ya la habías enviado)
--           already (ya sois amigos) · notfound · full · slow · bad
create or replace function public.friend_add(p_id uuid, p_secret text, p_tid text) returns text
language plpgsql security definer set search_path = public, extensions as $$
declare me public.players; other uuid; mine boolean; theirs boolean;
begin
  begin me := public._dk_me(p_id, p_secret); exception when others then return sqlerrm; end;
  p_tid := upper(p_tid);
  if p_tid is null or p_tid !~ '^[A-Z0-9]{6}$' or p_tid = me.trainer_id then return 'bad'; end if;
  select pp.player_id into other from public.players pp where pp.trainer_id = p_tid
    and not exists (select 1 from public.bans b where b.trainer_id = p_tid);
  if other is null then return 'notfound'; end if;
  mine := exists (select 1 from public.friends where player_id = p_id and friend_tid = p_tid);
  theirs := exists (select 1 from public.friends where player_id = other and friend_tid = me.trainer_id);
  if mine and theirs then return 'already'; end if;
  if mine then return 'pending'; end if;
  if (select count(*) from public.friends where player_id = p_id) >= 100 then return 'full'; end if;
  if not theirs and (select count(*) from public.inbox where from_tid = me.trainer_id and kind = 'friend' and created_at > now() - interval '1 hour') >= 20 then return 'slow'; end if;
  insert into public.friends (player_id, friend_tid) values (p_id, p_tid) on conflict do nothing;
  if theirs then
    delete from public.inbox where kind = 'friend' and from_tid = p_tid and to_tid = me.trainer_id;
    insert into public.inbox (to_tid, from_tid, from_name, kind, body) values (p_tid, me.trainer_id, me.name, 'friendok', '{}'::jsonb);
    return 'accepted';
  end if;
  delete from public.inbox where kind = 'friend' and from_tid = me.trainer_id and to_tid = p_tid;
  insert into public.inbox (to_tid, from_tid, from_name, kind, body) values (p_tid, me.trainer_id, me.name, 'friend', '{}'::jsonb);
  return 'sent';
end $$;

-- Rechazar una solicitud que te han enviado
create or replace function public.friend_reject(p_id uuid, p_secret text, p_tid text) returns text
language plpgsql security definer set search_path = public, extensions as $$
declare me public.players;
begin
  begin me := public._dk_me(p_id, p_secret); exception when others then return sqlerrm; end;
  delete from public.friends f using public.players p where p.player_id = f.player_id and p.trainer_id = upper(p_tid) and f.friend_tid = me.trainer_id;
  delete from public.inbox where kind = 'friend' and from_tid = upper(p_tid) and to_tid = me.trainer_id;
  return 'ok';
end $$;

-- Quitar a un amigo (o cancelar tu solicitud): se borra en los dos sentidos
create or replace function public.friend_remove(p_id uuid, p_secret text, p_tid text) returns text
language plpgsql security definer set search_path = public, extensions as $$
declare me public.players;
begin
  begin me := public._dk_me(p_id, p_secret); exception when others then return sqlerrm; end;
  delete from public.friends where player_id = p_id and friend_tid = upper(p_tid);
  delete from public.friends f using public.players p where p.player_id = f.player_id and p.trainer_id = upper(p_tid) and f.friend_tid = me.trainer_id;
  delete from public.inbox where kind = 'friend' and ((from_tid = me.trainer_id and to_tid = upper(p_tid)) or (from_tid = upper(p_tid) and to_tid = me.trainer_id));
  return 'ok';
end $$;

-- Amigos, solicitudes enviadas y recibidas. status: friend · sent · incoming
drop function if exists public.friend_list(uuid, text);
create or replace function public.friend_list(p_id uuid, p_secret text)
returns table (trainer_id text, name text, title text, avatar jsonb, fav jsonb, records jsonb, updated_at timestamptz, mutual boolean, status text)
language plpgsql security definer set search_path = public, extensions as $$
declare me public.players;
begin
  me := public._dk_me(p_id, p_secret);
  return query
    with mine as (select f.friend_tid as tid, f.created_at from public.friends f where f.player_id = p_id),
         theirs as (select p.trainer_id as tid, f.created_at from public.friends f join public.players p on p.player_id = f.player_id where f.friend_tid = me.trainer_id),
         alltid as (select coalesce(m.tid, t.tid) as tid, (m.tid is not null) as m, (t.tid is not null) as t, coalesce(m.created_at, t.created_at) as at
                    from mine m full join theirs t on t.tid = m.tid)
    select pp.trainer_id, pp.name, pp.title, pp.avatar, pp.fav, pp.records, pp.updated_at, (a.m and a.t),
           case when a.m and a.t then 'friend' when a.m then 'sent' else 'incoming' end
    from alltid a join public.players_public pp on pp.trainer_id = a.tid
    order by (a.m and a.t) desc, a.at;
end $$;

-- ---------- Enviar / leer / recoger del buzón ----------
create or replace function public.inbox_send(p_id uuid, p_secret text, p_to text, p_kind text, p_body jsonb) returns text
language plpgsql security definer set search_path = public, extensions as $$
declare me public.players; txt text; today date := (now() at time zone 'Europe/Madrid')::date;
begin
  begin me := public._dk_me(p_id, p_secret); exception when others then return sqlerrm; end;
  if p_kind not in ('msg', 'gift', 'trade') or p_to is null or p_to !~ '^[A-Z0-9]{6}$' or p_to = me.trainer_id then return 'bad'; end if;
  if not exists (select 1 from public.friends where player_id = p_id and friend_tid = p_to)
     or not exists (select 1 from public.friends f join public.players p on p.player_id = f.player_id where p.trainer_id = p_to and f.friend_tid = me.trainer_id)
  then return 'notfriends'; end if;
  if exists (select 1 from public.bans b where b.trainer_id = p_to) then return 'notfriends'; end if;
  if (select count(*) from public.inbox where from_tid = me.trainer_id and created_at > now() - interval '1 hour') >= 40 then return 'slow'; end if;
  perform public._dk_clean();
  delete from public.gift_log where day < today - 2;
  if p_kind = 'msg' then
    txt := left(regexp_replace(coalesce(p_body ->> 'text', ''), '[[:cntrl:]]', '', 'g'), 140);
    if char_length(trim(txt)) = 0 then return 'bad'; end if;
    p_body := jsonb_build_object('text', txt);
  elsif p_kind = 'gift' then
    if exists (select 1 from public.gift_log where from_tid = me.trainer_id and to_tid = p_to and day = today) then return 'giftdone'; end if;
    insert into public.gift_log values (me.trainer_id, p_to, today);
    p_body := jsonb_build_object('item', 'pocion', 'n', 1);
  else
    if coalesce(p_body ->> 'code', '') !~ '^[A-Z0-9]{6}$' then return 'bad'; end if;
    p_body := jsonb_build_object('code', p_body ->> 'code');
  end if;
  insert into public.inbox (to_tid, from_tid, from_name, kind, body) values (p_to, me.trainer_id, me.name, p_kind, p_body);
  return 'ok';
end $$;

create or replace function public.inbox_fetch(p_id uuid, p_secret text)
returns table (id bigint, from_tid text, from_name text, kind text, body jsonb, created_at timestamptz)
language plpgsql security definer set search_path = public, extensions as $$
declare me public.players;
begin
  me := public._dk_me(p_id, p_secret);
  perform public._dk_clean();
  return query select i.id, i.from_tid, i.from_name, i.kind, i.body, i.created_at from public.inbox i
    where i.to_tid = me.trainer_id order by i.id desc limit 100;
end $$;

-- Borra algo de tu buzón. Con un regalo (de un amigo o del equipo) devuelve 'claimed' sólo la primera vez.
create or replace function public.inbox_take(p_id uuid, p_secret text, p_msg bigint) returns text
language plpgsql security definer set search_path = public, extensions as $$
declare me public.players; k text;
begin
  begin me := public._dk_me(p_id, p_secret); exception when others then return sqlerrm; end;
  delete from public.inbox where id = p_msg and to_tid = me.trainer_id returning kind into k;
  if k is null then return 'gone'; end if;
  return case when k in ('gift', 'agift') then 'claimed' else 'ok' end;
end $$;

-- ---------- Noticias (las publica el admin; las ve todo el mundo) ----------
create table if not exists public.news (
  id         bigint generated always as identity primary key,
  title      text not null check (char_length(title) between 1 and 80),
  body       text not null default '' check (char_length(body) <= 2000),
  gift       jsonb check (coalesce(pg_column_size(gift), 0) < 3000),
  pinned     boolean not null default false,
  published  boolean not null default true,
  created_at timestamptz not null default now(),
  expires_at timestamptz
);
alter table public.news enable row level security;
revoke all on public.news from anon, authenticated;
create or replace view public.news_public as
  select id, title, body, gift, pinned, created_at, expires_at from public.news
  where published and (expires_at is null or expires_at > now());
grant select on public.news_public to anon;

create table if not exists public.news_claims (
  news_id   bigint not null references public.news(id) on delete cascade,
  player_id uuid not null references public.players(player_id) on delete cascade,
  at        timestamptz not null default now(),
  primary key (news_id, player_id)
);
alter table public.news_claims enable row level security;
revoke all on public.news_claims from anon, authenticated;

-- Recoger el regalo de una noticia (una vez por jugador)
create or replace function public.news_claim(p_id uuid, p_secret text, p_news bigint) returns text
language plpgsql security definer set search_path = public, extensions as $$
declare me public.players; n public.news;
begin
  begin me := public._dk_me(p_id, p_secret); exception when others then return sqlerrm; end;
  select * into n from public.news where id = p_news and published and (expires_at is null or expires_at > now());
  if not found then return 'gone'; end if;
  if n.gift is null then return 'nogift'; end if;
  insert into public.news_claims (news_id, player_id) values (p_news, p_id) on conflict do nothing;
  if not found then return 'gone'; end if;
  return 'claimed';
end $$;
-- Qué noticias con regalo ya has recogido
create or replace function public.news_claimed(p_id uuid, p_secret text) returns bigint[]
language plpgsql security definer set search_path = public, extensions as $$
declare me public.players;
begin
  me := public._dk_me(p_id, p_secret);
  return coalesce((select array_agg(news_id) from public.news_claims where player_id = p_id), '{}');
end $$;

-- ---------- Hablar con el equipo (soporte) ----------
create table if not exists public.support (
  id         bigint generated always as identity primary key,
  trainer_id text not null,
  from_admin boolean not null default false,
  body       text not null check (char_length(body) between 1 and 500),
  seen       boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists support_tid_idx on public.support (trainer_id, id);
alter table public.support enable row level security;
revoke all on public.support from anon, authenticated;

create or replace function public.support_send(p_id uuid, p_secret text, p_text text) returns text
language plpgsql security definer set search_path = public, extensions as $$
declare me public.players; txt text := left(regexp_replace(coalesce(p_text, ''), '[[:cntrl:]]', '', 'g'), 500);
begin
  begin me := public._dk_me(p_id, p_secret); exception when others then return sqlerrm; end;
  if char_length(trim(txt)) = 0 then return 'bad'; end if;
  if (select count(*) from public.support where trainer_id = me.trainer_id and not from_admin and created_at > now() - interval '1 hour') >= 10 then return 'slow'; end if;
  insert into public.support (trainer_id, body) values (me.trainer_id, txt);
  delete from public.support where created_at < now() - interval '180 days';
  return 'ok';
end $$;
-- Tu conversación con el equipo
create or replace function public.support_fetch(p_id uuid, p_secret text)
returns table (id bigint, from_admin boolean, body text, created_at timestamptz)
language plpgsql security definer set search_path = public, extensions as $$
declare me public.players;
begin
  me := public._dk_me(p_id, p_secret);
  return query select s.id, s.from_admin, s.body, s.created_at from public.support s where s.trainer_id = me.trainer_id order by s.id desc limit 50;
end $$;

-- Denuncias: se pueden cerrar desde el panel
alter table public.reports add column if not exists closed boolean not null default false;

-- =====================================================================
-- PANEL DE ADMIN: todas estas funciones comprueban que quien llama es admin (Supabase Auth + tabla admins)
-- =====================================================================
create or replace function public.admin_whoami() returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object('admin', public._dk_admin(), 'uid', auth.uid())
$$;

create or replace function public.admin_stats() returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  perform public._dk_need_admin();
  return jsonb_build_object(
    'players', (select count(*) from public.players),
    'active24', (select count(*) from public.players where updated_at > now() - interval '24 hours'),
    'active7', (select count(*) from public.players where updated_at > now() - interval '7 days'),
    'new7', (select count(*) from public.players where created_at > now() - interval '7 days'),
    'banned', (select count(*) from public.bans),
    'reports', (select count(*) from public.reports where not closed),
    'flagged', (select count(*) from public.scores where flagged) + (select count(*) from public.averno_scores where flagged),
    'support', (select count(*) from public.support where not from_admin and not seen),
    'news', (select count(*) from public.news where published and (expires_at is null or expires_at > now())),
    'inbox', (select count(*) from public.inbox),
    'friends', (select count(*) from public.friends),
    'season', public.averno_season(), 'week', public.dk_week(),
    'byDay', (select coalesce(jsonb_agg(jsonb_build_object('d', d, 'n', n) order by d), '[]') from (
      select (created_at at time zone 'Europe/Madrid')::date as d, count(*) as n from public.players
      where created_at > now() - interval '14 days' group by 1) x)
  );
end $$;

-- Lista de jugadores. p_filter: all · recent · new · banned · reported · flagged · support
create or replace function public.admin_players(p_q text default '', p_filter text default 'recent', p_limit int default 50, p_offset int default 0)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare q text := '%' || lower(coalesce(trim(p_q), '')) || '%';
begin
  perform public._dk_need_admin();
  return coalesce((select jsonb_agg(row_to_json(x)) from (
    select p.trainer_id, p.name, p.title, p.playtime, p.records, p.updated_at, p.created_at, p.version, p.name_locked,
      p.avatar, p.fav, (b.trainer_id is not null) as banned, b.reason as ban_reason,
      (select count(*) from public.reports r where r.target_tid = p.trainer_id and not r.closed) as reports,
      (select count(*) from public.scores s where s.player_id = p.player_id and s.flagged)
        + (select count(*) from public.averno_scores a where a.player_id = p.player_id and a.flagged) as flagged,
      (select count(*) from public.support s where s.trainer_id = p.trainer_id and not s.from_admin and not s.seen) as unread
    from public.players p left join public.bans b on b.trainer_id = p.trainer_id
    where (lower(p.name) like q or lower(p.trainer_id) like q)
      and case p_filter
        when 'banned' then b.trainer_id is not null
        when 'reported' then exists (select 1 from public.reports r where r.target_tid = p.trainer_id and not r.closed)
        when 'flagged' then exists (select 1 from public.scores s where s.player_id = p.player_id and s.flagged)
                         or exists (select 1 from public.averno_scores a where a.player_id = p.player_id and a.flagged)
        when 'support' then exists (select 1 from public.support s where s.trainer_id = p.trainer_id and not s.from_admin and not s.seen)
        else true end
    order by case when p_filter = 'new' then p.created_at else p.updated_at end desc
    limit greatest(1, least(coalesce(p_limit, 50), 200)) offset greatest(0, coalesce(p_offset, 0))
  ) x), '[]');
end $$;

-- Ficha completa de un jugador (incluye sus datos privados: cajas, monedas y bolsa)
create or replace function public.admin_player(p_tid text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare p public.players;
begin
  perform public._dk_need_admin();
  select * into p from public.players where trainer_id = upper(p_tid);
  if not found then return null; end if;
  return jsonb_build_object(
    'profile', jsonb_build_object('trainer_id', p.trainer_id, 'name', p.name, 'title', p.title, 'avatar', p.avatar, 'fav', p.fav, 'team', p.team,
      'records', p.records, 'playtime', p.playtime, 'updated_at', p.updated_at, 'created_at', p.created_at, 'version', p.version,
      'name_locked', p.name_locked, 'private', p.private, 'player_id', p.player_id),
    'ban', (select row_to_json(b) from public.bans b where b.trainer_id = p.trainer_id),
    'scores', (select coalesce(jsonb_agg(jsonb_build_object('board', s.board, 'period', s.period, 'value', s.value, 'flagged', s.flagged, 'updated_at', s.updated_at, 'build', s.build) order by s.updated_at desc), '[]') from public.scores s where s.player_id = p.player_id),
    'averno', (select coalesce(jsonb_agg(jsonb_build_object('season', a.season, 'floors', a.floors, 'maps', a.maps, 'level', a.level, 'flagged', a.flagged, 'updated_at', a.updated_at, 'team', a.team, 'relics', a.relics) order by a.season desc), '[]') from public.averno_scores a where a.player_id = p.player_id),
    'reports', (select coalesce(jsonb_agg(row_to_json(r) order by r.id desc), '[]') from public.reports r where r.target_tid = p.trainer_id),
    'reportsBy', (select count(*) from public.reports r where r.reporter = p.trainer_id),
    'friends', (select coalesce(jsonb_agg(jsonb_build_object('tid', f.friend_tid, 'mutual', exists (select 1 from public.friends f2 join public.players p2 on p2.player_id = f2.player_id where p2.trainer_id = f.friend_tid and f2.friend_tid = p.trainer_id))), '[]') from public.friends f where f.player_id = p.player_id),
    'support', (select coalesce(jsonb_agg(row_to_json(s) order by s.id), '[]') from (select * from public.support s where s.trainer_id = p.trainer_id order by s.id desc limit 100) s),
    'inbox', (select count(*) from public.inbox i where i.to_tid = p.trainer_id)
  );
end $$;

create or replace function public.admin_ban(p_tid text, p_reason text) returns text
language plpgsql security definer set search_path = public as $$
begin
  perform public._dk_need_admin();
  insert into public.bans (trainer_id, reason) values (upper(p_tid), left(p_reason, 200))
    on conflict (trainer_id) do update set reason = excluded.reason;
  perform public._dk_log('ban', upper(p_tid), jsonb_build_object('reason', p_reason));
  return 'ok';
end $$;
create or replace function public.admin_unban(p_tid text) returns text
language plpgsql security definer set search_path = public as $$
begin
  perform public._dk_need_admin();
  delete from public.bans where trainer_id = upper(p_tid);
  perform public._dk_log('unban', upper(p_tid), null);
  return 'ok';
end $$;

-- Cambiar el nombre (y bloquearlo para que el juego no lo vuelva a cambiar)
create or replace function public.admin_rename(p_tid text, p_name text, p_lock boolean default true) returns text
language plpgsql security definer set search_path = public as $$
begin
  perform public._dk_need_admin();
  if coalesce(char_length(trim(p_name)), 0) = 0 then return 'bad'; end if;
  update public.players set name = left(trim(p_name), 20), name_locked = coalesce(p_lock, true) where trainer_id = upper(p_tid);
  update public.averno_scores a set name = left(trim(p_name), 20) from public.players p where p.player_id = a.player_id and p.trainer_id = upper(p_tid);
  perform public._dk_log('rename', upper(p_tid), jsonb_build_object('name', p_name, 'lock', p_lock));
  return 'ok';
end $$;

-- Récords de una tabla (incluye los marcados). board: averno · depth · weekly · abyss · shiny
create or replace function public.admin_scores(p_board text, p_period int default null, p_flagged boolean default false, p_limit int default 100)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare per int := coalesce(p_period, case when p_board = 'weekly' then public.dk_week() else public.averno_season() end);
begin
  perform public._dk_need_admin();
  if p_board = 'averno' then
    return coalesce((select jsonb_agg(row_to_json(x)) from (
      select a.player_id, coalesce(p.trainer_id, '') as trainer_id, a.name, a.floors as value, a.maps, a.level, a.season as period, a.flagged, a.updated_at,
             jsonb_build_object('team', a.team, 'relics', a.relics) as build, (b.trainer_id is not null) as banned, p.playtime
      from public.averno_scores a left join public.players p on p.player_id = a.player_id left join public.bans b on b.trainer_id = p.trainer_id
      where a.season = per and (not p_flagged or a.flagged)
      order by a.floors desc, a.maps desc limit greatest(1, least(p_limit, 500))) x), '[]');
  end if;
  return coalesce((select jsonb_agg(row_to_json(x)) from (
    select s.player_id, p.trainer_id, p.name, s.value, s.period, s.flagged, s.updated_at, s.build, (b.trainer_id is not null) as banned, p.playtime
    from public.scores s join public.players p on p.player_id = s.player_id left join public.bans b on b.trainer_id = p.trainer_id
    where s.board = p_board and s.period = per and (not p_flagged or s.flagged)
    order by s.value desc limit greatest(1, least(p_limit, 500))) x), '[]');
end $$;

-- Todos los récords marcados como sospechosos (de todas las tablas)
create or replace function public.admin_flagged() returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  perform public._dk_need_admin();
  return coalesce((select jsonb_agg(row_to_json(x) order by x.updated_at desc) from (
    select 'averno' as board, a.player_id, p.trainer_id, a.name, a.floors as value, a.season as period, a.updated_at, p.playtime
      from public.averno_scores a left join public.players p on p.player_id = a.player_id where a.flagged
    union all
    select s.board, s.player_id, p.trainer_id, p.name, s.value, s.period, s.updated_at, p.playtime
      from public.scores s join public.players p on p.player_id = s.player_id where s.flagged) x), '[]');
end $$;

-- p_action: ok (dar por bueno) · flag (ocultar) · delete (borrar el récord)
create or replace function public.admin_score(p_player uuid, p_board text, p_period int, p_action text) returns text
language plpgsql security definer set search_path = public as $$
begin
  perform public._dk_need_admin();
  if p_board = 'averno' then
    if p_action = 'delete' then delete from public.averno_scores where player_id = p_player and season = p_period;
    else update public.averno_scores set flagged = (p_action = 'flag') where player_id = p_player and season = p_period; end if;
  else
    if p_action = 'delete' then delete from public.scores where player_id = p_player and board = p_board and period = p_period;
    else update public.scores set flagged = (p_action = 'flag') where player_id = p_player and board = p_board and period = p_period; end if;
  end if;
  perform public._dk_log('score_' || p_action, p_player::text, jsonb_build_object('board', p_board, 'period', p_period));
  return 'ok';
end $$;

-- Borrar todos los récords de un jugador (todas las tablas y temporadas)
create or replace function public.admin_reset_scores(p_tid text) returns text
language plpgsql security definer set search_path = public as $$
declare pid uuid;
begin
  perform public._dk_need_admin();
  select player_id into pid from public.players where trainer_id = upper(p_tid);
  if pid is null then return 'notfound'; end if;
  delete from public.scores where player_id = pid;
  delete from public.averno_scores where player_id = pid;
  perform public._dk_log('reset_scores', upper(p_tid), null);
  return 'ok';
end $$;

-- Borrar a un jugador por completo (perfil, récords, amigos, buzón y chat). No le impide volver: para eso, banea.
create or replace function public.admin_delete_player(p_tid text) returns text
language plpgsql security definer set search_path = public as $$
declare pid uuid; t text := upper(p_tid);
begin
  perform public._dk_need_admin();
  select player_id into pid from public.players where trainer_id = t;
  if pid is null then return 'notfound'; end if;
  delete from public.averno_scores where player_id = pid;
  delete from public.friends where friend_tid = t;
  delete from public.inbox where to_tid = t or from_tid = t;
  delete from public.support where trainer_id = t;
  delete from public.players where player_id = pid;
  perform public._dk_log('delete_player', t, null);
  return 'ok';
end $$;

-- Denuncias
create or replace function public.admin_reports(p_open boolean default true) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  perform public._dk_need_admin();
  return coalesce((select jsonb_agg(row_to_json(x) order by x.id desc) from (
    select r.*, p.name as target_name, (b.trainer_id is not null) as banned
    from public.reports r left join public.players p on p.trainer_id = r.target_tid left join public.bans b on b.trainer_id = r.target_tid
    where (not p_open or not r.closed) order by r.id desc limit 300) x), '[]');
end $$;
create or replace function public.admin_report_close(p_report bigint, p_tid text default null) returns text
language plpgsql security definer set search_path = public as $$
begin
  perform public._dk_need_admin();
  if p_tid is not null then update public.reports set closed = true where target_tid = upper(p_tid);
  else update public.reports set closed = true where id = p_report; end if;
  perform public._dk_log('report_close', coalesce(upper(p_tid), p_report::text), null);
  return 'ok';
end $$;

-- Noticias
create or replace function public.admin_news_list() returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  perform public._dk_need_admin();
  return coalesce((select jsonb_agg(row_to_json(x) order by x.id desc) from (
    select n.*, (select count(*) from public.news_claims c where c.news_id = n.id) as claims from public.news n) x), '[]');
end $$;
create or replace function public.admin_news_save(p_news bigint, p_title text, p_body text, p_gift jsonb, p_pinned boolean, p_published boolean, p_expires timestamptz)
returns bigint
language plpgsql security definer set search_path = public as $$
declare nid bigint;
begin
  perform public._dk_need_admin();
  if p_gift is not null and (jsonb_typeof(p_gift) <> 'object' or p_gift = '{}'::jsonb) then p_gift := null; end if;
  if p_news is null then
    insert into public.news (title, body, gift, pinned, published, expires_at)
      values (left(p_title, 80), left(coalesce(p_body, ''), 2000), p_gift, coalesce(p_pinned, false), coalesce(p_published, true), p_expires)
      returning id into nid;
  else
    update public.news set title = left(p_title, 80), body = left(coalesce(p_body, ''), 2000), gift = p_gift, pinned = coalesce(p_pinned, false),
      published = coalesce(p_published, true), expires_at = p_expires where id = p_news returning id into nid;
  end if;
  perform public._dk_log('news_save', nid::text, jsonb_build_object('title', p_title, 'gift', p_gift));
  return nid;
end $$;
create or replace function public.admin_news_delete(p_news bigint) returns text
language plpgsql security definer set search_path = public as $$
begin
  perform public._dk_need_admin();
  delete from public.news where id = p_news;
  perform public._dk_log('news_delete', p_news::text, null);
  return 'ok';
end $$;

-- Mensaje y/o regalo a un jugador. p_gift: {"items": {"pocion": 5, ...}, "coins": 1000, "emblems": 3}
create or replace function public.admin_send(p_tid text, p_text text, p_gift jsonb default null) returns text
language plpgsql security definer set search_path = public as $$
declare t text := upper(p_tid); txt text := left(trim(coalesce(p_text, '')), 500);
begin
  perform public._dk_need_admin();
  if not exists (select 1 from public.players where trainer_id = t) then return 'notfound'; end if;
  if p_gift is not null and (jsonb_typeof(p_gift) <> 'object' or p_gift = '{}'::jsonb) then p_gift := null; end if;
  if char_length(txt) = 0 and p_gift is null then return 'bad'; end if;
  if char_length(txt) > 0 then
    insert into public.support (trainer_id, from_admin, body, seen) values (t, true, txt, true);
    update public.support set seen = true where trainer_id = t and not from_admin;
  end if;
  if p_gift is not null then
    insert into public.inbox (to_tid, from_tid, from_name, kind, body) values (t, '@TEAM', 'Daskai', 'agift', jsonb_build_object('gift', p_gift, 'text', txt));
  elsif char_length(txt) > 0 then
    insert into public.inbox (to_tid, from_tid, from_name, kind, body) values (t, '@TEAM', 'Daskai', 'admin', jsonb_build_object('text', txt));
  end if;
  perform public._dk_log('send', t, jsonb_build_object('text', txt, 'gift', p_gift));
  return 'ok';
end $$;

-- Conversaciones con jugadores (las que tienen mensajes), con los no leídos primero
create or replace function public.admin_threads() returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  perform public._dk_need_admin();
  return coalesce((select jsonb_agg(row_to_json(x) order by x.unread desc, x.last_at desc) from (
    select s.trainer_id, p.name, max(s.created_at) as last_at, count(*) filter (where not s.from_admin and not s.seen) as unread,
      (select s2.body from public.support s2 where s2.trainer_id = s.trainer_id order by s2.id desc limit 1) as last
    from public.support s left join public.players p on p.trainer_id = s.trainer_id
    group by s.trainer_id, p.name) x), '[]');
end $$;
create or replace function public.admin_thread(p_tid text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare t text := upper(p_tid);
begin
  perform public._dk_need_admin();
  update public.support set seen = true where trainer_id = t and not from_admin and not seen;
  return coalesce((select jsonb_agg(row_to_json(s) order by s.id) from (select * from public.support where trainer_id = t order by id desc limit 200) s), '[]');
end $$;

create or replace function public.admin_log_list(p_limit int default 200) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  perform public._dk_need_admin();
  return coalesce((select jsonb_agg(row_to_json(l) order by l.id desc) from (select * from public.admin_log order by id desc limit greatest(1, least(p_limit, 1000))) l), '[]');
end $$;

-- ---------- Permisos ----------
-- Uso interno: nadie desde fuera
revoke all on function public._dk_admin() from public, anon, authenticated;
revoke all on function public._dk_need_admin() from public, anon, authenticated;
revoke all on function public._dk_log(text, text, jsonb) from public, anon, authenticated;
revoke all on function public._dk_clean() from public, anon, authenticated;
-- Del juego (clave pública)
revoke all on function public.profile_save(uuid, text, text, text, text, jsonb, jsonb, jsonb, jsonb, int, jsonb, text) from public;
revoke all on function public.friend_add(uuid, text, text) from public;
revoke all on function public.friend_reject(uuid, text, text) from public;
revoke all on function public.friend_remove(uuid, text, text) from public;
revoke all on function public.friend_list(uuid, text) from public;
revoke all on function public.inbox_send(uuid, text, text, text, jsonb) from public;
revoke all on function public.inbox_fetch(uuid, text) from public;
revoke all on function public.inbox_take(uuid, text, bigint) from public;
revoke all on function public.news_claim(uuid, text, bigint) from public;
revoke all on function public.news_claimed(uuid, text) from public;
revoke all on function public.support_send(uuid, text, text) from public;
revoke all on function public.support_fetch(uuid, text) from public;
grant execute on function public.profile_save(uuid, text, text, text, text, jsonb, jsonb, jsonb, jsonb, int, jsonb, text) to anon;
grant execute on function public.friend_add(uuid, text, text) to anon;
grant execute on function public.friend_reject(uuid, text, text) to anon;
grant execute on function public.friend_remove(uuid, text, text) to anon;
grant execute on function public.friend_list(uuid, text) to anon;
grant execute on function public.inbox_send(uuid, text, text, text, jsonb) to anon;
grant execute on function public.inbox_fetch(uuid, text) to anon;
grant execute on function public.inbox_take(uuid, text, bigint) to anon;
grant execute on function public.news_claim(uuid, text, bigint) to anon;
grant execute on function public.news_claimed(uuid, text) to anon;
grant execute on function public.support_send(uuid, text, text) to anon;
grant execute on function public.support_fetch(uuid, text) to anon;
-- Del panel (sólo usuarios con sesión; además cada función comprueba que seas admin)
do $$
declare f text;
begin
  foreach f in array array[
    'admin_whoami()', 'admin_stats()', 'admin_players(text, text, int, int)', 'admin_player(text)', 'admin_ban(text, text)', 'admin_unban(text)',
    'admin_rename(text, text, boolean)', 'admin_scores(text, int, boolean, int)', 'admin_flagged()', 'admin_score(uuid, text, int, text)',
    'admin_reset_scores(text)', 'admin_delete_player(text)', 'admin_reports(boolean)', 'admin_report_close(bigint, text)',
    'admin_news_list()', 'admin_news_save(bigint, text, text, jsonb, boolean, boolean, timestamptz)', 'admin_news_delete(bigint)',
    'admin_send(text, text, jsonb)', 'admin_threads()', 'admin_thread(text)', 'admin_log_list(int)']
  loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;
-- (las vistas del juego: también para quien tenga sesión, por si abres el juego con la sesión del panel)
grant select on public.news_public to authenticated;
```


## 7. Imágenes en mensajes, chat y noticias (v5.41)

Ejecuta este bloque **una vez** en *SQL Editor* (después de la sección 6). Se puede repetir.

- Crea el almacén público **daskai-media** en Supabase Storage (máx. 5 MB por imagen; PNG, JPG, WebP o GIF). Cualquiera puede **ver** las imágenes por su dirección; sólo un admin (`public._dk_admin()`) puede **subir**, cambiar o borrar.
- Añade `img` a las noticias (`news`, `news_public`) y al chat (`support`); `admin_send` y `admin_news_save` aceptan `p_img`. Sólo se guardan direcciones `https://` (`_dk_img`).
- El panel reduce las imágenes antes de subirlas (máx. 1600 px, WebP), así que ocupan poco: el plan gratuito de Supabase incluye 1 GB de almacenamiento.
- Para ver o borrar imágenes: Supabase → **Storage → daskai-media**.

```sql
-- =====================================================================
-- Daskai v5.41: imágenes en los mensajes del equipo, en el chat y en las noticias.
-- Requiere haber ejecutado antes la v5.39 y la v5.40. Se puede repetir sin problema.
-- Crea el almacén de imágenes «daskai-media» (público para leer; sólo los admins pueden subir).
-- =====================================================================

-- ---------- Almacén de imágenes (Supabase Storage) ----------
-- (si la base de datos no tiene Storage, esta parte se salta)
grant execute on function public._dk_admin() to authenticated; -- (lo usan las reglas del almacén)
do $$
begin
  if exists (select 1 from pg_namespace where nspname = 'storage') then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
      values ('daskai-media', 'daskai-media', true, 5242880, array['image/png', 'image/jpeg', 'image/webp', 'image/gif'])
      on conflict (id) do update set public = true, file_size_limit = 5242880, allowed_mime_types = array['image/png', 'image/jpeg', 'image/webp', 'image/gif'];
    execute 'drop policy if exists dk_media_admin_insert on storage.objects';
    execute 'drop policy if exists dk_media_admin_update on storage.objects';
    execute 'drop policy if exists dk_media_admin_delete on storage.objects';
    execute $p$create policy dk_media_admin_insert on storage.objects for insert to authenticated with check (bucket_id = 'daskai-media' and public._dk_admin())$p$;
    execute $p$create policy dk_media_admin_update on storage.objects for update to authenticated using (bucket_id = 'daskai-media' and public._dk_admin())$p$;
    execute $p$create policy dk_media_admin_delete on storage.objects for delete to authenticated using (bucket_id = 'daskai-media' and public._dk_admin())$p$;
  end if;
end $$;

-- Una imagen es una dirección https (normalmente la del almacén de arriba)
create or replace function public._dk_img(p text) returns text
language sql immutable as $$
  select case when p is not null and p ~ '^https://[^\s"''<>]+$' and char_length(p) <= 500 then p else null end
$$;

-- ---------- Noticias con imagen ----------
alter table public.news add column if not exists img text check (img is null or char_length(img) <= 500);
create or replace view public.news_public as
  select id, title, body, gift, pinned, created_at, expires_at, img from public.news
  where published and (expires_at is null or expires_at > now());
grant select on public.news_public to anon, authenticated;

drop function if exists public.admin_news_save(bigint, text, text, jsonb, boolean, boolean, timestamptz);
create or replace function public.admin_news_save(p_news bigint, p_title text, p_body text, p_gift jsonb, p_pinned boolean, p_published boolean, p_expires timestamptz, p_img text default null)
returns bigint
language plpgsql security definer set search_path = public as $$
declare nid bigint; im text := public._dk_img(p_img);
begin
  perform public._dk_need_admin();
  if p_gift is not null and (jsonb_typeof(p_gift) <> 'object' or p_gift = '{}'::jsonb) then p_gift := null; end if;
  if p_news is null then
    insert into public.news (title, body, gift, pinned, published, expires_at, img)
      values (left(p_title, 80), left(coalesce(p_body, ''), 2000), p_gift, coalesce(p_pinned, false), coalesce(p_published, true), p_expires, im)
      returning id into nid;
  else
    update public.news set title = left(p_title, 80), body = left(coalesce(p_body, ''), 2000), gift = p_gift, pinned = coalesce(p_pinned, false),
      published = coalesce(p_published, true), expires_at = p_expires, img = im where id = p_news returning id into nid;
  end if;
  perform public._dk_log('news_save', nid::text, jsonb_build_object('title', p_title, 'gift', p_gift, 'img', im));
  return nid;
end $$;

-- ---------- Chat con imagen ----------
alter table public.support add column if not exists img text check (img is null or char_length(img) <= 500);
alter table public.support drop constraint if exists support_body_check;
alter table public.support add constraint support_body_check check (char_length(body) <= 500);

drop function if exists public.support_fetch(uuid, text);
create or replace function public.support_fetch(p_id uuid, p_secret text)
returns table (id bigint, from_admin boolean, body text, img text, created_at timestamptz)
language plpgsql security definer set search_path = public, extensions as $$
declare me public.players;
begin
  me := public._dk_me(p_id, p_secret);
  return query select s.id, s.from_admin, s.body, s.img, s.created_at from public.support s where s.trainer_id = me.trainer_id order by s.id desc limit 50;
end $$;

-- Mensaje (texto y/o imagen) y/o regalo a un jugador
drop function if exists public.admin_send(text, text, jsonb);
create or replace function public.admin_send(p_tid text, p_text text, p_gift jsonb default null, p_img text default null) returns text
language plpgsql security definer set search_path = public as $$
declare t text := upper(p_tid); txt text := left(trim(coalesce(p_text, '')), 500); im text := public._dk_img(p_img); b jsonb;
begin
  perform public._dk_need_admin();
  if not exists (select 1 from public.players where trainer_id = t) then return 'notfound'; end if;
  if p_gift is not null and (jsonb_typeof(p_gift) <> 'object' or p_gift = '{}'::jsonb) then p_gift := null; end if;
  if char_length(txt) = 0 and p_gift is null and im is null then return 'bad'; end if;
  if char_length(txt) > 0 or im is not null then
    insert into public.support (trainer_id, from_admin, body, img, seen) values (t, true, txt, im, true);
    update public.support set seen = true where trainer_id = t and not from_admin;
  end if;
  b := jsonb_build_object('text', txt) || case when im is null then '{}'::jsonb else jsonb_build_object('img', im) end;
  if p_gift is not null then
    insert into public.inbox (to_tid, from_tid, from_name, kind, body) values (t, '@TEAM', 'Daskai', 'agift', b || jsonb_build_object('gift', p_gift));
  else
    insert into public.inbox (to_tid, from_tid, from_name, kind, body) values (t, '@TEAM', 'Daskai', 'admin', b);
  end if;
  perform public._dk_log('send', t, jsonb_build_object('text', txt, 'gift', p_gift, 'img', im));
  return 'ok';
end $$;

-- ---------- Permisos ----------
revoke all on function public.support_fetch(uuid, text) from public;
grant execute on function public.support_fetch(uuid, text) to anon;
revoke all on function public.admin_news_save(bigint, text, text, jsonb, boolean, boolean, timestamptz, text) from public, anon;
grant execute on function public.admin_news_save(bigint, text, text, jsonb, boolean, boolean, timestamptz, text) to authenticated;
revoke all on function public.admin_send(text, text, jsonb, text) from public, anon;
grant execute on function public.admin_send(text, text, jsonb, text) to authenticated;
```


## 8. Chat entre amigos y avisos rápidos (v5.42)

Ejecuta este bloque **una vez** (después de la sección 7). Se puede repetir.

- **dm**: mensajes entre dos amigos (los dos se han aceptado), de hasta 300 caracteres; se borran a las 24 h. `dm_send` (máx. 20 por minuto y 300 por hora), `dm_fetch` (sólo lo nuevo con `p_after`), `dm_threads` (tus conversaciones).
- **dk_poll**: una comprobación muy pequeña (sólo números: último id del buzón, de las noticias, de la respuesta del equipo y de cada conversación). El juego la hace cada 15 s y cada 4 s con el buzón abierto; sólo descarga algo si ha cambiado.

```sql
-- =====================================================================
-- Daskai v5.42: chat entre amigos (conversaciones) y comprobación rápida de novedades.
-- Requiere la v5.39 y la v5.40. Se puede repetir sin problema.
-- =====================================================================

-- Mensajes entre dos amigos. (a_tid, b_tid) = la pareja ordenada. Se borran a las 24 h.
create table if not exists public.dm (
  id         bigint generated always as identity primary key,
  a_tid      text not null,
  b_tid      text not null,
  from_tid   text not null,
  body       text not null check (char_length(body) between 1 and 300),
  created_at timestamptz not null default now()
);
create index if not exists dm_pair_idx on public.dm (a_tid, b_tid, id);
create index if not exists dm_b_idx on public.dm (b_tid, id);
create index if not exists dm_created_idx on public.dm (created_at);
alter table public.dm enable row level security;
revoke all on public.dm from anon, authenticated;

-- ¿Son amigos (los dos se han aceptado)?
create or replace function public._dk_mutual(p_me uuid, p_me_tid text, p_other text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.friends where player_id = p_me and friend_tid = p_other)
     and exists (select 1 from public.friends f join public.players p on p.player_id = f.player_id where p.trainer_id = p_other and f.friend_tid = p_me_tid)
     and not exists (select 1 from public.bans b where b.trainer_id = p_other)
$$;

create or replace function public.dm_send(p_id uuid, p_secret text, p_to text, p_text text) returns text
language plpgsql security definer set search_path = public, extensions as $$
declare me public.players; txt text := left(regexp_replace(coalesce(p_text, ''), '[[:cntrl:]]', '', 'g'), 300); t text := upper(coalesce(p_to, ''));
begin
  begin me := public._dk_me(p_id, p_secret); exception when others then return sqlerrm; end;
  if t !~ '^[A-Z0-9]{6}$' or t = me.trainer_id or char_length(trim(txt)) = 0 then return 'bad'; end if;
  if not public._dk_mutual(p_id, me.trainer_id, t) then return 'notfriends'; end if;
  if (select count(*) from public.dm where from_tid = me.trainer_id and created_at > now() - interval '1 minute') >= 20
     or (select count(*) from public.dm where from_tid = me.trainer_id and created_at > now() - interval '1 hour') >= 300 then return 'slow'; end if;
  delete from public.dm where created_at < now() - interval '24 hours';
  insert into public.dm (a_tid, b_tid, from_tid, body) values (least(me.trainer_id, t), greatest(me.trainer_id, t), me.trainer_id, txt);
  return 'ok';
end $$;

-- Mensajes con un amigo (los de las últimas 24 h; p_after = sólo los más nuevos que ese id)
create or replace function public.dm_fetch(p_id uuid, p_secret text, p_with text, p_after bigint default 0)
returns table (id bigint, from_tid text, body text, created_at timestamptz)
language plpgsql security definer set search_path = public, extensions as $$
declare me public.players; t text := upper(coalesce(p_with, ''));
begin
  me := public._dk_me(p_id, p_secret);
  return query select d.id, d.from_tid, d.body, d.created_at from public.dm d
    where d.a_tid = least(me.trainer_id, t) and d.b_tid = greatest(me.trainer_id, t) and d.id > coalesce(p_after, 0)
      and d.created_at > now() - interval '24 hours'
    order by d.id desc limit 200;
end $$;

-- Tus conversaciones abiertas (último mensaje de cada una)
create or replace function public.dm_threads(p_id uuid, p_secret text)
returns table (with_tid text, name text, last_id bigint, last_from text, last_body text, last_at timestamptz)
language plpgsql security definer set search_path = public, extensions as $$
declare me public.players;
begin
  me := public._dk_me(p_id, p_secret);
  return query select distinct on (w) w, p.name, d.id, d.from_tid, d.body, d.created_at
    from (select x.*, case when x.a_tid = me.trainer_id then x.b_tid else x.a_tid end as w from public.dm x
          where (x.a_tid = me.trainer_id or x.b_tid = me.trainer_id) and x.created_at > now() - interval '24 hours') d
    left join public.players p on p.trainer_id = d.w
    order by w, d.id desc;
end $$;

-- Comprobación rápida (cada pocos segundos): sólo números, para saber si hay que descargar algo
create or replace function public.dk_poll(p_id uuid, p_secret text) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare me public.players;
begin
  begin me := public._dk_me(p_id, p_secret); exception when others then return jsonb_build_object('error', sqlerrm); end;
  return jsonb_build_object(
    'inbox', (select coalesce(max(id), 0) from public.inbox where to_tid = me.trainer_id),
    'news', (select coalesce(max(id), 0) from public.news where published and (expires_at is null or expires_at > now())),
    'support', (select coalesce(max(id), 0) from public.support where trainer_id = me.trainer_id and from_admin),
    'dm', coalesce((select jsonb_object_agg(f, m) from (select from_tid as f, max(id) as m from public.dm
            where (a_tid = me.trainer_id or b_tid = me.trainer_id) and from_tid <> me.trainer_id and created_at > now() - interval '24 hours' group by from_tid) z), '{}'::jsonb));
end $$;

revoke all on function public._dk_mutual(uuid, text, text) from public, anon, authenticated;
revoke all on function public.dm_send(uuid, text, text, text) from public;
revoke all on function public.dm_fetch(uuid, text, text, bigint) from public;
revoke all on function public.dm_threads(uuid, text) from public;
revoke all on function public.dk_poll(uuid, text) from public;
grant execute on function public.dm_send(uuid, text, text, text) to anon;
grant execute on function public.dm_fetch(uuid, text, text, bigint) to anon;
grant execute on function public.dm_threads(uuid, text) to anon;
grant execute on function public.dk_poll(uuid, text) to anon;
```
