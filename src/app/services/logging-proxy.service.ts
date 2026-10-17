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

import { Injectable } from "@angular/core";
import { NGXLogger, NgxLoggerLevel } from "ngx-logger";
import { BehaviorSubject, Observable } from "rxjs";

export interface LogEntry {
  level: NgxLoggerLevel;
  message: string;
  timestamp: Date;
  additional?: any[];
}

/**
 * LoggingProxy service that wraps NGXLogger and allows preprocessing of log messages
 * before they are sent to the underlying logger.
 */
@Injectable({
  providedIn: "root",
})
export class LoggingProxyService {
  private recentLogs: LogEntry[] = [];
  private maxRecentLogs = 5;
  private logsSubject = new BehaviorSubject<LogEntry[]>([]);

  constructor(private ngxLogger: NGXLogger) {}

  getRecentLogs(): Observable<LogEntry[]> {
    return this.logsSubject.asObservable();
  }

  private addToRecentLogs(level: NgxLoggerLevel, message: any, ...additional: any[]): void {
    let fullMessage = "";
    if (typeof message === "string") {
      fullMessage += message;
    } else {
      fullMessage += JSON.stringify(message);
    }
    if (additional && additional.length > 0) {
      fullMessage +=
        " " +
        additional
          .map((item) => (typeof item === "string" ? item : JSON.stringify(item)))
          .join(" ");
    }
    const logEntry: LogEntry = {
      level,
      message: fullMessage,
      timestamp: new Date(),
    };

    this.recentLogs.unshift(logEntry);
    if (this.recentLogs.length > this.maxRecentLogs) {
      this.recentLogs.pop();
    }

    // Defer the emission to the next tick to avoid ExpressionChangedAfterItHasBeenCheckedError
    Promise.resolve().then(() => {
      this.logsSubject.next([...this.recentLogs]);
    });
  }

  clearRecentLogs(): void {
    this.recentLogs = [];
    // Defer the emission to the next tick to avoid ExpressionChangedAfterItHasBeenCheckedError
    Promise.resolve().then(() => {
      this.logsSubject.next([]);
    });
  }

  setMaxRecentLogs(max: number): void {
    this.maxRecentLogs = Math.max(1, max);
    while (this.recentLogs.length > this.maxRecentLogs) {
      this.recentLogs.pop();
    }
    // Defer the emission to the next tick to avoid ExpressionChangedAfterItHasBeenCheckedError
    Promise.resolve().then(() => {
      this.logsSubject.next([...this.recentLogs]);
    });
  }

  private beforeLog(level: NgxLoggerLevel, message: any, ...additional: any[]): boolean {
    this.addToRecentLogs(level, message, ...additional);
    return true;
  }

  trace(message: any, ...additional: any[]): void {
    if (this.beforeLog(NgxLoggerLevel.TRACE, message, ...additional)) {
      this.ngxLogger.trace(message, ...additional);
    }
  }

  debug(message: any, ...additional: any[]): void {
    if (this.beforeLog(NgxLoggerLevel.DEBUG, message, ...additional)) {
      this.ngxLogger.debug(message, ...additional);
    }
  }

  info(message: any, ...additional: any[]): void {
    if (this.beforeLog(NgxLoggerLevel.INFO, message, ...additional)) {
      this.ngxLogger.info(message, ...additional);
    }
  }

  warn(message: any, ...additional: any[]): void {
    if (this.beforeLog(NgxLoggerLevel.WARN, message, ...additional)) {
      this.ngxLogger.warn(message, ...additional);
    }
  }

  error(message: any, ...additional: any[]): void {
    if (this.beforeLog(NgxLoggerLevel.ERROR, message, ...additional)) {
      this.ngxLogger.error(message, ...additional);
    }
  }

  fatal(message: any, ...additional: any[]): void {
    if (this.beforeLog(NgxLoggerLevel.FATAL, message, ...additional)) {
      this.ngxLogger.fatal(message, ...additional);
    }
  }

  log(level: NgxLoggerLevel, message: any, ...additional: any[]): void {
    if (this.beforeLog(level, message, ...additional)) {
      this.ngxLogger.log(level, message, ...additional);
    }
  }
}
