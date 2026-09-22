-- =====================================================================
-- Plataforma de diagramas interactivos - esquema Supabase (beta)
-- Ejecutar completo en: Supabase > SQL Editor > New query > Run
-- Requiere activar en Authentication > Providers: "Allow anonymous sign-ins"
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------- Tablas ----------

create table if not exists public.sesiones (
  id          uuid primary key default gen_random_uuid(),
  codigo      text not null unique,
  titulo      text not null,
  diagrama_id text not null,
  docente_id  uuid not null default auth.uid(),
  activa      boolean not null default true,
  creada      timestamptz not null default now()
);

create table if not exists public.participantes (
  id         uuid primary key default gen_random_uuid(),
  sesion_id  uuid not null references public.sesiones(id) on delete cascade,
  user_id    uuid not null,
  nombre     text not null,
  carnet     text not null,
  creado     timestamptz not null default now(),
  unique (sesion_id, carnet)
);

create table if not exists public.respuestas (
  id              uuid primary key default gen_random_uuid(),
  sesion_id       uuid not null references public.sesiones(id) on delete cascade,
  participante_id uuid not null references public.participantes(id) on delete cascade,
  ejercicio_id    text not null,
  tipo            text not null check (tipo in ('numerica','opcion','abierta')),
  respuesta       jsonb not null,
  correcta        boolean,            -- null en respuestas abiertas hasta que el docente califique
  puntaje         numeric,            -- null = pendiente de calificar
  intentos        int not null default 1,
  nota_docente    text,
  actualizado     timestamptz not null default now(),
  unique (participante_id, ejercicio_id)
);

create index if not exists respuestas_sesion_idx on public.respuestas(sesion_id);
create index if not exists participantes_sesion_idx on public.participantes(sesion_id);

-- ---------- Seguridad (RLS) ----------

alter table public.sesiones      enable row level security;
alter table public.participantes enable row level security;
alter table public.respuestas    enable row level security;

-- Sesiones: solo su docente (los estudiantes entran por la funcion unirse()).
drop policy if exists sesiones_docente on public.sesiones;
create policy sesiones_docente on public.sesiones
  for all to authenticated
  using (docente_id = auth.uid())
  with check (docente_id = auth.uid());

-- Participantes: el docente de la sesion ve todos; cada estudiante ve el suyo.
drop policy if exists participantes_docente on public.participantes;
create policy participantes_docente on public.participantes
  for select to authenticated
  using (exists (select 1 from public.sesiones s
                 where s.id = sesion_id and s.docente_id = auth.uid()));

drop policy if exists participantes_propio on public.participantes;
create policy participantes_propio on public.participantes
  for select to authenticated
  using (user_id = auth.uid());

-- Respuestas: docente ve y califica las de su sesion; estudiante ve las suyas.
drop policy if exists respuestas_docente_ver on public.respuestas;
create policy respuestas_docente_ver on public.respuestas
  for select to authenticated
  using (exists (select 1 from public.sesiones s
                 where s.id = sesion_id and s.docente_id = auth.uid()));

drop policy if exists respuestas_docente_calificar on public.respuestas;
create policy respuestas_docente_calificar on public.respuestas
  for update to authenticated
  using (exists (select 1 from public.sesiones s
                 where s.id = sesion_id and s.docente_id = auth.uid()))
  with check (exists (select 1 from public.sesiones s
                      where s.id = sesion_id and s.docente_id = auth.uid()));

drop policy if exists respuestas_propias on public.respuestas;
create policy respuestas_propias on public.respuestas
  for select to authenticated
  using (exists (select 1 from public.participantes p
                 where p.id = participante_id and p.user_id = auth.uid()));

-- ---------- Funciones (los estudiantes escriben SOLO por aqui) ----------

-- Unirse a una sesion con codigo + nombre + carnet.
-- Si el carnet ya existe en esa sesion con el mismo nombre, se reutiliza el
-- registro (permite reconectar desde otro navegador o tras perder la señal).
create or replace function public.unirse(p_codigo text, p_nombre text, p_carnet text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  s public.sesiones;
  p public.participantes;
begin
  if auth.uid() is null then
    raise exception 'Sesion no autenticada';
  end if;

  select * into s from public.sesiones
   where upper(codigo) = upper(trim(p_codigo)) and activa = true;
  if not found then
    raise exception 'Codigo de sesion invalido o cerrada';
  end if;

  if length(trim(p_nombre)) < 3 or length(trim(p_carnet)) < 3 then
    raise exception 'Nombre o carnet incompletos';
  end if;

  select * into p from public.participantes
   where sesion_id = s.id and carnet = trim(p_carnet);

  if found then
    if p.user_id <> auth.uid() and lower(p.nombre) <> lower(trim(p_nombre)) then
      raise exception 'Ese carnet ya esta registrado con otro nombre';
    end if;
    update public.participantes set user_id = auth.uid() where id = p.id
      returning * into p;   -- reconexion desde otro navegador
  else
    insert into public.participantes(sesion_id, user_id, nombre, carnet)
    values (s.id, auth.uid(), trim(p_nombre), trim(p_carnet))
    returning * into p;
  end if;

  return json_build_object(
    'participante_id', p.id,
    'nombre', p.nombre,
    'sesion_id', s.id,
    'titulo', s.titulo,
    'diagrama_id', s.diagrama_id
  );
end;
$$;

-- Enviar / reenviar la respuesta a un ejercicio.
-- BETA: la correccion automatica la calcula el navegador (se puede manipular
-- si un estudiante lee el codigo fuente). Para una nota que cuente de verdad,
-- mover el calculo de "correcta"/"puntaje" a una Edge Function server-side.
create or replace function public.enviar_respuesta(
  p_participante uuid,
  p_ejercicio    text,
  p_tipo         text,
  p_respuesta    jsonb,
  p_correcta     boolean,
  p_puntaje      numeric
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  pa public.participantes;
begin
  select * into pa from public.participantes
   where id = p_participante and user_id = auth.uid();
  if not found then
    raise exception 'Participante no valido';
  end if;

  if not exists (select 1 from public.sesiones where id = pa.sesion_id and activa) then
    raise exception 'La sesion esta cerrada';
  end if;

  insert into public.respuestas(sesion_id, participante_id, ejercicio_id, tipo,
                                respuesta, correcta, puntaje)
  values (pa.sesion_id, pa.id, p_ejercicio, p_tipo, p_respuesta,
          case when p_tipo = 'abierta' then null else p_correcta end,
          case when p_tipo = 'abierta' then null else p_puntaje end)
  on conflict (participante_id, ejercicio_id) do update
    set respuesta   = excluded.respuesta,
        correcta    = case when respuestas.tipo = 'abierta' then respuestas.correcta else excluded.correcta end,
        puntaje     = case when respuestas.tipo = 'abierta' then respuestas.puntaje else excluded.puntaje end,
        intentos    = respuestas.intentos + 1,
        actualizado = now();
end;
$$;

grant execute on function public.unirse(text, text, text) to authenticated;
grant execute on function public.enviar_respuesta(uuid, text, text, jsonb, boolean, numeric) to authenticated;

-- Calificar una respuesta abierta (solo el docente dueño de la sesion).
create or replace function public.calificar_respuesta(
  p_respuesta_id uuid,
  p_puntaje      numeric,
  p_nota         text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.respuestas r
     set puntaje = p_puntaje,
         correcta = (p_puntaje >= 1),
         nota_docente = p_nota,
         actualizado = now()
   where r.id = p_respuesta_id
     and exists (select 1 from public.sesiones s
                 where s.id = r.sesion_id and s.docente_id = auth.uid());
end;
$$;

grant execute on function public.calificar_respuesta(uuid, numeric, text) to authenticated;

-- ---------- Tiempo real ----------
alter publication supabase_realtime add table public.participantes;
alter publication supabase_realtime add table public.respuestas;
