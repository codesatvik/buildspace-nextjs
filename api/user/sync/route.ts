import { db } from "@/db/drizzle";
import { users } from "@/db/schema";
import { auth, currentUser } from "@clerk/nextjs/server";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function POST() {
    try {
        const { userId } = await auth();
        const clerkUser = await currentUser();
        if (!userId || !clerkUser) {
            return new NextResponse("unauthorized", { status: 401 });
        }

        const existingUser = await db.query.users.findFirst({
            where: { clerkId: userId },
        });
        const email = clerkUser.emailAddresses[0]?.emailAddress;
        const name = clerkUser.firstName ? `${clerkUser.firstName} ${clerkUser.lastName || ""}`.trim() : clerkUser.username || email?.split("@")[0] || "learner";

        if (!existingUser) {
            const [newUser] = await db.insert(users).values({
                clerkId: userId,
                email: email,
                name: name,
                username: clerkUser.username || email?.split("@")[0],
                avatarUrl: clerkUser.imageUrl,
                points: 0,
                level: 1,
                currentStreak: 0,
                longestStreak: 0,
                lastActive: new Date(),
            })
                .returning();

            return NextResponse.json({
                success: true,
                user: newUser,
                message: "user created successfully",
            });
        } else {
            const [updatedUser] = await db.update(users).set({
                name: name,
                email: email,
                username: clerkUser.username || email?.split("@")[0],
                avatarUrl: clerkUser.imageUrl,
                updatedAt: new Date(),
            })
                .where(eq(users.clerkId, userId))
                .returning();

            return NextResponse.json({
                success: true,
                user: updatedUser,
                message: "user updated successfully",
            });

        }
    } catch (error) { 
        console.error("Error syncing user:", error);
        return NextResponse.json(
            {
                error: "failed to sync user",
            },
            { status: 500 },
        );
    }
}
