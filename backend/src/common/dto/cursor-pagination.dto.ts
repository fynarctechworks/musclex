import { IsOptional, IsString, IsInt, Min, Max } from 'class-validator';
import { Transform } from 'class-transformer';

/**
 * Cursor-based pagination DTO for large datasets.
 * Use 'cursor' (last item's ID) + 'take' for efficient pagination.
 *
 * Example: GET /api/v1/members?cursor=abc-123&take=20&sort=created_at&order=desc
 */
export class CursorPaginationDto {
  @IsOptional()
  @IsString()
  cursor?: string;

  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  @IsInt()
  @Min(1)
  @Max(100)
  take?: number = 20;

  @IsOptional()
  @IsString()
  sort?: string = 'created_at';

  @IsOptional()
  @IsString()
  order?: 'asc' | 'desc' = 'desc';
}

export interface CursorPaginatedResponse<T> {
  data: T[];
  meta: {
    hasMore: boolean;
    nextCursor: string | null;
    count: number;
  };
}

/**
 * Build Prisma findMany args for cursor pagination.
 */
export function buildCursorPaginationArgs(dto: CursorPaginationDto) {
  const take = dto.take || 20;
  const orderBy = { [dto.sort || 'created_at']: dto.order || 'desc' };

  if (dto.cursor) {
    return {
      take: take + 1, // Fetch one extra to check for next page
      skip: 1, // Skip the cursor itself
      cursor: { id: dto.cursor },
      orderBy,
    };
  }

  return {
    take: take + 1,
    orderBy,
  };
}

/**
 * Format a Prisma result set into a cursor-paginated response.
 */
export function formatCursorResponse<T extends { id: string }>(
  items: T[],
  take: number,
): CursorPaginatedResponse<T> {
  const hasMore = items.length > take;
  const data = hasMore ? items.slice(0, take) : items;
  const lastItem = data[data.length - 1];

  return {
    data,
    meta: {
      hasMore,
      nextCursor: hasMore && lastItem ? lastItem.id : null,
      count: data.length,
    },
  };
}
