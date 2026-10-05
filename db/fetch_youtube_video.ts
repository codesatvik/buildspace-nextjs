import { google } from "googleapis";
import * as dotenv from "dotenv";
import { db } from "@/db/drizzle";
import { courses, lessons } from "@/db/schema";
import { eq } from "drizzle-orm";

dotenv.config({ path: ".env" });

// --------------------------------------------------
// Environment variables
// --------------------------------------------------

const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;
const CHANNEL_ID = process.env.YOUTUBE_CHANNEL_ID;

if (!YOUTUBE_API_KEY) {
  throw new Error("YOUTUBE_API_KEY is not set in .env");
}

if (!CHANNEL_ID) {
  throw new Error("YOUTUBE_CHANNEL_ID is not set in .env");
}

// --------------------------------------------------
// YouTube API client
// --------------------------------------------------

const youtube = google.youtube({
  version: "v3",
  auth: YOUTUBE_API_KEY,
});

// Maximum items returned by YouTube per API request
const BATCH_SIZE = 50;

// --------------------------------------------------
// Calculate estimated course duration
// Assuming approximately 15 minutes per video
// --------------------------------------------------

function calculateDuration(videoCount: number): number {
  return videoCount * 15;
}

// --------------------------------------------------
// Calculate course XP
// --------------------------------------------------

function calculatePoints(difficulty: string, videoCount: number): number {
  const basePoints =
    difficulty === "beginner"
      ? 500
      : difficulty === "intermediate"
        ? 750
        : 1000;

  return basePoints + videoCount * 10;
}

// --------------------------------------------------
// Determine course difficulty
// --------------------------------------------------

function determineDifficulty(title: string): string {
  const lower = title.toLowerCase();

  if (lower.includes("advanced") || lower.includes("expert")) {
    return "advanced";
  }

  if (lower.includes("intermediate")) {
    return "intermediate";
  }

  return "beginner";
}

// --------------------------------------------------
// Fetch all playlists from YouTube channel
// --------------------------------------------------

async function fetchChannelPlaylists() {
  console.log("📺 Fetching playlists from channel...");

  let allPlaylists: any[] = [];
  let pageToken: string | undefined = undefined;

  do {
    const response = await youtube.playlists.list({
      part: ["snippet", "contentDetails"],
      channelId: CHANNEL_ID,
      maxResults: BATCH_SIZE,
      pageToken,
    });

    const playlists = response.data.items || [];

    allPlaylists = [...allPlaylists, ...playlists];

    pageToken = response.data.nextPageToken || undefined;

    console.log(`  Found ${playlists.length} playlists...`);
  } while (pageToken);

  console.log(`✅ Total playlists found: ${allPlaylists.length}\n`);

  return allPlaylists;
}

// --------------------------------------------------
// Fetch all videos from a playlist
// --------------------------------------------------

async function fetchPlaylistVideos(playlistId: string, playlistTitle: string) {
  console.log(`  📹 Fetching videos for: ${playlistTitle}`);

  let allVideos: any[] = [];
  let pageToken: string | undefined = undefined;

  do {
    const response = await youtube.playlistItems.list({
      part: ["snippet", "contentDetails"],
      playlistId,
      maxResults: BATCH_SIZE,
      pageToken,
    });

    const videos = response.data.items || [];

    allVideos = [...allVideos, ...videos];

    pageToken = response.data.nextPageToken || undefined;
  } while (pageToken);

  console.log(`    ✅ Found ${allVideos.length} videos`);

  return allVideos;
}

// --------------------------------------------------
// Check whether a video is valid
// --------------------------------------------------

function isValidVideo(video: any): boolean {
  const videoId = video.contentDetails?.videoId;
  const title = video.snippet?.title;

  // No video ID
  if (!videoId) {
    return false;
  }

  // Private video
  if (title === "Private video") {
    return false;
  }

  // Deleted/unavailable videos sometimes appear
  // without a usable video ID
  return true;
}

// --------------------------------------------------
// Seed courses and lessons
// --------------------------------------------------

async function seedCoursesFromPlaylists() {
  console.log("🚀 Starting YouTube content import...\n");

  // ------------------------------------------------
  // 1. Fetch playlists
  // ------------------------------------------------

  const playlists = await fetchChannelPlaylists();

  // ------------------------------------------------
  // 2. Remove system playlists
  // ------------------------------------------------

  const coursePlaylists = playlists.filter((playlist) => {
    const title = playlist.snippet?.title || "";

    const isSystemPlaylist =
      title === "Uploads" || title === "Liked videos" || title === "Favorites";

    return !isSystemPlaylist;
  });

  console.log(`📚 Processing ${coursePlaylists.length} course playlists...\n`);

  let coursesAdded = 0;
  let lessonsAdded = 0;
  let lessonsSkipped = 0;

  // ------------------------------------------------
  // 3. Process every playlist
  // ------------------------------------------------

  for (const playlist of coursePlaylists) {
    try {
      const playlistId = playlist.id;

      if (!playlistId) {
        console.log("    ⚠️ Playlist has no ID, skipping...");
        continue;
      }

      const snippet = playlist.snippet;
      const contentDetails = playlist.contentDetails;

      const title = snippet?.title || "Untitled Course";

      const description =
        snippet?.description ||
        `Complete ${title} course for beginners. Learn ${title.toLowerCase()} with practical examples and hands-on projects.`;

      const videoCount = contentDetails?.itemCount || 0;

      const thumbnail =
        snippet?.thumbnails?.high?.url ||
        snippet?.thumbnails?.default?.url ||
        null;

      const difficulty = determineDifficulty(title);

      const duration = calculateDuration(videoCount);

      const points = calculatePoints(difficulty, videoCount);

      console.log(`📖 Processing course: ${title}`);

      console.log(
        `    Videos: ${videoCount}, Difficulty: ${difficulty}, XP: ${points}`,
      );

      // ------------------------------------------------
      // 4. Find existing course
      // ------------------------------------------------
      let existingCourse = await db
        .select()
        .from(courses)
        .where(eq(courses.title, title))
        .limit(1);

      let course = existingCourse[0];
      // ------------------------------------------------
      // 5. Create course if it doesn't exist
      // ------------------------------------------------

      if (!course) {
        const [newCourse] = await db
          .insert(courses)
          .values({
            title,
            description,
            difficulty,
            duration,
            points,
            thumbnail,
          })
          .returning();

        course = newCourse;

        coursesAdded++;

        console.log("    ✅ Course created");
      } else {
        console.log("    ℹ️ Course already exists, checking lessons...");
      }

      // ------------------------------------------------
      // 6. Fetch playlist videos
      // ------------------------------------------------

      const videos = await fetchPlaylistVideos(playlistId, title);

      // ------------------------------------------------
      // 7. Remove private/unavailable videos
      // ------------------------------------------------

      const validVideos = videos.filter(isValidVideo);

      const invalidCount = videos.length - validVideos.length;

      if (invalidCount > 0) {
        console.log(
          `    ⚠️ Skipping ${invalidCount} private/unavailable videos`,
        );
      }

      console.log(`    📹 ${validVideos.length} valid videos`);

      // ------------------------------------------------
      // 8. Insert lessons
      // ------------------------------------------------

      for (let index = 0; index < validVideos.length; index++) {
        const video = validVideos[index];

        const videoSnippet = video.snippet;

        const videoId = video.contentDetails?.videoId;

        if (!videoId) {
          continue;
        }

        const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;

        // ----------------------------------------------
        // Check if lesson already exists
        // ----------------------------------------------

        const existingLesson = await db
          .select()
          .from(lessons)
          .where(eq(lessons.videoUrl, videoUrl))
          .limit(1);

        if (existingLesson.length > 0) {
          lessonsSkipped++;
          continue;
        }

        // ----------------------------------------------
        // Insert lesson
        // ----------------------------------------------

        await db.insert(lessons).values({
          title: videoSnippet?.title || `Lesson ${index + 1}`,

          content:
            videoSnippet?.description ||
            `Watch this video to learn ${title.toLowerCase()}. Complete tutorial with practical examples.`,

          videoUrl,

          order: index + 1,

          courseId: course.id,
        });

        lessonsAdded++;
      }

      console.log(`    ✅ Finished processing ${title}\n`);
    } catch (error) {
      console.error(`    ❌ Error processing playlist:`, error);
    }
  }

  // ------------------------------------------------
  // Final summary
  // ------------------------------------------------

  console.log("========================================");

  console.log("🎉 YouTube import completed!");

  console.log("========================================");

  console.log(`📚 Courses added: ${coursesAdded}`);

  console.log(`📖 Lessons added: ${lessonsAdded}`);

  console.log(`⏭️ Lessons already existing: ${lessonsSkipped}`);

  console.log("========================================");
}

// --------------------------------------------------
// Run importer
// --------------------------------------------------

seedCoursesFromPlaylists().catch((error) => {
  console.error("❌ YouTube import failed:", error);

  process.exit(1);
});
