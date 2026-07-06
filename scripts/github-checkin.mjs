import { runFlyertCheckin } from "../worker/src/flyert-checkin.mjs";

export async function runGithubCheckin(options = {}) {
  const env = options.env ?? process.env;
  const fetchImpl = options.fetchImpl ?? fetch;
  const logger = options.logger ?? console;

  const result = await runFlyertCheckin({ env, fetchImpl, logger });
  const exitCode = result.ok ? 0 : 1;
  const line = JSON.stringify(result, null, 2);

  if (result.ok) {
    logger.log(line);
  } else {
    logger.error(line);
  }

  return { exitCode, result };
}

const invokedPath = process.argv[1] ? `file://${process.argv[1].replace(/\\/g, "/")}` : "";
if (import.meta.url === invokedPath) {
  const outcome = await runGithubCheckin();
  process.exitCode = outcome.exitCode;
}
