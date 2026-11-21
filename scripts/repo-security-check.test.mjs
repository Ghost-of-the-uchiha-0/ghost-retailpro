import { describe, expect, it } from 'vitest';
import { formatFinding, isEnvironmentFilePath, scanText } from './repo-security-check.mjs';

describe('repository security check', () => {
  it('recognizes tracked .env files and variants', () => {
    expect(isEnvironmentFilePath('.env')).toBe(true);
    expect(isEnvironmentFilePath('config/.env.production')).toBe(true);
    expect(isEnvironmentFilePath('src/environment.ts')).toBe(false);
  });

  it('flags likely private assignments without returning their values', () => {
    const secretValue = 'private-value-should-never-print';
    const [finding] = scanText('config/settings.env', `PAYMENT_SECRET=${secretValue}`);

    expect(finding).toMatchObject({ rule: 'credential-like-assignment', name: 'PAYMENT_SECRET', line: 1 });
    expect(JSON.stringify(finding)).not.toContain(secretValue);
    expect(formatFinding(finding)).not.toContain(secretValue);
  });

  it('does not treat explicitly public keys or common placeholders as private credentials', () => {
    const findings = scanText(
      'src/config.ts',
      'SUPABASE_PUBLISHABLE_KEY=public-value\nPUBLIC_API_KEY=public-value\nSTRIPE_SECRET_KEY=replace-me',
    );

    expect(findings).toEqual([]);
  });

  it('flags recognizable private token patterns without printing the token', () => {
    const token = `ghp_${'A'.repeat(32)}`;
    const [finding] = scanText('scripts/setup.txt', `token=${token}`);

    expect(finding).toMatchObject({ rule: 'known-secret-pattern', description: 'GitHub token pattern' });
    expect(formatFinding(finding)).not.toContain(token);
  });
});