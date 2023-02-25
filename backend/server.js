const express = require('express');
const { PrismaClient } = require('@prisma/client')
const bodyParser = require('body-parser');
const bcrypt = require('bcrypt');
const secretKey = 'my_secret_key';
const swaggerUi = require('./swagger');
const jwt = require('jsonwebtoken')

// Verify JWT token middleware
function verifyToken(req, res, next) {
  const authHeader = req.headers.authorization
  if (!authHeader) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const token = authHeader.split(' ')[1]
  if (!token) {
    return res.status(401).json({ error: 'Unauthorized' })
  }


  try {
    const decoded = jwt.verify(token, secretKey)
    req.user = decoded
    next()
  } catch (err) {
    return res.status(401).json({ error: 'Unauthorized' })
  }
}
const app = express();
app.use(bodyParser.json());

const prisma = new PrismaClient()

/**
 * @swagger
 * /signup:
 *   post:
 *     summary: Create a new user
 *     description: Creates a new user with the specified name and email address
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               email:
 *                 type: string
 *               password:
 *                  type: string
 *     responses:
 *       200:
 *         description: User created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 user:
 *                   $ref: '#/components/schemas/User'
 *       400:
 *         description: Invalid request payload
 */
app.post('/signup', async (req, res) => {
  try {
    const hashedPassword = await bcrypt.hash(req.body.password, 10)
    const newUser = await prisma.user.create({
      data: {
        name: req.body.name,
        email: req.body.email,
        password: hashedPassword,
      },
    })
    res.status(200).json(newUser)
  } catch (error) {
    if (error.code === 'P2002') {
      res.status(400).json({ message: 'Email address already exists' })
    } else {
      console.log(error.message);
      res.status(500).json({ message: 'Server error' })
    }
  }
})


/**
 * @swagger
 * /login:
 *   post:
 *     summary: Logs in a user and returns a JWT token
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Login successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 token:
 *                   type: string
 *                   description: The JWT token for the authenticated user
 *       400:
 *         description: Invalid input
 *       401:
 *         description: Invalid credentials
 *       500:
 *         description: Server error
 */
app.post('/login', async (req, res) => {
  const { email, password } = req.body;

  // Check if email and password are provided
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  try {
    // Find the user with the provided email
    const user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Check if the password is correct
    const passwordMatch = await bcrypt.compare(password, user.password);

    if (!passwordMatch) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Check if the user already has a valid token
    const currentTime = new Date().getTime();
    const tokenExpiration = user.tokenExpiration?.getTime();
    const tokenIsValid = tokenExpiration && tokenExpiration > currentTime;

    if (tokenIsValid) {
      // Return the existing token
      return res.json({ token: user.token });
    } else {
      // Generate a new token and save it to the database
      const token = jwt.sign(
        { id: user.id, email: user.email },
        secretKey,
        { expiresIn: '1h' }
      );
      const expiration = new Date(currentTime + 60 * 60 * 1000);
      await prisma.user.update({
        where: { id: user.id },
        data: { token, tokenExpiration: expiration },
      });

      return res.json({ token });
    }
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Server error' });
  }
});

/**
 * @swagger
 * /users/{userId}/posts:
 *   post:
 *     summary: Create a new post for a user
 *     description: Creates a new post with the specified title and content for the user with the given ID.
 *     tags: [Posts]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         description: ID of the user to create the post for
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - title
 *               - content
 *             properties:
 *               title:
 *                 type: string
 *                 description: The title of the post
 *               content:
 *                 type: string
 *                 description: The content of the post
 *     responses:
 *       200:
 *         description: The created post
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Post'
 *       400:
 *         description: Bad request
 *       404:
 *         description: User not found
 *       500:
 *         description: Server error
 */
app.post('/users/:userId/posts', verifyToken, async (req, res) => {
  const { title, content } = req.body
  const { userId } = req.params

  try {
    // Check if user exists
    const user = await prisma.user.findUnique({ where: { id: Number(userId) } })
    if (!user) {
      return res.status(404).json({ error: 'User not found' })
    }

    // Check if the user creating the post is the same as the authenticated user
    if (req.user.id !== user.id) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    // Create the new post
    const post = await prisma.post.create({
      data: {
        title,
        content,
        author: { connect: { id: user.id } },
      },
    })

    res.json(post)
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Server error' })
  }
})

/**
 * @swagger
 * /users/{userId}/posts:
 *   get:
 *     summary: Get user's posts
 *     description: Returns an array of posts for the user with the specified ID.
 *     tags: [Posts]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         description: ID of the user whose posts to retrieve
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Array of posts
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Post'
 *       400:
 *         description: Bad request
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: User not found
 *       500:
 *         description: Server error
 */
app.get('/users/:userId/posts', verifyToken, async (req, res) => {
  const { userId } = req.params

  try {
    // Check if user exists
    const user = await prisma.user.findUnique({ where: { id: Number(userId) } })
    if (!user) {
      return res.status(404).json({ error: 'User not found' })
    }

    // Check if the user requesting the posts is the same as the authenticated user
    if (req.user.id !== user.id) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    // Retrieve the user's posts
    const posts = await prisma.post.findMany({
      where: { authorId: user.id },
    })

    res.json(posts)
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Server error' })
  }
})

swaggerUi(app);

app.listen(3000, () => {
  console.log('Server started on port 3000');
});