import { BuildConfiguration } from "../data/buildConfiguration";
import { ResultDefinition } from "../components/authenticated-v2/results/results.component";
import { DimService } from "./dim.service";

describe("DimService", () => {
  const service = new DimService(
    { readonlyConfigurationSnapshot: BuildConfiguration.buildEmptyConfiguration() } as any,
    { debug: () => undefined } as any
  );

  it("adds worker-selected tuning hashes to DIM's flat mod list", () => {
    const result = {
      exotic: undefined,
      artifice: [],
      mods: [],
      tuningMods: [388618952],
      tuningStats: [0, 5, 0, 0, 0, -5],
      items: [
        { itemInstanceId: "helmet", hash: 1, exotic: false },
        { itemInstanceId: "gauntlets", hash: 2, exotic: false },
      ],
      stats: [],
      statsNoMods: [],
      tiers: 0,
      waste: 0,
      modCost: 0,
      modCount: 0,
      loaded: true,
    } as unknown as ResultDefinition;

    const url = service.generateDIMLink(result);
    const loadout = JSON.parse(decodeURIComponent(url.split("loadout=")[1]));

    expect(loadout.parameters.mods).toEqual([388618952]);
    expect(loadout.parameters.modsByBucket).toBeUndefined();
  });
});
