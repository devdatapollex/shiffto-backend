import Handlebars from "handlebars";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const TEMPLATES_DIR = join(__dirname, "templates");
const partialsDir = join(TEMPLATES_DIR, "partials");

const compiledTemplates: Map<string, HandlebarsTemplateDelegate> = new Map();
let partialsLoaded = false;

function loadPartials(): void {
  if (partialsLoaded) return;

  const partialFiles = ["header.hbs", "footer.hbs"];

  for (const file of partialFiles) {
    const name = file.replace(".hbs", "");
    const content = readFileSync(join(partialsDir, file), "utf-8");
    Handlebars.registerPartial(name, content);
  }

  partialsLoaded = true;
}

function getTemplate(templatePath: string): HandlebarsTemplateDelegate {
  if (compiledTemplates.has(templatePath)) {
    return compiledTemplates.get(templatePath)!;
  }

  loadPartials();

  const fullPath = join(TEMPLATES_DIR, `${templatePath}.hbs`);
  const source = readFileSync(fullPath, "utf-8");
  const compiled = Handlebars.compile(source);

  compiledTemplates.set(templatePath, compiled);
  return compiled;
}

export interface TemplateData {
  [key: string]: unknown;
}

export function renderTemplate(
  templatePath: string,
  data: TemplateData,
): string {
  const template = getTemplate(templatePath);
  return template({
    ...data,
    year: new Date().getFullYear(),
  });
}

export function clearTemplateCache(): void {
  compiledTemplates.clear();
}
