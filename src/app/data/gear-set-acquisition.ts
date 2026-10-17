export interface GearSetDefinitionForAcquisition {
  hash: number;
  displayProperties: { name: string };
  setItems: number[];
}

export interface GearSetItemSourceData {
  hash: number;
  collectibleHash?: number;
  sourceData?: { sourceHashes?: number[] };
}

export interface GearSetRewardSource {
  hash: number;
  displayProperties: { name: string };
}

export interface GearSetCollectibleSource {
  hash: number;
  sourceHash?: number;
  sourceString?: string;
}

export interface GearSetLocationDefinition {
  hash: number;
  displayProperties: { name: string };
}

import {
  GEAR_SET_ACQUISITION_LOCATION_FALLBACK_NAMES,
  GEAR_SET_ACQUISITION_LOCATIONS,
} from "./gear-set-source-locations";

export type GearSetSourceType = "activity" | "raid" | "dungeon" | "world";

export interface GearSetAcquisitionLocation {
  sourceType: GearSetSourceType;
  locationHash: number;
}

export interface GearSetAcquisitionSource extends GearSetAcquisitionLocation {
  name: string;
}

export interface GearSetAcquisitionInfo {
  hash: number;
  name: string;
  sources: GearSetAcquisitionSource[];
}

export interface GearSetAcquisitionManifestData {
  rewardSources?: Iterable<GearSetRewardSource>;
  collectibles?: Iterable<GearSetCollectibleSource>;
  activityLocations?: Iterable<GearSetLocationDefinition>;
  worldLocations?: Iterable<GearSetLocationDefinition>;
}

function formatCuratedSourceName(sourceType: GearSetSourceType, locationName: string): string {
  switch (sourceType) {
    case "activity":
      return `${locationName} activities`;
    case "raid":
      return `${locationName} raid`;
    case "dungeon":
      return `${locationName} dungeon`;
    case "world":
      return `World drop in ${locationName}`;
  }
}

function getRawLocationName(sourceType: GearSetSourceType, name: string): string {
  switch (sourceType) {
    case "activity":
      return name.replace(/\s+activities$/i, "");
    case "raid":
      return name.replace(/\s+raid$/i, "");
    case "dungeon":
      return name.replace(/\s+dungeon$/i, "");
    case "world":
      return name.replace(/^World drop in\s+/i, "");
  }
}

export function formatGearSetAcquisitionSourceName(source: GearSetAcquisitionSource): string {
  const sourceType = source.sourceType.replace(/^sourceType\./, "") as GearSetSourceType;
  if (source.locationHash <= 0) return source.name || "Unknown";

  const rawName = getRawLocationName(sourceType, source.name || "");
  const locationName =
    rawName ||
    GEAR_SET_ACQUISITION_LOCATION_FALLBACK_NAMES[source.locationHash] ||
    "Unknown location";
  return formatCuratedSourceName(sourceType, locationName);
}

export function createGearSetAcquisitionMap(
  gearSets: Iterable<GearSetDefinitionForAcquisition>,
  items: Iterable<GearSetItemSourceData>,
  manifestData: GearSetAcquisitionManifestData = {}
): Map<number, GearSetAcquisitionInfo> {
  const gearSetList = Array.from(gearSets);
  const itemByHash = new Map(Array.from(items, (item) => [item.hash, item]));
  const rewardSourceByHash = new Map(
    Array.from(manifestData.rewardSources ?? [], (source) => [source.hash, source])
  );
  const collectibleByHash = new Map(
    Array.from(manifestData.collectibles ?? [], (collectible) => [collectible.hash, collectible])
  );
  const activityLocationByHash = new Map<number, GearSetLocationDefinition>();
  for (const location of manifestData.activityLocations ?? []) {
    if (!activityLocationByHash.has(location.hash)) {
      activityLocationByHash.set(location.hash, location);
    }
  }
  const worldLocationByHash = new Map(
    Array.from(manifestData.worldLocations ?? [], (location) => [location.hash, location])
  );
  const acquisitionBySetHash = new Map<number, GearSetAcquisitionInfo>();

  for (const gearSet of gearSetList) {
    const curatedSources = GEAR_SET_ACQUISITION_LOCATIONS[gearSet.hash];
    if (curatedSources) {
      acquisitionBySetHash.set(gearSet.hash, {
        hash: gearSet.hash,
        name: gearSet.displayProperties.name,
        sources: curatedSources.map((source) => {
          const location =
            source.sourceType === "world"
              ? worldLocationByHash.get(source.locationHash)
              : activityLocationByHash.get(source.locationHash);
          return {
            ...source,
            name:
              location?.displayProperties.name ??
              GEAR_SET_ACQUISITION_LOCATION_FALLBACK_NAMES[source.locationHash] ??
              "Unknown location",
          };
        }),
      });
      continue;
    }

    const sourcesByKey = new Map<string, GearSetAcquisitionSource>();
    const addSource = (sourceType: GearSetSourceType, name: string) => {
      const key = `${sourceType}:${name}`;
      sourcesByKey.set(key, { sourceType, locationHash: 0, name });
    };

    for (const itemHash of new Set(gearSet.setItems)) {
      const item = itemByHash.get(itemHash);

      const collectible = item?.collectibleHash
        ? collectibleByHash.get(item.collectibleHash)
        : undefined;
      const collectibleSource = collectible?.sourceString?.trim();
      if (collectible && collectibleSource) {
        const name = collectibleSource.replace(/^Source:\s*/i, "");
        addSource(/^Random Perks:/i.test(name) ? "world" : "activity", name);
      }

      for (const sourceHash of new Set(item?.sourceData?.sourceHashes ?? [])) {
        const source = rewardSourceByHash.get(sourceHash);
        if (source) {
          addSource("activity", source.displayProperties.name);
        }
      }
    }

    const sources = Array.from(sourcesByKey.values());
    if (sources.length === 0) {
      sources.push({
        sourceType: "world",
        locationHash: 0,
        name: "Source location not mapped yet",
      });
    }

    acquisitionBySetHash.set(gearSet.hash, {
      hash: gearSet.hash,
      name: gearSet.displayProperties.name,
      sources,
    });
  }

  return acquisitionBySetHash;
}
