ALTER TABLE "courses"
ADD COLUMN IF NOT EXISTS "difficulty" text DEFAULT 'beginner' NOT NULL;