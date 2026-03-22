import { describe, it } from "node:test";
import assert from "node:assert";
import { hasGeocodableCoordinates, pickStreetName } from "./reverse-geocode.js";

describe("reverse-geocode", () => {
  it("accepts real coordinates and rejects origin", () => {
    assert.strictEqual(hasGeocodableCoordinates(39.45983, -82.07542), true);
    assert.strictEqual(hasGeocodableCoordinates(0, 0), false);
  });

  it("prefers road-like fields when extracting a street name", () => {
    const street = pickStreetName({
      address: {
        road: "Main Street",
        city: "McArthur",
      },
    });

    assert.strictEqual(street, "Main Street");
  });

  it("falls back to display name when no road is available", () => {
    const street = pickStreetName({
      display_name: "Zaleski, Vinton County, Ohio, United States",
    });

    assert.strictEqual(street, "Zaleski");
  });
});
