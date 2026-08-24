import { createInterface } from "node:readline";

export function promptText(question: string): Promise<string> {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

const CTRL_C = String.fromCharCode(3);
const CTRL_D = String.fromCharCode(4);
const BACKSPACE = String.fromCharCode(127);

/**
 * Reads a line of input without echoing it to the terminal — used for the
 * vault passphrase so it never appears on-screen or in terminal scrollback.
 *
 * When stdin isn't a TTY (piped input, CI, this project's own test
 * harness) there is nothing to visually hide, so this falls back to a
 * plain line read instead of failing — the same accommodation `git`,
 * `ssh`, and most secret-prompting CLIs make for scripted/automated use.
 */
export function promptHidden(question: string): Promise<string> {
  if (!process.stdin.isTTY) {
    return promptText(question);
  }
  return new Promise((resolve) => {
    process.stdout.write(question);
    const stdin = process.stdin;
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding("utf8");

    let value = "";
    const onData = (char: string) => {
      if (char === "\n" || char === "\r" || char === CTRL_D) {
        stdin.setRawMode(false);
        stdin.pause();
        stdin.removeListener("data", onData);
        process.stdout.write("\n");
        resolve(value);
        return;
      }
      if (char === CTRL_C) {
        stdin.setRawMode(false);
        stdin.pause();
        process.stdout.write("\n");
        process.exit(130);
      }
      if (char === BACKSPACE || char === "\b") {
        value = value.slice(0, -1);
        return;
      }
      value += char;
    };
    stdin.on("data", onData);
  });
}

export async function promptConfirm(question: string, defaultYes = false): Promise<boolean> {
  if (!process.stdin.isTTY) return defaultYes;
  const suffix = defaultYes ? "[Y/n]" : "[y/N]";
  const answer = (await promptText(`${question} ${suffix} `)).toLowerCase();
  if (!answer) return defaultYes;
  return answer === "y" || answer === "yes";
}
