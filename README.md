# D2ArmorPicker
<!-- ALL-CONTRIBUTORS-BADGE:START - Do not remove or modify this section -->
[![All Contributors](https://img.shields.io/badge/all_contributors-2-orange.svg?style=flat-square)](#contributors-)
<!-- ALL-CONTRIBUTORS-BADGE:END -->

D2ArmorPicker is a small tool to min-max your armor stats with only a few clicks.
Visit the page here: https://d2armorpicker.com


# Contribution

## Development
1. Run `npx husky-init && npm install` to install dependencies.
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
- Copy `.env_dev` to `.env` and/or `.env_beta`.
- To build a production package, set the environment flag `PRODUCTION=1`.
- To build a beta package, set the environment flag `BETA=1`.

Then you can use `npm run build`.

## Deployment
You can also deploy the page to a "github pages" page. Please note that I strongly discourage hosting alternative D2AP installations, let's make this one as awesome as possible.

1. Set the environment flag `BETA=1` or `PRODUCTION=1`.
1. Modify the  `deploy` script in `package.json` and remove`--base-href=/ --cname=d2armorpicker.com`. The same for the beta command. If you deploy to `yourname.github.io/fancyrepo`, then you may have to set `--base-href=/fancyrepo`.
2. `npm run deploy` (given you forked the repository first).

## Guidelines
- We use [husky](https://github.com/typicode/husky) to execute some commit hooks.
- We are using [commitlint](https://github.com/conventional-changelog/commitlint) to make sure we all have the same commit structure. The template used is [@commitlint/config-angular](https://github.com/conventional-changelog/commitlint/tree/master/@commitlint/config-angular).

## Contributors ✨

Thanks goes to these wonderful people ([emoji key](https://allcontributors.org/docs/en/emoji-key)):

<!-- ALL-CONTRIBUTORS-LIST:START - Do not remove or modify this section -->
<!-- prettier-ignore-start -->
<!-- markdownlint-disable -->
<table>
  <tbody>
    <tr>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/Mijago"><img src="https://avatars.githubusercontent.com/u/3903469?v=4?s=100" width="100px;" alt="Markus"/><br /><sub><b>Markus</b></sub></a><br /><a href="https://github.com/Mijago/D2ArmorPicker/commits?author=Mijago" title="Code">💻</a> <a href="https://github.com/Mijago/D2ArmorPicker/commits?author=Mijago" title="Documentation">📖</a> <a href="#maintenance-Mijago" title="Maintenance">🚧</a> <a href="#projectManagement-Mijago" title="Project Management">📆</a> <a href="https://github.com/Mijago/D2ArmorPicker/pulls?q=is%3Apr+reviewed-by%3AMijago" title="Reviewed Pull Requests">👀</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/TheYeshir13"><img src="https://avatars.githubusercontent.com/u/88265590?v=4?s=100" width="100px;" alt="TheYeshir"/><br /><sub><b>TheYeshir</b></sub></a><br /><a href="#projectManagement-TheYeshir13" title="Project Management">📆</a> <a href="#ideas-TheYeshir13" title="Ideas, Planning, & Feedback">🤔</a> <a href="#userTesting-TheYeshir13" title="User Testing">📓</a> <a href="#question-TheYeshir13" title="Answering Questions">💬</a></td>
    </tr>
  </tbody>
  <tfoot>
    <tr>
      <td align="center" size="13px" colspan="7">
        <img src="https://raw.githubusercontent.com/all-contributors/all-contributors-cli/1b8533af435da9854653492b1327a23a4dbd0a10/assets/logo-small.svg">
          <a href="https://all-contributors.js.org/docs/en/bot/usage">Add your contributions</a>
        </img>
      </td>
    </tr>
  </tfoot>
</table>

<!-- markdownlint-restore -->
<!-- prettier-ignore-end -->

<!-- ALL-CONTRIBUTORS-LIST:END -->

This project follows the [all-contributors](https://github.com/all-contributors/all-contributors) specification. Contributions of any kind welcome!