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

export function formatTimeMMMSS(seconds: number) {
  seconds = Math.abs(seconds);
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
}
