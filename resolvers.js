if (process.env.NODE_ENV !== "production") {
  require("dotenv").config();
}

const { UserInputError, AuthenticationError } = require("apollo-server");
const { PubSub } = require("graphql-subscriptions");
const pubsub = new PubSub();
const jwt = require("jsonwebtoken");
const Book = require("./models/book");
const Author = require("./models/author");
const User = require("./models/user");

const JWT_SECRET = process.env.JWT_SECRET;

const resolvers = {
  Query: {
    bookCount: async () => Book.collection.countDocuments(),
    authorCount: async () => Author.collection.countDocuments(),
    allBooks: async (root, args) => {
      console.log("Book.find");
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
      console.log("Author.find");
      return foundAuthors;
    },
    allGenres: async () => {
      const allBooks = await Book.find({});
      const genres = new Set(
        allBooks.map((b) => b.genres).reduce((a, b) => a.concat(b))
      );
      return [...genres];
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

        pubsub.publish("BOOK_ADDED", { bookAdded: book });

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
  Subscription: {
    bookAdded: {
      subscribe: () => pubsub.asyncIterator(["BOOK_ADDED"]),
    },
  },
};

module.exports = resolvers;
