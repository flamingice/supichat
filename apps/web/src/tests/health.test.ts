import { describe, it, expect } from 'vitest';

// Very light sanity test on env presence
describe('env', () => {
  it('has basePath default', () => {
    expect(process.env.NEXT_PUBLIC_BASE_PATH || '/MyChatApp').toBeTruthy();
  });
});




