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

import { enableProdMode } from "@angular/core";
import { platformBrowserDynamic } from "@angular/platform-browser-dynamic";

import { AppModule } from "./app/app.module";
import { environment } from "./environments/environment";

import * as Sentry from "@sentry/angular";

// Only initialize Sentry if DSN is provided and valid
if (environment.sentryDsn && environment.sentryDsn.trim() !== "") {
  try {
    Sentry.init({
      dsn: environment.sentryDsn,
      environment: environment.version,
      // Setting this option to true will send default PII data to Sentry.
      // For example, automatic IP address collection on events
      sendDefaultPii: true,
      integrations: [
        // send console.log, console.warn, and console.error calls as logs to Sentry
        Sentry.consoleLoggingIntegration({ levels: ["warn", "error", "log", "info", "debug"] }), // Reduced log levels
      ],
      enableLogs: true,
      // Add transport options to help with CORS
    });
  } catch (error) {
    console.warn("Failed to initialize Sentry:", error);
  }
} else {
  console.log("Sentry DSN not provided, skipping Sentry initialization");
}

if (environment.production) {
  enableProdMode();
}

platformBrowserDynamic()
  .bootstrapModule(AppModule)
  .catch((err) => console.error(err));
