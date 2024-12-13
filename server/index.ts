import { PrismaClient, Exercise } from "@prisma/client";
import express from "express";
import cors from "cors";
import * as fs from "fs";

const prisma = new PrismaClient();
const app = express();
const port = 3001;

const multer = require("multer");
const upload = multer({ dest: "uploads/" });
const path = require("path");

app.use(cors());
app.use(express.json());

// Create a new user
app.post("/api/users", async (req, res) => {
  try {
    const { email, username, password, height, weight, bodyFat } = req.body;
    const newUser = await prisma.user.create({
      data: {
        email,
        username,
        password,
      },
    });
    res.status(201).json(newUser); // Return the created user
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ error: "An error occurred while creating the user." });
  }
});

import { Prisma } from "@prisma/client";

app.patch("/api/users/:username", async (req, res) => {
  try {
    const { newUsername } = req.body;
    const authUsername = req.headers["authorization"];

    if (!authUsername) {
      res.status(401).json({ error: "Authorization header is required." });
      return;
    }

    if (!newUsername) {
      res.status(400).json({ error: "New username is required." });
      return;
    }

    const user = await prisma.user.findFirst({
      where: { username: authUsername },
    });

    if (!user) {
      res.status(404).json({ error: "User not found." });
      return;
    }

    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: { username: newUsername },
    });

    res.status(200).json(updatedUser);
  } catch (error) {
    // Cast error as PrismaClientKnownRequestError
    if ((error as Prisma.PrismaClientKnownRequestError).code === "P2002") {
      res.status(400).json({ error: "Username is already in use." });
      return;
    }

    console.error("Error updating username:", error);
    res
      .status(500)
      .json({ error: "An error occurred while updating the username." });
  }
});

// List all users
app.get("/api/users", async (req, res) => {
  try {
    // Fetch all users from the database
    const users = await prisma.user.findMany();
    // Send the user list as a response
    res.status(200).json({
      success: true,
      data: users,
    });
  } catch (error) {
    console.error("Error fetching users:", error);
    // Handle errors and send a response
    res.status(500).json({
      success: false,
      message: "Failed to fetch users",
      error: (error as Error).message,
    });
  }
});

// Username and password verification for signin
app.post("/api/signin", async (req, res) => {
  try {
    const { username, password } = req.body;
    // Validate input
    if (!username || !password) {
      res.status(400).json({ message: "Username and password are required." });
    }
    // Retrieve user from the database (replace with your DB logic)
    const user = await prisma.user.findFirst({ where: { username, password } });
    if (!user) {
      res.status(401).json({ message: "Invalid username or password." });
    } else {
      res.status(200).json({
        message: "Sign-in successful!",
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
        },
      });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal server error." });
  }
});

// Get all info from a single user for profile page
app.get("/api/users/:username", async (req, res) => {
  if (!req.params.username) {
    res.status(400).json({
      message: "Username is missing",
    });
    return;
  }
  const authUsername = req.headers["authorization"];
  const authUser = await prisma.user.findFirst({
    where: { username: authUsername as string },
  });
  if (!authUser) {
    res.status(401).json({ message: "User not found." });
    return;
  }
  const { username } = req.params as any;
  try {
    const user = await prisma.user.findFirst({
      where: { username: username as string },
      include: {
        followers: {
          include: {
            follower: true, // Include follower details
          },
        },
        following: {
          include: {
            following: true, // Include following details
          },
        },
        posts: {
          include: {
            author: true,
            comments: true,
            likes: true,
            images: true,
            workouts: {
              include: {
                exercises: true, // Include exercises in the response
              },
            },
          },
          orderBy: {
            timestamp: "desc", // Order posts by timestamp in descending order
          },
        },
      },
    });
    res.status(200).json(user);
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ error: "An error occurred while fetching the user." });
  }
});

// Create a post
app.post("/api/posts", upload.array("images"), async (req, res) => {
  try {
    const { username, content, location, workouts } = req.body;

    // Validate required fields
    if (!username || !content) {
      res.status(400).json({ error: "Username and content are required." });
      return;
    }

    // Parse and validate workouts
    let myWorkout;
    try {
      myWorkout = JSON.parse(workouts); // Parse workouts from string to JSON
    } catch (error) {
      res
        .status(400)
        .json({ error: "'workouts' must be a valid JSON string." });
      return;
    }

    if (!Array.isArray(myWorkout)) {
      res.status(400).json({ error: "'workouts' must be an array." });
      return;
    }

    console.log("Parsed workouts:", myWorkout); // Log parsed workouts for debugging

    // Find the author in the database
    const author = await prisma.user.findFirst({ where: { username } });
    if (!author) {
      res.status(401).json({ error: "User not found" });
      return;
    }

    // Process uploaded files
    const files = req.files as Express.Multer.File[];
    const savedFiles = files.map((file) => {
      const extension = path.extname(file.originalname).toLowerCase();
      const filename = `${file.filename}${extension}`;
      const newPath = path.join(file.destination, filename);

      fs.renameSync(file.path, newPath); // Rename file to include extension
      return { objectPath: newPath }; // Match the Image model schema
    });

    // Create the post
    const newPost = await prisma.post.create({
      data: {
        author: { connect: { id: author.id } },
        content,
        timestamp: new Date(),
        location: location || null, // Handle optional location
        workouts: {
          create: myWorkout.map((workout) => ({
            type: workout.type,
            subtype: workout.subtype || null,
            exercises: {
              create: workout.exercises.map(
                (exercise: {
                  name: string;
                  sets: number;
                  reps: number;
                  distance: number;
                  pace: number;
                  weight: number;
                  duration: number;
                }) => ({
                  name: exercise.name,
                  sets: exercise.sets || null,
                  reps: exercise.reps || null,
                  distance: exercise.distance || null,
                  pace: exercise.pace || null,
                  weight: exercise.weight || null,
                  duration: exercise.duration || null,
                })
              ),
            },
          })),
        },
        images: {
          create: savedFiles.map((file) => ({
            objectPath: file.objectPath, // Save the file path
          })),
        },
      },
    });

    // Respond with the created post
    res.status(201).json(newPost);
  } catch (error) {
    console.error("Error creating post:", error);
    res
      .status(500)
      .json({ error: "An error occurred while creating the post." });
  } finally {
    res.end();
  }
});

// Follow a user
app.post("/api/follow/:username", async (req, res) => {
  const { username } = req.params;
  // const { followerUsername, username } = req.body;
  const authUsername = req.headers["authorization"];
  const followerUser = await prisma.user.findFirst({
    where: {
      username: authUsername,
    },
  });
  const user = await prisma.user.findFirst({
    where: {
      username: username,
    },
  });
  if (!followerUser || !user) {
    res.status(401).send("User not found");
    return;
  }
  try {
    const newFollow = await prisma.follow.create({
      data: {
        follower: {
          connect: { id: followerUser.id },
        },
        following: {
          connect: { id: user.id },
        },
      },
    });
    res.status(201).json(newFollow);
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ error: "An error ocurred while creating the follow." });
  }
});

// Unfollow a user
app.delete("/api/follow/:username", async (req, res) => {
  const { username } = req.params;
  // const { followerUsername, username } = req.body;
  const authUsername = req.headers["authorization"];
  const followerUser = await prisma.user.findFirst({
    where: {
      username: authUsername,
    },
  });
  const user = await prisma.user.findFirst({
    where: {
      username: username,
    },
  });
  if (!followerUser || !user) {
    res.status(401).send("User not found");
    return;
  }
  try {
    const follow = await prisma.follow.findFirst({
      where: {
        followerId: followerUser.id,
        followingId: user.id,
      },
    });
    if (!follow) {
      res.status(404).send("Follow not found");
      return;
    }
    await prisma.follow.delete({
      where: {
        id: follow.id,
      },
    });
    res.status(200).json({ message: "Follow deleted successfully." });
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ error: "An error ocurred while deleting the follow." });
  }
});

// Get all users that a user is following
app.get("/api/users/:username/following", async (req, res) => {
  const { username } = req.params;
  const user = await prisma.user.findUnique({
    where: {
      username,
    },
    select: {
      following: {
        select: {
          following: {
            select: {
              username: true,
            },
          },
        },
      },
    },
  });
  if (!user) {
    res.status(401).send("User not found");
    return;
  }
  try {
    const following = user.following.map(
      (followee) => followee.following.username
    );
    res.status(200).json(following);
  } catch (error) {
    console.error("Error fetching following:", error);
    res
      .status(500)
      .json({ error: "An error ocurred while fetching the followees." });
  }
});

// Get all users a user is followed by
app.get("/api/users/:username/followers", async (req, res) => {
  const { username } = req.params;
  const user = await prisma.user.findUnique({
    where: {
      username,
    },
    select: {
      followers: {
        select: {
          follower: {
            select: {
              username: true,
            },
          },
        },
      },
    },
  });
  if (!user) {
    res.status(401).send("User not found");
    return;
  }
  try {
    const followedBy = user.followers.map(
      (follower) => follower.follower.username
    );
    res.status(200).json(followedBy);
  } catch (error) {
    console.error("Error fetching followers:", error);
    res
      .status(500)
      .json({ error: "An error ocurred while fetching the followers." });
  }
});

import { Request, Response } from "express";

app.get("/api/feed", async (req: Request, res: Response) => {
  const username = req.headers["authorization"] as string;
  if (!username) {
    res.status(400).json({ error: "Authorization header is required." });
    return; // Ensure no further execution after response
  }

  try {
    const user = await prisma.user.findFirst({
      where: { username },
      include: {
        following: {
          select: {
            followingId: true, // Include only the `followingId` field
          },
        },
      },
    });

    if (!user) {
      res.status(404).json({ error: "User not found." });
      return; // Prevent further execution
    }

    const followingIds = user.following.map((follow) => follow.followingId);

    const authorIds = [...followingIds, user.id];

    const friendPosts = await prisma.post.findMany({
      where: {
        authorId: { in: authorIds }, // Use the list of `followingId`
      },
      include: {
        author: true,
        workouts: {
          include: {
            exercises: true,
          },
        },
        comments: true,
        likes: true,
        images: true,
      },
      orderBy: {
        timestamp: "desc",
      },
    });

    if (!friendPosts.length) {
      res.status(404).json({ error: "No posts found from user's friends." });
      return; // Ensure no further execution
    }

    res.status(200).json(friendPosts);
  } catch (error) {
    console.error("Error fetching posts:", error);
    res.status(500).json({ error: "An error occurred while fetching posts." });
  }
});

// Get a single post (include comments and likes)
app.get("/api/posts/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const post = await prisma.post.findUnique({
      where: { id: parseInt(id) },
      include: {
        comments: {
          include: {
            author: { select: { id: true, username: true } },
          },
        },
        likes: {
          include: {
            author: { select: { id: true, username: true } },
          },
        },
        images: true,
        workouts: {
          include: {
            exercises: true,
          },
        },
      },
    });
    res.status(200).json(post);
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ error: "An error occurred while fetching the post." });
  }
});

// Create a comment
app.post("/api/comments", async (req, res) => {
  const { content, postId, authorId } = req.body;
  try {
    const postExists = await prisma.post.findUnique({
      where: { id: postId },
    });
    if (!postExists) {
      res.status(404).json({ error: "Post not found." });
    }
    const userExists = await prisma.user.findUnique({
      where: { id: authorId },
    });
    if (!userExists) {
      res.status(404).json({ error: "User not found." });
    }
    const newComment = await prisma.comment.create({
      data: {
        content,
        timestamp: new Date(),
        post: {
          connect: { id: postId },
        },
        author: {
          connect: { id: authorId },
        },
      },
    });
    res.status(201).json(newComment);
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ error: "An error occurred while creating the comment." });
  }
});

// Delete a post
app.delete("/api/posts/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const post = await prisma.post.findUnique({
      where: { id: parseInt(id) },
    });
    await prisma.post.delete({
      where: { id: parseInt(id) },
    });
    res
      .status(200)
      .json({ message: "Post and associated data deleted successfully." });
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ error: "An error occurred while deleting the post." });
  }
});

// Delete a comment
app.delete("/api/comments/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const comment = await prisma.comment.findUnique({
      where: { id: parseInt(id) },
    });
    await prisma.comment.delete({
      where: { id: parseInt(id) },
    });
    res.status(200).json({ message: "Comment deleted successfully." });
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ error: "An error occurred while deleting the comment." });
  }
});

// Give a like on a post
app.post("/api/posts/:postId/likes", async (req, res) => {
  const { postId } = req.params;
  const { userId } = req.body; // Assuming userId is sent in the request body

  if (!userId) {
    res.status(400).json({ error: "User ID is required." });
  }

  try {
    // Verify the post exists
    const post = await prisma.post.findUnique({
      where: { id: parseInt(postId) },
    });

    if (!post) {
      res.status(404).json({ error: "Post not found." });
    }

    if (!userId) {
      res.status(404).json({ error: "User not found." });
    }
    // Create a like
    const like = await prisma.like.create({
      data: {
        timestamp: new Date(),
        post: {
          connect: { id: parseInt(postId) },
        },
        author: {
          connect: { id: parseInt(userId) },
        },
      },
    });

    res.status(201).json({ message: "Post liked successfully.", like });
  } catch (error) {
    console.error("Error liking post:", error);
    res.status(500).json({ error: "An error occurred while liking the post." });
  }
});

// Delete a like on a post
app.delete("/api/posts/:postId/likes", async (req, res) => {
  const { postId } = req.params;
  const { userId } = req.body;

  if (!userId) {
    res.status(400).json({ error: "User ID is required." });
  }

  try {
    // Verify the like exists
    const like = await prisma.like.findFirst({
      where: {
        postId: parseInt(postId),
        authorId: parseInt(userId),
      },
    });

    if (!like) {
      res.status(404).json({ error: "Like not found." });
    } else {
      // Delete the like
      await prisma.like.delete({
        where: { id: like.id },
      });

      res.status(200).json({ message: "Like removed successfully." });
    }
  } catch (error) {
    console.error("Error unliking post:", error);
    res
      .status(500)
      .json({ error: "An error occurred while unliking the post." });
  }
});

// Get the likes on a post
app.get("/api/posts/:postId/likes", async (req, res) => {
  const { postId } = req.params;
  try {
    // Verify the post exists
    const post = await prisma.post.findUnique({
      where: { id: parseInt(postId) },
    });
    if (!post) {
      res.status(404).json({ error: "Post not found." });
      return;
    }
  } catch (error) {
    console.error("Error fetching likes:", error);
    res.status(500).json({ error: "An error occurred while fetching likes." });
    return;
  }
  // Fetch the likes on the post
  const likes = await prisma.like.findMany({
    where: {
      postId: parseInt(postId),
    },
    include: {
      author: {
        select: {
          username: true, // Only return the username
        },
      },
    },
  });
  const usernames = likes.map((like) => like.author.username);

  res.status(200).json({ usernames });
});

// Get all posts for a specific user within a specific year
app.get("/api/users/:username/posts", async (req, res) => {
  const { year } = req.query;
  const { username } = req.params;

  if (!username || !year || isNaN(parseInt(year as string))) {
    res.status(400).json({ error: "A valid username and year are required." });
    return;
  }

  const startDate = new Date(`${year}-01-01T00:00:00Z`);
  const endDate = new Date(`${year}-12-31T23:59:59Z`);

  try {
    const user = await prisma.user.findFirst({
      where: { username },
    });

    if (!user) {
      res.status(404).json({ error: "User not found." });
      return;
    }

    const posts = await prisma.post.findMany({
      where: {
        authorId: user.id,
        timestamp: {
          gte: startDate,
          lte: endDate,
        },
      },
      select: {
        timestamp: true, // Only select the timestamp field
      },
    });

    // Transform and group posts by date
    // Transform and group posts by date
    const postCounts = posts.reduce<Record<string, number>>((acc, post) => {
      const date = new Date(post.timestamp).toISOString().split("T")[0]; // Format as YYYY-MM-DD
      acc[date] = (acc[date] || 0) + 1; // Increment count for the date
      return acc;
    }, {});

    // Convert the grouped data into the desired format
    const formattedPosts = Object.entries(postCounts).map(([date, count]) => ({
      date,
      count,
    }));

    res.status(200).json(formattedPosts);
  } catch (error) {
    console.error("Error fetching user posts for heatmap:", error);
    res.status(500).json({ error: "An error occurred while fetching posts." });
  }
});

app.get("/api/users/:username/workout-stats", async (req, res) => {
  const { username } = req.params;

  if (!username) {
    res.status(400).json({ error: "Username is required." });
    return;
  }

  try {
    const user = await prisma.user.findFirst({
      where: { username },
    });

    if (!user) {
      res.status(404).json({ error: "User not found." });
      return;
    }

    const workoutStats = await prisma.workout.groupBy({
      by: ["type", "subtype"],
      _count: {
        _all: true,
      },
      where: {
        post: {
          authorId: user.id, // Filter workouts by the user's posts
        },
      },
    });

    const formattedData = workoutStats.map((stat) => ({
      type: stat.type,
      subtype: stat.subtype || "Other",
      count: stat._count._all,
    }));

    res.status(200).json(formattedData);
  } catch (error) {
    console.error("Error fetching workout stats:", error);
    res
      .status(500)
      .json({ error: "An error occurred while fetching workout stats." });
  }
});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
function async(
  req: any,
  res: any
): import("express-serve-static-core").RequestHandler<
  {},
  any,
  any,
  import("qs").ParsedQs,
  Record<string, any>
> {
  throw new Error("Function not implemented.");
}
// Serve static files
app.use("/uploads", express.static(path.resolve(__dirname, "../uploads")));
