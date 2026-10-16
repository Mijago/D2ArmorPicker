# D2ArmorPicker

<!-- ALL-CONTRIBUTORS-BADGE:START - Do not remove or modify this section -->

[![All Contributors](https://img.shields.io/badge/all_contributors-7-orange.svg?style=flat-square)](#contributors-)

<!-- ALL-CONTRIBUTORS-BADGE:END -->

D2ArmorPicker is a small tool to min-max your armor stats with only a few clicks.
Visit the page here: https://d2armorpicker.com

## About this project

D2ArmorPicker is a powerful web-based tool designed for Destiny 2 players who want to optimize their armor sets for maximum efficiency and performance. Whether you're a casual player or a hardcore speedrunner, D2ArmorPicker helps you find the best possible combinations of armor pieces, mods, and stat distributions to suit your playstyle and goals.

**Key Features:**

- **Utilises Bungie API:** Connects to your Destiny 2 account via the Bungie API to automatically load your available armor pieces.
- **Stat Optimization:** Calculates and suggests the best armor combinations to maximize your desired stats (Resilience, Recovery, Discipline, etc.).
- **Mod & Artifice Support:** Allows you to include stat mods (minor, major, artifice) in the optimization process for even more precise builds.
- **Highly Detailed User Preferences:** Customize your stat priorities, lock specific armor pieces, and filter by perks or other criteria.

## Contribution

### Development

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
   - Ignore the "invalid certificate" error your browser will show you. You need HTTPS to be able to use the Bungie Authentification.

### Building Production and Beta packages

- Copy `.env_dev` to `.env` and/or `.env_beta`.
- To build a production package, set the environment flag `RELEASE=PROD`.
- To build a beta package, set the environment flag `RELEASE=BETA`.

Then you can use `npm run build`.

### Deployment

You can also deploy the page to a "github pages" page. Please note that I strongly discourage hosting alternative D2AP installations, let's make this one as awesome as possible.

1. Set the environment flag `RELEASE` to one of the posible values `PROD`, `BETA`, `CANARY`, `DEV`.
1. Modify the `deploy` script in `package.json` and remove`--base-href=/ --cname=d2armorpicker.com`. The same for the beta command. If you deploy to `yourname.github.io/fancyrepo`, then you may have to set `--base-href=/fancyrepo`.
1. `npm run deploy` (given you forked the repository first).

### Guidelines

- We use [husky](https://github.com/typicode/husky) to execute some commit hooks.
- We use [eslint](https://eslint.org) to make sure we have the same code style.
- We use [prettier](https://prettier.io/docs/en/) to make sure we have the same code formatting.
- We are using [commitlint](https://github.com/conventional-changelog/commitlint) to make sure we all have the same commit structure. The template used is [@commitlint/config-angular](https://github.com/conventional-changelog/commitlint/tree/master/@commitlint/config-angular).

### Contributors ✨

Thanks goes to these wonderful people ([emoji key](https://allcontributors.org/docs/en/emoji-key)):

<!-- ALL-CONTRIBUTORS-LIST:START - Do not remove or modify this section -->
<!-- prettier-ignore-start -->
<!-- markdownlint-disable -->
<table>
  <tbody>
    <tr>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/Mijago"><img src="https://avatars.githubusercontent.com/u/3903469?v=4?s=100" width="100px;" alt="Mijago"/><br /><sub><b>Mijago</b></sub></a><br /><a href="https://github.com/Mijago/D2ArmorPicker/commits?author=Mijago" title="Code">💻</a> <a href="#ideas-Mijago" title="Ideas, Planning, & Feedback">🤔</a> <a href="#infra-Mijago" title="Infrastructure (Hosting, Build-Tools, etc)">🚇</a> <a href="https://github.com/Mijago/D2ArmorPicker/commits?author=Mijago" title="Tests">⚠️</a> <a href="https://github.com/Mijago/D2ArmorPicker/commits?author=Mijago" title="Documentation">📖</a> <a href="#maintenance-Mijago" title="Maintenance">🚧</a> <a href="#projectManagement-Mijago" title="Project Management">📆</a> <a href="#userTesting-Mijago" title="User Testing">📓</a> <a href="https://github.com/Mijago/D2ArmorPicker/pulls?q=is%3Apr+reviewed-by%3AMijago" title="Reviewed Pull Requests">👀</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/TheYeshir13"><img src="https://avatars.githubusercontent.com/u/88265590?v=4?s=100" width="100px;" alt="TheYeshir"/><br /><sub><b>TheYeshir</b></sub></a><br /><a href="#projectManagement-TheYeshir13" title="Project Management">📆</a> <a href="#ideas-TheYeshir13" title="Ideas, Planning, & Feedback">🤔</a> <a href="https://github.com/Mijago/D2ArmorPicker/pulls?q=is%3Apr+reviewed-by%3ATheYeshir13" title="Reviewed Pull Requests">👀</a> <a href="#userTesting-TheYeshir13" title="User Testing">📓</a> <a href="#question-TheYeshir13" title="Answering Questions">💬</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/TheMojoDojo"><img src="https://avatars.githubusercontent.com/u/99927863?v=4?s=100" width="100px;" alt="Mojo"/><br /><sub><b>Mojo</b></sub></a><br /><a href="#projectManagement-TheMojoDojo" title="Project Management">📆</a> <a href="#ideas-TheMojoDojo" title="Ideas, Planning, & Feedback">🤔</a> <a href="#userTesting-TheMojoDojo" title="User Testing">📓</a> <a href="#question-TheMojoDojo" title="Answering Questions">💬</a> <a href="https://github.com/Mijago/D2ArmorPicker/commits?author=TheMojoDojo" title="Code">💻</a></td>
      <td align="center" valign="top" width="14.28%"><a href="http://benhollis.net/"><img src="https://avatars.githubusercontent.com/u/313208?v=4?s=100" width="100px;" alt="Ben Hollis"/><br /><sub><b>Ben Hollis</b></sub></a><br /><a href="https://github.com/Mijago/D2ArmorPicker/commits?author=bhollis" title="Code">💻</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/nznaza"><img src="https://avatars.githubusercontent.com/u/5291065?v=4?s=100" width="100px;" alt="nznaza"/><br /><sub><b>nznaza</b></sub></a><br /><a href="#maintenance-nznaza" title="Maintenance">🚧</a> <a href="https://github.com/Mijago/D2ArmorPicker/commits?author=nznaza" title="Code">💻</a></td>
      <td align="center" valign="top" width="14.28%"><a href="http://ciaranwal.sh/"><img src="https://avatars.githubusercontent.com/u/3736?v=4?s=100" width="100px;" alt="Ciarán Walsh"/><br /><sub><b>Ciarán Walsh</b></sub></a><br /><a href="https://github.com/Mijago/D2ArmorPicker/commits?author=ciaran" title="Code">💻</a> <a href="#maintenance-ciaran" title="Maintenance">🚧</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://www.slasto.eu/"><img src="https://avatars.githubusercontent.com/u/2999718?v=4?s=100" width="100px;" alt="Slavi Stoev"/><br /><sub><b>Slavi Stoev</b></sub></a><br /><a href="#data-SlaggyWolfie" title="Data">🔣</a></td>
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

# License

Copyright (c) Mijago 2023.

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as published
by the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <http://www.gnu.org/licenses/>.
