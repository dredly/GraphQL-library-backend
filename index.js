if (process.env.NODE_ENV !== "production") {
  require("dotenv").config();
}

const mongoose = require("mongoose");
const { ApolloServer, gql, UserInputError } = require("apollo-server");
const { v1: uuid } = require("uuid");
let { authors, books } = require("./startingData");
const Book = require("./models/book");
const Author = require("./models/author");

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

const typeDefs = gql`
  type Author {
    name: String!
    id: ID!
    born: Int
    bookCount: Int!
  }

  type Book {
    title: String!
    published: Int!
    author: Author!
    id: ID!
    genres: [String]!
  }

  type Query {
    bookCount: Int!
    authorCount: Int!
    allBooks(author: String, genre: String): [Book!]!
    allAuthors: [Author!]!
  }

  type Mutation {
    addBook(
      title: String!
      author: String!
      published: Int!
      genres: [String]!
    ): Book
    editAuthor(name: String!, setBornTo: Int!): Author
  }
`;

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
  },
  Mutation: {
    addBook: async (root, args) => {
      // See if author already exists in the database
      const foundAuthor = await Author.findOne({ name: args.author });
      const author = foundAuthor
        ? foundAuthor
        : new Author({
            name: args.author,
          });
      const book = new Book({ ...args, author: author._id.toString() });
      author.books = author.books.concat(book._id);
      try {
        await author.save();
        await book.save();
      } catch (err) {
        throw new UserInputError(err.message, {
          invalidArgs: args,
        });
      }
      return book;
    },
    editAuthor: async (root, args) => {
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
});

server.listen().then(({ url }) => {
  console.log(`Server ready at ${url}`);
});
