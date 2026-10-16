import {
  createGearSetAcquisitionMap,
  formatGearSetAcquisitionSourceName,
} from "./gear-set-acquisition";

describe("createGearSetAcquisitionMap", () => {
  it("formats curated sources from source type and manifest location names", () => {
    const acquisitions = createGearSetAcquisitionMap(
      [
        {
          hash: 2151917545,
          displayProperties: { name: "Renegades armor" },
          setItems: [],
        },
        {
          hash: 2386215115,
          displayProperties: { name: "Pantheon armor" },
          setItems: [],
        },
        {
          hash: 3639539903,
          displayProperties: { name: "Vesper armor" },
          setItems: [],
        },
        {
          hash: 2250480800,
          displayProperties: { name: "Moon armor" },
          setItems: [],
        },
      ],
      [],
      {
        activityLocations: [
          {
            hash: 2439131218,
            displayProperties: { name: "Renegades" },
          },
          {
            hash: 2112123535,
            displayProperties: { name: "Pantheon" },
          },
          {
            hash: 4095868423,
            displayProperties: { name: "Vesper's Host" },
          },
        ],
        worldLocations: [{ hash: 677774031, displayProperties: { name: "The Moon" } }],
      }
    );

    expect(acquisitions.get(2151917545)?.sources[0].name).toBe("Renegades");
    expect(acquisitions.get(2386215115)?.sources[0].name).toBe("Pantheon");
    expect(acquisitions.get(3639539903)?.sources[0].name).toBe("Vesper's Host");
    expect(acquisitions.get(2250480800)?.sources[0].name).toBe("The Moon");
    expect(formatGearSetAcquisitionSourceName(acquisitions.get(2151917545)!.sources[0])).toBe(
      "Renegades activities"
    );
    expect(formatGearSetAcquisitionSourceName(acquisitions.get(2386215115)!.sources[0])).toBe(
      "Pantheon raid"
    );
    expect(formatGearSetAcquisitionSourceName(acquisitions.get(3639539903)!.sources[0])).toBe(
      "Vesper's Host dungeon"
    );
    expect(formatGearSetAcquisitionSourceName(acquisitions.get(2250480800)!.sources[0])).toBe(
      "World drop in The Moon"
    );
  });

  it("uses hash-keyed English fallback names when location definitions are missing", () => {
    const source = createGearSetAcquisitionMap(
      [{ hash: 1223381128, displayProperties: { name: "AION Renewal" }, setItems: [] }],
      []
    ).get(1223381128)?.sources[0];

    expect(source?.name).toBe("Kepler");
    expect(source && formatGearSetAcquisitionSourceName(source)).toBe("World drop in Kepler");
  });

  it("does not duplicate a label prefix from a previously formatted cache", () => {
    expect(
      formatGearSetAcquisitionSourceName({
        sourceType: "world",
        locationHash: 4076196532,
        name: "World drop in Kepler",
      })
    ).toBe("World drop in Kepler");
  });
});
