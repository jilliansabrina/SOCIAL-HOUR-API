import { PrismaClient } from "@prisma/client";
import express from "express";

const prisma = new PrismaClient();
const app = express();
const port = 3001;
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
        height: height ? parseFloat(height) : null, // Ensure Decimal fields are numbers
        weight: weight ? parseFloat(weight) : null,
        bodyFat: bodyFat ? parseFloat(bodyFat) : null,
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

// Get all info from a single user for profile page
app.get("/api/username", async (req, res) => {
  const authUserId = parseInt(req.headers["authorization"]!);
  try {
    const user = await prisma.user.findUnique({
      where: { id: authUserId },
      include: {
        posts: true,
        friendships: true,
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
app.post("/api/posts", async (req, res) => {
  const { authorId, content, workoutDuration, location, images, exercises } =
    req.body;
  try {
    const userExists = await prisma.user.findUnique({
      where: { id: authorId },
    });
    const newPost = await prisma.post.create({
      data: {
        author: {
          connect: { id: authorId },
        },
        content,
        timestamp: new Date(),
        workoutDuration: workoutDuration ? parseFloat(workoutDuration) : null,
        // location,
        images: images
          ? {
              create: images.map((img: { url: string }) => ({
                url: img.url,
              })),
            }
          : undefined,
        exercises: exercises
          ? {
              create: exercises.map(
                (exercise: { name: string; reps: number; sets: number }) => ({
                  name: exercise.name,
                  sets: exercise.sets,
                  reps: exercise.reps,
                })
              ),
            }
          : undefined,
      },
    });
    res.status(201).json(newPost);
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ error: "An error ocurred while creating the post." });
  }
});

// Get all posts from friends
app.get("/api/feed", async (req, res) => {
  const authUserId = parseInt(req.headers["authorization"]!);
  try {
    // Ensure the user exists
    const user = await prisma.user.findUnique({
      where: { id: authUserId },
    });

    if (!user) {
      res.status(404).json({ error: "User not found." });
    }

    // Fetch posts from the user's friends
    const friendPosts = await prisma.post.findMany({
      where: {
        author: {
          friendships: {
            some: {
              users: {
                some: { id: authUserId }, // Match friendships containing this user
              },
            },
          },
        },
      },
      include: {
        author: { select: { id: true, username: true } }, // Include author details
        comments: true, // Include comments
        likes: true, // Include likes
      },
    });

    if (friendPosts.length === 0) {
      res.status(404).json({ error: "No posts found from user's friends." });
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
        exercises: true,
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

// Create a friendship
app.post("/api/friendships", async (req, res) => {
  const { user1Id, user2Id } = req.body;
  try {
    const user1 = await prisma.user.findUnique({ where: { id: user1Id } });
    const user2 = await prisma.user.findUnique({ where: { id: user2Id } });

    const existingFriendship = await prisma.friendship.findFirst({
      where: {
        users: {
          every: {
            id: { in: [user1Id, user2Id] },
          },
        },
      },
    });

    const friendship = await prisma.friendship.create({
      data: {
        users: {
          connect: [{ id: user1Id }, { id: user2Id }],
        },
      },
    });
    if (!existingFriendship) {
      res
        .status(201)
        .json({ message: "Friendship created successfully.", friendship });
    } else {
      res.status(400).json({ error: "Friendship already exists." });
    }
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ error: "An error occurred while creating the friendship." });
  }
});

// Create a comment
app.post("/api/comments", async (req, res) => {
  const { content, postId, authorId } = req.body;
  try {
    const postExists = await prisma.post.findUnique({
      where: { id: postId },
    });
    const userExists = await prisma.user.findUnique({
      where: { id: authorId },
    });
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

// Delete a friendship
app.delete("/api/friendships/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const friendship = await prisma.friendship.findUnique({
      where: { id: parseInt(id) },
    });
    if (!friendship) {
      res.status(404).json({ error: "Friendship not found." });
    }
    await prisma.friendship.delete({
      where: { id: parseInt(id) },
    });

    res.status(200).json({ message: "Friendship deleted successfully." });
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ error: "An error occurred while deleting the friendship." });
  }
});

// Get all friendships from a user
app.get("/api/users/:id/friendships", async (req, res) => {
  const authUserId = parseInt(req.headers["authorization"]!);
  try {
    const user = await prisma.user.findUnique({
      where: { id: authUserId },
    });
    if (!user) {
      res.status(404).json({ error: "User not found." });
    }
    const friendships = await prisma.friendship.findMany({
      where: {
        users: {
          some: { id: authUserId },
        },
      },
      include: {
        users: {
          select: { id: true, username: true, email: true }, // Include relevant user info
        },
      },
    });
    res.status(200).json(friendships);
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ error: "An error occurred while fetching friendships." });
  }
});

// Give a like on a post
app.post("/api/posts/:postId/like", async (req, res) => {
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

    // Verify the user exists
    const user = await prisma.user.findUnique({
      where: { id: parseInt(userId) },
    });

    if (!user) {
      res.status(404).json({ error: "User not found." });
    }

    // Check if the user already liked the post
    const existingLike = await prisma.like.findFirst({
      where: {
        postId: parseInt(postId),
        authorId: parseInt(userId),
      },
    });

    if (existingLike) {
      res.status(400).json({ error: "You have already liked this post." });
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
app.delete("/api/posts/:postId/like", async (req, res) => {
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

app.get("/", (req, res) => {
  res.send("Hello World!");
});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
