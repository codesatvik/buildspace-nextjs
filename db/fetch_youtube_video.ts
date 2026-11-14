import { google, youtube_v3 } from "googleapis";
import * as dotenv from "dotenv";
import { db } from "@/db/drizzle";
import { courses, lessons } from "@/db/schema";
import { eq } from "drizzle-orm";

dotenv.config({ path: ".env" });

console.log("KEY", process.env.YOUTUBE_API_KEY);
console.log("ID", process.env.YOUTUBE_CHANNEL_ID);

const youtube = google.youtube({
  version: "v3",
  auth: process.env.YOUTUBE_API_KEY,
});

const CHANNEL_ID = process.env.YOUTUBE_CHANNEL_ID;
const BATCH_SIZE = 50; 

function determineDifficulty(title: string): string {
  const lower = title.toLowerCase();
  if (lower.includes("advanced") || lower.includes("expert")) return "advanced";
  if (lower.includes("intermediate")) return "intermediate";
  return "beginner";
}

function calculateDuration(videoCount: number): number {
  return videoCount * 15;
}

function calculatePoints(difficulty: string, videoCount: number): number {
  const basePoints =
    difficulty === "beginner"
      ? 500
      : difficulty === "intermediate"
        ? 750
        : 1000;
  return basePoints + videoCount * 10;
}

async function fetchChannelPlaylists() {
  if (!CHANNEL_ID) {
    throw new Error("YOUTUBE_CHANNEL_ID is not set in .env.local");
  }

  console.log("📺 Fetching playlists from channel...");

  let allPlaylists: any[] = [];
  let pageToken: string | undefined = undefined;

  do {
    const response: youtube_v3.Schema$PlaylistListResponse = (await youtube.playlists.list({
      part: ["snippet", "contentDetails"],
      channelId: CHANNEL_ID,
      maxResults: BATCH_SIZE,
      pageToken: pageToken,
    })).data;

    const playlists = response.items || [];
    allPlaylists = [...allPlaylists, ...playlists];
    pageToken = response.nextPageToken || undefined;

    console.log(`  Found ${playlists.length} playlists...`);
  } while (pageToken);

  console.log(`✅ Total playlists found: ${allPlaylists.length}\n`);
  return allPlaylists;
}

async function fetchPlaylistVideos(playlistId: string, playlistTitle: string) {
  console.log(`  📹 Fetching videos for: ${playlistTitle}`);

  let allVideos: any[] = [];
  let pageToken: string | undefined = undefined;

  do {
    const response: youtube_v3.Schema$PlaylistItemListResponse = (await youtube.playlistItems.list({
      part: ["snippet", "contentDetails"],
      playlistId: playlistId,
      maxResults: BATCH_SIZE,
      pageToken: pageToken,
    })).data;

    const videos = response.items || [];
    allVideos = [...allVideos, ...videos];
    pageToken = response.nextPageToken || undefined;
  } while (pageToken);

  console.log(`    ✅ Found ${allVideos.length} videos`);
  return allVideos;
}

async function seedCoursesFromPlaylists() {
  console.log("🚀 Starting YouTube content import...\n");

  const playlists = await fetchChannelPlaylists();

  const coursePlaylists = playlists.filter((playlist) => {
    const title = playlist.snippet?.title || "";
    const isSystemPlaylist =
      title === "Uploads" || title === "Liked videos" || title === "Favorites";
    return !isSystemPlaylist;
  });

  console.log(`📚 Processing ${coursePlaylists.length} course playlists...\n`);

  let coursesAdded = 0;
  let lessonsAdded = 0;

  for (const playlist of coursePlaylists) {
    const playlistId = playlist.id!;
    const snippet = playlist.snippet!;
    const contentDetails = playlist.contentDetails!;

    const title = snippet.title || "Untitled Course";
    const description =
      snippet.description ||
      `Complete ${title} course for beginners. Learn ${title.toLowerCase()} with practical examples and hands-on projects.`;
    const videoCount = contentDetails.itemCount || 0;
    const thumbnail =
      snippet.thumbnails?.high?.url || snippet.thumbnails?.default?.url || null;

    const difficulty = determineDifficulty(title);
    const duration = calculateDuration(videoCount);
    const points = calculatePoints(difficulty, videoCount);

    console.log(`📖 Processing course: ${title}`);
    console.log(
      `    Videos: ${videoCount}, Difficulty: ${difficulty}, XP: ${points}`,
    );

    const [existingCourse] = await db.select().from(courses).where(eq(courses.title, title)).limit(1);

    if (existingCourse) {
      console.log(`    ⏭️  Course already exists, skipping...`);
      continue;
    }

    const [course] = await db
      .insert(courses)
      .values({
        title: title,
        description: description,
        difficulty: difficulty,
        duration: duration,
        points: points,
        thumbnail: thumbnail,
      })
      .returning();

    coursesAdded++;

    const videos = await fetchPlaylistVideos(playlistId, title);

    if (videos.length > 0) {
      const lessonValues = videos.map((video, index) => {
        const videoSnippet = video.snippet!;
        const videoId = video.contentDetails?.videoId;

        return {
          title: videoSnippet.title || `Lesson ${index + 1}`,
          content:
            videoSnippet.description ||
            `Watch this video to learn ${title.toLowerCase()}. Complete tutorial with practical examples.`,
          videoUrl: `https://www.youtube.com/watch?v=${videoId}`,
          order: index + 1,
          courseId: course.id,
        };
      });

      await db.insert(lessons).values(lessonValues);
      lessonsAdded += lessonValues.length;
    }

    console.log(`    ✅ Added ${videos.length} lessons\n`);
  }

  console.log("✨ Import complete!");
  console.log(`   📚 Courses added: ${coursesAdded}`);
  console.log(`   📹 Lessons added: ${lessonsAdded}`);
}

seedCoursesFromPlaylists()
  .then(() => {
    console.log("\n✅ YouTube content import finished!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ Import failed:", error);
    process.exit(1);
  });