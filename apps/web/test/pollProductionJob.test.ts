import { describe, expect, it } from 'vitest';
import { ApiHttpError } from '../src/api';
import { isTransientApiError } from '../src/lib/pollProductionJob';

describe('isTransientApiError', () => {
  it('treats gateway errors as transient', () => {
    expect(isTransientApiError(new ApiHttpError(502))).toBe(true);
    expect(isTransientApiError(new ApiHttpError(503))).toBe(true);
    expect(isTransientApiError(new ApiHttpError(404))).toBe(false);
  });
});
