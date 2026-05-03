const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8000';

export type PipelineStatus = {
  research: string;
  debate: string;
  summary: string;
  scripts: string;
  audio: string;
  video: string;
};

export type Topic = {
  id: string;
  topic: string;
  pole_a: string;
  pole_b: string;
  topic_slug: string;
  pipeline_status: PipelineStatus;
  video_urls: string[] | null;
  scripts: ShortScript[] | null;
};

export type ShortScript = {
  role: string;
  title: string;
  headline: string;
  narration: string;
  image_prompts: string[];
  voice: string;
};

export type TopicDetail = Topic & {
  briefing: {
    origin: string;
    key_players: string;
    case_for_a: string;
    case_for_b: string;
    consequences: string;
    current_state: string;
    viz_urls: string[];
  } | null;
  debate_summary: {
    side_a_points: string[];
    side_b_points: string[];
  } | null;
  audio_urls: string[] | null;
};

export type VoteDistribution = {
  topic_id: string;
  total: number;
  histogram: number[];
  mean: number | null;
};

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, options);
  if (!res.ok) throw new Error(`API error ${res.status}: ${path}`);
  return res.json() as Promise<T>;
}

export const api = {
  getTopics: () => apiFetch<Topic[]>('/topics'),

  getTopic: (id: string) => apiFetch<TopicDetail>(`/topics/${id}`),

  getPipelineStatus: (id: string) =>
    apiFetch<PipelineStatus>(`/pipeline/status/${id}`),

  submitVote: (topic_id: string, position: number) =>
    apiFetch<VoteDistribution>('/votes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ topic_id, position }),
    }),

  getVoteDistribution: (id: string) =>
    apiFetch<VoteDistribution>(`/votes/${id}/distribution`),
};
