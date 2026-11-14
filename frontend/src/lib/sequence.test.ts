import { describe, expect, it } from 'vitest';
import { createSequence } from './sequence';

describe('createSequence', () => {
  it('accepts responses in issue order', () => {
    const s = createSequence();
    const a = s.issue();
    const b = s.issue();
    expect(s.accept(a)).toBe(true);
    expect(s.accept(b)).toBe(true);
  });

  it('rejects a response older than one already applied', () => {
    const s = createSequence();
    const a = s.issue();
    const b = s.issue();
    expect(s.accept(b)).toBe(true);
    expect(s.accept(a)).toBe(false);
  });

  it('keeps an earlier success when a later request fails (the later one is never accepted)', () => {
    const s = createSequence();
    const a = s.issue(); // preset succeeds
    s.issue(); // verify fails: never calls accept
    expect(s.accept(a)).toBe(true);
  });

  it('a direct set invalidates everything issued before it', () => {
    const s = createSequence();
    const a = s.issue();
    s.accept(s.issue()); // set() path
    expect(s.accept(a)).toBe(false);
  });
});
