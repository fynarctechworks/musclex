import { execFileSync } from 'child_process';
import { join } from 'path';

/**
 * The two split schemas (`schema.public.prisma`, `schema.tenant.prisma`) are
 * generated from `schema.prisma` and back two SEPARATE Prisma clients. If they
 * drift, the symptom is not a build error — it is a client missing a model or
 * a column at runtime, in whichever half nobody regenerated.
 *
 * That drift already happened: the generator hardcoded an absolute path from
 * another machine, so it could not run here, and both files were hand-edited
 * for months under a header saying not to.
 */
describe('split Prisma schemas', () => {
  it('are in sync with schema.prisma', () => {
    const script = join(__dirname, '../../scripts/_phase2_split.js');
    // Exits non-zero, naming the offending files, if they have drifted.
    const out = execFileSync('node', [script, '--check'], { encoding: 'utf8' });
    expect(out).toMatch(/match schema\.prisma/);
  });
});
