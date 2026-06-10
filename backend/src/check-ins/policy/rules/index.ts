import { BranchAccessRule } from './branch-access.rule';
import { ParallelSessionRule } from './parallel-session.rule';
import { MemberStatusRule } from './member-status.rule';
import { MembershipRule } from './membership.rule';
import { FreezeRule } from './freeze.rule';
import { ClassCreditsRule } from './class-credits.rule';
import { CooldownRule } from './cooldown.rule';
import { DuplicateRule } from './duplicate.rule';

export {
  BranchAccessRule,
  ParallelSessionRule,
  MemberStatusRule,
  MembershipRule,
  FreezeRule,
  ClassCreditsRule,
  CooldownRule,
  DuplicateRule,
};

export const ALL_RULE_PROVIDERS = [
  BranchAccessRule,
  ParallelSessionRule,
  MemberStatusRule,
  MembershipRule,
  FreezeRule,
  ClassCreditsRule,
  CooldownRule,
  DuplicateRule,
];
