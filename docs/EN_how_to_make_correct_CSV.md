🇬🇧 Minimal guide: how to get a correct CSV for POSICIONAMIENTO

Goal:
Generate a CSV file compatible with the POSICIONAMIENTO app to build perceptual maps.

⸻

1. Designer — mandatory first step

In the POSICIONAMIENTO app:
	•	Define brands (including IDEAL, if used).
	•	Define attributes.
	•	These names are the single source of truth for the survey.

⚠️ Important:
Brand and attribute names must not be edited later.

⸻

2. Google Form — survey setup
	•	Use a matrix (Likert scale 1–5) question type.
	•	Create one question per attribute.
	•	Columns = brand names (copy & paste from Designer).
	•	Attribute text must exactly match Designer (same language).

You must include the general preference question:

“Overall, how much would you prefer this brand?”

⚠️ Do not modify this question text.

⸻

3. Responses and export
	•	Responses are stored automatically in Google Sheets.
	•	From Google Sheets:
	•	File → Download → CSV
	•	Do not edit the CSV manually.

⸻

4. Import into the app
	•	In the Survey page of POSICIONAMIENTO:
	•	Import the CSV file.
	•	Click Apply to map to compute the maps.

If brand and attribute names match Designer → it works.