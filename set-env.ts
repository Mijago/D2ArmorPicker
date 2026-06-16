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

const writeFile = require("fs").writeFile;

// RELEASE can be one of: 'PROD', 'BETA', 'CANARY'. Defaults to 'CANARY' if missing/invalid
const releaseRaw = (process.env["RELEASE"] || "").toUpperCase();
const release = ["PROD", "BETA", "CANARY", "DEV"].includes(releaseRaw) ? releaseRaw : "DEV";

const is_production = release === "PROD";
const is_beta = release === "BETA";
const is_canary = release === "CANARY";
const is_dev = release === "DEV";

const version = "2.9.10";

// Configure Angular `environment.ts` file path
const targetPath = "./src/environments/environment.ts";

const copyPath = is_production
  ? "./src/environments/environment.prod.ts"
  : is_beta
    ? "./src/environments/environment.beta.ts"
    : is_canary
      ? "./src/environments/environment.canary.ts"
      : "./src/environments/environment.dev.ts";
// Load node modules

const dotenvfile = is_production
  ? ".env"
  : is_beta
    ? ".env_beta"
    : is_canary
      ? ".env_canary"
      : ".env_dev";

// Only load from .env if key variables are not already present in the environment
const requiredEnvKeys = [
  "D2AP_BUNGIE_API_KEY",
  "D2AP_BUNGIE_CLIENT_ID",
  "D2AP_BUNGIE_CLIENT_SECRET",
  "D2AP_OPEN_REPLAY_PROJECT_KEY",
  "D2AP_FEATURE_ENABLE_MODSLOT_LIMITATION",
  "D2AP_FEATURE_ENABLE_ZERO_WASTE",
  "D2AP_FEATURE_ENABLE_GUARDIAN_GAMES_FEATURES",
  "D2AP_SHOW_LOGS",
  // Feature flags are optional; they default to disabled when not set
];

const optionalEnvKeys = ["D2AP_SENTRY_DSN"];

const hasAllRequiredEnv = requiredEnvKeys.every((k) => {
  const val = process.env[k] ?? "";
  return val.length > 0;
});

if (!hasAllRequiredEnv) {
  const dotenv = require("dotenv");
  const result = dotenv.config({ path: dotenvfile });
  if (result.error) {
    throw new Error(`Failed to load env file at ${dotenvfile}: ${result.error}`);
  }
  // After attempting to load, warn for any missing keys
  const missingKeys = requiredEnvKeys.filter((k) => !process.env[k]);
  if (missingKeys.length > 0) {
    throw new Error(
      `Missing required environment variables after loading ${dotenvfile}: ${missingKeys.join(", ")}`
    );
  }
} else {
  console.log("Environment variables already set; skipping .env file load.");
}

const revision = require("child_process").execSync("git rev-parse --short HEAD").toString().trim();

var version_tag = is_production ? "" : is_beta ? "-beta-" + revision : "-dev-" + revision;

console.log(`Reading ${dotenvfile} version ${version + version_tag} (RELEASE=${release})`);

const data = {
  version: version + version_tag,
  revision: revision,
  production: is_production,
  beta: is_beta,
  canary: is_canary,
  apiKey: process.env["D2AP_BUNGIE_API_KEY"],
  clientId: process.env["D2AP_BUNGIE_CLIENT_ID"],
  client_secret: process.env["D2AP_BUNGIE_CLIENT_SECRET"],
  nodeEnv: process.env["NODE_ENV"],
  offlineMode: false,
  // highlight_project_id: process.env["D2AP_HIGHLIGHT_MONITORING_ID"],
  open_replay_project_key: process.env["D2AP_OPEN_REPLAY_PROJECT_KEY"],
  sentryDsn: process.env["D2AP_SENTRY_DSN"],
  showLogs: process.env["D2AP_SHOW_LOGS"] == "1",
  featureFlags: {
    enableModslotLimitation: process.env["D2AP_FEATURE_ENABLE_MODSLOT_LIMITATION"] == "1",
    enableZeroWaste: process.env["D2AP_FEATURE_ENABLE_ZERO_WASTE"] == "1",
    enableGuardianGamesFeatures: process.env["D2AP_FEATURE_ENABLE_GUARDIAN_GAMES_FEATURES"] == "1",
  },
};

// `environment.ts` file structure
const envConfigFile = `export const environment = ${JSON.stringify(data, null, 2)};`;
writeFile(targetPath, envConfigFile, (err: NodeJS.ErrnoException | null) => {
  if (err) {
    throw console.error(err);
  } else {
    console.log(`Angular environment.ts file generated correctly\n`);

    writeFile(copyPath, envConfigFile, (err2: NodeJS.ErrnoException | null) => {
      if (err2) {
        throw console.error(err2);
      } else {
        console.log(`Active Angular environment copied to ${copyPath}`);
      }
    });
  }
});
