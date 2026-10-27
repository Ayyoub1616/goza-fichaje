-- GOZA Fichaje v2 · Instalación EXCLUSIVA en un proyecto Supabase nuevo.
-- No ejecutar en otros proyectos. Fechas UTC almacenadas y Europe/Madrid en pantalla.
create schema if not exists goza_private;
revoke all on schema goza_private from public,anon,authenticated;
create table public.staff(
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null unique references auth.users(id),
 employee_code text not null unique check(employee_code ~ '^[A-Z0-9-]{3,24}$'),
 full_name text not null check(length(trim(full_name)) between 2 and 100),
 role text not null default 'employee' check(role in ('employee','admin')),
 active boolean not null default true,
 weekly_target numeric(5,2) check(weekly_target between 0 and 60),
 created_at timestamptz not null default now()
);
create table public.shifts(
 id uuid primary key default gen_random_uuid(),
 staff_id uuid not null references public.staff(id),
 started_at timestamptz not null,
 ended_at timestamptz,
 paused_seconds integer not null default 0 check(paused_seconds>=0),
 pause_started_at timestamptz,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 check (ended_at is null or ended_at >= started_at),
 check (ended_at is null or pause_started_at is null),
 check (ended_at is null or ended_at - started_at < interval '48 hours')
);
create unique index shifts_one_open on public.shifts(staff_id) where ended_at is null;
create index shifts_by_start on public.shifts(started_at desc);
create index shifts_by_staff on public.shifts(staff_id,started_at desc);
create table public.clock_events(
 id uuid primary key default gen_random_uuid(),
 shift_id uuid not null references public.shifts(id),
 staff_id uuid not null references public.staff(id),
 kind text not null check(kind in ('entry','break_start','break_end','exit')),
 happened_at timestamptz not null default clock_timestamp()
);
create index events_by_staff_time on public.clock_events(staff_id,happened_at desc);
create table public.incidents(
 id uuid primary key default gen_random_uuid(),
 staff_id uuid not null references public.staff(id),
 reason text not null check(length(trim(reason)) between 8 and 1000),
 status text not null default 'pending' check(status in ('pending','resolved','rejected')),
 created_at timestamptz not null default now(),
 reviewed_at timestamptz,
 reviewed_by uuid references public.staff(id),
 review_note text
);
create index incidents_by_status on public.incidents(status,created_at desc);
create table public.corrections(
 id uuid primary key default gen_random_uuid(),
 shift_id uuid not null references public.shifts(id),
 staff_id uuid not null references public.staff(id),
 changed_by uuid not null references public.staff(id),
 changed_at timestamptz not null default now(),
 reason text not null check(length(trim(reason)) between 8 and 1000),
 old_started_at timestamptz not null, old_ended_at timestamptz, old_paused_seconds integer not null,
 new_started_at timestamptz not null, new_ended_at timestamptz, new_paused_seconds integer not null
);
-- El historial original y las correcciones son inmutables incluso para el administrador.
create function goza_private.refuse_mutation() returns trigger language plpgsql set search_path='' as $$
begin raise exception 'Historial inmutable';end $$;
create trigger events_immutable before update or delete on public.clock_events
 for each row execute function goza_private.refuse_mutation();
create trigger corrections_immutable before update or delete on public.corrections
 for each row execute function goza_private.refuse_mutation();

create function goza_private.my_staff() returns uuid language sql stable security definer set search_path='' as $$
 select id from public.staff where user_id=(select auth.uid()) and active=true limit 1
$$;
create function goza_private.is_admin() returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.staff where user_id=(select auth.uid()) and role='admin' and active=true)
$$;
create function goza_private.assert_admin() returns uuid language plpgsql stable security definer set search_path='' as $$
declare sid uuid;
begin
 select id into sid from public.staff where user_id=auth.uid() and active and role='admin';
 if sid is null then raise exception 'No autorizado';end if;
 return sid;
end $$;
revoke all on function goza_private.my_staff(),goza_private.is_admin(),goza_private.assert_admin() from public,anon;
grant usage on schema goza_private to authenticated;
grant execute on function goza_private.my_staff(),goza_private.is_admin(),goza_private.assert_admin() to authenticated;

alter table public.staff enable row level security;
alter table public.shifts enable row level security;
alter table public.clock_events enable row level security;
alter table public.incidents enable row level security;
alter table public.corrections enable row level security;
revoke all on public.staff,public.shifts,public.clock_events,public.incidents,public.corrections from anon,authenticated;
grant select on public.staff,public.shifts,public.clock_events,public.incidents,public.corrections to authenticated;
create policy staff_read on public.staff for select to authenticated using
 (user_id=(select auth.uid()) or (select goza_private.is_admin()));
create policy shifts_read on public.shifts for select to authenticated using
 (staff_id=(select goza_private.my_staff()) or (select goza_private.is_admin()));
create policy events_read on public.clock_events for select to authenticated using
 (staff_id=(select goza_private.my_staff()) or (select goza_private.is_admin()));
create policy incidents_read on public.incidents for select to authenticated using
 (staff_id=(select goza_private.my_staff()) or (select goza_private.is_admin()));
create policy corrections_read on public.corrections for select to authenticated using
 (staff_id=(select goza_private.my_staff()) or (select goza_private.is_admin()));

-- Todas las escrituras de fichaje pasan por función transaccional. Sin aceptar horas del dispositivo.
create function public.clock_action(p_action text) returns jsonb language plpgsql security definer set search_path='' as $$
declare s uuid; sh public.shifts%rowtype; t timestamptz := clock_timestamp();
begin
 select id into s from public.staff where user_id=auth.uid() and active=true for update;
 if s is null then raise exception 'Usuario no autorizado';end if;
 if p_action not in ('entry','break_start','break_end','exit') then raise exception 'Acción inválida';end if;
 select * into sh from public.shifts where staff_id=s and ended_at is null for update;
 if p_action='entry' then
   if sh.id is not null then raise exception 'Ya tienes una jornada abierta'; end if;
   insert into public.shifts(staff_id,started_at) values(s,t) returning * into sh;
 elsif sh.id is null then
   raise exception 'No hay jornada abierta';
 elsif p_action='break_start' then
   if sh.pause_started_at is not null then raise exception 'Ya tienes una pausa abierta'; end if;
   update public.shifts set pause_started_at=t,updated_at=t where id=sh.id;
 elsif p_action='break_end' then
   if sh.pause_started_at is null then raise exception 'No hay una pausa activa'; end if;
   update public.shifts set paused_seconds=paused_seconds+greatest(0,extract(epoch from(t-pause_started_at))::integer),
     pause_started_at=null,updated_at=t where id=sh.id;
 else
   if sh.started_at>t then raise exception 'La hora de entrada no puede estar en el futuro';end if;
   if t-sh.started_at>=interval '48 hours' then
      raise exception 'Jornada de más de 48 h; solicita corrección al responsable';
   end if;
   update public.shifts set ended_at=t,paused_seconds=paused_seconds+
     case when pause_started_at is null then 0 else greatest(0,extract(epoch from(t-pause_started_at))::integer) end,
     pause_started_at=null,updated_at=t where id=sh.id;
 end if;
 insert into public.clock_events(shift_id,staff_id,kind,happened_at) values(sh.id,s,p_action,t);
 return jsonb_build_object('ok',true,'shift_id',sh.id,'server_time',t);
end $$;

create function public.submit_incident(p_reason text) returns uuid language plpgsql security definer set search_path='' as $$
declare s uuid; created uuid;
begin
 s:=goza_private.my_staff();
 if s is null then raise exception 'No autorizado';end if;
 if length(trim(coalesce(p_reason,''))) not between 8 and 1000 then raise exception 'Describe el problema con al menos 8 caracteres';end if;
 insert into public.incidents(staff_id,reason) values(s,trim(p_reason)) returning id into created;
 return created;
end $$;
create function public.review_incident(p_id uuid,p_status text,p_note text default null) returns void language plpgsql security definer set search_path='' as $$
declare who uuid;
begin
 who:=goza_private.assert_admin();
 if p_status not in ('resolved','rejected','pending') then raise exception 'Estado inválido';end if;
 update public.incidents set status=p_status,review_note=left(coalesce(p_note,''),500),reviewed_by=who,
 reviewed_at=case when p_status='pending' then null else now() end
 where id=p_id;
 if not found then raise exception 'Incidencia no encontrada';end if;
end $$;
create function public.correct_shift(p_id uuid,p_start timestamptz,p_end timestamptz,p_pause_seconds integer,p_reason text)
returns void language plpgsql security definer set search_path='' as $$
declare who uuid; sh public.shifts%rowtype; t timestamptz:=clock_timestamp();
begin
 who:=goza_private.assert_admin();
 if length(trim(coalesce(p_reason,''))) not between 8 and 1000 then raise exception 'Indica el motivo de la corrección';end if;
 if p_start is null or p_end is null or p_end <= p_start or p_end-p_start >= interval '48 hours'
    or p_start>t+interval '5 minutes' or p_end>t+interval '5 minutes'
    or p_pause_seconds is null or p_pause_seconds<0
    or p_pause_seconds >= extract(epoch from (p_end-p_start)) then raise exception 'Horas o pausa no válidas';end if;
 select * into sh from public.shifts where id=p_id for update;
 if sh.id is null then raise exception 'Jornada no encontrada';end if;
 -- Una jornada con pausa activa debe cerrarse primero en el flujo ordinario.
 if sh.pause_started_at is not null then raise exception 'Finaliza primero la pausa abierta';end if;
 insert into public.corrections(shift_id,staff_id,changed_by,reason,old_started_at,old_ended_at,old_paused_seconds,
 new_started_at,new_ended_at,new_paused_seconds)
 values(sh.id,sh.staff_id,who,trim(p_reason),sh.started_at,sh.ended_at,sh.paused_seconds,p_start,p_end,p_pause_seconds);
 update public.shifts set started_at=p_start,ended_at=p_end,paused_seconds=p_pause_seconds,updated_at=t where id=sh.id;
end $$;
-- Proteger RPC SECURITY DEFINER públicos; no permitir a anon/PUBLIC ejecutarlos.
revoke execute on function public.clock_action(text),public.submit_incident(text),
 public.review_incident(uuid,text,text),public.correct_shift(uuid,timestamptz,timestamptz,integer,text)
 from public,anon;
grant execute on function public.clock_action(text),public.submit_incident(text),
 public.review_incident(uuid,text,text),public.correct_shift(uuid,timestamptz,timestamptz,integer,text)
 to authenticated;

-- ARRANQUE: desde Authentication > Users, crear tu usuario real con email y contraseña segura.
-- Después ejecutar, reemplazando EL UUID (nunca pegar contraseña ni token):
-- insert into public.staff(user_id,employee_code,full_name,role)
-- values ('UUID-DE-TU-USUARIO','GOZA-ADMIN','Administrador GOZA','admin');
-- No se admiten registros de empleados desde la web pública; solo alta con Edge Function autenticada.
