import { describe, it, expect } from "vitest";
import { parseGoogleFormCSVToResponses } from "../parseGoogleFormCSV";

const mockProject = {
  brands: [
	{ name: "Coca-Cola" },
	{ name: "Pepsi" },
  ],
  attributes: [
	{ id: "taste", labelEs: "Sabor", labelEn: "Taste" },
	{ id: "price", labelEs: "Precio", labelEn: "Price" },
  ],
};

const csv = `
Timestamp,Coca-Cola [Sabor],Coca-Cola [Precio],Pepsi [Sabor],Pepsi [Precio]
2024/01/01 10:00,5,4,3,2
2024/01/01 10:01,4,3,4,3
`;

describe("parseGoogleFormCSVToResponses", () => {
  it("parses Google Forms CSV and builds responses correctly", () => {
	const responses = parseGoogleFormCSVToResponses(csv, mockProject);

	// 2 строки = 2 responses
	expect(responses.length).toBe(2);

	const r0 = responses[0];

	// структура
	expect(r0).toHaveProperty("performance");
	expect(r0).toHaveProperty("ts");

	// бренды
	expect(r0.performance).toHaveProperty("Coca-Cola");
	expect(r0.performance).toHaveProperty("Pepsi");

	// атрибуты
	expect(r0.performance["Coca-Cola"].taste).toBe(5);
	expect(r0.performance["Coca-Cola"].price).toBe(4);
	expect(r0.performance["Pepsi"].taste).toBe(3);
	expect(r0.performance["Pepsi"].price).toBe(2);
  });
});