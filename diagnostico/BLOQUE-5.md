# Bloque 5 — Acciones, reescaneo y pruebas integrales

## Cambios incorporados

- Botón para revisar primero el error o advertencia de mayor gravedad.
- Botón para volver a analizar el ZIP actualmente seleccionado.
- Botón para seleccionar nuevamente un ZIP corregido, incluso con el mismo nombre.
- Mensaje que diferencia reanalizar la copia seleccionada de cargar un archivo corregido.
- Pruebas automáticas para las acciones de revisión y reescaneo.
- Prueba integral de diez escenarios: correcto, faltante, duplicado, PEA Base incompleto, Excel vacío, Excel dañado, archivo no identificado, advertencia no bloqueante y error crítico.
- Flujo de GitHub Actions para ejecutar `npm test` en cada cambio de la rama principal y en cada pull request.

## Resultado esperado

Después del análisis, el usuario puede revisar la primera incidencia, corregir los Excel, volver a seleccionar el ZIP y confirmar que los contadores y estados se actualicen antes de importar.

## Comandos de comprobación

```bash
npm run test:acciones
npm run test:flujo
npm test
```

## Versión

`1.0.5`
