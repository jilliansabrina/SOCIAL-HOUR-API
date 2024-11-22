import { PrismaClient, Exercise } from "@prisma/client";
import express from "express";
import cors from "cors";

const prisma = new PrismaClient();
const app = express();
const port = 3001;

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
        posts: {
          include: {
            author: true,
          },
        },
        followers: {
          where: {
            followerId: authUser.id,
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
app.post("/api/posts", async (req, res) => {
  const { username, content, workoutDuration, location } = req.body;
  const author = await prisma.user.findFirst({
    where: {
      username,
    },
  });
  if (!author) {
    res.status(401).send("User not found");
    return;
  }
  try {
    const newPost = await prisma.post.create({
      data: {
        author: {
          connect: { id: author.id },
        },
        content,
        timestamp: new Date(),
        workoutDuration: workoutDuration ? parseFloat(workoutDuration) : null,
        location,
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

// Get all posts from friends
app.get("/api/feed", async (req, res) => {
  const username = req.headers["authorization"]!;
  try {
    // Ensure the user exists
    const user = await prisma.user.findFirst({
      where: { username },
    });

    if (!user) {
      res.status(404).json({ error: "User not found." });
    }

    // Fetch posts from the user's friends
    const friendPosts = await prisma.post.findMany({
      // where: {
      // author: {
      //   OR: [
      //     {
      //       sentRequests: {
      //         some: {
      //           id: user?.id,
      //         },
      //       },
      //     },
      //     {
      //       receivedRequests: {
      //         some: {
      //           id: user?.id,
      //         },
      //       },
      //     },
      //   ],
      // },
      // },
      include: {
        author: true,
        comments: {
          include: {
            author: true,
          },
        }, // Include comments
        likes: true, // Include likes
      },
      orderBy: {
        timestamp: "desc", // Order posts by timestamp
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

// Delete a friendship
// app.delete("/api/friendships/:id", async (req, res) => {
//   const { id } = req.params;

//   try {
//     const friendship = await prisma.friendship.findUnique({
//       where: { id: parseInt(id) },
//     });
//     if (!friendship) {
//       res.status(404).json({ error: "Friendship not found." });
//     }
//     await prisma.friendship.delete({
//       where: { id: parseInt(id) },
//     });

//     res.status(200).json({ message: "Friendship deleted successfully." });
//   } catch (error) {
//     console.error(error);
//     res
//       .status(500)
//       .json({ error: "An error occurred while deleting the friendship." });
//   }
// });

// Get all friendships from a user
// app.get("/api/users/:id/friendships", async (req, res) => {
//   const authUserId = parseInt(req.headers["authorization"]!);
//   try {
//     const user = await prisma.user.findUnique({
//       where: { id: authUserId },
//     });
//     if (!user) {
//       res.status(404).json({ error: "User not found." });
//     }
//     const friendships = await prisma.friendship.findMany({
//       where: {
//         users: {
//           some: { id: authUserId },
//         },
//       },
//       include: {
//         users: {
//           select: { id: true, username: true, email: true }, // Include relevant user info
//         },
//       },
//     });
//     res.status(200).json(friendships);
//   } catch (error) {
//     console.error(error);
//     res
//       .status(500)
//       .json({ error: "An error occurred while fetching friendships." });
//   }
// });

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
