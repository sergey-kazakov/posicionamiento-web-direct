# CSV Contract v2 — POSICIONAMIENTO

## Purpose
This CSV file is used to import student survey results
into the **POSICIONAMIENTO** application to build perceptual maps.

Data source:
**Google Forms → Google Sheets → Export as CSV**

---

## 1. General format

- The CSV file contains:
  - 1 header row
  - N response rows (participants)
- Separator: `,` (comma)
- The first column (`Timestamp`) is automatically ignored

---

## 2. Header format (mandatory)

Each data column must follow this format: Brand [Attribute]

Examples:
- `Coca-Cola [Taste]`
- `Pepsi [Price]`
- `BMW [Overall preference]`

Arbitrary headers or format changes are not allowed.

---

## 3. Brands

- Brand names must **exactly match**
  those defined in the **Designer** page
- Brand names are not translated
- Unknown brands are not accepted

---

## 4. Attributes

- Attributes must exist in Designer:
  - by `id`
  - or `labelEs`
  - or `labelEn`
- The CSV language must match the survey language

---

## 5. Overall preference

- Preference is treated as a **regular attribute**
- It must exist in Designer as an attribute
- Defined **per brand**, for example:

Coca-Cola [Overall preference]
Pepsi [Overall preference]

---

## 6. Response rows

- Each row represents one student
- All brands must have values
- Allowed values: **1 to 5**
- Incomplete rows are ignored

---

## 7. Validation

Import fails if:
- unknown brands are found
- unknown attributes are found
- header format is invalid
- no valid responses exist

---

This contract is **strict and mandatory**.