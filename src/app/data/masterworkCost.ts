type costEntry = { [id: string]: number };

export const MASTERWORK_COST_LEGENDARY: { [id: number]: costEntry } = {
    2: { shards: 1, glimmer: 500, core: 0, prism: 0, ascshard: 0 },
    3: { shards: 1, glimmer: 500, core: 0, prism: 0, ascshard: 0 },
    4: { shards: 2, glimmer: 500, core: 0, prism: 0, ascshard: 0 },
    5: { shards: 2, glimmer: 1000, core: 0, prism: 0, ascshard: 0 },
    6: { shards: 3, glimmer: 1000, core: 1, prism: 0, ascshard: 0 },
    7: { shards: 3, glimmer: 2500, core: 2, prism: 0, ascshard: 0 },
    8: { shards: 4, glimmer: 3000, core: 0, prism: 1, ascshard: 0 },
    9: { shards: 4, glimmer: 3000, core: 0, prism: 2, ascshard: 0 },
    10: { shards: 5, glimmer: 4000, core: 0, prism: 0, ascshard: 1 },
};
export const MASTERWORK_COST_EXOTIC: { [id: number]: costEntry } = {
    2: { shards: 1, glimmer: 500, core: 0, prism: 0, ascshard: 0 },
    3: { shards: 2, glimmer: 1000, core: 0, prism: 0, ascshard: 0 },
    4: { shards: 2, glimmer: 1000, core: 0, prism: 0, ascshard: 0 },
    5: { shards: 3, glimmer: 2500, core: 0, prism: 0, ascshard: 0 },
    6: { shards: 3, glimmer: 3000, core: 2, prism: 0, ascshard: 0 },
    7: { shards: 4, glimmer: 3000, core: 3, prism: 0, ascshard: 0 },
    8: { shards: 4, glimmer: 4000, core: 0, prism: 2, ascshard: 0 },
    9: { shards: 5, glimmer: 4000, core: 0, prism: 3, ascshard: 0 },
    10: { shards: 6, glimmer: 5000, core: 0, prism: 0, ascshard: 3 },
};
