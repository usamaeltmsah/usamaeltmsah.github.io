import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import type { ZodObject } from 'astro/zod';
import { folders, relations, singletons } from '../src/lib/schemas';

const root = join(import.meta.dirname, '..');
const sveltia = join(root, 'node_modules/@sveltia/cms'); // read directly: the package's exports hide these files
const config = parse(readFileSync(join(root, 'public/admin/config.yml'), 'utf8'));

type Field = { name: string; required?: boolean };
type Section = { name: string; folder?: string; file?: string; fields?: Field[]; divider?: boolean };

/** Fields the schema requires with no default, i.e. ones the CMS must always write. */
const requiredKeys = (schema: ZodObject) =>
  Object.entries(schema.shape).filter(([, s]) => !s.safeParse(undefined).success).map(([k]) => k);

const checkFields = (section: Section, schema: ZodObject) => {
  const names = section.fields!.map((f) => f.name);
  const managed = ['order']; // written by the CMS reorder feature
  expect(names.filter((n) => !(n in schema.shape)), 'CMS fields missing from the Zod schema').toEqual([]);
  expect(requiredKeys(schema).filter((k) => !names.includes(k) && !managed.includes(k)), 'required schema keys missing from the CMS').toEqual([]);
};

describe('CMS config', () => {
  it('is valid against the Sveltia CMS JSON Schema', () => {
    const schema = JSON.parse(readFileSync(join(sveltia, 'schema/sveltia-cms.json'), 'utf8'));
    const ajv = new Ajv({ strict: false, allErrors: true });
    addFormats(ajv);
    const validate = ajv.compile(schema);
    validate(config);
    expect(validate.errors ?? []).toEqual([]);
  });

  it('only uses built-in widgets (the JSON Schema allows any custom name)', () => {
    const builtIn = new Set(['string', 'text', 'boolean', 'select', 'list', 'object', 'image', 'color', 'hidden', 'number', 'datetime', 'file', 'markdown', 'relation']);
    const widgets: string[] = [];
    const walk = (fields: (Field & { widget?: string; fields?: Field[] })[] = []) =>
      fields.forEach((f) => { widgets.push(f.widget ?? 'string'); walk(f.fields as never); });
    for (const s of [...config.singletons, ...config.collections] as Section[]) walk(s.fields as never);
    expect(widgets.filter((w) => !builtIn.has(w))).toEqual([]);
  });

  it('loads the same Sveltia version the tests validate against', () => {
    const html = readFileSync(join(root, 'public/admin/index.html'), 'utf8');
    const { version } = JSON.parse(readFileSync(join(sveltia, 'package.json'), 'utf8'));
    expect(html).toContain(`@sveltia/cms@${version}/`);
  });

  const collections = (config.collections as Section[]).filter((c) => !c.divider);

  it('covers every content folder', () => {
    expect(collections.map((c) => c.name).sort()).toEqual(Object.keys(folders).sort());
  });

  it.each(collections.map((c) => [c.name, c] as const))('collection %s matches its folder and schema', (name, c) => {
    expect(c.folder).toBe(`src/content/${name}`);
    checkFields(c, folders[name as keyof typeof folders]);
  });

  it.each(relations.map((r) => [`${r.from}.${r.field}`, r] as const))('%s is a relation picker to the right collection, stored by slug', (_, r) => {
    const field = (collections.find((c) => c.name === r.from)!.fields as (Field & Record<string, unknown>)[]).find((f) => f.name === r.field);
    expect(field).toMatchObject({ widget: 'relation', collection: r.to, value_field: '{{slug}}' });
  });

  it.each((config.singletons as Section[]).map((s) => [s.name, s] as const))('singleton %s matches its file and schema', (name, s) => {
    expect(s.file).toBe(`src/content/${name}.json`);
    expect(existsSync(join(root, s.file!))).toBe(true);
    checkFields(s, singletons[name as keyof typeof singletons]);
  });
});
