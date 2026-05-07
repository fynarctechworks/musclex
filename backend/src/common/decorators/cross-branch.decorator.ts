import { SetMetadata } from '@nestjs/common';

export const CROSS_BRANCH_KEY = 'cross_branch';
export const CrossBranch = () => SetMetadata(CROSS_BRANCH_KEY, true);
