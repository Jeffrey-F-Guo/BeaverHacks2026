# POST /votes — Submit Vote
# GET  /votes/{topic_id}/distribution — Get Vote Distribution
#
# Handles the spectrum vote that unlocks after a user watches all 6 videos.
# Votes are a float between 0.0 (fully Pole A) and 1.0 (fully Pole B).
#
# POST stores the vote and returns the updated distribution.
# GET returns the full distribution across the spectrum so the frontend can
# render the consensus curve. Uses Supabase Realtime on the frontend side
# for live updates — the distribution visibly shifts as new votes come in,
# which is the demo payoff moment.
