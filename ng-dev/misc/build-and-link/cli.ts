/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */

import {lstatSync} from 'fs';
import {resolve} from 'path';
import {Argv, Arguments, CommandModule} from 'yargs';

import {BuildWorker} from '../../release/build/index.js';
import {ChildProcess} from '../../utils/child-process.js';
import {Log, green} from '../../utils/logging.js';
import {getConfig} from '../../utils/config.js';
import {assertValidReleaseConfig} from '../../release/config/index.js';

/** Command line options. */
export interface BuildAndLinkOptions {
  projectRoot: string;
}

/** Yargs command builder for the command. */
function builder(argv: Argv): Argv<BuildAndLinkOptions> {
  return argv.positional('projectRoot', {
    type: 'string',
    normalize: true,
    coerce: (path: string) => resolve(path),
    demandOption: true,
  });
}

/** Yargs command handler for the command. */
async function handler({projectRoot}: Arguments<BuildAndLinkOptions>) {
  try {
    if (!lstatSync(projectRoot).isDirectory()) {
      Log.error(`  ✘   The 'projectRoot' must be a directory: ${projectRoot}`);
      process.exit(1);
    }
  } catch {
    Log.error(`  ✘   Could not find the 'projectRoot' provided: ${projectRoot}`);
    process.exit(1);
  }

  const config = await getConfig();
  assertValidReleaseConfig(config);

  const builtPackages = await BuildWorker.invokeBuild();

  if (builtPackages === null) {
    Log.error(`  ✘   Could not build release output. Please check output above.`);
    process.exit(1);
  }
  Log.info(green(` ✓  Built release output.`));

  for (const {outputPath, name} of builtPackages) {
    await ChildProcess.spawn('yarn', ['link', '--cwd', outputPath]);
    await ChildProcess.spawn('yarn', ['link', '--cwd', projectRoot, name]);
  }

  Log.info(green(` ✓  Linked release packages in provided project.`));
}

/** CLI command module. */
export const BuildAndLinkCommandModule: CommandModule<{}, BuildAndLinkOptions> = {
  builder,
  handler,
  command: 'build-and-link <projectRoot>',
  describe:
    'Builds the release output, registers the outputs as linked, and links via yarn to the provided project',
};
