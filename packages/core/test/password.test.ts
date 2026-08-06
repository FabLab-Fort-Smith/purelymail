import { describe, expect, it } from 'vitest';
import { generatePassword } from '../src/password.js';

const AMBIGUOUS = /[0O1lI]/;

describe('generatePassword', () => {
  it('defaults to length 20 with all character classes', () => {
    const pw = generatePassword();
    expect(pw).toHaveLength(20);
    expect(pw).toMatch(/[a-z]/);
    expect(pw).toMatch(/[A-Z]/);
    expect(pw).toMatch(/[0-9]/);
    expect(pw).toMatch(/[!@#$%^&*\-_=+]/);
  });

  it('honours a custom length', () => {
    expect(generatePassword({ length: 32 })).toHaveLength(32);
  });

  it('clamps to a minimum length of 12', () => {
    expect(generatePassword({ length: 4 })).toHaveLength(12);
  });

  it('omits symbols when disabled but keeps the other classes', () => {
    const pw = generatePassword({ length: 24, symbols: false });
    expect(pw).toHaveLength(24);
    expect(pw).not.toMatch(/[!@#$%^&*\-_=+]/);
    expect(pw).toMatch(/[a-z]/);
    expect(pw).toMatch(/[A-Z]/);
    expect(pw).toMatch(/[0-9]/);
  });

  it('never uses ambiguous characters', () => {
    for (let i = 0; i < 50; i += 1) {
      expect(generatePassword()).not.toMatch(AMBIGUOUS);
    }
  });

  it('produces distinct values across calls', () => {
    const set = new Set(Array.from({ length: 20 }, () => generatePassword()));
    expect(set.size).toBe(20);
  });
});
