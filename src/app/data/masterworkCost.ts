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
export const MASTERWORK_COST_LEGENDARY: { [tier: number]: { [id: number]: costEntry } } = {
  1: {
    1: { glimmer: 300, core: 0, prism: 0, ascshard: 0 },
    2: { glimmer: 500, core: 0, prism: 0, ascshard: 0 },
    3: { glimmer: 1200, core: 0, prism: 0, ascshard: 0 },
    4: { glimmer: 3500, core: 1, prism: 0, ascshard: 0 },
    5: { glimmer: 4500, core: 2, prism: 0, ascshard: 0 },
  },
  2: {
    1: { glimmer: 1200, core: 0, prism: 0, ascshard: 0 },
    2: { glimmer: 2800, core: 1, prism: 0, ascshard: 0 },
    3: { glimmer: 4000, core: 1, prism: 0, ascshard: 0 },
    4: { glimmer: 5000, core: 2, prism: 0, ascshard: 0 },
    5: { glimmer: 7000, core: 2, prism: 1, ascshard: 0 },
  },
  3: {
    1: { glimmer: 1500, core: 1, prism: 0, ascshard: 0 },
    2: { glimmer: 3000, core: 2, prism: 0, ascshard: 0 },
    3: { glimmer: 5000, core: 3, prism: 0, ascshard: 0 },
    4: { glimmer: 7000, core: 4, prism: 1, ascshard: 0 },
    5: { glimmer: 8500, core: 5, prism: 2, ascshard: 1 },
  },
  4: {
    1: { glimmer: 200, core: 2, prism: 0, ascshard: 0 },
    2: { glimmer: 3300, core: 3, prism: 1, ascshard: 0 },
    3: { glimmer: 6500, core: 4, prism: 1, ascshard: 0 },
    4: { glimmer: 8200, core: 5, prism: 2, ascshard: 1 },
    5: { glimmer: 10000, core: 7, prism: 3, ascshard: 1 },
  },
  5: {
    1: { glimmer: 2400, core: 3, prism: 1, ascshard: 0 },
    2: { glimmer: 3500, core: 5, prism: 2, ascshard: 0 },
    3: { glimmer: 7500, core: 6, prism: 2, ascshard: 0 },
    4: { glimmer: 9100, core: 7, prism: 3, ascshard: 1 },
    5: { glimmer: 12500, core: 9, prism: 5, ascshard: 2 },
  },
};
export const MASTERWORK_COST_EXOTIC: { [id: number]: costEntry } = {
  1: { glimmer: 1500, core: 1, prism: 0, ascshard: 0 },
  2: { glimmer: 3000, core: 2, prism: 0, ascshard: 0 },
  3: { glimmer: 5000, core: 3, prism: 1, ascshard: 0 },
  4: { glimmer: 7000, core: 4, prism: 1, ascshard: 1 },
  5: { glimmer: 8500, core: 5, prism: 2, ascshard: 2 },
};

export function getMasterworkCostList(
  isExotic: boolean,
  tier: number
): { [id: number]: costEntry } | undefined {
  if (isExotic) {
    return MASTERWORK_COST_EXOTIC;
  }
  return MASTERWORK_COST_LEGENDARY[tier];
}
