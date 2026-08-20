import { PublicPrismaService } from '../../prisma/public-prisma.service';

/**
 * ────────────────────────────────────────────────────────────────
 * WHO MAY SEE AN ACTIVITY — the only definition
 * ────────────────────────────────────────────────────────────────
 *
 * Extracted the moment a SECOND surface needed it (the club feed). A club feed
 * that re-derived this would be the classic leak: joining a club would quietly
 * become a way to see activities their owner chose not to share.
 *
 * Every caller composes this filter into its own WHERE. Nothing else decides
 * visibility, anywhere.
 */

export interface ViewerScope {
  /** People this member follows. */
  following: string[];
  /** People blocked in EITHER direction — a block is symmetric in effect. */
  blocked: string[];
}

export async function loadViewerScope(
  pub: PublicPrismaService,
  meId: string,
): Promise<ViewerScope> {
  const [follows, blocks] = await Promise.all([
    pub.follow.findMany({ where: { follower_id: meId }, select: { followee_id: true } }),
    pub.block.findMany({
      where: { OR: [{ blocker_id: meId }, { blocked_id: meId }] },
      select: { blocker_id: true, blocked_id: true },
    }),
  ]);

  const blocked = new Set<string>();
  for (const b of blocks) blocked.add(b.blocker_id === meId ? b.blocked_id : b.blocker_id);

  return { following: follows.map((f) => f.followee_id), blocked: [...blocked] };
}

/**
 *   own activities   always
 *   'everyone'       anyone not blocked
 *   'followers'      only people they follow
 *   'only_me'        nobody but the owner
 *
 * Blocks win over all of it, in both directions.
 */
export function visibleActivityFilter(meId: string, scope: ViewerScope) {
  return {
    AND: [
      { app_user_id: { notIn: scope.blocked } },
      {
        OR: [
          { app_user_id: meId },
          { visibility: 'everyone' },
          { visibility: 'followers', app_user_id: { in: scope.following } },
        ],
      },
    ],
  };
}
