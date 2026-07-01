# Importador de Carrera

Modulo nuevo para procesar una carpeta o ZIP completo de una carrera.

Objetivo del modulo:

1. Recibir una carrera completa en ZIP o carpeta.
2. Detectar estructura: carrera, Matriz CCC, niveles, materias y archivos PEA.
3. Clasificar archivos: PEA Base, PEA Unidades, PEA Actividades, fichas y actas.
4. Mostrar vista previa antes de guardar.
5. Guardar datos validados en los modulos existentes de Curriculo.

## Estado por bloques

- Bloque 1: carpeta base, pantalla, estado, UI y vista previa inicial.
- Bloque 2: lectura ZIP/carpeta y deteccion de rutas.
- Bloque 3: clasificacion de archivos y parser Excel.
- Bloque 4: validacion inteligente y vista previa curricular.
- Bloque 5: guardado, rollback y reporte.
- Bloque 6: conexion con menu y Base local.

## Estructura planificada

```txt
importador_carrera/
├─ imp.index.html
├─ imp.styles.css
├─ core/
├─ ui/
├─ input/
├─ detector/
├─ parser/
├─ processor/
├─ validation/
├─ commit/
└─ report/
```
