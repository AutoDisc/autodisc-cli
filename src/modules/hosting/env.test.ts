import { describe, expect, it } from 'vitest';
import { validateHostedConnectionVariable } from './env.js';

describe('hosted connection validation', () => {
  it('rejects placeholder database credentials', () => {
    expect(() => validateHostedConnectionVariable(
      'DATABASE_URL',
      'postgres://placeholder:placeholder@db.internal:5432/app',
    )).toThrow('contains placeholder credentials');
  });

  it('rejects database URLs that point inside the app container', () => {
    expect(() => validateHostedConnectionVariable(
      'DATABASE_URL',
      'postgres://app:secret@localhost:5432/app',
    )).toThrow('resolves inside the application container');
  });

  it('accepts a managed private database hostname', () => {
    expect(() => validateHostedConnectionVariable(
      'DATABASE_URL',
      'postgres://app:secret@db-180105808738339d3293:5432/app',
    )).not.toThrow();
  });
});
