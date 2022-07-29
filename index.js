if (process.env.NODE_ENV !== "production") {
  require("dotenv").config();
}

const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const typeDefs = require("./typeDefs");
const {
  ApolloServer,
  UserInputError,
  AuthenticationError,
} = require("apollo-server");
const Book = require("./models/book");
const Author = require("./models/author");
const User = require("./models/user");

const JWT_SECRET = process.env.JWT_SECRET;

const MONGODB_URI = process.env.MONGODB_URI;
console.log("Connecting to", MONGODB_URI);

mongoose
  .connect(MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => {
    console.log("Connected to MongoDB!");
  })
  .catch((err) => {
    console.log("Error connecting to mongodb", err.message);
  });

const resolvers = {
  Query: {
    bookCount: async () => Book.collection.countDocuments(),
    authorCount: async () => Author.collection.countDocuments(),
    allBooks: async (root, args) => {
      const allBooks = await Book.find({}).populate("author");
      if (!args.author && !args.genre) {
        return allBooks;
      }
      if (args.author && !args.genre) {
        return allBooks.filter((b) => b.author.name === args.author);
      }
      if (args.genre && !args.author) {
        return allBooks.filter((b) => b.genres.includes(args.genre));
      }
      if (args.genre && args.author) {
        return allBooks
          .filter((b) => b.genres.includes(args.genre))
          .filter((b) => b.author.name === args.author);
      }
    },
    allAuthors: async () => {
      const foundAuthors = await Author.find({});
      return foundAuthors;
    },
    me: (root, args, context) => context.currentUser,
  },
  Mutation: {
    addBook: async (root, args, context) => {
      const currentUser = context.currentUser;

      if (!currentUser) {
        throw new AuthenticationError("not authenticated");
      }

      // See if author already exists in the database
      const foundAuthor = await Author.findOne({ name: args.author });
      const author = foundAuthor
        ? foundAuthor
        : new Author({
            name: args.author,
          });
      const book = new Book({ ...args, author: author._id.toString() });
      author.books = author.books.concat(book._id);
      let savedBook = null;
      try {
        await author.save();
        savedBook = await (await book.save()).populate("author");
        console.log("savedBook", savedBook);
        return savedBook;
      } catch (err) {
        throw new UserInputError(err.message, {
          invalidArgs: args,
        });
      }
    },
    editAuthor: async (root, args, context) => {
      const currentUser = context.currentUser;

      if (!currentUser) {
        throw new AuthenticationError("not authenticated");
      }

      const foundAuthor = await Author.findOne({ name: args.name });
      if (!foundAuthor) throw new UserInputError("Author not found");
      foundAuthor.born = args.setBornTo;
      try {
        await foundAuthor.save();
      } catch (err) {
        throw new UserInputError(err.message, {
          invalidArgs: args,
        });
      }
      return foundAuthor;
    },
    createUser: async (root, args) => {
      const user = new User({
        username: args.username,
        favouriteGenre: args.favouriteGenre,
      });
      return user.save().catch((err) => {
        throw new UserInputError(err.message, {
          invalidArgs: args,
        });
      });
    },
    login: async (root, args) => {
      const user = await User.findOne({ username: args.username });
      if (!user || args.password !== "secret") {
        throw new UserInputError("Wrong credentials");
      }
      const userForToken = {
        username: user.username,
        id: user._id,
      };
      return { value: jwt.sign(userForToken, JWT_SECRET) };
    },
  },
  Author: {
    bookCount: (root) => {
      return root.books.length;
    },
  },
};

const server = new ApolloServer({
  typeDefs,
  resolvers,
  context: async ({ req }) => {
    const auth = req ? req.headers.authorization : null;
    if (auth && auth.toLowerCase().startsWith("bearer ")) {
      const decodedToken = jwt.verify(auth.substring(7), JWT_SECRET);
      const currentUser = await User.findById(decodedToken.id);
      return { currentUser };
    }
  },
});

server.listen().then(({ url }) => {
  console.log(`Server ready at ${url}`);
});
