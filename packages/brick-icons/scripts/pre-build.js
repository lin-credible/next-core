const fs = require("fs-extra");
const os = require("os");
const path = require("path");
const klawSync = require("klaw-sync");
const changeCase = require("change-case");
const prettier = require("prettier");
const _ = require("lodash");

const iconsDir = path.join(process.cwd(), "src/icons");

const flattenIcons = klawSync(iconsDir, {
  depthLimit: 2,
  nodir: true,
  filter: item => item.path.endsWith(".svg"),
  traverseAll: true
}).map(item => {
  const relativePath = path
    .relative(iconsDir, item.path)
    .split(path.sep)
    .join("/");
  const basename = path.basename(relativePath, ".svg");
  const category = relativePath.includes("/")
    ? relativePath.split("/")[0]
    : "default";
  const lowerKebabCase = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;
  if (!(lowerKebabCase.test(category) && lowerKebabCase.test(basename))) {
    throw new Error(
      `Icon category and filename should always be in lower-kebab-case: ${category}/${basename}`
    );
  }
  return { category, relativePath, basename };
});

const groupedIcons = Object.entries(_.groupBy(flattenIcons, "category"));

const content = [
  ...groupedIcons.map(([category, icons]) =>
    icons
      .map(
        icon =>
          `import ${changeCase.pascal(category)}${changeCase.pascal(
            icon.basename
          )} from "./icons/${icon.relativePath}";`
      )
      .join(os.EOL)
  ),
  ...groupedIcons.map(
    ([category, icons]) =>
      `export const ${changeCase.camel(category)}Category = {
      ${icons
        .map(
          icon =>
            `  "${changeCase.kebab(icon.basename)}": ${changeCase.pascal(
              category
            )}${changeCase.pascal(icon.basename)},`
        )
        .join(os.EOL)}
    };`
  ),
  `export default {
    ${groupedIcons
      .map(
        ([category]) =>
          `"${changeCase.kebab(category)}": ${changeCase.camel(category) +
            "Category"}`
      )
      .join(",")}
  };`
].join(os.EOL + os.EOL);

const indexTsPath = path.join(process.cwd(), "src/categories.ts");
fs.outputFileSync(
  indexTsPath,
  prettier.format(content, { parser: "typescript" })
);
