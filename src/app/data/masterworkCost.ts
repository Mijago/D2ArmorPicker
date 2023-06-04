/*
 * Copyright (c) 2023 D2ArmorPicker by Mijago.
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published
 * by the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

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
