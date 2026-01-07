# Contrato CSV v2 — POSICIONAMIENTO

## Propósito
Este archivo CSV se utiliza para importar los resultados de encuestas de estudiantes
en la aplicación **POSICIONAMIENTO** para construir mapas perceptuales.

Fuente de datos:
**Google Forms → Google Sheets → Exportar como CSV**

---

## 1. Formato general

- El archivo CSV contiene:
  - 1 fila de encabezados
  - N filas de respuestas (participantes)
- Separador: `,` (coma)
- La primera columna (`Timestamp`) se ignora automáticamente

---

## 2. Formato de los encabezados (obligatorio)

Cada columna de datos debe tener el formato: Marca [Atributo]

Ejemplos:
- `Coca-Cola [Sabor]`
- `Pepsi [Precio]`
- `BMW [Preferencia general]`

No se permiten encabezados arbitrarios ni modificaciones del formato.

---

## 3. Marcas

- El nombre de la marca debe coincidir **exactamente**
  con el definido en la página **Designer**
- No se traducen los nombres de marca
- No se admiten marcas desconocidas

---

## 4. Atributos

- El atributo debe existir en Designer:
  - por `id`
  - o por `labelEs`
  - o por `labelEn`
- El idioma del CSV debe coincidir con el idioma del cuestionario

---

## 5. Preferencia general

- La preferencia se trata como **un atributo normal**
- Debe existir en Designer como atributo
- Se define **por marca**, por ejemplo:

Coca-Cola [Preferencia general]
Pepsi [Preferencia general]

---

## 6. Filas de respuestas

- Cada fila representa un estudiante
- Todas las marcas deben tener valores
- Valores permitidos: **1 a 5**
- Filas incompletas se ignoran

---

## 7. Validación

La importación falla si:
- hay marcas desconocidas
- hay atributos desconocidos
- el formato del encabezado es incorrecto
- no existen respuestas válidas

---

Este contrato es **estricto y obligatorio**.