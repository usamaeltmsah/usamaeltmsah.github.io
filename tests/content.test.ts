import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { folders, relations, singletons } from '../src/lib/schemas';

const root = join(import.meta.dirname, '..', 'src');
const read = (path: string) => JSON.parse(readFileSync(path, 'utf8'));
const imageExists = (name: string) => !name || existsSync(join(root, 'assets', 'images', name.split('/').pop()!));

describe.each(Object.entries(singletons))('singleton %s', (name, schema) => {
  it('matches its schema', () => {
    const result = schema.safeParse(read(join(root, 'content', `${name}.json`)));
    expect(result.error?.issues ?? []).toEqual([]);
  });
});

describe.each(Object.entries(folders))('collection %s', (name, schema) => {
  const dir = join(root, 'content', name);
  const files = readdirSync(dir).filter((f) => f.endsWith('.json'));

  it('has entries', () => expect(files.length).toBeGreaterThan(0));

  it.each(files)('%s matches its schema and its images exist', (file) => {
    const result = schema.safeParse(read(join(dir, file)));
    expect(result.error?.issues ?? []).toEqual([]);
    const image = (result.data as { image?: string }).image ?? '';
    expect(imageExists(image), `missing image ${image}`).toBe(true);
  });
});

describe('profile', () => {
  it('references an existing photo', () => {
    const profile = singletons.profile.parse(read(join(root, 'content', 'profile.json')));
    expect(imageExists(profile.image)).toBe(true);
  });
});

describe('relations', () => {
  const ids = (name: string) => readdirSync(join(root, 'content', name)).filter((f) => f.endsWith('.json')).map((f) => f.slice(0, -5));

  it.each(relations.map((r) => [`${r.from}.${r.field} → ${r.to}`, r] as const))('%s points to existing entries', (_, r) => {
    const targets = new Set(ids(r.to));
    const dangling = ids(r.from)
      .map((id) => [id, read(join(root, 'content', r.from, `${id}.json`))[r.field] ?? ''] as const)
      .filter(([, value]) => value !== '' && !targets.has(value));
    expect(dangling, `entries in ${r.from} with a broken ${r.field} link`).toEqual([]);
  });
});
