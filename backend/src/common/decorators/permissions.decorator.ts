import { SetMetadata } from '@nestjs/common';
import { PermissionModule, ModuleAction } from './current-user.decorator';

export const PERMISSIONS_KEY = 'permissions';

export interface RequiredPermission {
  module: PermissionModule;
  action: ModuleAction;
}

export const Permissions = (...permissions: RequiredPermission[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);
