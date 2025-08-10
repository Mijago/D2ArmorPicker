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

const production = process.env["PRODUCTION"] === "1";
const beta_branch = process.env["BETA"] === "1";
const canary_branch = process.env["CANARY"] === "1";

const version = "2.9.7";

// Configure Angular `environment.ts` file path
const targetPath = production
  ? "./src/environments/environment.prod.ts"
  : beta_branch || canary_branch
    ? "./src/environments/environment.prod.ts"
    : "./src/environments/environment.ts";
// Load node modules

const dotenvfile = production
  ? ".env"
  : beta_branch
    ? ".env_beta"
    : canary_branch
      ? ".env_canary"
      : ".env_dev";

require("dotenv").config({ path: dotenvfile });

const revision = require("child_process").execSync("git rev-parse --short HEAD").toString().trim();

var version_tag = production ? "" : beta_branch ? "-beta-" + revision : "-dev-" + revision;

console.log(`Reading ${dotenvfile} version ${version + version_tag}`);

const data = {
  version: version + version_tag,
  revision: revision,
  production: production,
  beta: beta_branch,
  canary: canary_branch,
  apiKey: process.env["D2AP_BUNGIE_API_KEY"],
  clientId: process.env["D2AP_BUNGIE_CLIENT_ID"],
  client_secret: process.env["D2AP_BUNGIE_CLIENT_SECRET"],
  nodeEnv: process.env["NODE_ENV"],
  offlineMode: false,
  highlight_project_id: process.env["D2AP_HIGHLIGHT_MONITORING_ID"],
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
    console.log(`Angular environment.ts file generated correctly at ${targetPath} \n`);
  }
});
