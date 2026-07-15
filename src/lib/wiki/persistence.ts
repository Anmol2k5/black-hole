import path from "node:path";
import fs from "node:fs";
import { getWikiDirectory } from "../paths";

export async function persistWikiMarkdown(
  slug: string,
  contentMd: string,
): Promise<string> {
  const outputPath = path.join(
    getWikiDirectory(),
    ...slug.split("/"),
  ) + ".md";

  await fs.promises.mkdir(path.dirname(outputPath), {
    recursive: true,
  });

  const temporaryPath = `${outputPath}.tmp`;

  await fs.promises.writeFile(
    temporaryPath,
    contentMd,
    "utf8",
  );

  await fs.promises.rename(temporaryPath, outputPath);

  return outputPath;
}
