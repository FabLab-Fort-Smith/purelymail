import { describe, expect, it } from 'vitest';
import {
  PurelymailApiError,
  PurelymailAuthError,
  PurelymailConfigError,
  PurelymailError,
  PurelymailTransportError,
  PurelymailValidationError,
} from '../src/errors.js';

describe('errors', () => {
  it('base error sets name and preserves prototype chain', () => {
    const err = new PurelymailError('boom', { cause: new Error('x') });
    expect(err).toBeInstanceOf(PurelymailError);
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe('PurelymailError');
    expect(err.message).toBe('boom');
    expect(err.cause).toBeInstanceOf(Error);
  });

  it('config error', () => {
    const err = new PurelymailConfigError('bad');
    expect(err).toBeInstanceOf(PurelymailError);
    expect(err.name).toBe('PurelymailConfigError');
  });

  it('validation error carries phase and issues', () => {
    const err = new PurelymailValidationError('request', ['a: bad', 'b: worse']);
    expect(err.phase).toBe('request');
    expect(err.issues).toEqual(['a: bad', 'b: worse']);
    expect(err.message).toContain('request validation failed');
    expect(err.name).toBe('PurelymailValidationError');
  });

  it('transport error tracks timeout flag', () => {
    const t = new PurelymailTransportError('slow', { timeout: true });
    expect(t.timeout).toBe(true);
    const n = new PurelymailTransportError('net');
    expect(n.timeout).toBe(false);
    expect(n.name).toBe('PurelymailTransportError');
  });

  it('api error carries code and status; defaults undefined', () => {
    const err = new PurelymailApiError('nope', { code: 'X', httpStatus: 400 });
    expect(err.code).toBe('X');
    expect(err.httpStatus).toBe(400);
    const bare = new PurelymailApiError('nope');
    expect(bare.code).toBeUndefined();
    expect(bare.httpStatus).toBeUndefined();
    expect(bare.name).toBe('PurelymailApiError');
  });

  it('auth error is an api error with its own name', () => {
    const err = new PurelymailAuthError('unauth', { httpStatus: 401 });
    expect(err).toBeInstanceOf(PurelymailApiError);
    expect(err.name).toBe('PurelymailAuthError');
    expect(err.httpStatus).toBe(401);
  });
});
