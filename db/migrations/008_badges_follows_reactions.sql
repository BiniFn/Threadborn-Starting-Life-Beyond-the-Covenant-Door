-- Reading streaks
CREATE TABLE IF NOT EXISTS reader_streaks (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  current_streak int NOT NULL DEFAULT 0,
  longest_streak int NOT NULL DEFAULT 0,
  last_read_date date,
  total_days_read int NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Badges / achievements
CREATE TABLE IF NOT EXISTS reader_badges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  badge_key text NOT NULL,
  earned_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, badge_key)
);

-- Follow system (characters, volumes, arcs)
CREATE TABLE IF NOT EXISTS reader_follows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  follow_type text NOT NULL CHECK (follow_type IN ('character','volume','arc','tag')),
  follow_key text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, follow_type, follow_key)
);

-- Inline paragraph reactions
CREATE TABLE IF NOT EXISTS paragraph_reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  novel_id text NOT NULL DEFAULT 'threadborn',
  chapter_key text NOT NULL,
  paragraph_index int NOT NULL,
  emoji text NOT NULL CHECK (emoji IN ('❤️','😂','😱','🔥','💀','🤯','👏')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, chapter_key, paragraph_index, emoji)
);

-- Feedback / bug reports
CREATE TABLE IF NOT EXISTS reader_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  page_path text NOT NULL DEFAULT '/',
  feedback_type text NOT NULL DEFAULT 'general' CHECK (feedback_type IN ('bug','suggestion','content','other')),
  message text NOT NULL CHECK (char_length(message) BETWEEN 5 AND 2000),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Vote-to-unlock milestones
CREATE TABLE IF NOT EXISTS unlock_milestones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text NOT NULL,
  unlock_type text NOT NULL DEFAULT 'lore',
  unlock_content text NOT NULL DEFAULT '',
  target_votes int NOT NULL DEFAULT 100,
  current_votes int NOT NULL DEFAULT 0,
  is_unlocked boolean NOT NULL DEFAULT false,
  lang text NOT NULL DEFAULT 'en',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS unlock_votes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  milestone_id uuid NOT NULL REFERENCES unlock_milestones(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, milestone_id)
);

CREATE INDEX IF NOT EXISTS idx_paragraph_reactions_chapter ON paragraph_reactions(novel_id, chapter_key);
CREATE INDEX IF NOT EXISTS idx_reader_follows_user ON reader_follows(user_id);
CREATE INDEX IF NOT EXISTS idx_reader_badges_user ON reader_badges(user_id);
