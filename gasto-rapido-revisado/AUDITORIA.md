# Auditoría de Gasto Rápido — 22 de octubre de 2026

Se conserva el ZIP original. Esta copia incorpora correcciones de mantenimiento y datos.
No se ha publicado en una cuenta externa ni se ha generado una URL pública.

## Resultado

La versión original abre en navegador local y permite registrar Café por $55, verlo en Movimientos y abrir su editor. Los 11 módulos pasan el análisis de sintaxis. El manifiesto real se llama manifest.webmanifest: es JSON válido, tiene display standalone, scope/start_url relativos e iconos declarados presentes. Las rutas relativas permiten alojar la app en una subcarpeta de GitHub Pages. Los recursos son locales; no requiere compilación ni CDN.

## Hallazgos y correcciones

- sw.js borraba todas las cachés del origen salvo la propia. Podía afectar otras PWAs del mismo usuario en GitHub Pages. Ahora aísla la caché por scope y solo elimina versiones de esa app.
- La estrategia anterior actualizaba archivos individuales en segundo plano y no prolongaba con waitUntil las escrituras. Ahora el conjunto de recursos se precarga por versión; el nuevo worker espera al cierre de las ventanas antiguas. Cambiar VERSION en cada publicación.
- El fallback anterior devolvía HTML también para JS/CSS ausentes sin conexión. Ahora solo devuelve index.html para navegaciones; otros recursos ausentes responden 503.
- db.js modificaba la memoria antes de confirmar IndexedDB. Ahora actualiza el estado tras completar la transacción: un fallo de escritura no deja un movimiento ficticio en memoria.
- validateBackup no rechazaba data:null ni validaba todas las colecciones. Ahora valida esquema, IDs únicos, campos, importes, fechas y categorías antes de restaurar. Los IDs históricos de métodos de pago eliminados siguen siendo válidos.
- toCents aceptaba texto parcial como 55abc. Ahora exige un monto completo, con hasta dos decimales y agrupación de miles correcta.
- app.js ahora escapa el mensaje de error inicial y avisa si falla el registro del Service Worker.

## Pruebas realizadas

- Original: apertura, registro rápido, lista y apertura del editor en navegador local.
- Copia corregida: análisis de sintaxis de los 11 módulos y sw.js; JSON del manifiesto y presencia de iconos.
- Conversión de 55, 800 y 1,234.50; rechazo de 55abc, 12,34, -1 y exceso de decimales.
- Rechazo de respaldos nulos/incompletos.
- Umbrales de presupuesto de 80% y 100%; recurrente del día 31 en febrero.

La prueba final en navegador de la copia corregida fue interrumpida. No se certifica aún funcionamiento offline real, instalación Android, diseño en pantalla física ni restauración integral. Revisión de código favorable al precache, pendiente prueba real siguiente.

## Publicación recomendada

1. Descomprime gasto-rapido-revisado.zip.
2. Inicia sesión en Netlify y abre https://app.netlify.com/drop.
3. Arrastra la carpeta gasto-rapido-revisado que contiene directamente index.html, sw.js, manifest.webmanifest, css, js e icons. No arrastres una carpeta superior.
4. Abre el enlace HTTPS en Chrome del teléfono e instala la app.
5. Con internet, abre la app y espera la instalación del worker. Ciérrala y vuelve a abrirla. Activa modo avión, registra un gasto, revisa Movimientos, cierra y vuelve a abrir. Debe conservarlo y abrir sin red.

Netlify es la vía más rápida para este paquete estático. GitHub Pages también es compatible. Conserva la misma dirección al actualizar: IndexedDB está separado por origen; un dominio nuevo no comparte los datos anteriores.

## Ajustes iniciales

- Gastos de un toque: Café $55 (prescindible), Gasolina $800 (necesario); ambos sin método de pago.
- Meta de ahorro: 0%, desactivada.
- Categorías y presupuestos: 11 de gasto y 2 de ingreso; todas sin presupuesto mensual. Revisa Necesario/Prescindible.
- Métodos: Efectivo, Débito y Transferencia/Mercado Pago.
- Recurrentes: ninguno; añade importe y día de tus pagos.
- Protección del almacenamiento y respaldo JSON: los datos solo están en el navegador/dispositivo; no hay sincronización automática. El aviso semanal no crea un respaldo por sí solo.
