# Cambios en curso

Notas de lo que fuimos haciendo. Lo ya publicado está en `master`. El resto está en la máquina y todavía no se subió.

## Ya en master

- **Ventana de seguridad de 5 a 2 días** (`23bd8cb`). Una prenda reservada se bloquea desde 2 días antes del retiro hasta la devolución. El inicio sale de la fecha de retiro; si no hay retiro, de la fecha del evento. El fin es la fecha de devolución; si no hay devolución, la fecha del evento.

## Hecho, todavía sin subir

- **El admin puede cambiar esa ventana para todo el local.** En Ajustes → Ventana de bloqueo. El número son los días previos al retiro (de 0 a 30). La pantalla explica de dónde sale el inicio, el fin y la marca de reservado en productos. Hay que reiniciar el backend para que se cree el ajuste.

- **Conjuntos para armar ya no deja pegado “En modista”.** Si la prenda volvió, se alquiló o está en salón, el reporte usa ese estado. Un ingreso viejo a modista sin fecha de salida no la vuelve a marcar. Al pasar a salón, alquilarla o venderla, ese ingreso se cierra.

- **Imprimir la etiqueta grande en Órdenes de trabajo también marca el conjunto como separado.** Es la misma marca que el tilde de la seña. Si la etiqueta no llega a imprimirse, no se marca. En Reportes figura como ya separado.

- **Editar un presupuesto y cambiar el tipo de precio.** Al abrir la edición, cada prenda vuelve a tomar los precios del producto (alquiler lista, efectivo, medio uso, liquidación, etc.), no el importe ya guardado. Si había descuento, se muestra de nuevo sobre esos precios y no se aplica dos veces. Si un tipo no tiene precio cargado, se deja el que estaba en vez de poner 0. Un 0 que sí está en el producto se respeta.

- **Buscar prendas en un presupuesto muestra todas las coincidencias.** Antes la lista cortaba en 30 (por ejemplo, no entraban todos los corbatines). Ahora trae todas las páginas.

- **Prendas a armar imprime la etiqueta resumen de cada reserva.** El botón de arriba ya no saca una etiqueta por prenda. Sale una por orden marcada, con cliente, fechas y el conjunto.

- **Devoluciones muestra el número de contrato y se puede buscar por él.** La grilla y los modales de devolución lo muestran junto a la orden. El buscador lo encuentra sin ir a Contratos.
