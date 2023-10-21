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

export const SUPER_COOLDOWN_RATIO_PER_TIER = [
  1.44, 1.276, 1.144, 1.0, 0.9488, 0.9024, 0.8608, 0.8224, 0.798, 0.776, 0.7664,
];
export const ABILITY_COOLDOWN_RATIO_PER_TIER = [
  1.25, 1.14, 1.04, 1.0, 0.83, 0.72, 0.62, 0.55, 0.5, 0.455, 0.39,
];
export const CLASS_COOLDOWN_RATIO_PER_TIER = [
  1.427, 1.256, 1.11, 1.0, 0.91461, 0.829, 0.7683, 0.72, 0.622, 0.561, 0.5,
];

export function formatTimeMMMSS(seconds: number) {
  seconds = Math.abs(seconds);
  var ms = Math.floor((seconds * 10) % 10);
  var min = Math.floor(seconds / 60);
  var sec = Math.floor(seconds - min * 60);

  return `${min}:${sec < 10 ? "0" : ""}${sec}`;
}

export function formatTimeSplit(seconds: number) {
  seconds = Math.abs(seconds);
  var ms = Math.floor((seconds * 10) % 10);
  var min = Math.floor(seconds / 60);
  var sec = Math.floor(seconds - min * 60);

  let str = `${sec}s`;
  if (ms > 0) str = `${sec}.${ms}s`;
  if (min > 0) str = `${min}m ${str}`;
  return str;

  return `${min}:${sec < 10 ? "0" : ""}${sec}`;
}
