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

import { Pipe, PipeTransform } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";

@Pipe({
  name: "logLevel",
  pure: true,
})
export class LogLevelPipe implements PipeTransform {
  transform(value: NgxLoggerLevel): string {
    switch (value) {
      case NgxLoggerLevel.TRACE:
        return "TRACE";
      case NgxLoggerLevel.DEBUG:
        return "DEBUG";
      case NgxLoggerLevel.INFO:
        return "INFO";
      case NgxLoggerLevel.WARN:
        return "WARN";
      case NgxLoggerLevel.ERROR:
        return "ERROR";
      case NgxLoggerLevel.FATAL:
        return "FATAL";
      default:
        return "UNKNOWN";
    }
  }
}
