import MatchStatsCard from '@/app/components/jsx/MatchStatsCard'
import { MatchBodySchema } from '@/app/components/zod/Match'

export default async function MatchStatsPage({ params }: {
  params: Promise<{ slugs: string[] }>
}) {
  const { slugs } = await params
  const [game_mode, match_id, source, year] = slugs
  const match_body = MatchBodySchema.parse({
    game_mode,
    match_id: +match_id,
    source,
    year,
  })
  return <MatchStatsCard match_body={match_body} />
}