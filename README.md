# Plataforma de diagramas interactivos (beta)

Reemplaza las diapositivas y AhaSlides por diagramas interactivos: el
profesor comparte la pantalla por Zoom, y cada estudiante entra desde su
propio dispositivo (con nombre y carnet) a su propia copia del diagrama para
resolver ejercicios mientras el profesor ve el avance de todos en una
pizarra en vivo.

Sitio 100% estático (sirve para GitHub Pages, igual que tu repo
`sitio-asignaturas`), con Supabase como backend (base de datos, login y
tiempo real).

## 1. Crear el proyecto en Supabase

1. Entra a https://supabase.com, crea una cuenta y un proyecto nuevo (plan Free).
2. En **Authentication > Providers**, activa **"Allow anonymous sign-ins"**
   (los estudiantes entran sin contraseña).
3. En **Authentication > URL Configuration**, agrega la URL donde vas a
   publicar el sitio (ej. `https://rolous1588-rgb.github.io/tu-repo/`) tanto
   en *Site URL* como en *Redirect URLs*, para que el enlace de acceso del
   docente funcione.
4. En **SQL Editor > New query**, pega todo el contenido de
   `supabase/schema.sql` y dale **Run**. Esto crea las tablas, las
   políticas de seguridad y las funciones que usa el sitio.
5. En **Project Settings > API**, copia el **Project URL** y la **anon
   public key**.

## 2. Conectar el sitio a tu proyecto

Abre `js/config.js` y reemplaza:

```js
export const SUPABASE_URL = "https://TU-PROYECTO.supabase.co";
export const SUPABASE_ANON_KEY = "TU-ANON-KEY";
```

con los valores del paso anterior. La *anon key* es segura para exponer en
el frontend: el acceso real lo controlan las políticas de la base de datos
(RLS) y las funciones del `schema.sql`.

## 3. Probar en local

No necesitas Node para el sitio en sí (es HTML/JS puro), pero los
`import` de ES modules requieren servirlo por HTTP, no abrirlo con
doble clic:

```bash
cd plataforma-diagramas
python3 -m http.server 8080
```

Abre `http://localhost:8080` — un lado como docente y otro (en modo
incógnito, o desde el celular) como estudiante.

## 4. Publicar

Copia toda esta carpeta dentro de tu repositorio `sitio-asignaturas` (por
ejemplo en una subcarpeta `diagramas-app/`) y haz push a GitHub. GitHub
Pages la sirve automáticamente. El enlace y el QR que genera el panel del
docente usan la URL del navegador, así que funcionan solos apenas los subes.

## Cómo usar en clase

1. Entra a `docente.html`, pon tu correo y abre el enlace que te llega por
   email (login sin contraseña).
2. Crea una sesión: título + diagrama. Se genera un código y un QR.
3. Proyecta el QR o dicta el código; cada estudiante entra desde
   `estudiante.html` con su nombre y carnet.
4. Usa "Ver diagrama para compartir en Zoom" para la explicación en vivo
   (se anima solo, sin controles) mientras cada estudiante manipula su
   propia copia y responde los ejercicios.
5. Sigue la pizarra en vivo: se actualiza sola con cada respuesta. Las
   respuestas abiertas aparecen abajo para que las califiques con un clic.
6. Al terminar, exporta el CSV con los resultados y cierra la sesión.

## Agregar un diagrama nuevo

La estructura ya está pensada para esto — no hay que tocar nada del resto
del sitio:

1. Crea una carpeta `diagramas/<id-del-diagrama>/`.
2. Agrega `manifest.json` (conceptos + ejercicios) siguiendo el formato de
   `diagramas/lazo-4-20ma/manifest.json`.
3. Agrega `diagram.js` que exporte `montar()` (versión interactiva del
   estudiante) y `montarSoloLectura()` (versión animada para proyectar).
   Puedes pedirme que te genere uno nuevo (por ejemplo, un puente de
   Wheatstone, un divisor de tensión, un diagrama de Bode) y yo te entrego
   esos dos archivos listos.
4. Agrega una línea en `js/registry.js` con el id y la carpeta.

Eso es todo: el nuevo diagrama ya aparece en el selector del docente.

## Limitaciones del beta (a mejorar después)

- La corrección de ejercicios numéricos y de opción múltiple se calcula en
  el navegador del estudiante; para una evaluación que cuente oficialmente
  para nota, conviene mover ese cálculo a una Edge Function de Supabase
  (server-side), para que no se pueda manipular desde la consola del
  navegador.
- El plan gratuito de Supabase pausa el proyecto tras 7 días sin uso (el
  primer acceso después tarda unos 20-30 segundos en "despertar"); basta con
  abrir el panel del docente un rato antes de cada clase.
- Por ahora solo hay un diagrama (lazo 4-20 mA) para validar el flujo
  completo antes de construir el resto del temario de instrumentación
  industrial.
