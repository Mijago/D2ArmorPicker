const writeFile = require("fs").writeFile

const production = process.env.PRODUCTION === "1"
const beta_branch = process.env.BETA === "1"
const version = "2.2.0"

// Configure Angular `environment.ts` file path
const targetPath = production
  ? './src/environments/environment.prod.ts'
  : beta_branch
    ? './src/environments/environment.prod.ts'
    : './src/environments/environment.ts';
// Load node modules

require('dotenv').config({
  path: production
    ? ".env"
    : beta_branch
      ? ".env_beta"
      : ".env_dev"
});

var version_tag = production
  ? ""
  : beta_branch
    ? "-beta"
    : "-dev"

const data = {
  version: version + version_tag,
  production: production,
  apiKey: process.env.D2AP_BUNGIE_API_KEY,
  clientId: process.env.D2AP_BUNGIE_CLIENT_ID,
  client_secret: process.env.D2AP_BUNGIE_CLIENT_SECRET,
  nodeEnv: process.env.NODE_ENV
}


// `environment.ts` file structure
const envConfigFile = `export const environment = ${JSON.stringify(data, null, 2)};`;
writeFile(targetPath, envConfigFile, (err: NodeJS.ErrnoException | null) => {
  if (err) {
    throw console.error(err);
  } else {
    console.log(`Angular environment.ts file generated correctly at ${targetPath} \n`);
  }
});
