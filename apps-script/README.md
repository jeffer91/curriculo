# Google Apps Script de sincronización

Este módulo corresponde únicamente al entorno de pruebas de la pantalla **Sincronización**.

## Alcance actual

- Usa exclusivamente la hoja `99_SYNC_TEST`.
- No modifica materias, unidades, actividades, bibliografía ni validaciones.
- Compara cada registro mediante `id`, `version`, `actualizadoEn` y `hash`.
- La versión más nueva actualiza a la versión anterior.
- Si versión, fecha y contenido no permiten decidir, se devuelve un conflicto.

## Configuración

1. Crear o seleccionar un archivo de Google Sheets destinado a pruebas.
2. Abrir **Extensiones → Apps Script**.
3. Copiar el contenido de `Code.gs` dentro del proyecto de Apps Script.
4. Abrir **Configuración del proyecto → Propiedades del script**.
5. Crear la propiedad:
   - `SPREADSHEET_ID`: ID del archivo de Google Sheets.
6. Opcionalmente, crear:
   - `SYNC_TOKEN`: token privado para validar las solicitudes.
7. Ejecutar manualmente `ejecutarPruebaLocal` una vez y aceptar los permisos.
8. Seleccionar **Implementar → Nueva implementación → Aplicación web**.
9. Ejecutar como el propietario del script.
10. Configurar el acceso según las políticas de la institución.
11. Copiar la URL terminada en `/exec` y colocarla en la pantalla Sincronización.

## Prueba inicial

1. Guardar la configuración desde la aplicación.
2. Pulsar **Probar conexión**.
3. Crear una nueva versión en **Registro local de prueba**.
4. Pulsar **Comparar bases**.
5. Pulsar **Sincronizar ahora**.
6. Confirmar que se creó la pestaña `99_SYNC_TEST` y que la fila conserva su versión y fecha.

## Seguridad

No guardar en GitHub:

- token de sincronización;
- credenciales de Google;
- claves privadas;
- enlaces con secretos incorporados.

La pantalla guarda la configuración de pruebas en una base IndexedDB separada llamada `BD_SYNC_CURRICULO_CCC`; no reemplaza ni modifica `BD_GESTION_CURRICULAR_CCC`.