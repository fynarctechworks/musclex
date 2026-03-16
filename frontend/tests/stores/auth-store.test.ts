import { describe, it, expect, beforeEach } from 'vitest';
import { useAuthStore } from '@/stores/auth-store';

const mockUser = {
  id: 'user-1',
  email: 'owner@gym.com',
  full_name: 'Test Owner',
  role: 'owner',
  studio_id: 'studio-1',
  branch_ids: ['branch-1'],
  permissions: {
    members: ['view', 'create', 'edit', 'delete'],
    payments: ['view', 'create'],
  },
  permission_codes: ['members.view', 'members.create', 'members.edit', 'members.delete', 'payments.view', 'payments.create'],
};

const mockStudio = {
  id: 'studio-1',
  name: 'Test Gym',
  slug: 'test-gym',
};

describe('useAuthStore', () => {
  beforeEach(() => {
    useAuthStore.setState({
      user: null,
      studio: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      loading: false,
    });
  });

  it('should start with null user and unauthenticated', () => {
    const state = useAuthStore.getState();
    expect(state.user).toBeNull();
    expect(state.isAuthenticated).toBe(false);
  });

  it('should set auth data', () => {
    useAuthStore.getState().setAuth({
      user: mockUser,
      studio: mockStudio,
      access_token: 'test-token',
      refresh_token: 'test-refresh',
    });

    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(true);
    expect(state.user?.email).toBe('owner@gym.com');
    expect(state.accessToken).toBe('test-token');
  });

  it('should logout and clear state', () => {
    useAuthStore.getState().setAuth({
      user: mockUser,
      studio: mockStudio,
      access_token: 'test-token',
      refresh_token: 'test-refresh',
    });

    useAuthStore.getState().logout();
    const state = useAuthStore.getState();
    expect(state.user).toBeNull();
    expect(state.isAuthenticated).toBe(false);
    expect(state.accessToken).toBeNull();
  });

  it('should update studio', () => {
    useAuthStore.getState().updateStudio({ ...mockStudio, name: 'Updated Gym' });
    expect(useAuthStore.getState().studio?.name).toBe('Updated Gym');
  });

  it('should update user partial fields', () => {
    useAuthStore.getState().setAuth({
      user: mockUser,
      studio: mockStudio,
      access_token: 'test-token',
      refresh_token: 'test-refresh',
    });

    useAuthStore.getState().updateUser({ full_name: 'Updated Name' });
    expect(useAuthStore.getState().user?.full_name).toBe('Updated Name');
    expect(useAuthStore.getState().user?.email).toBe('owner@gym.com');
  });

  describe('hasPermission', () => {
    it('should return true for owner role regardless of permissions', () => {
      useAuthStore.getState().setAuth({
        user: mockUser,
        studio: mockStudio,
        access_token: 't',
        refresh_token: 'r',
      });
      expect(useAuthStore.getState().hasPermission('anything', 'any_action')).toBe(true);
    });

    it('should check permissions map for non-owner roles', () => {
      useAuthStore.getState().setAuth({
        user: { ...mockUser, role: 'trainer' },
        studio: mockStudio,
        access_token: 't',
        refresh_token: 'r',
      });
      expect(useAuthStore.getState().hasPermission('members', 'view')).toBe(true);
      expect(useAuthStore.getState().hasPermission('settings', 'edit')).toBe(false);
    });

    it('should return false when no user', () => {
      expect(useAuthStore.getState().hasPermission('members', 'view')).toBe(false);
    });
  });

  describe('hasAnyPermission', () => {
    it('should return true when user has any permission in module', () => {
      useAuthStore.getState().setAuth({
        user: { ...mockUser, role: 'trainer' },
        studio: mockStudio,
        access_token: 't',
        refresh_token: 'r',
      });
      expect(useAuthStore.getState().hasAnyPermission('members')).toBe(true);
      expect(useAuthStore.getState().hasAnyPermission('settings')).toBe(false);
    });
  });
});
