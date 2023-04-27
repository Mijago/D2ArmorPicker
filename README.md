# D2ArmorPicker

D2ArmorPicker is a small tool to min-max your armor stats with only a few clicks.
Visit the page here: https://d2armorpicker.com


# Contribution

## Development
1. Run `npm install` to install dependencies.
2. Duplicate the `.env_example` to `.env_dev`. 
3. Create a Bungie API key. For this, head over to https://www.bungie.net/en/Application and create a new application. 
    - Set the OAuth Client Type to `Confidential` and the redirect URL to `https://localhost:4200/`. 
    - Select the Scopes `Read your Destiny 2 information` and `Move or equip Destiny gear and other items`.
    - Set `Origin Header` to `https://localhost:4200`.
    - Copy the API key and paste it to `D2AP_BUNGIE_API_KEY` in the `.env_dev` file.
    - Copy the OAuth client_id and paste it to `D2AP_BUNGIE_CLIENT_ID` in the `.env_dev` file.
    - Copy the OAuth client_secrety and paste it to `D2AP_BUNGIE_CLIENT_SECRET` in the `.env_dev` file.
4. Start the development server with `npm start` (or `npm run start`). The server will be available at https://localhost:4200/. This page will automatically update whenever you change anything in the code. 
    - Ignore the "invalid certificate" error your browser will give you. You need HTTPS to be able to use the Bungie Authentification.

## Building Production and Beta packages
- To build a production package, set the environment flag `PRODUCTION=1`.
- To build a beta package, set the environment flag `BETA=1`.

## Deployment
You can also deploy the page to a "github pages" page. Please note that I strongly discourage hosting alternative D2AP installations, let's make this one as awesome as possible.

1. Set the environment flag `BETA=1` or `PRODUCTION=1`.
1. Modify the  `deploy` script in `package.json` and remove`--base-href=/ --cname=d2armorpicker.com`. The same for the beta command. 
2. `npm run deploy` (given you forked the repository first).

