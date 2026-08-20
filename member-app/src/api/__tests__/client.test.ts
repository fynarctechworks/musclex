import { request, setToken } from '../client';

/**
 * The empty-body case is the one that bites: Nest answers 200 with NO body when
 * a handler returns null (e.g. /workouts/today with nothing assigned, which is
 * most members most days). Returning undefined from there makes React Query
 * throw "Query data cannot be undefined" and takes the screen down.
 */
const reply = (body: string, ok = true, status = 200) =>
  Promise.resolve({ ok, status, text: () => Promise.resolve(body) } as Response);

beforeEach(() => {
  setToken('t');
  jest.restoreAllMocks();
});

describe('request', () => {
  it('unwraps the data envelope', async () => {
    jest.spyOn(globalThis, 'fetch').mockImplementation(() => reply('{"data":{"id":"x"}}'));
    await expect(request('/thing')).resolves.toEqual({ id: 'x' });
  });

  it('returns null — never undefined — for a 200 with an empty body', async () => {
    jest.spyOn(globalThis, 'fetch').mockImplementation(() => reply(''));
    await expect(request('/workouts/today')).resolves.toBeNull();
  });

  it('returns null for an envelope whose data is explicitly null', async () => {
    jest.spyOn(globalThis, 'fetch').mockImplementation(() => reply('{"data":null}'));
    await expect(request('/workouts/today')).resolves.toBeNull();
  });

  it('surfaces the server error message', async () => {
    jest
      .spyOn(globalThis, 'fetch')
      .mockImplementation(() => reply('{"error":{"code":"X","message":"nope"}}', false, 400));
    await expect(request('/thing')).rejects.toThrow('nope');
  });

  it('reports a network failure as offline, which is the queueable case', async () => {
    jest.spyOn(globalThis, 'fetch').mockImplementation(() => Promise.reject(new Error('down')));
    await expect(request('/thing')).rejects.toThrow('No connection');
  });
});
