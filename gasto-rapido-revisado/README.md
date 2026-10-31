# Gasto Rápido

App personal para registrar gastos en 3 toques y detectar fugas de dinero.
PWA sin dependencias (HTML + CSS + JavaScript). Tus datos viven solo en el teléfono (IndexedDB).

## Publicarla en GitHub Pages (una sola vez)

1. Entra a github.com → **New repository**. Nombre: `gasto-rapido`. Déjalo **Public** (GitHub Pages gratis lo requiere) y crea el repositorio.
   El repositorio solo contiene código; tus gastos nunca salen del teléfono.
2. En el repositorio: **Add file → Upload files**. Arrastra **todo el contenido** de esta carpeta
   (index.html, manifest.webmanifest, sw.js, y las carpetas css, js, icons). Pulsa **Commit changes**.
3. **Settings → Pages**. En *Build and deployment* elige **Deploy from a branch**, rama `main`, carpeta `/ (root)`. Guarda.
4. En 1–2 minutos aparece el enlace: `https://TU-USUARIO.github.io/gasto-rapido/`.

## Instalarla en el Galaxy S26 Ultra

1. Abre ese enlace en **Chrome**.
2. Menú ⋮ → **Instalar app** (o *Agregar a pantalla de inicio*).
3. Abre la app desde el ícono. La primera vez que guardes un gasto pide protección de datos; acéptala.
4. Mantén presionado el ícono para los accesos directos: **Nuevo gasto**, **Nuevo ingreso** y **Resumen del mes**.

## Actualizar la app

Sube los archivos modificados al repositorio y **cambia el número de versión** en `sw.js`
(`const VERSION = 'v1.0.2'`). Cierra todas las ventanas de la app y vuelve a abrirla con conexión para activar la actualización.

## Respaldo

- Cada 7 días aparece un aviso en Captura. Un toque abre el menú de compartir de Android: guárdalo en Drive.
- Restaurar: Ajustes → **Restaurar desde un respaldo** y elige el archivo `.json`.
- Antes de cambiar de teléfono, haz un respaldo y restáuralo en el nuevo.

## Notas

- Los montos se guardan en centavos (enteros) para evitar errores de redondeo.
- Si borras los datos de Chrome o desinstalas la app, se pierden los datos: por eso el respaldo.
- Estructura: `js/db.js` (datos), `js/logic.js` (cálculos puros), una pantalla por archivo
  (`capture.js`, `movements.js`, `summary.js`, `settings.js`).

## Novedades v1.1 — tu plan de presupuesto

- **Ajustes → Mi plan → Aplicar mi presupuesto:** carga los montos del Excel (total $10,525 al mes) y marca como *fuera del plan* Comida fuera, Café/antojos, Súper, Ropa y Entretenimiento.
- **Alerta antes de guardar:** si un gasto te pasa del presupuesto de su categoría o del total del mes, o es de una categoría fuera del plan, la app te pregunta antes de registrarlo y te ofrece mandarlo a la Lista de deseos.
- **Lista de deseos (regla de 30 días):** a los 30 días te pregunta si todavía lo quieres y suma lo que te ahorraste.
- **Recordatorios en la app:** quincena (págate primero y regla de 48 horas) y revisión de domingo. Para avisos con la app cerrada, usa MacroDroid (instrucciones en Ajustes → Recordatorios).
- **Resumen → Tu plan del mes:** total gastado contra el plan, cuánto te queda y gastos fuera del plan.
